export type Signal = "BUY" | "SELL" | "WAIT";
export type Timeframe = "15m" | "1h" | "4h" | "1d";

export interface Coin {
  symbol: string;
  name: string;
  icon: string;
  color: string;
  price: number | null;
  change: number | null;
  high: number | null;
  low: number | null;
  signal: Signal | null;
  reason: string;
  lastSignal: string | null;
  volume: string | null;
  sparkline: number[];
}

export const timeframes: Timeframe[] = ["15m", "1h", "4h", "1d"];
export const defaultWatchlist = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE"];
const metadata = [
  ["BTC", "Bitcoin", "₿", "#f7931a"],
  ["ETH", "Ethereum", "Ξ", "#8194ef"],
  ["SOL", "Solana", "≋", "#8b68ee"],
  ["BNB", "BNB", "◈", "#e8b527"],
  ["XRP", "XRP", "×", "#8894a7"],
  ["DOGE", "Dogecoin", "Ð", "#c9a64a"],
  ["ADA", "Cardano", "⠿", "#3a82e0"],
  ["AVAX", "Avalanche", "▲", "#e85465"],
  ["LINK", "Chainlink", "⬡", "#4877ec"],
  ["DOT", "Polkadot", "●", "#e35bad"],
];

// Asset identity only. Prices and signals always come from market data.
export const coins: Coin[] = metadata.map(([symbol, name, icon, color]) => ({
  symbol,
  name,
  icon,
  color,
  price: null,
  change: null,
  high: null,
  low: null,
  signal: null,
  reason: "Waiting for market data",
  lastSignal: null,
  volume: null,
  sparkline: [],
}));

export interface HistorySignal {
  id: string;
  symbol: string;
  time: string;
  timeframe: Timeframe;
  signal: "BUY" | "SELL";
  price: number;
  rsi: number;
  result1: number | null;
  result3: number | null;
  result6: number | null;
  reason: string;
  strategyVersion: string;
  source: "backfill" | "live";
  emaFast: number;
  emaSlow: number;
  macd: number;
  macdSignal: number;
  histogram: number;
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 5 : 2,
  }).format(value);
}

export function formatChange(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatVolume(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}
