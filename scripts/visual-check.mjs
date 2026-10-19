import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
const results = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir("test-results/screenshots", { recursive: true });
for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: width === 1440 ? 1100 : 844 });
  for (const route of [
    "/",
    "/markets/",
    "/signals/",
    "/analytics/",
    "/watchlist/",
    "/settings/",
    "/notifications/",
    "/sign-in/",
  ]) {
    await page.goto(`http://127.0.0.1:3000${route}`);
    await page.locator("h1").waitFor({ state: "attached" });
    if (route === "/markets/") await page.locator("canvas").first().waitFor();
    await page.screenshot({
      path: `test-results/screenshots/${route.replaceAll("/", "") || "dashboard"}-${width}.png`,
      fullPage: true,
    });
    results.push({
      route,
      width,
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    });
  }
}
await page.setViewportSize({ width: 1440, height: 1100 });
await page.goto("http://127.0.0.1:3000/");
await page.getByRole("button", { name: "Dark appearance" }).click();
await page.screenshot({
  path: "test-results/screenshots/dashboard-light.png",
  fullPage: true,
});
await writeFile(
  "test-results/visual-report.json",
  JSON.stringify({ results, errors }, null, 2),
);
console.log(JSON.stringify({ results, errors }, null, 2));
await browser.close();
