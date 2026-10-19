import { EMA, MACD, RSI } from "technicalindicators";
import type { LineData, UTCTimestamp } from "lightweight-charts";
import { timeframeSeconds, type MarketCandle } from "./binance";
import type { HistorySignal, Signal, Timeframe } from "./data";
import {
  defaultStrategy,
  strategyVersion,
  validateStrategySettings,
  type ConditionKey,
  type StrategySettings,
} from "./strategy";

export interface MarketCondition {
  label: string;
  passed: boolean;
  detail: string;
}

export interface MarketAnalysis {
  candles: MarketCandle[];
  /** The names stay stable for chart consumers; periods come from strategy. */
  ema50: LineData<UTCTimestamp>[];
  ema200: LineData<UTCTimestamp>[];
  macd: LineData<UTCTimestamp>[];
  macdSignal: LineData<UTCTimestamp>[];
  histogram: LineData<UTCTimestamp>[];
  rsi: LineData<UTCTimestamp>[];
  signal: Signal | null;
  signals: Signal[];
  conditions: Record<"BUY" | "SELL", MarketCondition[]>;
  history: HistorySignal[];
  closedCandle: MarketCandle | null;
  lastClosedIndex: number;
  reason: string;
  strategyVersion: string;
}

export function analyzeMarket(
  symbol: string,
  timeframe: Timeframe,
  sourceCandles: MarketCandle[],
  settings: StrategySettings = defaultStrategy,
): MarketAnalysis {
  const version = strategyVersion(settings);
  const candles = [...sourceCandles].sort(
    (a, b) => Number(a.time) - Number(b.time),
  );
  const count = candles.length;
  const step = timeframeSeconds[timeframe];
  const emptyValues = () => Array<number>(count).fill(Number.NaN);
  const emaFast = emptyValues(),
    emaSlow = emptyValues(),
    macd = emptyValues(),
    macdSignal = emptyValues(),
    histogram = emptyValues(),
    rsi = emptyValues();
  const validCandle = (candle: MarketCandle) =>
    Number.isSafeInteger(Number(candle.time)) &&
    Number(candle.time) > 0 &&
    Number(candle.time) % step === 0 &&
    [candle.open, candle.high, candle.low, candle.close].every(
      (value) => Number.isFinite(value) && value > 0,
    ) &&
    Number.isFinite(candle.volume) &&
    candle.volume >= 0 &&
    candle.high >= Math.max(candle.open, candle.close) &&
    candle.low <= Math.min(candle.open, candle.close) &&
    candle.closeTime === Number(candle.time) * 1000 + step * 1000 - 1;
  const strategyError = validateStrategySettings(settings);

  // A gap restarts every indicator's warm-up. Missing candles never silently
  // compress a moving average or produce an apparent MACD crossover.
  const calculateSegment = (start: number, end: number) => {
    const closes = candles.slice(start, end).map((candle) => candle.close);
    if (!closes.length) return;
    const align = (values: (number | undefined)[], target: number[]) => {
      const offset = end - values.length;
      values.forEach((value, index) => {
        if (value !== undefined && Number.isFinite(value))
          target[offset + index] = value;
      });
    };
    align(EMA.calculate({ values: closes, period: settings.emaFast }), emaFast);
    align(EMA.calculate({ values: closes, period: settings.emaSlow }), emaSlow);
    const values = MACD.calculate({
      values: closes,
      fastPeriod: settings.macdFast,
      slowPeriod: settings.macdSlow,
      signalPeriod: settings.macdSignal,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    align(
      values.map((value) => value.MACD),
      macd,
    );
    align(
      values.map((value) => value.signal),
      macdSignal,
    );
    align(
      values.map((value) => value.histogram),
      histogram,
    );
    align(RSI.calculate({ values: closes, period: settings.rsiPeriod }), rsi);
  };
  if (!strategyError) {
    let start = 0;
    for (let index = 0; index <= count; index++) {
      if (
        index === count ||
        !validCandle(candles[index]) ||
        (index > start &&
          Number(candles[index].time) - Number(candles[index - 1].time) !==
            step)
      ) {
        calculateSegment(start, index);
        start =
          index === count || !validCandle(candles[index]) ? index + 1 : index;
      }
    }
  }
  const dataValid = candles.map(
    (candle, index) =>
      !strategyError &&
      index > 0 &&
      validCandle(candle) &&
      candle.closed &&
      candles[index - 1].closed &&
      validCandle(candles[index - 1]) &&
      Number(candle.time) - Number(candles[index - 1].time) === step &&
      [
        emaFast[index],
        emaSlow[index],
        macd[index - 1],
        macd[index],
        macdSignal[index - 1],
        macdSignal[index],
        histogram[index],
        rsi[index],
      ].every(Number.isFinite),
  );

  const volumeAverageAt = (index: number): number => {
    if (index < 20) return Number.NaN;
    const previous = candles.slice(index - 20, index);
    if (
      !previous.every(
        (candle, offset) =>
          validCandle(candle) &&
          candle.closed &&
          Number(candles[index].time) - Number(candle.time) ===
            (20 - offset) * step,
      )
    )
      return Number.NaN;
    return previous.reduce((sum, candle) => sum + candle.volume, 0) / 20;
  };

  const conditionsAt = (
    index: number,
    side: "BUY" | "SELL",
  ): MarketCondition[] => {
    const buy = side === "BUY";
    const enabled = settings[buy ? "buy" : "sell"];
    const minimum = buy ? settings.buyRsiMin : settings.sellRsiMin;
    const maximum = buy ? settings.buyRsiMax : settings.sellRsiMax;
    const current = candles[index];
    const finiteRsi = Number.isFinite(rsi[index])
      ? rsi[index].toFixed(1)
      : "pending";
    const values: Record<ConditionKey, MarketCondition> = {
      price: {
        label: `Price ${buy ? "above" : "below"} EMA ${settings.emaFast}`,
        passed: Boolean(
          current &&
          (buy
            ? current.close > emaFast[index]
            : current.close < emaFast[index]),
        ),
        detail: "Latest complete closed candle",
      },
      ema: {
        label: `EMA ${settings.emaFast} ${buy ? "above" : "below"} EMA ${settings.emaSlow}`,
        passed: buy
          ? emaFast[index] > emaSlow[index]
          : emaFast[index] < emaSlow[index],
        detail: buy ? "Bullish trend alignment" : "Bearish trend alignment",
      },
      macd: {
        label: `MACD ${buy ? "bullish" : "bearish"} crossover`,
        passed:
          index > 0 &&
          (buy
            ? macd[index - 1] <= macdSignal[index - 1] &&
              macd[index] > macdSignal[index]
            : macd[index - 1] >= macdSignal[index - 1] &&
              macd[index] < macdSignal[index]),
        detail:
          "Previous and current closed candles; a new crossover is required",
      },
      rsi: {
        label: `RSI between ${minimum} and ${maximum}`,
        passed: rsi[index] >= minimum && rsi[index] <= maximum,
        detail: `RSI ${finiteRsi} · period ${settings.rsiPeriod}`,
      },
    };
    const conditions = (Object.keys(values) as ConditionKey[])
      .filter((key) => enabled[key])
      .map((key) => values[key]);
    if (settings.volumeFilter) {
      const average = volumeAverageAt(index);
      conditions.push({
        label: "Volume above the previous 20-candle average",
        passed: Boolean(current && current.volume > average),
        detail: "Comparison excludes the signal candle",
      });
    }
    conditions.push({
      label: "Complete, valid closed-candle data",
      passed: dataValid[index] === true,
      detail:
        strategyError ??
        "Contiguous candles and fully warmed EMA, MACD, and RSI",
    });
    return conditions;
  };
  const signals: Signal[] = candles.map((_, index) => {
    if (!dataValid[index]) return "WAIT";
    const buy = conditionsAt(index, "BUY").every(
      (condition) => condition.passed,
    );
    const sell = conditionsAt(index, "SELL").every(
      (condition) => condition.passed,
    );
    // Overlapping user ranges must not arbitrarily select a direction.
    if (buy === sell) return "WAIT";
    return buy ? "BUY" : "SELL";
  });
  const reasonAt = (index: number, signal: "BUY" | "SELL") =>
    conditionsAt(index, signal)
      .filter(
        (condition) =>
          condition.passed &&
          condition.label !== "Complete, valid closed-candle data",
      )
      .map((condition) => condition.label)
      .join(" · ");
  const resultAt = (index: number, distance: number): number | null => {
    const future = candles[index + distance];
    if (!future || !future.closed) return null;
    for (let offset = 1; offset <= distance; offset++) {
      const next = candles[index + offset];
      if (
        !next.closed ||
        !validCandle(next) ||
        Number(next.time) - Number(candles[index + offset - 1].time) !== step
      )
        return null;
    }
    return (future.close / candles[index].close - 1) * 100;
  };
  const history: HistorySignal[] = candles.flatMap((candle, index) => {
    const signal = signals[index];
    if (signal === "WAIT") return [];
    return [
      {
        id: `${symbol}:${timeframe}:${version}:${candle.closeTime}`,
        symbol,
        timeframe,
        time: new Date(candle.closeTime).toISOString(),
        signal,
        price: candle.close,
        rsi: rsi[index],
        emaFast: emaFast[index],
        emaSlow: emaSlow[index],
        macd: macd[index],
        macdSignal: macdSignal[index],
        histogram: histogram[index],
        result1: resultAt(index, 1),
        result3: resultAt(index, 3),
        result6: resultAt(index, 6),
        reason: reasonAt(index, signal),
        strategyVersion: version,
        source: "backfill" as const,
      },
    ];
  });
  const lastClosedIndex = candles.findLastIndex(
    (candle) => candle.closed && validCandle(candle),
  );
  const closedCandle = lastClosedIndex >= 0 ? candles[lastClosedIndex] : null;
  const signal =
    lastClosedIndex < 0 || !dataValid[lastClosedIndex]
      ? null
      : signals[lastClosedIndex];
  const reason =
    strategyError ??
    (signal === null
      ? "Waiting for complete closed candles and indicator warm-up."
      : signal === "WAIT"
        ? "The enabled BUY and SELL conditions do not identify one confirmed direction on the latest closed candle."
        : reasonAt(lastClosedIndex, signal));
  const points = (values: number[]): LineData<UTCTimestamp>[] =>
    values.flatMap((value, index) =>
      candles[index].closed && Number.isFinite(value)
        ? [{ time: candles[index].time, value }]
        : [],
    );
  return {
    candles,
    ema50: points(emaFast),
    ema200: points(emaSlow),
    macd: points(macd),
    macdSignal: points(macdSignal),
    histogram: points(histogram),
    rsi: points(rsi),
    signal,
    signals,
    conditions: {
      BUY: conditionsAt(lastClosedIndex, "BUY"),
      SELL: conditionsAt(lastClosedIndex, "SELL"),
    },
    history,
    closedCandle,
    lastClosedIndex,
    reason,
    strategyVersion: version,
  };
}
