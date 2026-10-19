"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  Layers3,
  Monitor,
  Moon,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Zap,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import { PageHeading, Panel, Toggle } from "@/components/ui";
import "../settings-views.css";

type ConditionKey = "price" | "ema" | "macd" | "rsi";
type NumericKey =
  | "emaFast"
  | "emaSlow"
  | "macdFast"
  | "macdSlow"
  | "macdSignal"
  | "rsiPeriod"
  | "buyRsiMin"
  | "buyRsiMax"
  | "sellRsiMin"
  | "sellRsiMax";
interface StrategySettings {
  emaFast: number;
  emaSlow: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  rsiPeriod: number;
  buyRsiMin: number;
  buyRsiMax: number;
  sellRsiMin: number;
  sellRsiMax: number;
  buy: Record<ConditionKey, boolean>;
  sell: Record<ConditionKey, boolean>;
  volumeFilter: boolean;
  trendFilter: boolean;
}
const defaults: StrategySettings = {
  emaFast: 50,
  emaSlow: 200,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  rsiPeriod: 14,
  buyRsiMin: 45,
  buyRsiMax: 70,
  sellRsiMin: 30,
  sellRsiMax: 55,
  buy: { price: true, ema: true, macd: true, rsi: true },
  sell: { price: true, ema: true, macd: true, rsi: true },
  volumeFilter: true,
  trendFilter: false,
};
const numericFields: { key: NumericKey; label: string; hint: string }[] = [
  { key: "emaFast", label: "EMA fast period", hint: "Short-term trend" },
  { key: "emaSlow", label: "EMA slow period", hint: "Long-term trend" },
  { key: "macdFast", label: "MACD fast period", hint: "Fast moving average" },
  { key: "macdSlow", label: "MACD slow period", hint: "Slow moving average" },
  {
    key: "macdSignal",
    label: "MACD signal period",
    hint: "Crossover smoothing",
  },
  { key: "rsiPeriod", label: "RSI period", hint: "Momentum lookback" },
];
const keys: ConditionKey[] = ["price", "ema", "macd", "rsi"];

function validateSettings(settings: StrategySettings): string | null {
  if (
    numericFields.some(
      (field) =>
        !Number.isInteger(settings[field.key]) ||
        settings[field.key] < 1 ||
        settings[field.key] > 500,
    )
  )
    return "Indicator periods must be whole numbers between 1 and 500.";
  if (
    settings.emaFast >= settings.emaSlow ||
    settings.macdFast >= settings.macdSlow
  )
    return "Fast periods must be smaller than their corresponding slow periods.";
  if (
    (["buy", "sell"] as const).some(
      (side) => !keys.some((key) => settings[side][key]),
    )
  )
    return "Enable at least one condition for both buy and sell signals.";
  const ranges = [
    [settings.buyRsiMin, settings.buyRsiMax],
    [settings.sellRsiMin, settings.sellRsiMax],
  ];
  if (
    ranges.some(
      ([minimum, maximum]) =>
        !Number.isFinite(minimum) ||
        !Number.isFinite(maximum) ||
        minimum < 0 ||
        maximum > 100 ||
        minimum >= maximum,
    )
  )
    return "Each RSI range must increase from a minimum of 0 to a maximum of 100.";
  return null;
}

function readSettings(value: unknown): StrategySettings | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const numericKeys: NumericKey[] = [
    ...numericFields.map((field) => field.key),
    "buyRsiMin",
    "buyRsiMax",
    "sellRsiMin",
    "sellRsiMax",
  ];
  if (
    !numericKeys.every(
      (key) =>
        typeof candidate[key] === "number" && Number.isFinite(candidate[key]),
    )
  )
    return null;
  for (const side of ["buy", "sell"]) {
    const conditions = candidate[side];
    if (
      !conditions ||
      typeof conditions !== "object" ||
      !keys.every(
        (key) =>
          typeof (conditions as Record<string, unknown>)[key] === "boolean",
      )
    )
      return null;
  }
  if (
    typeof candidate.volumeFilter !== "boolean" ||
    typeof candidate.trendFilter !== "boolean"
  )
    return null;
  const settings = candidate as unknown as StrategySettings;
  return validateSettings(settings) === null ? settings : null;
}

export default function SettingsPage() {
  const { theme, setTheme, timeframe, toast } = useApp();
  const [settings, setSettings] = useState<StrategySettings>(defaults);
  const [conditionSide, setConditionSide] = useState<"buy" | "sell">("buy");
  const [tab, setTab] = useState("strategy");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState("Default configuration");

  useEffect(() => {
    try {
      const saved = readSettings(
        JSON.parse(
          localStorage.getItem("signal-agent-strategy") ?? "null",
        ) as unknown,
      );
      if (saved) {
        setSettings(saved);
        setLastSaved("Saved on this device");
      }
    } catch {
      /* Default settings remain available. */
    }
  }, []);

  function updateNumber(key: NumericKey, value: string) {
    setSettings((previous) => ({
      ...previous,
      [key]: value === "" ? 0 : Number(value),
    }));
    setDirty(true);
    setError("");
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const validationError = validateSettings(settings);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      localStorage.setItem("signal-agent-strategy", JSON.stringify(settings));
      setDirty(false);
      setLastSaved("Just saved on this device");
      toast("Demo strategy settings saved on this device.");
    } catch {
      setError(
        "Your browser could not save these settings. Allow local storage and try again.",
      );
    }
  }

  function reset() {
    setSettings(structuredClone(defaults));
    setDirty(true);
    setError("");
  }
  const conditionLabels: Record<ConditionKey, string> =
    conditionSide === "buy"
      ? {
          price: `Price above EMA ${settings.emaFast}`,
          ema: `EMA ${settings.emaFast} above EMA ${settings.emaSlow}`,
          macd: "MACD bullish crossover",
          rsi: "RSI within the selected range",
        }
      : {
          price: `Price below EMA ${settings.emaFast}`,
          ema: `EMA ${settings.emaFast} below EMA ${settings.emaSlow}`,
          macd: "MACD bearish crossover",
          rsi: "RSI within the selected range",
        };

  return (
    <div className="settings-page">
      <PageHeading
        eyebrow="MAKE IT YOURS"
        title="Settings"
        description="Fine-tune your strategy. Make every signal count."
        actions={
          <span className="settings-device-tag">
            <ShieldCheck size={14} /> Local demo preferences
          </span>
        }
      />
      <nav className="tabs settings-nav" aria-label="Settings sections">
        <button
          className={`tab ${tab === "strategy" ? "active" : ""}`}
          onClick={() => setTab("strategy")}
        >
          <SlidersHorizontal size={15} /> Strategy
        </button>
        <Link className="tab" href="/watchlist">
          <Layers3 size={15} /> Watchlist
        </Link>
        <Link className="tab" href="/notifications">
          <Bell size={15} /> Notifications
        </Link>
        <button
          className={`tab ${tab === "appearance" ? "active" : ""}`}
          onClick={() => setTab("appearance")}
        >
          <Monitor size={15} /> Appearance
        </button>
        <button
          className={`tab ${tab === "system" ? "active" : ""}`}
          onClick={() => setTab("system")}
        >
          <Settings2 size={15} /> System
        </button>
      </nav>

      {tab === "strategy" && (
        <form onSubmit={save} className="settings-layout section-gap">
          <div className="settings-main-stack">
            <Panel
              title="Indicator parameters"
              description="The building blocks of your technical analysis."
              actions={
                <span className="settings-small-badge">6 parameters</span>
              }
            >
              <div className="settings-field-grid">
                {numericFields.map((field) => (
                  <label className="field" key={field.key}>
                    <span className="settings-label-line">
                      {field.label}
                      <CircleHelp size={12} aria-label={field.hint} />
                    </span>
                    <input
                      aria-label={field.label}
                      className="input"
                      type="number"
                      min="1"
                      max="500"
                      step="1"
                      value={settings[field.key]}
                      onChange={(event) =>
                        updateNumber(field.key, event.target.value)
                      }
                    />
                    <span className="settings-field-hint">{field.hint}</span>
                  </label>
                ))}
              </div>
              <div className="settings-info">
                <CircleHelp size={15} />
                <span>
                  Periods are measured in candles on your selected timeframe.
                </span>
              </div>
            </Panel>
            <Panel
              title="Signal conditions"
              description="All enabled conditions must be met to generate a signal."
            >
              <div className="settings-condition-tabs">
                <button
                  type="button"
                  className={conditionSide === "buy" ? "selected buy" : ""}
                  onClick={() => setConditionSide("buy")}
                >
                  <span className="settings-dot green" /> Buy conditions
                </button>
                <button
                  type="button"
                  className={conditionSide === "sell" ? "selected sell" : ""}
                  onClick={() => setConditionSide("sell")}
                >
                  <span className="settings-dot red" /> Sell conditions
                </button>
              </div>
              <div className="settings-condition-list">
                {keys.map((key) => (
                  <label className="settings-check-row" key={key}>
                    <input
                      type="checkbox"
                      checked={settings[conditionSide][key]}
                      onChange={(event) => {
                        setSettings((previous) => ({
                          ...previous,
                          [conditionSide]: {
                            ...previous[conditionSide],
                            [key]: event.target.checked,
                          },
                        }));
                        setDirty(true);
                      }}
                    />
                    <span>{conditionLabels[key]}</span>
                    {key === "macd" && (
                      <span className="settings-recommended">Recommended</span>
                    )}
                  </label>
                ))}
              </div>
              <div className="settings-rsi-row">
                <div>
                  <strong>RSI range</strong>
                  <p>Keep momentum within your preferred boundaries.</p>
                </div>
                <div className="settings-range-inputs">
                  <label>
                    <span className="sr-only">RSI minimum</span>
                    <input
                      className="input"
                      aria-label="RSI minimum"
                      type="number"
                      min="0"
                      max="100"
                      value={
                        settings[
                          conditionSide === "buy" ? "buyRsiMin" : "sellRsiMin"
                        ]
                      }
                      onChange={(event) =>
                        updateNumber(
                          conditionSide === "buy" ? "buyRsiMin" : "sellRsiMin",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <span>to</span>
                  <label>
                    <span className="sr-only">RSI maximum</span>
                    <input
                      className="input"
                      aria-label="RSI maximum"
                      type="number"
                      min="0"
                      max="100"
                      value={
                        settings[
                          conditionSide === "buy" ? "buyRsiMax" : "sellRsiMax"
                        ]
                      }
                      onChange={(event) =>
                        updateNumber(
                          conditionSide === "buy" ? "buyRsiMax" : "sellRsiMax",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            </Panel>
            <Panel
              title="Additional filters"
              description="Add a little more conviction to your signals."
            >
              <div className="settings-toggle-row">
                <span>
                  <strong>Volume confirmation</strong>
                  <p>Require volume above the 20-candle average.</p>
                </span>
                <Toggle
                  label="Volume confirmation"
                  checked={settings.volumeFilter}
                  onChange={(value) => {
                    setSettings((previous) => ({
                      ...previous,
                      volumeFilter: value,
                    }));
                    setDirty(true);
                  }}
                />
              </div>
              <div className="settings-toggle-row">
                <span>
                  <strong>Higher timeframe confirmation</strong>
                  <p>Only signal when the larger trend agrees.</p>
                </span>
                <Toggle
                  label="Higher timeframe confirmation"
                  checked={settings.trendFilter}
                  onChange={(value) => {
                    setSettings((previous) => ({
                      ...previous,
                      trendFilter: value,
                    }));
                    setDirty(true);
                  }}
                />
              </div>
            </Panel>
            {error && (
              <div className="settings-form-error" role="alert">
                {error}
              </div>
            )}
            <div className="settings-save-bar">
              <span>
                <span className={`settings-dot ${dirty ? "amber" : "green"}`} />
                {dirty ? "You have unsaved changes" : lastSaved}
              </span>
              <div>
                <button type="button" className="btn btn-ghost" onClick={reset}>
                  <RotateCcw size={14} /> Reset to default
                </button>
                <button type="submit" className="btn btn-primary">
                  <Save size={14} /> Save changes
                </button>
              </div>
            </div>
          </div>
          <aside className="settings-side-stack">
            <section className="settings-strategy-card">
              <div className="settings-strategy-icon">
                <Zap size={22} />
              </div>
              <span className="eyebrow">YOUR STRATEGY</span>
              <h2>
                Clarity in every
                <br />
                market move.
              </h2>
              <p>A balanced combination of trend, momentum, and volume.</p>
              <div className="settings-strategy-details">
                <span>
                  Strategy type<strong>Trend following</strong>
                </span>
                <span>
                  Active timeframe<strong>{timeframe}</strong>
                </span>
                <span>
                  Signal evaluation<strong>On candle close</strong>
                </span>
              </div>
              <div className="settings-strategy-footer">
                <CheckCheck size={15} /> Built for consistent decisions
              </div>
            </section>
            <Panel className="settings-tip-card">
              <div className="settings-tip-heading">
                <CircleHelp size={17} />
                <h3>A thoughtful starting point</h3>
              </div>
              <p>
                The default EMA 50/200 and MACD 12/26/9 configuration balances
                responsiveness with a broader view of the trend.
              </p>
              <Link href="/markets/?symbol=BTC">
                See it on a chart <ChevronRight size={14} />
              </Link>
            </Panel>
            <div className="settings-local-note">
              <ShieldCheck size={17} />
              <p>
                These settings are stored on this device. Demo charts and
                signals use sample data and are not recalculated.
              </p>
            </div>
          </aside>
        </form>
      )}

      {tab === "appearance" && (
        <div className="settings-short-section section-gap">
          <Panel
            title="Appearance"
            description="Choose the workspace that feels right for you."
          >
            <div className="settings-theme-options">
              {(["dark", "light"] as const).map((mode) => (
                <button
                  className={`settings-theme-option ${theme === mode ? "selected" : ""}`}
                  key={mode}
                  onClick={() => setTheme(mode)}
                >
                  {mode === "dark" ? <Moon size={26} /> : <Sun size={26} />}
                  <strong>{mode === "dark" ? "Dark" : "Light"} mode</strong>
                  <p>
                    {mode === "dark"
                      ? "A focused, low-light workspace."
                      : "A bright perspective on the market."}
                  </p>
                  {theme === mode && <Check size={16} />}
                </button>
              ))}
            </div>
          </Panel>
        </div>
      )}
      {tab === "system" && (
        <div className="settings-short-section section-gap">
          <Panel
            title="Workspace information"
            description="A transparent view of the current demo environment."
          >
            <div className="settings-system-row">
              <span>
                <Monitor size={17} /> Application mode
              </span>
              <strong>Interactive UI demo</strong>
            </div>
            <div className="settings-system-row">
              <span>
                <Clock3 size={17} /> Market data
              </span>
              <strong>Sample dataset</strong>
            </div>
            <div className="settings-system-row">
              <span>
                <ShieldCheck size={17} /> Preference storage
              </span>
              <strong>This browser only</strong>
            </div>
            <div className="settings-info">
              <CircleHelp size={15} />
              <span>
                Live exchange data, authentication, and Telegram delivery
                require a backend connection.
              </span>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
