import { EMA, MACD, RSI } from "technicalindicators";
import type {
  CandlestickData,
  LineData,
  UTCTimestamp,
} from "lightweight-charts";
import type { Coin, Signal, Timeframe } from "@/lib/data";
import { fixtureDate } from "@/lib/data";

export interface FixtureCandle extends CandlestickData<UTCTimestamp> {
  volume: number;
  closed: boolean;
}
interface FixtureCondition {
  label: string;
  passed: boolean;
  detail: string;
}
export interface MarketFixture {
  candles: FixtureCandle[];
  ema50: LineData<UTCTimestamp>[];
  ema200: LineData<UTCTimestamp>[];
  macd: LineData<UTCTimestamp>[];
  macdSignal: LineData<UTCTimestamp>[];
  histogram: LineData<UTCTimestamp>[];
  rsi: LineData<UTCTimestamp>[];
  signal: Signal;
  signals: Signal[];
  conditions: Record<"BUY" | "SELL", FixtureCondition[]>;
}

export function createMarketFixture(
  coin: Coin,
  timeframe: Timeframe,
): MarketFixture {
  const count = 320;
  const step = { "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 }[timeframe];
  // Fixture timestamps denote candle closes, including the last completed boundary.
  const end = Math.floor(new Date(fixtureDate).getTime() / 1000 / step) * step;
  const seed =
    coin.symbol.charCodeAt(0) * 0.12 +
    ["15m", "1h", "4h", "1d"].indexOf(timeframe) * 0.7;
  const drift = coin.change >= 0 ? 0.17 : -0.14;
  const raw = Array.from(
    { length: count },
    (_, i) =>
      1 +
      (drift * i) / count +
      0.013 * Math.sin(i * 0.09 + seed) +
      0.006 * Math.sin(i * 0.53 + seed) +
      0.003 * Math.cos(i * 1.4),
  );
  const scale = coin.price / raw[count - 1];
  const candles: FixtureCandle[] = raw.map((value, i) => {
    const close = value * scale;
    const open =
      (raw[Math.max(0, i - 1)] + 0.0006 * Math.sin(i * 2 + seed)) * scale;
    const spread = scale * (0.0009 + Math.abs(Math.sin(i * 1.73)) * 0.0017);
    return {
      time: (end - (count - 1 - i) * step) as UTCTimestamp,
      open,
      high: Math.max(open, close) + spread,
      low: Math.min(open, close) - spread,
      close,
      volume: Math.round(
        450 +
          Math.abs(Math.sin(i * 0.72 + seed)) * 1700 +
          (Math.abs(close - open) / scale) * 200000,
      ),
      closed: true,
    };
  });
  const closes = candles.map((candle) => candle.close);
  const points = (values: number[]): LineData<UTCTimestamp>[] =>
    values.flatMap((value, index) =>
      Number.isFinite(value) ? [{ time: candles[index].time, value }] : [],
    );
  const align = (values: (number | undefined)[]): number[] => [
    ...Array<number>(count - values.length).fill(Number.NaN),
    ...values.map((value) => value ?? Number.NaN),
  ];
  const ema50Values = align(EMA.calculate({ values: closes, period: 50 }));
  const ema200Values = align(EMA.calculate({ values: closes, period: 200 }));
  const macdResults = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const macd = align(macdResults.map((value) => value.MACD));
  const macdSignal = align(macdResults.map((value) => value.signal));
  const histogram = align(macdResults.map((value) => value.histogram));
  const rsiValues = align(RSI.calculate({ values: closes, period: 14 }));
  const validCandle = (candle: FixtureCandle) =>
    candle.closed &&
    candle.time <= end &&
    [candle.open, candle.high, candle.low, candle.close, candle.volume].every(
      (value) => Number.isFinite(value) && value > 0,
    ) &&
    candle.high >= Math.max(candle.open, candle.close) &&
    candle.low <= Math.min(candle.open, candle.close);
  const dataValid = candles.map(
    (candle, index) =>
      index >= 200 &&
      validCandle(candle) &&
      validCandle(candles[index - 1]) &&
      candle.time - candles[index - 1].time === step &&
      [
        ema50Values[index],
        ema200Values[index],
        macd[index - 1],
        macd[index],
        macdSignal[index - 1],
        macdSignal[index],
        rsiValues[index],
      ].every(Number.isFinite),
  );
  const conditionsAt = (
    index: number,
    side: "BUY" | "SELL",
  ): FixtureCondition[] => {
    const buy = side === "BUY";
    const bullishCross =
      macd[index - 1] <= macdSignal[index - 1] &&
      macd[index] > macdSignal[index];
    const bearishCross =
      macd[index - 1] >= macdSignal[index - 1] &&
      macd[index] < macdSignal[index];
    const minimumRsi = buy ? 45 : 30;
    const maximumRsi = buy ? 70 : 55;
    return [
      {
        label: `Price ${buy ? "above" : "below"} EMA 50`,
        passed: buy
          ? closes[index] > ema50Values[index]
          : closes[index] < ema50Values[index],
        detail: "Latest closed fixture candle",
      },
      {
        label: `EMA 50 ${buy ? "above" : "below"} EMA 200`,
        passed: buy
          ? ema50Values[index] > ema200Values[index]
          : ema50Values[index] < ema200Values[index],
        detail: buy ? "Bullish trend alignment" : "Bearish trend alignment",
      },
      {
        label: `MACD ${buy ? "bullish" : "bearish"} crossover`,
        passed: buy ? bullishCross : bearishCross,
        detail: "Previous and current closed candles",
      },
      {
        label: `RSI between ${minimumRsi} and ${maximumRsi}`,
        passed:
          rsiValues[index] >= minimumRsi && rsiValues[index] <= maximumRsi,
        detail: `RSI ${rsiValues[index].toFixed(1)} · period 14`,
      },
      {
        label: "Complete, valid closed-candle data",
        passed: dataValid[index],
        detail: "200-period warm-up and finite indicators",
      },
    ];
  };
  const signals: Signal[] = candles.map((_, index) => {
    if (!dataValid[index]) return "WAIT";
    if (conditionsAt(index, "BUY").every((condition) => condition.passed))
      return "BUY";
    if (conditionsAt(index, "SELL").every((condition) => condition.passed))
      return "SELL";
    return "WAIT";
  });
  const last = count - 1;
  return {
    candles,
    ema50: points(ema50Values),
    ema200: points(ema200Values),
    macd: points(macd),
    macdSignal: points(macdSignal),
    histogram: points(histogram),
    rsi: points(rsiValues),
    signal: signals[last],
    signals,
    conditions: {
      BUY: conditionsAt(last, "BUY"),
      SELL: conditionsAt(last, "SELL"),
    },
  };
}
