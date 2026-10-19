"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import { CoinIcon, PageHeading, Panel, Toggle } from "@/components/ui";
import { coins } from "@/lib/data";
import "../settings-views.css";

interface NotificationPreferences {
  buy: boolean;
  sell: boolean;
  summary: boolean;
  includeChart: boolean;
}
const defaultPreferences: NotificationPreferences = {
  buy: true,
  sell: true,
  summary: false,
  includeChart: true,
};

export default function NotificationsPage() {
  const { sound, setSound, toast } = useApp();
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [ready, setReady] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("signal-agent-notifications") ?? "null",
      ) as Partial<NotificationPreferences> | null;
      if (saved)
        setPreferences({
          buy: typeof saved.buy === "boolean" ? saved.buy : true,
          sell: typeof saved.sell === "boolean" ? saved.sell : true,
          summary: typeof saved.summary === "boolean" ? saved.summary : false,
          includeChart:
            typeof saved.includeChart === "boolean" ? saved.includeChart : true,
        });
    } catch {
      /* Defaults are used if browser storage is unavailable. */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(
          "signal-agent-notifications",
          JSON.stringify(preferences),
        );
      } catch {
        /* Preferences remain usable during this session. */
      }
    }
  }, [preferences, ready]);

  function update(key: keyof NotificationPreferences, checked: boolean) {
    setPreferences((previous) => ({ ...previous, [key]: checked }));
    toast("Notification preference updated on this device.");
  }

  function testNotification() {
    setTesting(true);
    setTestResult(false);
    window.setTimeout(() => {
      setTesting(false);
      setTestResult(true);
    }, 650);
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
              <span /> Not configured
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
                    <strong>Connect a delivery endpoint</strong>
                    <p>
                      This UI demo has no Telegram backend. A server integration
                      is required before messages can be delivered.
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
              <span className="settings-small-badge">Auto-saved locally</span>
            }
          >
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
                onChange={(checked) => update("buy", checked)}
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
                onChange={(checked) => update("sell", checked)}
              />
            </div>
            <div className="settings-toggle-row notifications-toggle-row">
              <span className="notifications-option-icon blue">
                <BellRing size={18} />
              </span>
              <span>
                <strong>Daily market summary</strong>
                <p>A daily overview of your watchlist activity.</p>
              </span>
              <Toggle
                label="Daily market summary"
                checked={preferences.summary}
                onChange={(checked) => update("summary", checked)}
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
                <p>Add a link to the symbol’s detailed analysis.</p>
              </span>
              <Toggle
                label="Include chart link"
                checked={preferences.includeChart}
                onChange={(checked) => update("includeChart", checked)}
              />
            </div>
            <div className="settings-toggle-row notifications-toggle-row">
              <span className="notifications-option-icon neutral">
                <Volume2 size={17} />
              </span>
              <span>
                <strong>Dashboard sound</strong>
                <p>Allow sound when a future live signal arrives.</p>
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
                <span>Backend connection required</span>
              </div>
              <button
                className="btn btn-ghost"
                disabled={testing}
                onClick={testNotification}
              >
                <Send size={14} />
                {testing ? "Checking…" : "Test notification"}
              </button>
            </div>
            {testResult && (
              <div className="notifications-test-result" role="status">
                <CircleHelp size={17} />
                <span>
                  No message sent. Telegram is not configured and this demo has
                  no delivery backend. Follow the setup guide to connect your
                  server.
                </span>
              </div>
            )}
          </Panel>
          <div className="settings-local-note">
            <ShieldCheck size={17} />
            <p>
              Preferences are saved on this device. Automatic Telegram delivery
              becomes available after connecting a backend.
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
                  <CoinIcon coin={coins[0]} small />
                  <strong>New BUY signal</strong>
                  <span className="notifications-live-label">4H</span>
                </div>
                <h3>
                  Bitcoin <span>BTC / USDT</span>
                </h3>
                <div className="notifications-message-price">
                  $82,222.14 <span>+1.10%</span>
                </div>
                <div className="notifications-message-divider" />
                <p className="notifications-message-intro">
                  Your strategy conditions are aligned.
                </p>
                <div className="notifications-message-check">
                  <Check size={14} /> Price above EMA 50
                </div>
                <div className="notifications-message-check">
                  <Check size={14} /> EMA 50 above EMA 200
                </div>
                <div className="notifications-message-check">
                  <Check size={14} /> MACD bullish crossover
                </div>
                <div className="notifications-message-check">
                  <Check size={14} /> RSI within range <span>48.6</span>
                </div>
                <div className="notifications-message-divider" />
                <p className="notifications-message-note">
                  Generated on candle close · 4h timeframe
                </p>
                <span className="notifications-message-time">
                  12:00 <Check size={12} />
                  <Check size={12} />
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
