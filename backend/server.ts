import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { config } from "./config";
import {
  connectDatabase,
  readSignals,
  type NotificationLog,
  type StoredCandle,
} from "./db";
import { createMarketEngine } from "./market";
import { createTelegram } from "./notifications";
import {
  checkOrigin,
  createSession,
  passwordMatches,
  validSession,
} from "./auth";
import {
  coins,
  defaultWatchlist,
  timeframes,
  type Timeframe,
} from "../lib/data";
import { defaultStrategy, readStrategySettings } from "../lib/strategy";
import type { ServerSettings } from "../lib/server-types";

const symbols = new Set(coins.map((coin) => coin.symbol));
const symbolSchema = z
  .string()
  .refine((value) => symbols.has(value), "Unsupported USDT Spot symbol.");
const timeframeSchema = z.enum(["15m", "1h", "4h", "1d"]);
const defaultSettings: ServerSettings = {
  strategy: defaultStrategy,
  watchlist: defaultWatchlist,
  alerts: ["BTC", "SOL", "BNB"],
  notifications: { enabled: false, buy: true, sell: true, includeChart: true },
  revision: 0,
};

async function main() {
  const { db, client } = await connectDatabase(
    config.mongoUri,
    config.database,
  );
  let cleanupEngine: ReturnType<typeof createMarketEngine> | undefined;
  try {
    const settingsCollection = db.collection<ServerSettings & { _id: string }>(
      "settings",
    );
    await settingsCollection.updateOne(
      { _id: "main" },
      { $setOnInsert: defaultSettings },
      { upsert: true },
    );
    const stored = await settingsCollection.findOne(
      { _id: "main" },
      { projection: { _id: 0 } },
    );
    let settings: ServerSettings = {
      strategy: readStrategySettings(stored?.strategy) ?? defaultStrategy,
      watchlist:
        stored?.watchlist?.filter((symbol) => symbols.has(symbol)) ??
        defaultWatchlist,
      alerts:
        stored?.alerts?.filter((symbol) => symbols.has(symbol)) ??
        defaultSettings.alerts,
      notifications: {
        ...defaultSettings.notifications,
        ...stored?.notifications,
      },
      revision: stored?.revision ?? 0,
    };
    const telegram = createTelegram(
      db,
      config.telegramToken,
      config.telegramChat,
      config.publicOrigin,
    );
    const engine = createMarketEngine(db, () => settings, telegram);
    cleanupEngine = engine;
    let settingsWrites: Promise<void> = Promise.resolve();
    function updateSettings(
      change: (current: ServerSettings) => ServerSettings,
    ): Promise<ServerSettings> {
      const operation = settingsWrites.then(async () => {
        const next = {
          ...change(settings),
          revision: (settings.revision ?? 0) + 1,
        };
        const strategyChanged =
          JSON.stringify(next.strategy) !== JSON.stringify(settings.strategy);
        await settingsCollection.updateOne({ _id: "main" }, { $set: next });
        settings = next;
        engine.settingsChanged(settings, strategyChanged);
        return settings;
      });
      settingsWrites = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    }
    const app = Fastify({
      logger: false,
      bodyLimit: 16384,
      requestTimeout: 20000,
    });
    const sseClients = new Set<import("node:http").ServerResponse>();
    const origins = new Set(
      [
        config.frontendOrigin,
        config.publicOrigin,
        `http://127.0.0.1:${config.port}`,
        `http://localhost:${config.port}`,
      ].filter(Boolean),
    );
    await app.register(cors, { origin: [...origins], credentials: true });
    await app.register(cookie);
    await app.register(rateLimit, { global: false });
    const authRequired = Boolean(config.passwordHash);
    app.addHook("preHandler", async (request, reply) => {
      if (!request.url.startsWith("/api/")) return;
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        const blocked = checkOrigin(request, reply, origins);
        if (blocked) return blocked;
      }
      const publicPaths = ["/api/health", "/api/session", "/api/auth/login"];
      if (
        authRequired &&
        request.method !== "OPTIONS" &&
        !publicPaths.includes(request.url.split("?")[0]) &&
        !validSession(
          request.cookies.session,
          config.username,
          config.sessionSecret,
        )
      ) {
        return reply.code(401).send({
          error: { message: "Sign in to access the Signal Agent backend." },
        });
      }
    });
    app.setErrorHandler((error, _request, reply) => {
      if (error instanceof z.ZodError)
        return reply.code(400).send({
          error: {
            message: error.issues.map((issue) => issue.message).join(" "),
          },
        });
      const statusCode =
        error &&
        typeof error === "object" &&
        "statusCode" in error &&
        typeof error.statusCode === "number"
          ? error.statusCode
          : 500;
      if (statusCode === 429)
        return reply.code(429).send({
          error: {
            message: "Too many attempts. Please wait before trying again.",
          },
        });
      return reply.code(statusCode < 500 ? statusCode : 500).send({
        error: {
          message:
            "The request could not be completed. Check the backend configuration and connection.",
        },
      });
    });
    app.get("/api/health", async () => ({
      ok: true,
      database: "connected",
      source: "Binance Spot",
      authRequired,
      telegramConfigured: telegram.configured,
      time: new Date().toISOString(),
    }));
    app.get("/api/session", async (request) => ({
      authRequired,
      authenticated:
        !authRequired ||
        validSession(
          request.cookies.session,
          config.username,
          config.sessionSecret,
        ),
      username: authRequired ? undefined : "Local workspace",
    }));
    app.post(
      "/api/auth/login",
      { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
      async (request, reply) => {
        const body = z
          .object({
            username: z.string().min(1).max(100),
            password: z.string().min(1).max(256),
            remember: z.boolean().optional(),
          })
          .parse(request.body);
        if (!authRequired) return { authenticated: true, localOnly: true };
        if (
          body.username !== config.username ||
          !passwordMatches(body.password, config.passwordHash)
        )
          return reply
            .code(401)
            .send({ error: { message: "Invalid username or password." } });
        const secure = config.publicOrigin.startsWith("https://");
        reply.setCookie(
          "session",
          createSession(config.username, config.sessionSecret),
          {
            path: "/",
            httpOnly: true,
            secure,
            sameSite:
              secure && config.frontendOrigin !== config.publicOrigin
                ? "none"
                : "strict",
            ...(body.remember ? { maxAge: 86400 } : {}),
          },
        );
        return { authenticated: true };
      },
    );
    app.post("/api/auth/logout", async (_request, reply) => {
      reply.clearCookie("session", { path: "/" });
      return { authenticated: false };
    });
    app.get("/api/symbols", async () => ({
      symbols: coins.map(({ symbol, name, color, icon }) => ({
        symbol,
        name,
        color,
        icon,
      })),
    }));
    app.get("/api/settings", async () => settings);
    app.put("/api/settings", async (request, reply) => {
      const body = z
        .object({
          strategy: z.unknown().optional(),
          watchlist: z.array(symbolSchema).max(10).optional(),
          alerts: z.array(symbolSchema).max(10).optional(),
          notifications: z
            .object({
              enabled: z.boolean(),
              buy: z.boolean(),
              sell: z.boolean(),
              includeChart: z.boolean(),
            })
            .optional(),
        })
        .strict()
        .parse(request.body);
      const strategy =
        body.strategy === undefined
          ? undefined
          : readStrategySettings(body.strategy);
      if (strategy === null)
        return reply.code(400).send({
          error: {
            message:
              "Invalid strategy parameters. Check the periods, RSI ranges, and supported filters.",
          },
        });
      return updateSettings((current) => ({
        ...current,
        ...body,
        strategy: strategy ?? current.strategy,
        watchlist: body.watchlist
          ? [...new Set(body.watchlist)]
          : current.watchlist,
        alerts: body.alerts ? [...new Set(body.alerts)] : current.alerts,
      }));
    });
    app.get("/api/market", async (request) => {
      const query = z
        .object({ timeframe: timeframeSchema.default("4h") })
        .parse(request.query);
      return engine.snapshot(query.timeframe);
    });
    app.get("/api/candles", async (request) => {
      const query = z
        .object({
          symbol: symbolSchema,
          timeframe: timeframeSchema.default("4h"),
          limit: z.coerce.number().int().min(1).max(1000).default(1000),
        })
        .parse(request.query);
      const cached = engine.snapshot(query.timeframe).candles[query.symbol];
      if (cached?.length) return { candles: cached.slice(-query.limit) };
      const rows = await db
        .collection<StoredCandle>("candles")
        .find(
          { symbol: query.symbol, timeframe: query.timeframe },
          { projection: { _id: 0, symbol: 0, timeframe: 0 } },
        )
        .sort({ time: -1 })
        .limit(query.limit)
        .toArray();
      return { candles: rows.reverse() };
    });
    app.get("/api/signals", async (request) => {
      const query = z
        .object({
          limit: z.coerce.number().int().min(1).max(5000).default(5000),
        })
        .parse(request.query);
      return {
        signals: await readSignals(db, query.limit),
        limit: query.limit,
      };
    });
    app.get("/api/signals/latest", async (request) => {
      const query = z
        .object({ timeframe: timeframeSchema.default("4h") })
        .parse(request.query);
      const snapshot = engine.snapshot(query.timeframe);
      return {
        signals: Object.entries(snapshot.candles).map(([symbol, candles]) => ({
          symbol,
          ...analyzeLatest(symbol, query.timeframe, candles, settings),
        })),
      };
    });
    app.post(
      "/api/refresh",
      { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
      async () => {
        engine.refresh();
        return { accepted: true };
      },
    );
    app.post("/api/watchlist", async (request) => {
      const { symbol } = z.object({ symbol: symbolSchema }).parse(request.body);
      const result = await updateSettings((current) => ({
        ...current,
        watchlist: [...new Set([...current.watchlist, symbol])],
      }));
      return { watchlist: result.watchlist };
    });
    app.delete("/api/watchlist/:symbol", async (request) => {
      const { symbol } = z
        .object({ symbol: symbolSchema })
        .parse(request.params);
      const result = await updateSettings((current) => ({
        ...current,
        watchlist: current.watchlist.filter((value) => value !== symbol),
        alerts: current.alerts.filter((value) => value !== symbol),
      }));
      return { watchlist: result.watchlist };
    });
    app.get("/api/notifications/status", async () => ({
      configured: telegram.configured,
      settings: settings.notifications,
      logs: await db
        .collection<NotificationLog>("notification_logs")
        .find({}, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray(),
    }));
    app.post(
      "/api/notifications/test",
      { config: { rateLimit: { max: 3, timeWindow: "1 minute" } } },
      async (_request, reply) => {
        if (!telegram.configured)
          return reply.code(409).send({
            error: {
              message:
                "No message sent. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the backend .env file.",
            },
          });
        try {
          await telegram.sendTest();
          return { sent: true };
        } catch (error) {
          return reply.code(502).send({
            error: {
              message:
                error instanceof Error
                  ? error.message
                  : "Telegram delivery failed.",
            },
          });
        }
      },
    );
    app.get("/api/events", async (request, reply) => {
      reply.hijack();
      sseClients.add(reply.raw);
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        ...(request.headers.origin && origins.has(request.headers.origin)
          ? {
              "Access-Control-Allow-Origin": request.headers.origin,
              "Access-Control-Allow-Credentials": "true",
            }
          : {}),
      });
      reply.raw.write("retry: 5000\n\n");
      const unsubscribe = engine.subscribe((event) => {
        if (reply.raw.destroyed) return;
        if (reply.raw.writableLength > 1024 * 1024) {
          reply.raw.end();
          return;
        }
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      });
      const timer = setInterval(() => {
        if (!reply.raw.destroyed) reply.raw.write(": keepalive\n\n");
      }, 20000);
      reply.raw.on("close", () => {
        sseClients.delete(reply.raw);
        clearInterval(timer);
        unsubscribe();
      });
    });
    if (existsSync(path.resolve("out/index.html")))
      await app.register(fastifyStatic, {
        root: path.resolve("out"),
        prefix: "/",
        index: ["index.html"],
        redirect: true,
      });
    app.addHook("preClose", async () => {
      for (const stream of sseClients) stream.end();
      await settingsWrites;
      await engine.close();
    });
    app.addHook("onClose", async () => {
      await client.close();
    });
    await app.listen({ host: config.host, port: config.port });
    console.log(
      `Signal Agent backend: http://${config.host}:${config.port} · MongoDB connected`,
    );
    void engine.start();
    const shutdown = async () => {
      await app.close();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    try {
      await cleanupEngine?.close();
    } finally {
      await client.close();
    }
    throw error;
  }
}

import { analyzeMarket } from "../lib/market-analysis";
import type { MarketCandle } from "../lib/binance";
function analyzeLatest(
  symbol: string,
  timeframe: Timeframe,
  candles: MarketCandle[],
  settings: ServerSettings,
) {
  const analysis = analyzeMarket(symbol, timeframe, candles, settings.strategy);
  return {
    signal: analysis.signal,
    reason: analysis.reason,
    closedCandle: analysis.closedCandle,
    strategyVersion: analysis.strategyVersion,
    conditions: analysis.conditions,
  };
}

void main().catch(() => {
  console.error(
    "Backend startup failed. Check MONGODB_URI, PORT, admin configuration, and database network permissions in .env. Secret values are not logged.",
  );
  process.exitCode = 1;
});
