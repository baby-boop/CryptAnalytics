import type { CandlestickData, UTCTimestamp } from "lightweight-charts";
import type { Timeframe } from "./data";

export interface MarketCandle extends CandlestickData<UTCTimestamp> {
  volume: number;
  closeTime: number;
  closed: boolean;
}

export interface MarketTicker {
  symbol: string;
  price: number;
  change: number;
  high: number;
  low: number;
  /** Rolling 24-hour quote volume, in USDT. */
  volume: number;
  eventTime: number;
}

export interface MarketSnapshot {
  tickers: Record<string, MarketTicker>;
  candles: Record<string, MarketCandle[]>;
  symbolErrors: Record<string, string>;
  serverTime: number;
  receivedAt: number;
}

export const timeframeSeconds: Record<Timeframe, number> = {
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};
const restBase = "https://data-api.binance.vision/api/v3";
const streamBase = "wss://data-stream.binance.vision:443/stream?streams=";
let restCooldownUntil = 0;

export class BinanceError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs = 0,
  ) {
    super(message);
    this.name = "BinanceError";
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BinanceError("Binance returned an invalid object.");
  return value as Record<string, unknown>;
}

function finite(value: unknown): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    value === "" ||
    (typeof value === "string" && value.trim() === "")
  )
    throw new BinanceError("Binance returned an invalid number.");
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new BinanceError("Binance returned a non-finite number.");
  return parsed;
}

function timestamp(value: unknown): number {
  const parsed = finite(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new BinanceError("Binance returned an invalid timestamp.");
  return parsed;
}

function selectedSymbols(symbols: string[]): string[] {
  const result = [...new Set(symbols)];
  if (
    !result.length ||
    result.some((symbol) => !/^[A-Z0-9]{2,12}$/.test(symbol))
  )
    throw new BinanceError("Select valid base-asset symbols, for example BTC.");
  if (result.length > 20)
    throw new BinanceError("A market feed supports up to 20 selected symbols.");
  return result;
}

async function request(path: string, signal: AbortSignal): Promise<unknown> {
  signal.throwIfAborted();
  if (Date.now() < restCooldownUntil)
    throw new BinanceError(
      "Binance rate limit cooling down. Retrying later.",
      restCooldownUntil - Date.now(),
    );
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new BinanceError("Binance request timed out.")),
    15000,
  );
  try {
    const response = await fetch(`${restBase}${path}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const seconds = Number(response.headers.get("Retry-After"));
      const retryAfterMs =
        response.status === 429 || response.status === 418
          ? Math.max(60000, Number.isFinite(seconds) ? seconds * 1000 : 60000)
          : 0;
      if (retryAfterMs) restCooldownUntil = Date.now() + retryAfterMs;
      throw new BinanceError(
        `Binance market data unavailable (HTTP ${response.status}).${retryAfterMs ? " Waiting before retrying." : ""}`,
        retryAfterMs,
      );
    }
    return (await response.json()) as unknown;
  } catch (error) {
    if (signal.aborted) throw signal.reason ?? error;
    if (controller.signal.aborted)
      throw new BinanceError(
        "Binance request timed out. Check your connection.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}

export function parseMarketCandle(
  value: unknown,
  timeframe: Timeframe,
  serverTime: number,
): MarketCandle {
  if (!Array.isArray(value) || value.length < 7)
    throw new BinanceError("Binance returned an invalid candle.");
  const openTime = timestamp(value[0]);
  const candle: MarketCandle = {
    time: (openTime / 1000) as UTCTimestamp,
    open: finite(value[1]),
    high: finite(value[2]),
    low: finite(value[3]),
    close: finite(value[4]),
    volume: finite(value[5]),
    closeTime: timestamp(value[6]),
    closed: false,
  };
  validateCandle(candle, timeframe);
  candle.closed = candle.closeTime < serverTime;
  return candle;
}

function validateCandle(candle: MarketCandle, timeframe: Timeframe): void {
  const step = timeframeSeconds[timeframe] * 1000;
  if (
    ![candle.open, candle.high, candle.low, candle.close].every(
      (value) => Number.isFinite(value) && value > 0,
    ) ||
    !Number.isFinite(candle.volume) ||
    candle.volume < 0 ||
    candle.high < Math.max(candle.open, candle.close) ||
    candle.low > Math.min(candle.open, candle.close) ||
    candle.closeTime !== Number(candle.time) * 1000 + step - 1 ||
    (Number(candle.time) * 1000) % step !== 0
  )
    throw new BinanceError("Binance returned malformed OHLCV data.");
}

export function parseMarketTicker(
  value: unknown,
  stream = false,
): MarketTicker {
  const record = object(value);
  const pair = record[stream ? "s" : "symbol"];
  if (typeof pair !== "string" || !pair.endsWith("USDT"))
    throw new BinanceError("Binance returned an invalid USDT ticker.");
  const ticker: MarketTicker = {
    symbol: pair.slice(0, -4),
    price: finite(record[stream ? "c" : "lastPrice"]),
    change: finite(record[stream ? "P" : "priceChangePercent"]),
    high: finite(record[stream ? "h" : "highPrice"]),
    low: finite(record[stream ? "l" : "lowPrice"]),
    volume: finite(record[stream ? "q" : "quoteVolume"]),
    eventTime: timestamp(record[stream ? "E" : "closeTime"]),
  };
  if (
    ticker.price <= 0 ||
    ticker.low <= 0 ||
    ticker.high < ticker.low ||
    ticker.volume < 0
  )
    throw new BinanceError(
      "Binance returned an invalid ticker price or volume.",
    );
  return ticker;
}

export async function loadMarket(
  symbols: string[],
  timeframe: Timeframe,
  signal: AbortSignal,
): Promise<MarketSnapshot> {
  const selected = selectedSymbols(symbols);
  if (!(timeframe in timeframeSeconds))
    throw new BinanceError("Unsupported candle timeframe.");
  // Capture exchange time before fetching candles. A candle fetched during a boundary
  // remains conservatively open until an explicit close event or the next snapshot.
  const serverTime = timestamp(
    object(await request("/time", signal)).serverTime,
  );
  const snapshot: MarketSnapshot = {
    tickers: {},
    candles: {},
    symbolErrors: {},
    serverTime,
    receivedAt: Date.now(),
  };
  const readTickers = async () => {
    try {
      const query = new URLSearchParams({
        symbols: JSON.stringify(selected.map((symbol) => `${symbol}USDT`)),
      });
      const values = await request(`/ticker/24hr?${query}`, signal);
      if (!Array.isArray(values))
        throw new BinanceError("Binance returned invalid ticker data.");
      for (const value of values) {
        const ticker = parseMarketTicker(value);
        if (selected.includes(ticker.symbol))
          snapshot.tickers[ticker.symbol] = ticker;
      }
      for (const symbol of selected)
        if (!snapshot.tickers[symbol])
          snapshot.symbolErrors[symbol] =
            "No Binance ticker is available for this symbol.";
    } catch (error) {
      if (signal.aborted) throw error;
      snapshot.symbolErrors._tickers =
        error instanceof Error
          ? error.message
          : "Could not load Binance tickers.";
    }
  };
  let cursor = 0;
  const worker = async () => {
    while (cursor < selected.length) {
      const symbol = selected[cursor++];
      try {
        const query = new URLSearchParams({
          symbol: `${symbol}USDT`,
          interval: timeframe,
          limit: "1000",
        });
        const values = await request(`/klines?${query}`, signal);
        if (!Array.isArray(values) || !values.length)
          throw new BinanceError(
            "No Binance candles are available for this symbol.",
          );
        const candles = values.map((value) =>
          parseMarketCandle(value, timeframe, serverTime),
        );
        for (let index = 1; index < candles.length; index++) {
          if (
            Number(candles[index].time) - Number(candles[index - 1].time) !==
            timeframeSeconds[timeframe]
          )
            throw new BinanceError(
              "Binance candle history is incomplete. Waiting for a fresh snapshot.",
            );
        }
        snapshot.candles[symbol] = candles;
      } catch (error) {
        if (signal.aborted) throw error;
        snapshot.symbolErrors[symbol] =
          error instanceof Error
            ? error.message
            : "Could not load Binance candles.";
      }
    }
  };
  await Promise.all([
    readTickers(),
    ...Array.from({ length: Math.min(3, selected.length) }, () => worker()),
  ]);
  signal.throwIfAborted();
  if (
    !Object.keys(snapshot.candles).length &&
    !Object.keys(snapshot.tickers).length
  )
    throw new BinanceError(
      Object.values(snapshot.symbolErrors)[0] ?? "Binance is unreachable.",
    );
  snapshot.receivedAt = Date.now();
  return snapshot;
}

interface MarketStreamOptions {
  symbols: string[];
  timeframe: Timeframe;
  includeTickers?: boolean;
  onTicker: (ticker: MarketTicker) => void;
  onCandle: (symbol: string, candle: MarketCandle) => void;
  onStatus: (status: "connecting" | "live" | "reconnecting" | "stale") => void;
  onResync: () => void;
}

export function connectMarketStream(options: MarketStreamOptions): () => void {
  const selected = selectedSymbols(options.symbols);
  const streams = selected.flatMap((symbol) => [
    `${symbol.toLowerCase()}usdt@kline_${options.timeframe}`,
    ...(options.includeTickers === false
      ? []
      : [`${symbol.toLowerCase()}usdt@ticker`]),
  ]);
  let socket: WebSocket | null = null;
  let disposed = false;
  let attempts = 0;
  let connectedBefore = false;
  let lastReceived = Date.now();
  let lastResync = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const lastCandles = new Map<string, number>();
  let status: Parameters<MarketStreamOptions["onStatus"]>[0] | null = null;
  const setStatus = (next: NonNullable<typeof status>) => {
    if (!disposed && next !== status) {
      status = next;
      options.onStatus(next);
    }
  };
  const resync = () => {
    if (!disposed && Date.now() - lastResync > 10000) {
      lastResync = Date.now();
      options.onResync();
    }
  };
  const schedule = () => {
    if (disposed || reconnectTimer) return;
    setStatus("reconnecting");
    const delay =
      Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)) +
      Math.floor(Math.random() * 500);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      open();
    }, delay);
  };
  const open = () => {
    if (disposed) return;
    setStatus(connectedBefore ? "reconnecting" : "connecting");
    lastReceived = Date.now();
    try {
      socket = new WebSocket(`${streamBase}${streams.join("/")}`);
    } catch {
      schedule();
      return;
    }
    const current = socket;
    current.onopen = () => {
      if (disposed || socket !== current) return;
      if (connectedBefore) resync();
      connectedBefore = true;
      lastReceived = Date.now();
    };
    current.onmessage = (event) => {
      if (disposed || socket !== current || typeof event.data !== "string")
        return;
      let symbol: string;
      let candle: MarketCandle | null = null;
      let ticker: MarketTicker | null = null;
      try {
        const envelope = object(JSON.parse(event.data) as unknown);
        const record = object(envelope.data);
        const pair = record.s;
        if (typeof pair !== "string" || !pair.endsWith("USDT")) return;
        symbol = pair.slice(0, -4);
        if (!selected.includes(symbol)) return;
        if (record.e === "24hrTicker" && options.includeTickers !== false)
          ticker = parseMarketTicker(record, true);
        else if (record.e === "kline") {
          const data = object(record.k);
          if (
            data.i !== options.timeframe ||
            data.s !== pair ||
            typeof data.x !== "boolean"
          )
            return;
          candle = parseMarketCandle(
            [data.t, data.o, data.h, data.l, data.c, data.v, data.T],
            options.timeframe,
            0,
          );
          const eventTime = timestamp(record.E);
          if (data.x && candle.closeTime > eventTime)
            throw new BinanceError(
              "Binance candle close precedes its scheduled boundary.",
            );
          candle.closed = data.x;
        } else return;
      } catch {
        setStatus("stale");
        resync();
        return;
      }
      lastReceived = Date.now();
      attempts = 0;
      setStatus("live");
      if (ticker) options.onTicker(ticker);
      if (candle) {
        const previous = lastCandles.get(symbol!);
        if (
          previous !== undefined &&
          Number(candle.time) - previous > timeframeSeconds[options.timeframe]
        )
          resync();
        if (previous === undefined || Number(candle.time) >= previous) {
          lastCandles.set(symbol!, Number(candle.time));
          options.onCandle(symbol!, candle);
        }
      }
    };
    current.onerror = () => {
      if (disposed || socket !== current) return;
      setStatus("reconnecting");
      current.close();
    };
    current.onclose = () => {
      if (!disposed && socket === current) {
        socket = null;
        schedule();
      }
    };
  };
  heartbeat = setInterval(() => {
    if (Date.now() - lastReceived > 30000) {
      setStatus("stale");
      resync();
      if (socket) {
        const current = socket;
        socket = null;
        current.close();
      }
      schedule();
    }
  }, 10000);
  open();
  return () => {
    disposed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (heartbeat) clearInterval(heartbeat);
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      socket = null;
    }
  };
}
