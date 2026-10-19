import type { MarketCandle, MarketTicker } from "./binance";
import type { HistorySignal } from "./data";
import type { StrategySettings } from "./strategy";

export type FeedStatus =
  "loading" | "live" | "reconnecting" | "offline" | "rest";
export interface NotificationSettings {
  enabled: boolean;
  buy: boolean;
  sell: boolean;
  includeChart: boolean;
}
export interface ServerSettings {
  strategy: StrategySettings;
  watchlist: string[];
  alerts: string[];
  notifications: NotificationSettings;
  revision?: number;
}
export interface MarketResponse {
  tickers: Record<string, MarketTicker>;
  candles: Record<string, MarketCandle[]>;
  status: FeedStatus;
  lastUpdate: number | null;
  error: string | null;
  symbolErrors: Record<string, string>;
}
export type FeedEvent =
  | { type: "ticker"; ticker: MarketTicker }
  | { type: "candle"; symbol: string; timeframe: string; candle: MarketCandle }
  | {
      type: "status";
      timeframe: string;
      status: FeedStatus;
      error: string | null;
    }
  | { type: "history" }
  | { type: "settings"; settings: ServerSettings };
export interface SignalResponse {
  signals: HistorySignal[];
  limit: number;
}
