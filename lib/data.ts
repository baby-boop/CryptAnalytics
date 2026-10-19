export type Signal = "BUY" | "SELL" | "WAIT";
export type Timeframe = "15m" | "1h" | "4h" | "1d";

export interface Coin {
  symbol: string;
  name: string;
  icon: string;
  color: string;
  price: number;
  change: number;
  signal: Signal;
  reason: string;
  lastSignal: string;
  volume: string;
  sparkline: number[];
}

export const timeframes: Timeframe[] = ["15m", "1h", "4h", "1d"];
export const fixtureDate = "2026-10-19T16:42:00Z";

function sparkline(seed: number, down = false): number[] {
  return Array.from(
    { length: 28 },
    (_, i) =>
      25 +
      (down ? -1 : 1) * i * 0.7 +
      Math.sin(i * 1.8 + seed) * 2.7 +
      Math.cos(i * 0.7 + seed) * 2,
  );
}

export const coins: Coin[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    icon: "₿",
    color: "#f7931a",
    price: 82222.14,
    change: 1.1,
    signal: "BUY",
    reason: "EMA bullish · MACD crossover",
    lastSignal: "12:00 UTC",
    volume: "28.48B",
    sparkline: sparkline(1),
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    icon: "Ξ",
    color: "#8194ef",
    price: 2455.32,
    change: 3.3,
    signal: "WAIT",
    reason: "Waiting for MACD confirmation",
    lastSignal: "08:00 UTC",
    volume: "14.32B",
    sparkline: sparkline(3),
  },
  {
    symbol: "SOL",
    name: "Solana",
    icon: "≋",
    color: "#8b68ee",
    price: 106.78,
    change: 3.4,
    signal: "BUY",
    reason: "Breakout · Trend confirmed",
    lastSignal: "08:00 UTC",
    volume: "3.82B",
    sparkline: sparkline(7),
  },
  {
    symbol: "BNB",
    name: "BNB",
    icon: "◈",
    color: "#e8b527",
    price: 730.76,
    change: 1.1,
    signal: "BUY",
    reason: "Price above EMA 50",
    lastSignal: "04:00 UTC",
    volume: "1.46B",
    sparkline: sparkline(9),
  },
  {
    symbol: "XRP",
    name: "XRP",
    icon: "×",
    color: "#8894a7",
    price: 1.34,
    change: -1.7,
    signal: "SELL",
    reason: "MACD bearish crossover",
    lastSignal: "04:00 UTC",
    volume: "2.18B",
    sparkline: sparkline(12, true),
  },
  {
    symbol: "DOGE",
    name: "Dogecoin",
    icon: "Ð",
    color: "#c9a64a",
    price: 0.0823,
    change: -2.5,
    signal: "SELL",
    reason: "Downtrend · Bearish momentum",
    lastSignal: "00:00 UTC",
    volume: "841.6M",
    sparkline: sparkline(5, true),
  },
  {
    symbol: "ADA",
    name: "Cardano",
    icon: "⠿",
    color: "#3a82e0",
    price: 0.3482,
    change: 2.14,
    signal: "WAIT",
    reason: "Waiting for trend confirmation",
    lastSignal: "Oct 18",
    volume: "428.2M",
    sparkline: sparkline(4),
  },
  {
    symbol: "AVAX",
    name: "Avalanche",
    icon: "▲",
    color: "#e85465",
    price: 24.85,
    change: -0.82,
    signal: "WAIT",
    reason: "RSI outside signal range",
    lastSignal: "Oct 18",
    volume: "316.5M",
    sparkline: sparkline(8, true),
  },
  {
    symbol: "LINK",
    name: "Chainlink",
    icon: "⬡",
    color: "#4877ec",
    price: 12.64,
    change: 1.92,
    signal: "BUY",
    reason: "EMA bullish · Trend confirmed",
    lastSignal: "Oct 18",
    volume: "296.1M",
    sparkline: sparkline(11),
  },
  {
    symbol: "DOT",
    name: "Polkadot",
    icon: "●",
    color: "#e35bad",
    price: 4.18,
    change: -0.61,
    signal: "WAIT",
    reason: "Waiting for MACD confirmation",
    lastSignal: "Oct 18",
    volume: "182.4M",
    sparkline: sparkline(2, true),
  },
];

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
}

export const history: HistorySignal[] = Array.from({ length: 36 }, (_, i) => {
  const coin = coins[i % 6];
  const date = new Date(Date.UTC(2026, 9, 19, 12) - i * 4 * 3600000);
  const sell = i % 5 === 2 || i % 5 === 4;
  const positive = i % 4 !== 2;
  return {
    id: `sig-${i + 1}`,
    symbol: coin.symbol,
    time: date.toISOString(),
    timeframe: i % 7 === 6 ? "1h" : "4h",
    signal: sell ? "SELL" : "BUY",
    price: coin.price * (1 - i * 0.0012),
    rsi: sell ? 38.6 - (i % 8) : 48.6 + (i % 12),
    result1: i < 1 ? null : (positive ? 1 : -1) * (0.6 + ((i * 7) % 25) / 10),
    result3: i < 3 ? null : (positive ? 1 : -1) * (1.2 + ((i * 3) % 40) / 10),
    result6: i < 6 ? null : (positive ? 1 : -1) * (2.1 + ((i * 5) % 60) / 10),
    reason: sell ? "MACD bearish crossover" : "EMA bullish crossover",
  };
});

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 5 : 2,
  }).format(value);
}

export function formatChange(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}
