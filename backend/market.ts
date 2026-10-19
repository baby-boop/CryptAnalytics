import { EventEmitter } from "node:events";
import type { Db } from "mongodb";
import { coins, timeframes, type Timeframe } from "../lib/data";
import {
  connectMarketStream,
  loadMarket,
  type MarketCandle,
  type MarketTicker,
} from "../lib/binance";
import { analyzeMarket } from "../lib/market-analysis";
import type {
  FeedEvent,
  FeedStatus,
  MarketResponse,
  ServerSettings,
} from "../lib/server-types";
import { evaluatePending, saveCandles, saveSignals } from "./db";
import type { createTelegram } from "./notifications";

const empty = (): MarketResponse => ({
  tickers: {},
  candles: {},
  status: "loading",
  lastUpdate: null,
  error: null,
  symbolErrors: {},
});

export function createMarketEngine(
  db: Db,
  getSettings: () => ServerSettings,
  telegram: ReturnType<typeof createTelegram>,
) {
  const events = new EventEmitter();
  events.setMaxListeners(100);
  const states: Record<Timeframe, MarketResponse> = {
    "15m": empty(),
    "1h": empty(),
    "4h": empty(),
    "1d": empty(),
  };
  const tickers: Record<string, MarketTicker> = {};
  const controller = new AbortController();
  const stops: (() => void)[] = [];
  const queues = new Map<string, Promise<void>>();
  const syncing = new Set<Timeframe>();
  const streamReady = new Set<Timeframe>();
  const candleUpdatedAt = new Map<string, number>();
  const symbols = coins.map((coin) => coin.symbol);
  const startedAt = Date.now();
  const initialized = new Set<Timeframe>();
  let historyTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function emit(event: FeedEvent) {
    if (!stopped) events.emit("update", event);
  }
  function status(
    timeframe: Timeframe,
    value: FeedStatus,
    error: string | null = null,
  ) {
    states[timeframe].status = value;
    states[timeframe].error = error;
    emit({ type: "status", timeframe, status: value, error });
  }
  function changedHistory() {
    if (historyTimer) return;
    historyTimer = setTimeout(() => {
      historyTimer = null;
      emit({ type: "history" });
    }, 700);
  }
  function rememberTicker(ticker: MarketTicker) {
    if ((tickers[ticker.symbol]?.eventTime ?? 0) > ticker.eventTime) return;
    tickers[ticker.symbol] = ticker;
    for (const timeframe of timeframes)
      states[timeframe].lastUpdate = ticker.eventTime;
    emit({ type: "ticker", ticker });
  }
  function store(
    symbol: string,
    timeframe: Timeframe,
    liveCandle?: MarketCandle,
    liveCloseTimes?: Set<number>,
  ) {
    const key = `${symbol}:${timeframe}`;
    const dataset = [...(states[timeframe].candles[symbol] ?? [])];
    const strategy = structuredClone(getSettings().strategy);
    const operation = (queues.get(key) ?? Promise.resolve())
      .then(async () => {
        if (stopped) return;
        const analysis = analyzeMarket(symbol, timeframe, dataset, strategy);
        await saveCandles(
          db,
          symbol,
          timeframe,
          liveCandle ? [liveCandle] : dataset,
        );
        const rows = analysis.history.map((signal) => ({
          ...signal,
          source:
            (liveCandle &&
              liveCandle.closeTime >= startedAt &&
              Date.parse(signal.time) === liveCandle.closeTime) ||
            liveCloseTimes?.has(Date.parse(signal.time))
              ? ("live" as const)
              : ("backfill" as const),
        }));
        const inserted = await saveSignals(db, rows);
        await evaluatePending(db, symbol, timeframe, dataset);
        changedHistory();
        const settings = getSettings();
        for (const signal of inserted) {
          if (
            signal.source !== "live" ||
            !settings.notifications.enabled ||
            !settings.alerts.includes(symbol) ||
            !settings.watchlist.includes(symbol)
          )
            continue;
          if (
            signal.signal === "BUY"
              ? !settings.notifications.buy
              : !settings.notifications.sell
          )
            continue;
          void telegram
            .sendSignal(signal, settings.notifications.includeChart)
            .catch(() => {
              /* Delivery status is retained without logging a token-bearing URL. */
            });
        }
      })
      .catch(() => {
        status(
          timeframe,
          streamReady.has(timeframe) ? "live" : "rest",
          "Market data is available, but MongoDB persistence failed. Check backend database access.",
        );
      });
    queues.set(key, operation);
    void operation.finally(() => {
      if (queues.get(key) === operation) queues.delete(key);
    });
  }
  function rememberCandle(
    symbol: string,
    timeframe: Timeframe,
    candle: MarketCandle,
  ) {
    const current = states[timeframe].candles[symbol] ?? [];
    const map = new Map(current.map((value) => [value.time, value]));
    const previous = map.get(candle.time);
    if (previous?.closed && !candle.closed) return;
    map.set(candle.time, candle);
    candleUpdatedAt.set(`${symbol}:${timeframe}`, Date.now());
    states[timeframe].candles[symbol] = [...map.values()]
      .sort((a, b) => a.time - b.time)
      .slice(-1000);
    emit({ type: "candle", symbol, timeframe, candle });
    if (candle.closed && !previous?.closed) store(symbol, timeframe, candle);
  }
  async function sync(timeframe: Timeframe) {
    if (syncing.has(timeframe) || stopped) return;
    syncing.add(timeframe);
    const requestedAt = Date.now();
    try {
      const snapshot = await loadMarket(symbols, timeframe, controller.signal);
      if (stopped) return;
      for (const ticker of Object.values(snapshot.tickers))
        rememberTicker(ticker);
      for (const [symbol, received] of Object.entries(snapshot.candles)) {
        const previousClosed = new Set(
          (states[timeframe].candles[symbol] ?? [])
            .filter((candle) => candle.closed)
            .map((candle) => candle.closeTime),
        );
        const liveCloses = initialized.has(timeframe)
          ? new Set(
              received
                .filter(
                  (candle) =>
                    candle.closed &&
                    candle.closeTime >= startedAt &&
                    !previousClosed.has(candle.closeTime),
                )
                .map((candle) => candle.closeTime),
            )
          : undefined;
        const merged = new Map(received.map((candle) => [candle.time, candle]));
        for (const current of states[timeframe].candles[symbol] ?? []) {
          const old = merged.get(current.time);
          if (
            !old ||
            (current.closed && !old.closed) ||
            ((candleUpdatedAt.get(`${symbol}:${timeframe}`) ?? 0) >
              requestedAt &&
              current.time >= received[received.length - 1]?.time)
          )
            merged.set(current.time, current);
        }
        states[timeframe].candles[symbol] = [...merged.values()]
          .sort((a, b) => a.time - b.time)
          .slice(-1000);
        store(symbol, timeframe, undefined, liveCloses);
      }
      states[timeframe].symbolErrors = snapshot.symbolErrors;
      states[timeframe].lastUpdate = snapshot.receivedAt;
      initialized.add(timeframe);
      status(
        timeframe,
        streamReady.has(timeframe) ? "live" : "rest",
        Object.keys(snapshot.symbolErrors).length
          ? "Some assets could not be synchronized. Retrying automatically."
          : null,
      );
    } catch {
      if (!stopped && !controller.signal.aborted)
        status(
          timeframe,
          "offline",
          "Binance market synchronization failed. Retrying automatically.",
        );
    } finally {
      syncing.delete(timeframe);
    }
  }
  async function start() {
    await Promise.all(
      timeframes.map(async (timeframe) => {
        await sync(timeframe);
        if (stopped) return;
        stops.push(
          connectMarketStream({
            symbols,
            timeframe,
            includeTickers: timeframe === "15m",
            onTicker: rememberTicker,
            onCandle: (symbol, candle) =>
              rememberCandle(symbol, timeframe, candle),
            onStatus: (value) => {
              if (value === "live") streamReady.add(timeframe);
              else streamReady.delete(timeframe);
              status(
                timeframe,
                value === "live"
                  ? "live"
                  : value === "connecting"
                    ? "loading"
                    : "reconnecting",
                value === "live"
                  ? null
                  : "Binance stream is reconnecting. REST snapshots remain available.",
              );
            },
            onResync: () => {
              void sync(timeframe);
            },
          }),
        );
      }),
    );
  }
  const timer = setInterval(() => {
    for (const timeframe of timeframes) void sync(timeframe);
  }, 60000);
  return {
    start,
    snapshot: (timeframe: Timeframe): MarketResponse => ({
      ...states[timeframe],
      tickers,
    }),
    subscribe: (listener: (event: FeedEvent) => void) => {
      events.on("update", listener);
      return () => {
        events.off("update", listener);
      };
    },
    refresh: () => {
      for (const timeframe of timeframes) void sync(timeframe);
    },
    settingsChanged: (settings: ServerSettings, reanalyze = true) => {
      emit({ type: "settings", settings });
      if (reanalyze)
        for (const timeframe of timeframes)
          for (const symbol of symbols) store(symbol, timeframe);
    },
    close: async () => {
      stopped = true;
      controller.abort();
      clearInterval(timer);
      if (historyTimer) clearTimeout(historyTimer);
      stops.forEach((stop) => stop());
      await Promise.allSettled([...queues.values()]);
      events.removeAllListeners();
    },
  };
}
