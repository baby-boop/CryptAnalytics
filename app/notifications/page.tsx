"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  BellRing,
  Check,
  CircleHelp,
  ExternalLink,
  LockKeyhole,
  MessageCircle,
  Send,
  Settings2,
  ShieldCheck,
  Volume2,
  WifiOff,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import { useMarket } from "@/components/market-provider";
import { CoinIcon, PageHeading, Panel, Toggle } from "@/components/ui";
import { coins, formatChange, formatPrice } from "@/lib/data";
import { apiRequest } from "@/lib/api";
import type { NotificationSettings, ServerSettings } from "@/lib/server-types";
import "../settings-views.css";

interface DeliveryLog {
  signalId: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  createdAt: string;
  updatedAt: string;
  kind: "signal" | "test";
}
interface DeliveryStatus {
  configured: boolean;
  settings: NotificationSettings;
  logs: DeliveryLog[];
}
const defaultPreferences: NotificationSettings = {
  enabled: false,
  buy: true,
  sell: true,
  includeChart: true,
};

export default function NotificationsPage() {
  const { sound, setSound, toast, timeframe } = useApp();
  const { connected, mode, markets, history } = useMarket();
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const backendAvailable = connected && mode === "server";
  const btc = markets.find((coin) => coin.symbol === "BTC") ?? coins[0];
  const latestSignal = history.find(
    (row) => row.symbol === "BTC" && row.timeframe === timeframe,
  );

  const readStatus = useCallback(async (signal?: AbortSignal) => {
    const result = await apiRequest<DeliveryStatus>("/notifications/status", {
      signal,
    });
    if (signal?.aborted) return;
    setPreferences(result.settings);
    setConfigured(result.configured);
    setLogs(result.logs);
    setReady(true);
    setError("");
  }, []);

  useEffect(() => {
    if (!backendAvailable) {
      setReady(false);
      return;
    }
    const controller = new AbortController();
    void readStatus(controller.signal).catch((error) => {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "Could not load notification settings.",
        );
    });
    return () => controller.abort();
  }, [backendAvailable, readStatus]);

  async function update(key: keyof NotificationSettings, checked: boolean) {
    if (!backendAvailable || !ready || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await apiRequest<ServerSettings>("/settings", {
        method: "PUT",
        body: JSON.stringify({
          notifications: { ...preferences, [key]: checked },
        }),
      });
      setPreferences(result.notifications);
      toast("Notification settings saved to MongoDB.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save notification settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function testNotification() {
    setTesting(true);
    setTestResult("");
    try {
      const result = await apiRequest<{ sent: boolean }>(
        "/notifications/test",
        { method: "POST", body: "{}" },
      );
      setTestResult(
        result.sent
          ? "Test message sent to Telegram."
          : "Telegram did not confirm delivery.",
      );
      void readStatus().catch((error) =>
        setError(
          error instanceof Error
            ? error.message
            : "The delivery log could not be refreshed.",
        ),
      );
    } catch (error) {
      setTestResult(
        error instanceof Error
          ? error.message
          : "Telegram delivery failed. No delivery confirmation received.",
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="notifications-page">
      <PageHeading
        eyebrow="STAY ONE STEP AHEAD"
        title="Notifications"
        description="The signals you care about, wherever you are."
        actions={
          <Link className="btn btn-ghost" href="/settings">
            <Settings2 size={15} /> Manage strategy
          </Link>
        }
      />
      <section className="notifications-connection panel">
        <div className="notifications-telegram-icon">
          <Send size={25} />
        </div>
        <div className="notifications-connection-copy">
          <div>
            <h2>Telegram notifications</h2>
            <span className="notifications-status">
              <span />{" "}
              {!backendAvailable
                ? "Backend unavailable"
                : !ready
                  ? "Checking configuration…"
                  : configured
                    ? "Configured"
                    : "Not configured"}
            </span>
          </div>
          <p>Your market updates, delivered directly to Telegram.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowSetup((value) => !value)}
        >
          <Send size={14} />
          {showSetup ? "Hide setup guide" : "Set up Telegram"}
          <ArrowUpRight size={14} />
        </button>
      </section>
      <div className="notifications-layout section-gap">
        <div className="settings-main-stack">
          {showSetup && (
            <Panel
              title="Connect through your backend"
              description="Keep your bot credentials on the server, where they belong."
            >
              <ol className="notifications-setup-list">
                <li>
                  <span>1</span>
                  <div>
                    <strong>Create a Telegram bot</strong>
                    <p>
                      Open @BotFather in Telegram and create a bot. Keep the
                      generated bot token private.
                    </p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>Configure server environment variables</strong>
                    <p>
                      Set <code>TELEGRAM_BOT_TOKEN</code> and{" "}
                      <code>TELEGRAM_CHAT_ID</code> in your backend environment.
                    </p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Restart and verify delivery</strong>
                    <p>
                      Restart your backend after setting the environment
                      variables, send a test notification, then enable automatic
                      delivery below.
                    </p>
                  </div>
                </li>
              </ol>
              <div className="settings-info">
                <LockKeyhole size={15} />
                <span>
                  Bot tokens are never requested or saved in this browser.
                </span>
              </div>
            </Panel>
          )}
          <Panel
            title="Delivery settings"
            description="Choose which moments deserve your attention."
            actions={
              <span className="settings-small-badge">
                {saving
                  ? "Saving…"
                  : ready
                    ? "Saved in MongoDB"
                    : "Backend required"}
              </span>
            }
          >
            {(error || !backendAvailable) && (
              <div className="settings-info" role="alert">
                <CircleHelp size={15} />
                <span>
                  {error ||
                    "Connect your backend to load and save Telegram delivery settings."}
                </span>
              </div>
            )}
            <div className="settings-toggle-row notifications-toggle-row">
              <span className="notifications-option-icon blue">
                <BellRing size={18} />
              </span>
              <span>
                <strong>Automatic delivery</strong>
                <p>
                  Send new live signals for symbols with alerts enabled in your
                  watchlist.
                </p>
              </span>
              <Toggle
                label="Automatic Telegram delivery"
                checked={preferences.enabled}
                disabled={!ready || !backendAvailable || saving}
                onChange={(checked) => {
                  void update("enabled", checked);
                }}
              />
            </div>
            <div className="settings-toggle-row notifications-toggle-row">
              <span className="notifications-option-icon green">
                <ArrowUpRight size={18} />
              </span>
              <span>
                <strong>Buy signals</strong>
                <p>Get notified when a bullish setup is confirmed.</p>
              </span>
              <Toggle
                label="Buy signal notifications"
                checked={preferences.buy}
                disabled={!ready || !backendAvailable || saving}
                onChange={(checked) => {
                  void update("buy", checked);
                }}
              />
            </div>
            <div className="settings-toggle-row notifications-toggle-row">
              <span className="notifications-option-icon red">
                <ArrowUpRight size={18} />
              </span>
              <span>
                <strong>Sell signals</strong>
                <p>Stay informed when a bearish setup appears.</p>
              </span>
              <Toggle
                label="Sell signal notifications"
                checked={preferences.sell}
                disabled={!ready || !backendAvailable || saving}
                onChange={(checked) => {
                  void update("sell", checked);
                }}
              />
            </div>
            <div className="settings-toggle-row notifications-toggle-row">
              <span className="notifications-option-icon blue">
                <BellRing size={18} />
              </span>
              <span>
                <strong>Daily market summary</strong>
                <p>
                  Unavailable: a daily summary scheduler has not been
                  configured.
                </p>
              </span>
              <Toggle
                label="Daily market summary"
                checked={false}
                disabled
                onChange={() => undefined}
              />
            </div>
          </Panel>
          <Panel
            title="Make it personal"
            description="A few details that make your alerts more useful."
          >
            <div className="settings-toggle-row notifications-toggle-row">
              <span className="notifications-option-icon neutral">
                <MessageCircle size={17} />
              </span>
              <span>
                <strong>Include chart link</strong>
                <p>
                  Add an analysis link when the backend PUBLIC_ORIGIN is
                  configured.
                </p>
              </span>
              <Toggle
                label="Include chart link"
                checked={preferences.includeChart}
                disabled={!ready || !backendAvailable || saving}
                onChange={(checked) => {
                  void update("includeChart", checked);
                }}
              />
            </div>
            <div className="settings-toggle-row notifications-toggle-row">
              <span className="notifications-option-icon neutral">
                <Volume2 size={17} />
              </span>
              <span>
                <strong>Dashboard sound</strong>
                <p>Save your dashboard sound preference on this device.</p>
              </span>
              <Toggle
                label="Dashboard notification sound"
                checked={sound}
                onChange={(checked) => {
                  setSound(checked);
                  toast("Dashboard sound preference updated.");
                }}
              />
            </div>
          </Panel>
          <Panel
            title="Test your connection"
            description="Check delivery before relying on your notifications."
          >
            <div className="notifications-test-row">
              <div>
                <WifiOff size={20} />
                <span>
                  {backendAvailable
                    ? configured
                      ? "Telegram is configured"
                      : "Telegram configuration required"
                    : "Backend connection required"}
                </span>
              </div>
              <button
                className="btn btn-ghost"
                disabled={testing || !backendAvailable}
                onClick={testNotification}
              >
                <Send size={14} />
                {testing ? "Checking…" : "Test notification"}
              </button>
            </div>
            {testResult && (
              <div className="notifications-test-result" role="status">
                <CircleHelp size={17} />
                <span>{testResult}</span>
              </div>
            )}
          </Panel>
          <Panel
            title="Delivery log"
            description="Actual delivery attempts recorded by your backend."
          >
            {logs.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Created at (UTC)</th>
                      <th>Kind</th>
                      <th>Status</th>
                      <th>Attempts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.signalId}>
                        <td>
                          {new Date(log.createdAt).toLocaleString("en-GB", {
                            timeZone: "UTC",
                            hour12: false,
                          })}
                        </td>
                        <td>{log.kind}</td>
                        <td
                          className={
                            log.status === "sent"
                              ? "positive"
                              : log.status === "failed"
                                ? "negative"
                                : "muted"
                          }
                        >
                          {log.status}
                        </td>
                        <td>{log.attempts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="settings-info">
                <Bell size={15} />
                <span>
                  {ready
                    ? "No delivery attempts recorded yet."
                    : "Connect your backend to read the delivery log."}
                </span>
              </div>
            )}
          </Panel>
          <div className="settings-local-note">
            <ShieldCheck size={17} />
            <p>
              Delivery settings and attempt logs are stored in MongoDB. Telegram
              credentials stay in your backend environment.
            </p>
          </div>
        </div>
        <aside className="notifications-preview-column">
          <div className="notifications-preview-label">
            <span className="settings-dot green" /> MESSAGE PREVIEW
            <span>Example</span>
          </div>
          <div className="notifications-phone-preview">
            <div className="notifications-chat-header">
              <span className="notifications-chat-avatar">
                <Send size={20} />
              </span>
              <div>
                <strong>Crypto Signal Agent</strong>
                <span>bot</span>
              </div>
              <span className="notifications-chat-menu">•••</span>
            </div>
            <div className="notifications-chat-body">
              <div className="notifications-chat-date">Today</div>
              <div className="notifications-chat-message">
                <div className="notifications-message-title">
                  <CoinIcon coin={btc} small />
                  <strong>
                    {btc.signal
                      ? `${btc.signal} message preview`
                      : "Signal message preview"}
                  </strong>
                  <span className="notifications-live-label">
                    {timeframe.toUpperCase()}
                  </span>
                </div>
                <h3>
                  Bitcoin <span>BTC / USDT</span>
                </h3>
                <div className="notifications-message-price">
                  {btc.price === null ? "—" : `$${formatPrice(btc.price)}`}{" "}
                  <span>{formatChange(btc.change)}</span>
                </div>
                <div className="notifications-message-divider" />
                <p className="notifications-message-intro">{btc.reason}</p>
                <div className="notifications-message-check">
                  <Check size={14} /> Latest recorded signal:{" "}
                  {latestSignal?.signal ?? "—"}
                </div>
                <div className="notifications-message-check">
                  <Check size={14} /> EMA fast{" "}
                  <span>{formatPrice(latestSignal?.emaFast)}</span>
                </div>
                <div className="notifications-message-check">
                  <Check size={14} /> EMA slow{" "}
                  <span>{formatPrice(latestSignal?.emaSlow)}</span>
                </div>
                <div className="notifications-message-check">
                  <Check size={14} /> RSI at signal{" "}
                  <span>{latestSignal?.rsi.toFixed(1) ?? "—"}</span>
                </div>
                <div className="notifications-message-divider" />
                <p className="notifications-message-note">
                  Example layout · live market values · {timeframe} timeframe
                </p>
                <span className="notifications-message-time">
                  {latestSignal
                    ? new Date(latestSignal.time).toLocaleTimeString("en-GB", {
                        timeZone: "UTC",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      }) + " UTC"
                    : "Awaiting signal"}
                </span>
              </div>
              {preferences.includeChart && (
                <Link
                  href="/markets/?symbol=BTC"
                  className="notifications-preview-button"
                >
                  Open chart <ExternalLink size={13} />
                </Link>
              )}
              <div className="notifications-preview-disclaimer">
                Sample message · No message has been sent
              </div>
            </div>
            <div className="notifications-chat-input">
              <span>Message</span>
              <Send size={17} />
            </div>
          </div>
          <div className="notifications-preview-note">
            <Bell size={16} />
            <p>
              Less noise. More clarity.
              <br />
              <span>Only confirmed signals from your strategy.</span>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
