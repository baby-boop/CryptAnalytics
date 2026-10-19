export type ConditionKey = "price" | "ema" | "macd" | "rsi";

export interface StrategySettings {
  emaFast: number;
  emaSlow: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  rsiPeriod: number;
  buyRsiMin: number;
  buyRsiMax: number;
  sellRsiMin: number;
  sellRsiMax: number;
  buy: Record<ConditionKey, boolean>;
  sell: Record<ConditionKey, boolean>;
  volumeFilter: boolean;
  trendFilter: boolean;
}

export const defaultStrategy: StrategySettings = {
  emaFast: 50,
  emaSlow: 200,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  rsiPeriod: 14,
  buyRsiMin: 45,
  buyRsiMax: 70,
  sellRsiMin: 30,
  sellRsiMax: 55,
  buy: { price: true, ema: true, macd: true, rsi: true },
  sell: { price: true, ema: true, macd: true, rsi: true },
  volumeFilter: true,
  trendFilter: false,
};

const periods = [
  "emaFast",
  "emaSlow",
  "macdFast",
  "macdSlow",
  "macdSignal",
  "rsiPeriod",
] as const;
const ranges = ["buyRsiMin", "buyRsiMax", "sellRsiMin", "sellRsiMax"] as const;
const conditionKeys: ConditionKey[] = ["price", "ema", "macd", "rsi"];

export function validateStrategySettings(
  settings: StrategySettings,
): string | null {
  if (
    periods.some(
      (key) =>
        !Number.isInteger(settings[key]) ||
        settings[key] < 1 ||
        settings[key] > 500,
    )
  )
    return "Indicator periods must be whole numbers between 1 and 500.";
  if (
    settings.emaFast >= settings.emaSlow ||
    settings.macdFast >= settings.macdSlow
  )
    return "Fast periods must be smaller than their corresponding slow periods.";
  if (
    (["buy", "sell"] as const).some(
      (side) => !conditionKeys.some((key) => settings[side][key]),
    )
  )
    return "Enable at least one condition for both buy and sell signals.";
  if (
    ranges.some(
      (key) =>
        !Number.isFinite(settings[key]) ||
        settings[key] < 0 ||
        settings[key] > 100,
    ) ||
    settings.buyRsiMin >= settings.buyRsiMax ||
    settings.sellRsiMin >= settings.sellRsiMax
  )
    return "Each RSI range must increase from a minimum of 0 to a maximum of 100.";
  if (settings.trendFilter)
    return "Higher timeframe confirmation is not available yet. Disable it to save this strategy.";
  return null;
}

export function readStrategySettings(value: unknown): StrategySettings | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    ![...periods, ...ranges].every(
      (key) => typeof record[key] === "number" && Number.isFinite(record[key]),
    )
  )
    return null;
  for (const side of ["buy", "sell"] as const) {
    if (
      !record[side] ||
      typeof record[side] !== "object" ||
      !conditionKeys.every(
        (key) =>
          typeof (record[side] as Record<string, unknown>)[key] === "boolean",
      )
    )
      return null;
  }
  if (
    typeof record.volumeFilter !== "boolean" ||
    typeof record.trendFilter !== "boolean"
  )
    return null;
  const settings: StrategySettings = {
    emaFast: record.emaFast as number,
    emaSlow: record.emaSlow as number,
    macdFast: record.macdFast as number,
    macdSlow: record.macdSlow as number,
    macdSignal: record.macdSignal as number,
    rsiPeriod: record.rsiPeriod as number,
    buyRsiMin: record.buyRsiMin as number,
    buyRsiMax: record.buyRsiMax as number,
    sellRsiMin: record.sellRsiMin as number,
    sellRsiMax: record.sellRsiMax as number,
    buy: Object.fromEntries(
      conditionKeys.map((key) => [
        key,
        (record.buy as Record<string, boolean>)[key],
      ]),
    ) as Record<ConditionKey, boolean>,
    sell: Object.fromEntries(
      conditionKeys.map((key) => [
        key,
        (record.sell as Record<string, boolean>)[key],
      ]),
    ) as Record<ConditionKey, boolean>,
    volumeFilter: record.volumeFilter,
    trendFilter: record.trendFilter,
  };
  return validateStrategySettings(settings) === null ? settings : null;
}

// A fixed property order makes browser and server identifiers identical.
export function strategyVersion(settings: StrategySettings): string {
  const serialized = JSON.stringify([
    ...periods.map((key) => settings[key]),
    ...ranges.map((key) => settings[key]),
    ...conditionKeys.map((key) => settings.buy[key]),
    ...conditionKeys.map((key) => settings.sell[key]),
    settings.volumeFilter,
    settings.trendFilter,
  ]);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index++)
    hash = Math.imul(hash ^ serialized.charCodeAt(index), 16777619);
  return `closed-v2-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
