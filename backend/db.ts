import { MongoClient, type Db } from "mongodb";
import type { HistorySignal, Timeframe } from "../lib/data";
import type { MarketCandle } from "../lib/binance";

export interface StoredCandle extends MarketCandle {
  symbol: string;
  timeframe: Timeframe;
}
export interface NotificationLog {
  signalId: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
  kind: "signal" | "test";
}

export async function connectDatabase(uri: string, name: string) {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 20000,
    waitQueueTimeoutMS: 10000,
    maxPoolSize: 10,
  });
  try {
    await client.connect();
    const db = client.db(name);
    await db.command({ ping: 1 });
    await Promise.all([
      db
        .collection<StoredCandle>("candles")
        .createIndex({ symbol: 1, timeframe: 1, time: 1 }, { unique: true }),
      db
        .collection<HistorySignal>("signals")
        .createIndex({ id: 1 }, { unique: true }),
      db
        .collection<HistorySignal>("signals")
        .createIndex(
          { symbol: 1, timeframe: 1, strategyVersion: 1, time: 1 },
          { unique: true },
        ),
      db.collection<HistorySignal>("signals").createIndex({ time: -1 }),
      db
        .collection<NotificationLog>("notification_logs")
        .createIndex({ signalId: 1 }, { unique: true }),
    ]);
    return { db, client };
  } catch {
    await client.close();
    throw new Error(
      "MongoDB connection failed. Check the backend MONGODB_URI, network access, and database permissions.",
    );
  }
}

export async function saveCandles(
  db: Db,
  symbol: string,
  timeframe: Timeframe,
  candles: MarketCandle[],
) {
  const closed = candles.filter((candle) => candle.closed);
  if (!closed.length) return;
  await db.collection<StoredCandle>("candles").bulkWrite(
    closed.map((candle) => ({
      updateOne: {
        filter: { symbol, timeframe, time: candle.time },
        update: { $set: { ...candle, symbol, timeframe } },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

export async function saveSignals(
  db: Db,
  signals: HistorySignal[],
): Promise<HistorySignal[]> {
  if (!signals.length) return [];
  const collection = db.collection<HistorySignal>("signals");
  const result = await collection.bulkWrite(
    signals.map((signal) => {
      const { result1, result3, result6, ...snapshot } = signal;
      const outcomes = { result1, result3, result6 };
      const pending = Object.fromEntries(
        Object.entries(outcomes).filter(([, value]) => value === null),
      );
      const evaluated = Object.fromEntries(
        Object.entries(outcomes).filter(([, value]) => value !== null),
      );
      return {
        updateOne: {
          filter: { id: signal.id },
          update: {
            $setOnInsert: { ...snapshot, ...pending },
            $set: evaluated,
          },
          upsert: true,
        },
      };
    }),
    { ordered: false },
  );
  return Object.keys(result.upsertedIds).map((index) => signals[Number(index)]);
}

export async function readSignals(db: Db, limit = 5000) {
  return db
    .collection<HistorySignal>("signals")
    .find({}, { projection: { _id: 0 } })
    .sort({ time: -1 })
    .limit(limit)
    .toArray();
}

export async function evaluatePending(
  db: Db,
  symbol: string,
  timeframe: Timeframe,
  candles: MarketCandle[],
) {
  const closed = candles.filter((candle) => candle.closed);
  if (!closed.length) return;
  const rows = await db
    .collection<HistorySignal>("signals")
    .find({
      symbol,
      timeframe,
      time: {
        $gte: new Date(closed[0].closeTime).toISOString(),
        $lte: new Date(closed[closed.length - 1].closeTime).toISOString(),
      },
      $or: [{ result1: null }, { result3: null }, { result6: null }],
    })
    .sort({ time: -1 })
    .limit(1000)
    .toArray();
  const step = { "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 }[timeframe];
  const operations = rows.flatMap((row) => {
    const index = closed.findIndex(
      (candle) => candle.closeTime === Date.parse(row.time),
    );
    if (index < 0) return [];
    const updates: Partial<HistorySignal> = {};
    for (const horizon of [1, 3, 6] as const) {
      const key = `result${horizon}` as const;
      const next = closed[index + horizon];
      if (
        row[key] !== null ||
        !next ||
        next.time - closed[index].time !== step * horizon
      )
        continue;
      if (
        !closed
          .slice(index, index + horizon + 1)
          .every(
            (candle, offset) =>
              candle.time === closed[index].time + offset * step,
          )
      )
        continue;
      updates[key] = (next.close / row.price - 1) * 100;
    }
    return Object.keys(updates).length
      ? [{ updateOne: { filter: { id: row.id }, update: { $set: updates } } }]
      : [];
  });
  if (operations.length)
    await db
      .collection<HistorySignal>("signals")
      .bulkWrite(operations, { ordered: false });
}
