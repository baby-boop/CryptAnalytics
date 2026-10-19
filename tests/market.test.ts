import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, scryptSync } from "node:crypto";
import type { UTCTimestamp } from "lightweight-charts";
import {
  parseMarketCandle,
  parseMarketTicker,
  type MarketCandle,
} from "../lib/binance";
import { analyzeMarket } from "../lib/market-analysis";
import {
  defaultStrategy,
  readStrategySettings,
  strategyVersion,
  type StrategySettings,
} from "../lib/strategy";
import { createSession, passwordMatches, validSession } from "../backend/auth";

const step = 14400;
const start = Math.floor(Date.UTC(2025, 0, 1) / 1000 / step) * step;
function candles(count: number, oscillating = false): MarketCandle[] {
  return Array.from({ length: count }, (_, index) => {
    const close = oscillating
      ? 100 + Math.sin(index * 0.6) * 8 + index * 0.03
      : 100 + index;
    const open = close - 0.25;
    return {
      time: (start + index * step) as UTCTimestamp,
      open,
      high: close + 1,
      low: open - 1,
      close,
      volume: 100 + index,
      closeTime: (start + (index + 1) * step) * 1000 - 1,
      closed: true,
    };
  });
}
function strategy(): StrategySettings {
  return {
    ...structuredClone(defaultStrategy),
    emaFast: 3,
    emaSlow: 8,
    macdFast: 3,
    macdSlow: 8,
    macdSignal: 3,
    rsiPeriod: 3,
    volumeFilter: false,
    buy: { price: true, ema: false, macd: false, rsi: false },
    sell: { price: true, ema: false, macd: false, rsi: false },
  };
}

test("REST candle parser uses exchange close boundaries and rejects malformed OHLCV", () => {
  const first = candles(1)[0];
  const row = [
    Number(first.time) * 1000,
    "100",
    "102",
    "99",
    "101",
    "0",
    first.closeTime,
  ];
  assert.equal(parseMarketCandle(row, "4h", first.closeTime).closed, false);
  const parsed = parseMarketCandle(row, "4h", first.closeTime + 1);
  assert.equal(parsed.closed, true);
  assert.equal(parsed.time, first.time);
  assert.equal(parsed.volume, 0);
  assert.throws(() =>
    parseMarketCandle(
      [row[0], "100", "99", "98", "101", "3", row[6]],
      "4h",
      first.closeTime + 1,
    ),
  );
  assert.throws(() =>
    parseMarketCandle(
      [row[0], "NaN", ...row.slice(2)],
      "4h",
      first.closeTime + 1,
    ),
  );
  assert.throws(() =>
    parseMarketCandle(
      [...row.slice(0, 6), first.closeTime - 1],
      "4h",
      first.closeTime + 1,
    ),
  );
});

test("ticker parser reads quote USDT volume and validates finite external data", () => {
  const row = {
    symbol: "BTCUSDT",
    lastPrice: "101",
    priceChangePercent: "1.25",
    highPrice: "105",
    lowPrice: "95",
    quoteVolume: "1234567.89",
    closeTime: 1735689600000,
  };
  assert.deepEqual(parseMarketTicker(row), {
    symbol: "BTC",
    price: 101,
    change: 1.25,
    high: 105,
    low: 95,
    volume: 1234567.89,
    eventTime: 1735689600000,
  });
  assert.throws(() => parseMarketTicker({ ...row, lastPrice: "Infinity" }));
  assert.throws(() => parseMarketTicker({ ...row, quoteVolume: "" }));
  assert.throws(() => parseMarketTicker({ ...row, symbol: "BTCETH" }));
});

test("open-candle spikes cannot change closed signals or rendered indicators", () => {
  const source = candles(80);
  const expected = analyzeMarket("BTC", "4h", source.slice(0, -1), strategy());
  const open = source.at(-1)!;
  open.closed = false;
  open.close *= 10;
  open.high = open.close + 1;
  const actual = analyzeMarket("BTC", "4h", source, strategy());
  assert.equal(actual.signal, expected.signal);
  assert.deepEqual(actual.closedCandle, expected.closedCandle);
  assert.equal(actual.signals.at(-1), "WAIT");
  for (const key of [
    "ema50",
    "ema200",
    "macd",
    "macdSignal",
    "histogram",
    "rsi",
  ] as const)
    assert.deepEqual(actual[key], expected[key]);
  assert.deepEqual(actual.history, expected.history);
});

test("warm-up and candle gaps suppress signals until indicators become complete again", () => {
  const warming = analyzeMarket("BTC", "4h", candles(20));
  assert.equal(warming.signal, null);
  assert.deepEqual(warming.history, []);
  const source = candles(100).filter((_, index) => index !== 90);
  const analysis = analyzeMarket("BTC", "4h", source, strategy());
  assert.equal(analysis.signal, null);
  assert.ok(analysis.history.length > 0);
  assert.ok(
    analysis.history.every(
      (signal) => Date.parse(signal.time) < source[90].closeTime,
    ),
  );
});

test("MACD signals require an actual crossing of previous and current closed values", () => {
  const settings = strategy();
  settings.buy = { price: false, ema: false, macd: true, rsi: false };
  settings.sell = { price: false, ema: false, macd: true, rsi: false };
  const analysis = analyzeMarket("BTC", "4h", candles(180, true), settings);
  assert.ok(analysis.history.some((signal) => signal.signal === "BUY"));
  assert.ok(analysis.history.some((signal) => signal.signal === "SELL"));
  const macd = new Map(analysis.macd.map((point) => [point.time, point.value]));
  const signalLine = new Map(
    analysis.macdSignal.map((point) => [point.time, point.value]),
  );
  for (const signal of analysis.history) {
    const current = ((Date.parse(signal.time) + 1) / 1000 -
      step) as UTCTimestamp;
    const previous = (Number(current) - step) as UTCTimestamp;
    if (signal.signal === "BUY") {
      assert.ok(macd.get(previous)! <= signalLine.get(previous)!);
      assert.ok(macd.get(current)! > signalLine.get(current)!);
    } else {
      assert.ok(macd.get(previous)! >= signalLine.get(previous)!);
      assert.ok(macd.get(current)! < signalLine.get(current)!);
    }
  }
});

test("1/3/6 results remain pending until contiguous future candles actually close", () => {
  const source = candles(47);
  const settings = strategy();
  const base = analyzeMarket("BTC", "4h", source.slice(0, 40), settings);
  const entry = base.history.at(-1)!;
  assert.equal(entry.time, new Date(source[39].closeTime).toISOString());
  assert.equal(entry.result1, null);
  assert.equal(entry.result3, null);
  assert.equal(entry.result6, null);
  const pendingSource = source.slice(0, 43).map((candle) => ({ ...candle }));
  pendingSource.at(-1)!.closed = false;
  const pending = analyzeMarket(
    "BTC",
    "4h",
    pendingSource,
    settings,
  ).history.find((signal) => signal.id === entry.id)!;
  assert.equal(
    pending.result1,
    (source[40].close / source[39].close - 1) * 100,
  );
  assert.equal(pending.result3, null);
  assert.equal(pending.result6, null);
  const full = analyzeMarket("BTC", "4h", source, settings).history.find(
    (signal) => signal.id === entry.id,
  )!;
  assert.equal(full.result3, (source[42].close / source[39].close - 1) * 100);
  assert.equal(full.result6, (source[45].close / source[39].close - 1) * 100);
  assert.equal(full.macd, entry.macd);
  assert.equal(full.rsi, entry.rsi);
  assert.equal(full.price, entry.price);
});

test("strategy validation and signal IDs are deterministic and strategy-specific", () => {
  const settings = strategy();
  assert.deepEqual(readStrategySettings(settings), settings);
  assert.equal(readStrategySettings({ ...settings, emaFast: 8 }), null);
  assert.equal(readStrategySettings({ ...settings, trendFilter: true }), null);
  assert.equal(
    readStrategySettings({ ...settings, rsiPeriod: Number.NaN }),
    null,
  );
  const a = analyzeMarket("BTC", "4h", candles(40), settings);
  const b = analyzeMarket("BTC", "4h", candles(40), structuredClone(settings));
  assert.deepEqual(
    a.history.map((signal) => signal.id),
    b.history.map((signal) => signal.id),
  );
  const modified = { ...settings, buyRsiMin: 46 };
  assert.notEqual(strategyVersion(settings), strategyVersion(modified));
  const c = analyzeMarket("BTC", "4h", candles(40), modified);
  assert.notEqual(a.history.at(-1)!.id, c.history.at(-1)!.id);
});

test("password hashes and signed sessions reject bad passwords, tampering, and expiry", () => {
  const password = "unit-test-password";
  const salt = "0123456789abcdef0123456789abcdef";
  const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  assert.equal(passwordMatches(password, hash), true);
  assert.equal(passwordMatches("wrong", hash), false);
  assert.equal(passwordMatches(password, "bad-hash"), false);
  const secret = "unit-test-session-secret-1234567890";
  const session = createSession("tester", secret);
  assert.equal(validSession(session, "tester", secret), true);
  assert.equal(validSession(session, "other", secret), false);
  assert.equal(
    validSession(`${session.slice(0, -5)}xxxxx`, "tester", secret),
    false,
  );
  const payload = Buffer.from(
    JSON.stringify({ username: "tester", expires: Date.now() - 1000 }),
  ).toString("base64url");
  const expired = `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
  assert.equal(validSession(expired, "tester", secret), false);
});
