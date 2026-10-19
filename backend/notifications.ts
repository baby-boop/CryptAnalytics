import type { Db } from "mongodb";
import type { HistorySignal } from "../lib/data";
import type { NotificationLog } from "./db";

export function createTelegram(
  db: Db,
  token: string,
  chatId: string,
  publicOrigin = "",
) {
  const configured = Boolean(token && chatId);
  const pending = new Set<string>();
  async function send(signalId: string, text: string, kind: "signal" | "test") {
    if (!configured)
      throw new Error(
        "Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the backend .env file.",
      );
    if (pending.has(signalId)) return;
    pending.add(signalId);
    try {
      const logs = db.collection<NotificationLog>("notification_logs");
      const existing = await logs.findOne({ signalId });
      // A pending delivery is not automatically repeated after a process crash: the remote outcome may be unknown.
      if (existing?.status === "sent" || existing?.status === "pending") return;
      await logs.updateOne(
        { signalId },
        {
          $setOnInsert: { signalId, kind, createdAt: new Date(), attempts: 0 },
          $set: { status: "pending", updatedAt: new Date() },
        },
        { upsert: true },
      );
      for (let attempt = existing?.attempts ?? 0; attempt < 3; attempt++) {
        await logs.updateOne(
          { signalId },
          { $set: { attempts: attempt + 1, updatedAt: new Date() } },
        );
        let response: Response;
        try {
          response = await fetch(
            `https://api.telegram.org/bot${token}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text,
                disable_web_page_preview: true,
              }),
              signal: AbortSignal.timeout(15000),
            },
          );
        } catch {
          // A timed-out send can have reached Telegram. Do not risk duplicating an unknown outcome.
          await logs.updateOne(
            { signalId },
            { $set: { status: "failed", updatedAt: new Date() } },
          );
          throw new Error(
            "Telegram delivery could not be confirmed. Check the server notification log.",
          );
        }
        const result: unknown = await response.json().catch(() => null);
        const payload = result as {
          ok?: boolean;
          parameters?: { retry_after?: number };
        } | null;
        if (response.ok && payload?.ok) {
          await logs.updateOne(
            { signalId },
            { $set: { status: "sent", updatedAt: new Date() } },
          );
          return;
        }
        if (response.status !== 429 || attempt === 2) break;
        const wait = Math.min(
          30,
          Math.max(1, payload?.parameters?.retry_after ?? 2 ** attempt),
        );
        await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      }
      await db
        .collection<NotificationLog>("notification_logs")
        .updateOne(
          { signalId },
          { $set: { status: "failed", updatedAt: new Date() } },
        );
      throw new Error(
        "Telegram rejected the notification. Check your backend configuration.",
      );
    } finally {
      pending.delete(signalId);
    }
  }
  return {
    configured,
    sendTest: () =>
      send(
        `test-${crypto.randomUUID()}`,
        "Crypto Signal Agent\nConnection test successful. Live technical signals are enabled only in your notification settings.",
        "test",
      ),
    sendSignal: (signal: HistorySignal, includeChart = false) =>
      send(
        signal.id,
        `${signal.symbol}/USDT · ${signal.signal} · ${signal.timeframe}\nClosed: ${signal.time}\nClose price: ${signal.price}\nRSI: ${signal.rsi.toFixed(2)}\nMACD: ${signal.macd.toFixed(5)} / ${signal.macdSignal.toFixed(5)}\n${signal.reason}\nStrategy: ${signal.strategyVersion}\nTechnical signal only.${includeChart && /^https?:\/\//.test(publicOrigin) ? `\nChart: ${publicOrigin.replace(/\/$/, "")}/markets/?symbol=${encodeURIComponent(signal.symbol)}` : ""}`,
        "signal",
      ),
  };
}
