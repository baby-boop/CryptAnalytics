import { test, expect } from "@playwright/test";

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
