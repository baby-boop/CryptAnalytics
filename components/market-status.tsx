"use client";

import { Radio, RefreshCw, TriangleAlert } from "lucide-react";
import { useMarket } from "@/components/market-provider";

export function MarketStatus({
  compact = false,
  symbol,
}: {
  compact?: boolean;
  symbol?: string;
}) {
  const { status, lastUpdate, error, symbolErrors, refresh, mode } =
    useMarket();
  const message = (symbol ? symbolErrors[symbol] : null) || error;
  const healthy = status === "live";
  const label =
    message && status === "live"
      ? "Market data unavailable"
      : healthy
        ? "Live market"
        : status === "rest"
          ? "REST updates"
          : status === "loading"
            ? "Connecting"
            : status === "reconnecting"
              ? "Reconnecting · stale data"
              : "Offline · stale data";
  const timestamp = lastUpdate
    ? new Date(lastUpdate).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "UTC",
      }) + " UTC"
    : "Waiting for exchange data";
  if (compact)
    return (
      <span className="snapshot-status" role="status">
        <span className={`status-dot ${healthy ? "" : "amber"}`} />
        {label}
        <span>{timestamp}</span>
      </span>
    );
  return (
    <div className="demo-notice" role={message ? "alert" : "status"}>
      <div>
        <span className="demo-notice-icon">
          {message || status === "offline" ? (
            <TriangleAlert size={16} />
          ) : (
            <Radio size={16} />
          )}
        </span>
        <span>
          <strong>{label}</strong>
          <span>
            {" · "}
            {message ||
              (healthy
                ? "Binance Spot prices stream in real time. Signals use closed candles."
                : status === "rest"
                  ? "Real Binance prices are refreshing through REST while the stream reconnects."
                  : status === "loading"
                    ? "Loading prices and candle history from Binance Spot."
                    : "Showing the last received values while the connection recovers.")}
            {mode === "browser"
              ? " Preview connects directly to Binance; MongoDB and Telegram require the server."
              : ""}
          </span>
        </span>
      </div>
      <button
        className="btn btn-small"
        onClick={refresh}
        disabled={status === "loading"}
      >
        <RefreshCw size={13} className={status === "loading" ? "spin" : ""} />
        {status === "loading" ? "Connecting" : "Retry / refresh"}
      </button>
    </div>
  );
}
