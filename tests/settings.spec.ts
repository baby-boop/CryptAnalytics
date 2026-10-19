import { expect, test } from "@playwright/test";
import { mockMarketApi } from "./market-fixtures";

test("strategy rejects incompatible periods and persists valid server settings after reload", async ({
  page,
}) => {
  const serverSettings = await mockMarketApi(page);
  await page.goto("/settings/");
  const save = page.getByRole("button", { name: "Save changes", exact: true });
  await expect(save).toBeEnabled();
  const fastPeriod = page.getByRole("spinbutton", {
    name: "EMA fast period",
    exact: true,
  });
  await fastPeriod.fill("250");
  await save.click();
  await expect(page.locator(".settings-form-error")).toHaveText(
    "Fast periods must be smaller than their corresponding slow periods.",
  );
  expect(serverSettings.strategy.emaFast).toBe(50);

  await fastPeriod.fill("34");
  await page
    .getByRole("spinbutton", { name: "EMA slow period", exact: true })
    .fill("144");
  await page
    .getByRole("spinbutton", { name: "RSI period", exact: true })
    .fill("21");
  await expect(
    page.getByRole("switch", {
      name: "Higher timeframe confirmation",
      exact: true,
    }),
  ).toBeDisabled();
  await save.click();
  await expect(
    page.getByText("Saved to MongoDB", { exact: true }),
  ).toBeVisible();
  expect(serverSettings.strategy.emaFast).toBe(34);
  expect(serverSettings.strategy.emaSlow).toBe(144);

  await page.reload();
  await expect(fastPeriod).toHaveValue("34");
  await expect(
    page.getByRole("spinbutton", { name: "EMA slow period", exact: true }),
  ).toHaveValue("144");
  await expect(
    page.getByRole("spinbutton", { name: "RSI period", exact: true }),
  ).toHaveValue("21");
  await page
    .getByRole("button", { name: "Reset to default", exact: true })
    .click();
  await expect(fastPeriod).toHaveValue("50");
  await expect(
    page.getByText("You have unsaved changes", { exact: true }),
  ).toBeVisible();
  expect(serverSettings.strategy.emaFast).toBe(34);
});

test("strategy ignores stale browser settings and validates RSI boundaries and enabled conditions", async ({
  page,
}) => {
  await mockMarketApi(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "signal-agent-strategy",
      JSON.stringify({ emaFast: 34, buyRsiMax: 101 }),
    ),
  );
  await page.goto("/settings/");
  const save = page.getByRole("button", { name: "Save changes", exact: true });
  await expect(save).toBeEnabled();
  await expect(
    page.getByRole("spinbutton", { name: "EMA fast period", exact: true }),
  ).toHaveValue("50");
  await expect(
    page.getByRole("spinbutton", { name: "RSI maximum", exact: true }),
  ).toHaveValue("70");
  await page
    .getByRole("spinbutton", { name: "RSI minimum", exact: true })
    .fill("75");
  await save.click();
  await expect(page.locator(".settings-form-error")).toHaveText(
    "Each RSI range must increase from a minimum of 0 to a maximum of 100.",
  );
  await page
    .getByRole("spinbutton", { name: "RSI minimum", exact: true })
    .fill("45");
  const conditions = page.locator(
    '.settings-condition-list input[type="checkbox"]',
  );
  for (const condition of await conditions.all()) await condition.uncheck();
  await save.click();
  await expect(page.locator(".settings-form-error")).toHaveText(
    "Enable at least one condition for both buy and sell signals.",
  );
  await conditions.first().check();
  await save.click();
  await expect(page.locator(".settings-form-error")).toHaveCount(0);
  await expect(
    page.getByText("Saved to MongoDB", { exact: true }),
  ).toBeVisible();
});

test("Telegram preferences persist on the server and an unconfigured test reports the real rejection", async ({
  page,
}) => {
  const serverSettings = await mockMarketApi(page);
  await page.goto("/notifications/");
  await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
  const buyNotifications = page.getByRole("switch", {
    name: "Buy signal notifications",
    exact: true,
  });
  await expect(buyNotifications).toBeChecked();
  await buyNotifications.click();
  await expect(buyNotifications).not.toBeChecked();
  expect(serverSettings.notifications.buy).toBe(false);
  await page.reload();
  await expect(buyNotifications).not.toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Daily market summary", exact: true }),
  ).toBeDisabled();

  const testRequest = page.waitForRequest(
    (request) =>
      request.url().includes("/api/notifications/test") &&
      request.method() === "POST",
  );
  await page
    .getByRole("button", { name: "Test notification", exact: true })
    .click();
  await testRequest;
  await expect(page.locator(".notifications-test-result")).toContainText(
    "No message sent. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID",
  );
  await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
  await expect(
    page.getByText("No delivery attempts recorded yet.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Set up Telegram", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Connect through your backend",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Bot tokens are never requested or saved in this browser.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("signal-agent-notifications"),
    ),
  ).toBeNull();
});

test("sign-in submits credentials to the backend and redirects only after authentication", async ({
  page,
}) => {
  await mockMarketApi(page, { authRequired: true });
  await page.goto("/sign-in/");
  await expect(
    page.getByRole("heading", { name: "Welcome back.", exact: true, level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".signin-error")).toHaveText(
    "Enter your username.",
  );
  await page
    .getByRole("textbox", { name: "Username", exact: true })
    .fill("admin");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("test-password");
  await expect(password).toHaveAttribute("type", "password");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  const loginRequest = page.waitForRequest(
    (request) =>
      request.url().includes("/api/auth/login") && request.method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await loginRequest).postDataJSON()).toEqual({
    username: "admin",
    password: "test-password",
    remember: false,
  });
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Market overview", exact: true }),
  ).toBeVisible();
});

test("local authentication-disabled mode opens the workspace without claiming a login", async ({
  page,
}) => {
  await mockMarketApi(page);
  await page.goto("/sign-in/");
  await expect(
    page.getByText(
      "Authentication is disabled for this local workspace. Open the workspace to continue.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Open workspace", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Market overview", exact: true }),
  ).toBeVisible();
});

test("a rejected server login keeps the user on sign-in and displays its error", async ({
  page,
}) => {
  await mockMarketApi(page, { authRequired: true });
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 401,
      json: { error: { message: "Invalid username or password." } },
    }),
  );
  await page.goto("/sign-in/");
  await page
    .getByRole("textbox", { name: "Username", exact: true })
    .fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".signin-error")).toHaveText(
    "Invalid username or password.",
  );
  await expect(page).toHaveURL(/\/sign-in\/$/);
});
