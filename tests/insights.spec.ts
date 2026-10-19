import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("watchlist additions, alert preferences and removals persist after reload", async ({
  page,
}) => {
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
  await page.goto("/signals/");
  await page
    .getByRole("combobox", { name: "Filter by symbol" })
    .selectOption("BTC");
  await page
    .getByRole("combobox", { name: "Filter by signal" })
    .selectOption("BUY");
  await page.getByLabel("Signals from date").fill("2026-10-17");
  await page.getByLabel("Signals until date").fill("2026-10-19");
  await page.getByRole("button", { name: "6 candles", exact: true }).click();

  const rows = page.locator("tr.history-row");
  await expect(rows).toHaveCount(2);
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
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("signal-history-demo.csv");
  const path = await download.path();
  expect(path).not.toBeNull();
  const csv = await readFile(path!, "utf8");
  const lines = csv.trim().split("\r\n");
  expect(lines).toHaveLength(3);
  expect(lines[0]).toContain("Price change after 6 candles (%)");
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

test("analytics distinguishes unevaluated outcomes from zero results", async ({
  page,
}) => {
  await page.goto("/analytics/");
  await page.getByRole("button", { name: "24h", exact: true }).click();
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
