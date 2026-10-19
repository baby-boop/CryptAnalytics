import { test, expect } from "@playwright/test";
import { makeCandles, mockMarketApi, testNow } from "./market-fixtures";

test.beforeEach(async ({ page }) => {
  await mockMarketApi(page);
});

test("all eight screens render without browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const routes = [
    ["/", "Market overview"],
    ["/markets/", "BTC"],
    ["/signals/", "Signal history"],
    ["/analytics/", "Performance analytics"],
    ["/watchlist/", "Watchlist"],
    ["/settings/", "Settings"],
    ["/notifications/", "Notifications"],
    ["/sign-in/", "Welcome back."],
  ];
  for (const [route, heading] of routes) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText(heading, {
      ignoreCase: true,
    });
  }
  expect(errors).toEqual([]);
});

test("mobile navigation and appearance preferences work", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Dark appearance" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Watchlist" })
    .click();
  await expect(page.locator("h1")).toHaveText("Watchlist");
  await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("asset search and chart selection preserve the selected coin", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Search your market watch" })
    .fill("sol");
  await expect(page.locator(".market-table tbody tr")).toHaveCount(1);
  await page.getByRole("link", { name: "View SOL analysis" }).click();
  await expect(page).toHaveURL(/symbol=SOL/);
  await expect(page.locator("h1")).toContainText("SOL");
  await expect(page.locator("canvas").first()).toBeVisible();
});

test("ticker updates change the dashboard and watchlist without inventing a signal", async ({
  page,
}) => {
  await page.goto("/");
  const btc = page
    .locator(".market-table tbody tr")
    .filter({ hasText: "Bitcoin" });
  await expect(btc.locator(".price-value")).toHaveText("82,437.40");
  const beforeSignal = await btc.locator(".signal-badge").textContent();
  await page.evaluate(
    (eventTime) =>
      window.dispatchEvent(
        new CustomEvent("test:market-event", {
          detail: {
            type: "ticker",
            ticker: {
              symbol: "BTC",
              price: 82555.25,
              change: -2.1,
              high: 83000,
              low: 81000,
              volume: 875199916,
              eventTime,
            },
          },
        }),
      ),
    testNow + 1000,
  );
  await expect(btc.locator(".price-value")).toHaveText("82,555.25");
  await expect(btc.locator(".change-value")).toContainText("-2.10%");
  expect(await btc.locator(".signal-badge").textContent()).toBe(beforeSignal);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: /^Watchlist/ })
    .click();
  await expect(
    page
      .locator(".watchlist-table tbody tr")
      .filter({ hasText: "Bitcoin" })
      .locator(".watchlist-price"),
  ).toHaveText("82,555.25");
});

test("chart changes timeframe and streams an open candle without changing closed analysis", async ({
  page,
}) => {
  await page.goto("/markets/?symbol=SOL");
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "15m", exact: true }).click();
  await expect(page.locator(".market-chart-legend")).toContainText(
    "SOL / USDT · 15m",
  );
  await expect(page.locator("canvas").first()).toBeVisible();
  const signalBefore = await page.locator(".market-signal-value").textContent();
  const closedPriceBefore = await page
    .locator(".market-signal-card dl")
    .textContent();
  const candle = {
    ...makeCandles("SOL", "15m").at(-1)!,
    close: 150,
    high: 151,
    closed: false,
  };
  await page.evaluate(
    (candle) =>
      window.dispatchEvent(
        new CustomEvent("test:market-event", {
          detail: { type: "candle", symbol: "SOL", timeframe: "15m", candle },
        }),
      ),
    candle,
  );
  await expect(page.locator(".market-chart-legend")).toContainText("150.00");
  expect(await page.locator(".market-signal-value").textContent()).toBe(
    signalBefore,
  );
  expect(await page.locator(".market-signal-card dl").textContent()).toBe(
    closedPriceBefore,
  );
  await page
    .getByRole("combobox", { name: "Select cryptocurrency" })
    .selectOption("ETH");
  await expect(page.locator("h1")).toContainText("ETH");
  await expect(page.locator(".market-current-price > strong")).toHaveText(
    "$2,601.00",
  );
});

test("stream disconnect marks retained data stale and offers a retry", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".market-table .price-value").first()).toHaveText(
    "82,437.40",
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("test:market-disconnect")),
  );
  await expect(page.locator(".demo-notice")).toContainText("stale data");
  await expect(
    page.getByRole("button", { name: "Retry / refresh", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".market-table .price-value").first()).toHaveText(
    "82,437.40",
  );
});

test("an unavailable backend leaves prices empty and never presents fixture data", async ({
  page,
}) => {
  await page.unroute("**/api/**");
  await mockMarketApi(page, { offline: true });
  await page.goto("/");
  await expect(page.locator(".demo-notice")).toContainText(
    "Backend is unavailable",
  );
  await expect(page.locator(".market-table .price-value").first()).toHaveText(
    "—",
  );
  await expect(page.locator(".market-table .signal-badge").first()).toHaveText(
    "—",
  );
  await expect(
    page.locator(".metric-card").nth(1).locator(".metric-value"),
  ).toHaveText("—");
});

test("a cold backend fills an initially empty dashboard when the collector becomes live", async ({
  page,
}) => {
  let collectorReady = false;
  let snapshotReads = 0;
  await page.route("**/api/market?**", async (route) => {
    snapshotReads++;
    if (collectorReady) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      json: {
        tickers: {},
        candles: {},
        status: "loading",
        lastUpdate: null,
        error: null,
        symbolErrors: {},
      },
    });
  });
  await page.goto("/");
  await expect.poll(() => snapshotReads).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".market-table .price-value").first()).toHaveText(
    "—",
  );
  collectorReady = true;
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("test:market-event", {
        detail: {
          type: "status",
          timeframe: "4h",
          status: "live",
          error: null,
        },
      }),
    ),
  );
  await expect(page.locator(".market-table .price-value").first()).toHaveText(
    "82,437.40",
  );
  await expect(
    page.locator(".metric-card").nth(1).locator(".metric-value"),
  ).not.toHaveText("—");
});

test("a rapid alert toggle back to its saved value is persisted after an earlier write", async ({
  page,
}) => {
  await page.unroute("**/api/**");
  const settings = await mockMarketApi(page);
  const writes: { watchlist: string[]; alerts: string[] }[] = [];
  let releaseFirst!: () => void;
  const firstWriteGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  await page.route("**/api/settings", async (route) => {
    if (route.request().method() !== "PUT") {
      await route.fallback();
      return;
    }
    const desired = route.request().postDataJSON() as {
      watchlist: string[];
      alerts: string[];
    };
    writes.push(desired);
    if (writes.length === 1) await firstWriteGate;
    Object.assign(settings, desired);
    await route.fulfill({ json: settings });
  });
  await page.goto("/watchlist/");
  await expect(page.locator(".watchlist-price").first()).toHaveText(
    "82,437.40",
  );
  const alert = page.getByRole("switch", {
    name: "Enable BTC alerts",
    exact: true,
  });
  await expect(alert).toHaveAttribute("aria-checked", "true");
  await alert.click();
  await expect.poll(() => writes.length).toBe(1);
  await alert.click();
  await expect(alert).toHaveAttribute("aria-checked", "true");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  releaseFirst();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[0].alerts).not.toContain("BTC");
  expect(writes[1].alerts).toContain("BTC");
  await expect.poll(() => settings.alerts.includes("BTC")).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("switch", { name: "Enable BTC alerts", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
});
