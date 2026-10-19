"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useApp } from "./app-provider";
import { apiBase, apiRequest } from "@/lib/api";
import { coins, formatVolume, type Coin, type HistorySignal } from "@/lib/data";
import { analyzeMarket, type MarketAnalysis } from "@/lib/market-analysis";
import {
  connectMarketStream,
  loadMarket,
  type MarketCandle,
  type MarketTicker,
} from "@/lib/binance";
import {
  defaultStrategy,
  strategyVersion,
  type StrategySettings,
} from "@/lib/strategy";
import type {
  FeedEvent,
  FeedStatus,
  MarketResponse,
  ServerSettings,
  SignalResponse,
} from "@/lib/server-types";

interface MarketContextValue {
  markets: Coin[];
  candles: Record<string, MarketCandle[]>;
  analyses: Record<string, MarketAnalysis>;
  history: HistorySignal[];
  status: FeedStatus;
  lastUpdate: number | null;
  error: string | null;
  symbolErrors: Record<string, string>;
  refresh: () => void;
  activeSymbol: string;
  setActiveSymbol: (symbol: string) => void;
  strategy: StrategySettings;
  saveStrategy: (strategy: StrategySettings) => Promise<void>;
  mode: "server" | "browser";
  connected: boolean;
  telegramConfigured: boolean;
}

const Context = createContext<MarketContextValue | null>(null);
const empty: MarketResponse = {
  tickers: {},
  candles: {},
  status: "loading",
  lastUpdate: null,
  error: null,
  symbolErrors: {},
};

function mergeCandle(candles: MarketCandle[], candle: MarketCandle) {
  const map = new Map(candles.map((value) => [value.time, value]));
  const previous = map.get(candle.time);
  if (!previous?.closed || candle.closed) map.set(candle.time, candle);
  return [...map.values()].sort((a, b) => a.time - b.time).slice(-1000);
}

function mergeSnapshot(
  previous: MarketResponse,
  incoming: MarketResponse,
  requestedAt: number,
  candleTimes: Record<string, number>,
  statusAt: number,
): MarketResponse {
  const tickers = { ...previous.tickers, ...incoming.tickers };
  for (const [symbol, ticker] of Object.entries(previous.tickers)) {
    if (ticker.eventTime > (incoming.tickers[symbol]?.eventTime ?? 0))
      tickers[symbol] = ticker;
  }
  const candles = { ...previous.candles, ...incoming.candles };
  for (const [symbol, current] of Object.entries(previous.candles)) {
    const values = new Map(
      (incoming.candles[symbol] ?? []).map((candle) => [candle.time, candle]),
    );
    for (const candle of current) {
      const received = values.get(candle.time);
      if (
        !received ||
        (candle.closed && !received.closed) ||
        (candleTimes[symbol] ?? 0) >= requestedAt
      )
        values.set(candle.time, candle);
    }
    candles[symbol] = [...values.values()]
      .sort((a, b) => a.time - b.time)
      .slice(-1000);
  }
  return {
    ...incoming,
    tickers,
    candles,
    lastUpdate:
      Math.max(previous.lastUpdate ?? 0, incoming.lastUpdate ?? 0) || null,
    ...(statusAt >= requestedAt
      ? { status: previous.status, error: previous.error }
      : {}),
  };
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const { timeframe, watchlist, alerts, setWatchlist, setAlerts, toast } =
    useApp();
  const [data, setData] = useState<MarketResponse>(empty);
  const [history, setHistory] = useState<HistorySignal[]>([]);
  const [strategy, setStrategy] = useState<StrategySettings>(defaultStrategy);
  const [activeSymbol, setActiveSymbol] = useState("BTC");
  const [revision, setRevision] = useState(0);
  const [mode, setMode] = useState<"server" | "browser">("server");
  const [connected, setConnected] = useState(false);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const savedPreferences = useRef<string | null>(null);
  const lastReceived = useRef(0);
  const failures = useRef(0);
  const settingsRevision = useRef(-1);
  const pendingPreferences = useRef<string | null>(null);
  const writingPreferences = useRef(false);
  const analysisCache = useRef(
    new Map<
      string,
      {
        candles: MarketCandle[];
        timeframe: string;
        version: string;
        analysis: MarketAnalysis;
      }
    >(),
  );

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let source: EventSource | null = null;
    let stopStream: (() => void) | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let historyRequest = 0;
    let snapshotRequest = 0;
    let statusAt = 0;
    let browserStreamLive = false;
    const candleTimes: Record<string, number> = {};
    setData((previous) => ({
      ...previous,
      candles: {},
      status: "loading",
      error: null,
      symbolErrors: {},
    }));

    const readHistory = async () => {
      const request = ++historyRequest;
      const response = await apiRequest<SignalResponse>("/signals?limit=5000", {
        signal: controller.signal,
      });
      if (!disposed && request === historyRequest) setHistory(response.signals);
    };
    const readSnapshot = async () => {
      const request = ++snapshotRequest;
      const requestedAt = Date.now();
      const response = await apiRequest<MarketResponse>(
        `/market?timeframe=${timeframe}`,
        { signal: controller.signal },
      );
      if (!disposed && request === snapshotRequest) {
        setData((previous) =>
          mergeSnapshot(previous, response, requestedAt, candleTimes, statusAt),
        );
        lastReceived.current = Date.now();
      }
    };
    const applyTicker = (ticker: MarketTicker) => {
      if (disposed) return;
      lastReceived.current = Date.now();
      setData((previous) => {
        if (
          (previous.tickers[ticker.symbol]?.eventTime ?? 0) > ticker.eventTime
        )
          return previous;
        return {
          ...previous,
          tickers: { ...previous.tickers, [ticker.symbol]: ticker },
          lastUpdate: Math.max(previous.lastUpdate ?? 0, ticker.eventTime),
        };
      });
    };
    const applyCandle = (symbol: string, candle: MarketCandle) => {
      if (disposed) return;
      lastReceived.current = Date.now();
      candleTimes[symbol] = Date.now();
      setData((previous) => ({
        ...previous,
        candles: {
          ...previous.candles,
          [symbol]: mergeCandle(previous.candles[symbol] ?? [], candle),
        },
      }));
    };
    const startBrowser = async () => {
      setMode("browser");
      setConnected(false);
      setTelegramConfigured(false);
      savedPreferences.current = null;
      const symbols = [...new Set([...watchlist, activeSymbol])].filter(
        (symbol) => coins.some((coin) => coin.symbol === symbol),
      );
      const sync = async () => {
        const request = ++snapshotRequest;
        const requestedAt = Date.now();
        const snapshot = await loadMarket(
          symbols,
          timeframe,
          controller.signal,
        );
        if (!disposed && request === snapshotRequest)
          setData((previous) =>
            mergeSnapshot(
              previous,
              {
                ...snapshot,
                status: browserStreamLive ? "live" : "rest",
                lastUpdate: snapshot.receivedAt,
                error: Object.keys(snapshot.symbolErrors).length
                  ? "Some assets could not be synchronized. Retrying automatically."
                  : null,
              },
              requestedAt,
              candleTimes,
              statusAt,
            ),
          );
      };
      await sync();
      stopStream = connectMarketStream({
        symbols,
        timeframe,
        onTicker: applyTicker,
        onCandle: applyCandle,
        onStatus: (status) => {
          browserStreamLive = status === "live";
          statusAt = Date.now();
          if (!disposed)
            setData((previous) => ({
              ...previous,
              status:
                status === "live"
                  ? "live"
                  : status === "connecting"
                    ? "loading"
                    : "reconnecting",
            }));
        },
        onResync: () => {
          void sync().catch(() => {
            if (!disposed)
              setData((previous) => ({
                ...previous,
                error:
                  "Binance synchronization failed. Retrying the connection.",
              }));
          });
        },
      });
      interval = setInterval(() => {
        void sync().catch(() => {
          if (!disposed)
            setData((previous) => ({
              ...previous,
              status: "reconnecting",
              error: "Binance is unreachable. Last values are stale.",
            }));
        });
      }, 60000);
    };
    const start = async () => {
      try {
        const preview =
          !apiBase && window.location.hostname.endsWith(".chatgpt.site");
        if (preview) {
          await startBrowser();
          return;
        }
        const health = await apiRequest<{ telegramConfigured: boolean }>(
          "/health",
          { signal: controller.signal },
        );
        const settings = await apiRequest<ServerSettings>("/settings", {
          signal: controller.signal,
        });
        if (disposed) return;
        failures.current = 0;
        setMode("server");
        setConnected(true);
        setTelegramConfigured(health.telegramConfigured);
        if ((settings.revision ?? 0) >= settingsRevision.current) {
          setStrategy(settings.strategy);
          settingsRevision.current = settings.revision ?? 0;
          const preferences = JSON.stringify({
            watchlist: settings.watchlist,
            alerts: settings.alerts,
          });
          savedPreferences.current = preferences;
          if (
            !pendingPreferences.current ||
            pendingPreferences.current === preferences
          ) {
            pendingPreferences.current = null;
            setWatchlist(settings.watchlist);
            setAlerts(settings.alerts);
          }
        }
        await Promise.all([readSnapshot(), readHistory()]);
        if (disposed) return;
        source = new EventSource(`${apiBase}/api/events`, {
          withCredentials: true,
        });
        source.onmessage = (event) => {
          if (disposed) return;
          try {
            const message = JSON.parse(event.data) as FeedEvent;
            if (message.type === "ticker") applyTicker(message.ticker);
            if (message.type === "candle" && message.timeframe === timeframe)
              applyCandle(message.symbol, message.candle);
            if (message.type === "status" && message.timeframe === timeframe) {
              statusAt = Date.now();
              setData((previous) => ({
                ...previous,
                status: message.status,
                error: message.error,
              }));
              if (message.status === "rest" || message.status === "live")
                void readSnapshot().catch(() => undefined);
            }
            if (message.type === "history")
              void readHistory().catch(() => undefined);
            if (message.type === "settings") {
              const revision = message.settings.revision ?? 0;
              if (revision < settingsRevision.current) return;
              settingsRevision.current = revision;
              setStrategy(message.settings.strategy);
              const next = JSON.stringify({
                watchlist: message.settings.watchlist,
                alerts: message.settings.alerts,
              });
              savedPreferences.current = next;
              if (
                !pendingPreferences.current ||
                pendingPreferences.current === next
              ) {
                pendingPreferences.current = null;
                setWatchlist(message.settings.watchlist);
                setAlerts(message.settings.alerts);
              }
            }
          } catch {
            setData((previous) => ({
              ...previous,
              error: "Received an invalid market update. Refresh to reconnect.",
            }));
          }
        };
        source.onopen = () => {
          void Promise.all([readSnapshot(), readHistory()]).catch(
            () => undefined,
          );
        };
        source.onerror = () => {
          statusAt = Date.now();
          if (!disposed)
            setData((previous) => ({
              ...previous,
              status: "reconnecting",
              error:
                "Market connection interrupted. Reconnecting automatically.",
            }));
        };
        interval = setInterval(() => {
          if (Date.now() - lastReceived.current > 45000) {
            statusAt = Date.now();
            setData((previous) => ({
              ...previous,
              status: "reconnecting",
              error: "Waiting for fresh market data. Last values may be stale.",
            }));
            void Promise.all([readSnapshot(), readHistory()]).catch(
              () => undefined,
            );
          }
        }, 15000);
      } catch (error) {
        if (!disposed && !controller.signal.aborted) {
          setConnected(false);
          setData((previous) => ({
            ...previous,
            status: "offline",
            error:
              error instanceof Error
                ? error.message
                : "Backend connection failed. Start the server with npm run dev.",
          }));
          retryTimer = setTimeout(
            () => setRevision((value) => value + 1),
            Math.min(30000, 2000 * 2 ** Math.min(failures.current++, 4)),
          );
        }
      }
    };
    void start();
    return () => {
      disposed = true;
      controller.abort();
      source?.close();
      stopStream?.();
      if (interval) clearInterval(interval);
      if (retryTimer) clearTimeout(retryTimer);
    };
    // Watchlist changes are synced separately; the server monitors the catalog in all timeframes.
  }, [
    timeframe,
    revision,
    mode === "browser" ? watchlist.join(",") : "",
    mode === "browser" ? activeSymbol : "",
  ]);

  useEffect(() => {
    if (!connected || mode !== "server" || savedPreferences.current === null)
      return;
    const next = JSON.stringify({ watchlist, alerts });
    if (next === savedPreferences.current && !writingPreferences.current)
      return;
    pendingPreferences.current = next;
    if (writingPreferences.current) return;
    writingPreferences.current = true;
    void (async () => {
      while (pendingPreferences.current) {
        const desired = pendingPreferences.current;
        const value = await apiRequest<ServerSettings>("/settings", {
          method: "PUT",
          body: desired,
          keepalive: true,
        });
        if ((value.revision ?? 0) >= settingsRevision.current) {
          settingsRevision.current = value.revision ?? 0;
          savedPreferences.current = JSON.stringify({
            watchlist: value.watchlist,
            alerts: value.alerts,
          });
        }
        if (pendingPreferences.current === desired)
          pendingPreferences.current = null;
      }
    })()
      .catch(() => {
        pendingPreferences.current = null;
        toast(
          "Could not save preferences to MongoDB. Reconnect and try again.",
        );
      })
      .finally(() => {
        writingPreferences.current = false;
      });
  }, [watchlist, alerts, connected, mode, toast]);

  const analyses = useMemo(() => {
    const version = strategyVersion(strategy);
    return Object.fromEntries(
      Object.entries(data.candles).map(([symbol, candles]) => {
        const cached = analysisCache.current.get(symbol);
        if (
          cached?.candles === candles &&
          cached.timeframe === timeframe &&
          cached.version === version
        )
          return [symbol, cached.analysis];
        const analysis = analyzeMarket(symbol, timeframe, candles, strategy);
        analysisCache.current.set(symbol, {
          candles,
          timeframe,
          version,
          analysis,
        });
        return [symbol, analysis];
      }),
    );
  }, [data.candles, timeframe, strategy]);
  const markets = useMemo(
    () =>
      coins.map((coin) => {
        const ticker = data.tickers[coin.symbol];
        const analysis = analyses[coin.symbol];
        const lastSignal = analysis?.history[analysis.history.length - 1];
        return {
          ...coin,
          price: ticker?.price ?? null,
          change: ticker?.change ?? null,
          high: ticker?.high ?? null,
          low: ticker?.low ?? null,
          volume: formatVolume(ticker?.volume),
          signal: analysis?.signal ?? null,
          reason: analysis?.reason ?? "Loading closed candles…",
          lastSignal: lastSignal?.time ?? null,
          sparkline: (data.candles[coin.symbol] ?? [])
            .slice(-28)
            .map((candle) => candle.close),
        };
      }),
    [data.tickers, data.candles, analyses],
  );
  const browserHistory = useMemo(
    () =>
      Object.values(analyses)
        .flatMap((analysis) => analysis.history)
        .sort((a, b) => b.time.localeCompare(a.time)),
    [analyses],
  );
  const saveStrategy = useCallback(
    async (value: StrategySettings) => {
      if (mode === "browser")
        throw new Error(
          "Strategy changes require your MongoDB backend. Run npm run dev locally.",
        );
      const result = await apiRequest<ServerSettings>("/settings", {
        method: "PUT",
        body: JSON.stringify({ strategy: value }),
      });
      setStrategy(result.strategy);
      refresh();
    },
    [mode, refresh],
  );
  return (
    <Context.Provider
      value={{
        markets,
        candles: data.candles,
        analyses,
        history: mode === "browser" ? browserHistory : history,
        status: data.status,
        lastUpdate: data.lastUpdate,
        error: data.error,
        symbolErrors: data.symbolErrors,
        refresh,
        activeSymbol,
        setActiveSymbol,
        strategy,
        saveStrategy,
        mode,
        connected,
        telegramConfigured,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useMarket() {
  const value = useContext(Context);
  if (!value) throw new Error("useMarket requires MarketProvider");
  return value;
}
