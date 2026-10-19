import { expect, test } from "@playwright/test";

test("strategy rejects incompatible periods and persists a valid configuration after reload", async ({
  page,
}) => {
  await page.goto("/settings/");
  const fastPeriod = page.getByRole("spinbutton", {
    name: "EMA fast period",
    exact: true,
  });
  await fastPeriod.fill("250");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".settings-form-error")).toHaveText(
    "Fast periods must be smaller than their corresponding slow periods.",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("signal-agent-strategy")),
  ).toBeNull();

  await fastPeriod.fill("34");
  await page
    .getByRole("spinbutton", { name: "EMA slow period", exact: true })
    .fill("144");
  await page
    .getByRole("spinbutton", { name: "RSI period", exact: true })
    .fill("21");
  await page
    .getByRole("switch", { name: "Higher timeframe confirmation", exact: true })
    .click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Just saved on this device", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".settings-form-error")).toHaveCount(0);

  await page.reload();
  await expect(fastPeriod).toHaveValue("34");
  await expect(
    page.getByRole("spinbutton", { name: "EMA slow period", exact: true }),
  ).toHaveValue("144");
  await expect(
    page.getByRole("spinbutton", { name: "RSI period", exact: true }),
  ).toHaveValue("21");
  await expect(
    page.getByRole("switch", {
      name: "Higher timeframe confirmation",
      exact: true,
    }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Reset to default", exact: true })
    .click();
  await expect(fastPeriod).toHaveValue("50");
  await expect(
    page.getByRole("switch", {
      name: "Higher timeframe confirmation",
      exact: true,
    }),
  ).not.toBeChecked();
  await expect(
    page.getByText("You have unsaved changes", { exact: true }),
  ).toBeVisible();
});

test("strategy validates RSI boundaries and falls back from invalid saved settings", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const settings = {
      emaFast: 34,
      emaSlow: 144,
      macdFast: 12,
      macdSlow: 26,
      macdSignal: 9,
      rsiPeriod: 14,
      buyRsiMin: 45,
      buyRsiMax: 101,
      sellRsiMin: 30,
      sellRsiMax: 55,
      buy: { price: true, ema: true, macd: true, rsi: true },
      sell: { price: true, ema: true, macd: true, rsi: true },
      volumeFilter: true,
      trendFilter: false,
    };
    localStorage.setItem("signal-agent-strategy", JSON.stringify(settings));
  });
  await page.goto("/settings/");
  await expect(
    page.getByRole("spinbutton", { name: "EMA fast period", exact: true }),
  ).toHaveValue("50");
  await expect(
    page.getByRole("spinbutton", { name: "RSI maximum", exact: true }),
  ).toHaveValue("70");
  await page
    .getByRole("spinbutton", { name: "RSI minimum", exact: true })
    .fill("75");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
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
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".settings-form-error")).toHaveText(
    "Enable at least one condition for both buy and sell signals.",
  );
  await conditions.first().check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".settings-form-error")).toHaveCount(0);
  await expect(
    page.getByText("Just saved on this device", { exact: true }),
  ).toBeVisible();
});

test("Telegram preferences persist and a connection test never claims to send a message", async ({
  page,
}) => {
  await page.goto("/notifications/");
  await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
  const buyNotifications = page.getByRole("switch", {
    name: "Buy signal notifications",
    exact: true,
  });
  await expect(buyNotifications).toBeChecked();
  await buyNotifications.click();
  await expect(buyNotifications).not.toBeChecked();
  await page.reload();
  await expect(buyNotifications).not.toBeChecked();

  const outboundRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") outboundRequests.push(request.url());
  });
  await page
    .getByRole("button", { name: "Test notification", exact: true })
    .click();
  await expect(page.locator(".notifications-test-result")).toContainText(
    "No message sent. Telegram is not configured",
  );
  await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
  expect(outboundRequests).toEqual([]);
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
});

test("sign-in reveals a password, reports unavailable authentication, and opens the demo", async ({
  page,
}) => {
  await page.goto("/sign-in/");
  await expect(
    page.getByRole("heading", { name: "Welcome back.", exact: true, level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".signin-error")).toHaveText(
    "Enter a username with at least 3 characters.",
  );
  await page
    .getByRole("textbox", { name: "Username", exact: true })
    .fill("demo-user");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("demo-password");
  await expect(password).toHaveAttribute("type", "password");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("demo-password");
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".signin-error")).toContainText(
    "Authentication is not connected in this UI demo.",
  );
  await page
    .getByRole("link", { name: "Explore the demo", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Market overview", exact: true }),
  ).toBeVisible();
});
