import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mockMarketApi, testHistory } from "./market-fixtures";

test("watchlist additions, alert preferences and removals persist after reload", async ({
  page,
}) => {
  const settings = await mockMarketApi(page);
  await page.goto("/watchlist/");
  await expect(
    page.getByRole("heading", { name: "Watchlist", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("signal-agent-preferences")),
    )
    .not.toBeNull();
  await expect(
    page.getByRole("button", {
      name: "Remove ADA from watchlist",
      exact: true,
    }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Add symbol", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a symbol" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "Search available symbols" })
    .fill("Cardano");
  await dialog
    .getByRole("button", { name: "Add ADA to watchlist", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Close add symbol dialog" }).click();
  const alert = page.getByRole("switch", {
    name: "Enable ADA alerts",
    exact: true,
  });
  await expect(alert).toHaveAttribute("aria-checked", "false");
  await alert.click();
  await expect(alert).toHaveAttribute("aria-checked", "true");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const preferences = JSON.parse(
          localStorage.getItem("signal-agent-preferences") ?? "{}",
        ) as { watchlist?: string[]; alerts?: string[] };
        return (
          preferences.watchlist?.includes("ADA") &&
          preferences.alerts?.includes("ADA")
        );
      }),
    )
    .toBe(true);
  await expect.poll(() => settings.alerts.includes("ADA")).toBe(true);

  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Remove ADA from watchlist",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Enable ADA alerts", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page
    .getByRole("button", { name: "Remove ADA from watchlist", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const preferences = JSON.parse(
          localStorage.getItem("signal-agent-preferences") ?? "{}",
        ) as { watchlist?: string[]; alerts?: string[] };
        return (
          preferences.watchlist?.includes("ADA") ||
          preferences.alerts?.includes("ADA")
        );
      }),
    )
    .toBe(false);
  await expect
    .poll(
      () =>
        settings.watchlist.includes("ADA") || settings.alerts.includes("ADA"),
    )
    .toBe(false);
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Remove ADA from watchlist",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("history filters constrain the exported CSV and the selected outcome horizon", async ({
  page,
}) => {
  await mockMarketApi(page);
  await page.goto("/signals/");
  await expect(page.getByLabel("Signals from date")).toHaveValue("");
  await expect(page.getByLabel("Signals until date")).toHaveValue("");
  await page
    .getByRole("combobox", { name: "Filter by symbol" })
    .selectOption("BTC");
  await page
    .getByRole("combobox", { name: "Filter by signal" })
    .selectOption("BUY");
  await page
    .getByLabel("Signals from date")
    .fill(testHistory[0].time.slice(0, 10));
  await page
    .getByLabel("Signals until date")
    .fill(testHistory[0].time.slice(0, 10));
  await page.getByRole("button", { name: "6 candles", exact: true }).click();

  const rows = page.locator("tr.history-row");
  await expect(rows).toHaveCount(1);
  for (const row of await rows.all()) {
    await expect(row.locator("td").nth(1)).toContainText("BTC");
    await expect(row.locator("td").nth(3)).toContainText("BUY");
  }
  await rows
    .first()
    .getByRole("button", { name: /Show BTC signal details/ })
    .click();
  await expect(
    page.getByText("6-candle price movement", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Strategy v-test", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Live close", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Awaiting more candles", { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("signal-history.csv");
  const path = await download.path();
  expect(path).not.toBeNull();
  const csv = await readFile(path!, "utf8");
  const lines = csv.trim().split("\r\n");
  expect(lines).toHaveLength(2);
  expect(lines[0]).toContain("Price change after 6 candles (%)");
  expect(lines[0]).toContain("Strategy version");
  expect(lines[0]).toContain("EMA fast");
  expect(lines[1]).toContain('"v-test"');
  expect(lines[1]).toContain('"live"');
  expect(
    lines
      .slice(1)
      .every((line) => line.includes('"BTC"') && line.includes('"BUY"')),
  ).toBe(true);

  await page
    .getByRole("combobox", { name: "Filter by timeframe" })
    .selectOption("15m");
  await expect(
    page.getByRole("heading", { name: "No matching signals" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeDisabled();
});

test("analytics signs real SELL outcomes and excludes unevaluated horizons", async ({
  page,
}) => {
  await mockMarketApi(page);
  await page.goto("/analytics/");
  await page.getByRole("button", { name: "24h", exact: true }).click();
  await expect(
    page
      .locator(".metric-card")
      .filter({ hasText: "Evaluated signals" })
      .locator(".metric-value"),
  ).toHaveText("2");
  await expect(
    page
      .locator(".metric-card")
      .filter({ hasText: "Directional accuracy" })
      .locator(".metric-value"),
  ).toHaveText("100.0%");
  await expect(page.locator(".analytics-chart-summary strong")).toContainText(
    "+2.50%",
  );
  await page.getByRole("button", { name: "6 candles", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Outcomes are still pending" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No evaluated symbols yet" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "1 candle", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Outcomes are still pending" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("img", {
      name: "Daily average directional price movement in percent",
    }),
  ).toBeVisible();
});

test("a zero observed price change is evaluated and an empty archive stays empty", async ({
  page,
}) => {
  await mockMarketApi(page, {
    history: testHistory.map((row, index) => ({
      ...row,
      result6: index === 0 ? 0 : null,
    })),
  });
  await page.goto("/analytics/");
  await page.getByRole("button", { name: "6 candles", exact: true }).click();
  await expect(
    page
      .locator(".metric-card")
      .filter({ hasText: "Evaluated signals" })
      .locator(".metric-value"),
  ).toHaveText("1");
  await expect(page.locator(".analytics-chart-summary strong")).toContainText(
    "0.00%",
  );
  await expect(
    page.getByRole("heading", { name: "Outcomes are still pending" }),
  ).toHaveCount(0);

  await page.route("**/api/signals?*", (route) =>
    route.fulfill({ json: { signals: [], limit: 5000 } }),
  );
  await page.goto("/signals/");
  await expect(
    page.getByRole("heading", { name: "No signals recorded yet" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  await expect(page.locator("tr.history-row")).toHaveCount(0);
});

test("an archived signal notification updates history without reloading the page", async ({
  page,
}) => {
  const signals = testHistory.slice(0, 0);
  await mockMarketApi(page, { history: signals });
  await page.goto("/signals/");
  await expect(
    page.getByRole("heading", { name: "No signals recorded yet" }),
  ).toBeVisible();
  signals.push(testHistory[0]);
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("test:market-event", { detail: { type: "history" } }),
    ),
  );
  await expect(page.locator("tr.history-row")).toHaveCount(1);
  await expect(page.locator("tr.history-row")).toContainText("BTC");
  await expect(page.locator("tr.history-row")).toContainText("BUY");
});

test("a slower old history response cannot remove a newer signal or evaluated outcome", async ({
  page,
}) => {
  await mockMarketApi(page);
  const oldRows = testHistory.map((row) => ({ ...row, result3: null }));
  const newRows = [
    {
      ...testHistory[0],
      id: "later-ada-signal",
      symbol: "ADA",
      price: 0.35,
      reason: "New closed-candle signal",
    },
    { ...testHistory[0], result3: 7 },
    testHistory[1],
  ];
  let baselineRequests = 0;
  let racing = false;
  let olderRequestStarted = false;
  let releaseOlder!: () => void;
  let notifyOlderStarted!: () => void;
  const olderGate = new Promise<void>((resolve) => {
    releaseOlder = resolve;
  });
  const olderStarted = new Promise<void>((resolve) => {
    notifyOlderStarted = resolve;
  });
  await page.route("**/api/signals?*", async (route) => {
    if (!racing) {
      baselineRequests++;
      await route.fulfill({ json: { signals: oldRows, limit: 5000 } });
    } else if (!olderRequestStarted) {
      olderRequestStarted = true;
      notifyOlderStarted();
      await olderGate;
      await route.fulfill({
        headers: { "X-Test-History-Snapshot": "old" },
        json: { signals: oldRows, limit: 5000 },
      });
    } else {
      await route.fulfill({ json: { signals: newRows, limit: 5000 } });
    }
  });
  await page.goto("/signals/");
  // Initial bootstrap and the first SSE onopen both refresh the archive.
  await expect.poll(() => baselineRequests).toBeGreaterThanOrEqual(2);
  await expect(page.locator("tr.history-row")).toHaveCount(2);
  await page.evaluate(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.headers.get("X-Test-History-Snapshot") === "old") {
        const readJson = response.json.bind(response);
        response.json = async () => {
          const value: unknown = await readJson();
          // Observe body consumption, then let the application's promise chain finish.
          setTimeout(() => {
            (
              window as Window & { oldHistoryConsumed?: boolean }
            ).oldHistoryConsumed = true;
          }, 0);
          return value;
        };
      }
      return response;
    };
  });
  racing = true;
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("test:market-event", { detail: { type: "history" } }),
    ),
  );
  await olderStarted;
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("test:market-event", { detail: { type: "history" } }),
    ),
  );
  const newerSignal = page.locator("tr.history-row").filter({ hasText: "ADA" });
  const btcOutcome = page
    .locator("tr.history-row")
    .filter({ hasText: "BTC" })
    .locator("td")
    .nth(6);
  await expect(newerSignal).toHaveCount(1);
  await expect(btcOutcome).toHaveText("+7.00%");
  releaseOlder();
  await page.waitForFunction(
    () =>
      (window as Window & { oldHistoryConsumed?: boolean })
        .oldHistoryConsumed === true,
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(newerSignal).toHaveCount(1);
  await expect(btcOutcome).toHaveText("+7.00%");
});
