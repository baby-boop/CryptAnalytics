import type { Page } from "@playwright/test";
import {
  coins,
  defaultWatchlist,
  type HistorySignal,
  type Timeframe,
} from "../lib/data";
import { defaultStrategy } from "../lib/strategy";
import type { ServerSettings } from "../lib/server-types";
import type { MarketCandle } from "../lib/binance";
import type { UTCTimestamp } from "lightweight-charts";

export const testNow = Date.UTC(2026, 9, 19, 12, 42);
export const testHistory: HistorySignal[] = [
  {
    id: "real-btc-test",
    symbol: "BTC",
    timeframe: "4h",
    time: new Date(testNow - 8 * 3600000).toISOString(),
    signal: "BUY",
    price: 82000,
    rsi: 52,
    result1: 1,
    result3: 2,
    result6: null,
    reason: "EMA alignment and bullish MACD crossover",
    strategyVersion: "v-test",
    source: "live",
    emaFast: 81000,
    emaSlow: 80000,
    macd: 12,
    macdSignal: 10,
    histogram: 2,
  },
  {
    id: "real-sol-test",
    symbol: "SOL",
    timeframe: "4h",
    time: new Date(testNow - 12 * 3600000).toISOString(),
    signal: "SELL",
    price: 140,
    rsi: 42,
    result1: -1.2,
    result3: -3,
    result6: null,
    reason: "EMA alignment and bearish MACD crossover",
    strategyVersion: "v-test",
    source: "backfill",
    emaFast: 142,
    emaSlow: 145,
    macd: -2,
    macdSignal: -1,
    histogram: -1,
  },
];

export function makeCandles(
  symbol: string,
  timeframe: Timeframe,
): MarketCandle[] {
  const step = { "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 }[timeframe];
  const end = Math.floor(testNow / 1000 / step) * step;
  const price =
    symbol === "BTC"
      ? 82437.4
      : symbol === "SOL"
        ? 140
        : symbol === "ETH"
          ? 2600
          : 10;
  return Array.from({ length: 520 }, (_, index) => {
    const time = (end - (519 - index) * step) as UTCTimestamp;
    const close = price * (0.9 + index * 0.00019 + Math.sin(index / 6) * 0.003);
    return {
      time,
      closeTime: (time + step) * 1000 - 1,
      open: close * 0.999,
      high: close * 1.002,
      low: close * 0.998,
      close,
      volume: 100 + (index % 20),
      closed: index < 519,
    };
  });
}

export async function mockMarketApi(
  page: Page,
  options: {
    history?: HistorySignal[];
    offline?: boolean;
    authRequired?: boolean;
  } = {},
) {
  const settings: ServerSettings = {
    strategy: structuredClone(defaultStrategy),
    watchlist: [...defaultWatchlist],
    alerts: ["BTC", "SOL", "BNB"],
    notifications: {
      enabled: false,
      buy: true,
      sell: true,
      includeChart: true,
    },
  };
  let authenticated = !options.authRequired;
  await page.addInitScript(() => {
    class TestEventSource extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 2;
      readyState = 1;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      listener = (event: Event) => {
        if (this.readyState === 1)
          this.onmessage?.(
            new MessageEvent("message", {
              data: JSON.stringify((event as CustomEvent).detail),
            }),
          );
      };
      disconnect = () => {
        this.readyState = 0;
        this.onerror?.(new Event("error"));
      };
      reconnect = () => {
        this.readyState = 1;
        this.onopen?.(new Event("open"));
      };
      constructor() {
        super();
        window.addEventListener("test:market-event", this.listener);
        window.addEventListener("test:market-disconnect", this.disconnect);
        window.addEventListener("test:market-reconnect", this.reconnect);
        setTimeout(() => this.onopen?.(new Event("open")), 10);
      }
      close() {
        this.readyState = 2;
        window.removeEventListener("test:market-event", this.listener);
        window.removeEventListener("test:market-disconnect", this.disconnect);
        window.removeEventListener("test:market-reconnect", this.reconnect);
      }
    }
    Object.defineProperty(window, "EventSource", {
      value: TestEventSource,
      configurable: true,
    });
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (options.offline) {
      await route.fulfill({
        status: 503,
        json: {
          error: { message: "Backend is unavailable. Retry the connection." },
        },
      });
      return;
    }
    let body: unknown;
    if (url.pathname === "/api/auth/login") {
      authenticated = true;
      body = { authenticated: true };
    } else if (url.pathname === "/api/session")
      body = { authenticated, authRequired: Boolean(options.authRequired) };
    else if (url.pathname === "/api/health")
      body = {
        ok: true,
        database: "connected",
        telegramConfigured: false,
        authRequired: Boolean(options.authRequired),
      };
    else if (!authenticated) {
      await route.fulfill({
        status: 401,
        json: { error: { message: "Sign in to access your backend." } },
      });
      return;
    } else if (url.pathname === "/api/settings") {
      if (request.method() === "PUT")
        Object.assign(settings, request.postDataJSON());
      body = settings;
    } else if (url.pathname === "/api/signals")
      body = { signals: options.history ?? testHistory, limit: 5000 };
    else if (url.pathname === "/api/market") {
      const timeframe = (url.searchParams.get("timeframe") ??
        "4h") as Timeframe;
      body = {
        tickers: Object.fromEntries(
          coins.map((coin, index) => [
            coin.symbol,
            {
              symbol: coin.symbol,
              price:
                coin.symbol === "BTC"
                  ? 82437.4
                  : coin.symbol === "SOL"
                    ? 140
                    : 2600 + index,
              change: index % 2 ? -1.2 : 2.3,
              high: coin.symbol === "BTC" ? 83000 : 2800,
              low: coin.symbol === "BTC" ? 81000 : 2400,
              volume: 875199916,
              eventTime: testNow,
            },
          ]),
        ),
        candles: Object.fromEntries(
          coins.map((coin) => [
            coin.symbol,
            makeCandles(coin.symbol, timeframe),
          ]),
        ),
        status: "live",
        lastUpdate: testNow,
        error: null,
        symbolErrors: {},
      };
    } else if (url.pathname === "/api/notifications/status")
      body = { configured: false, settings: settings.notifications, logs: [] };
    else if (url.pathname === "/api/notifications/test") {
      await route.fulfill({
        status: 409,
        json: {
          error: {
            message:
              "No message sent. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the backend .env file.",
          },
        },
      });
      return;
    } else body = { accepted: true };
    await route.fulfill({ json: body });
  });
  return settings;
}
