"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeft,
  BellPlus,
  Check,
  ChevronDown,
  CircleHelp,
  Crosshair,
  Expand,
  ExternalLink,
  Eye,
  Info,
  Minus,
  SlidersHorizontal,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import { CoinIcon, Panel, SignalBadge } from "@/components/ui";
import { createMarketFixture, MarketChart } from "@/components/market-chart";
import { coins, formatChange, formatPrice, timeframes } from "@/lib/data";
import "./market.css";

export default function MarketPage() {
  const {
    theme,
    timeframe,
    setTimeframe,
    watchlist,
    setWatchlist,
    alerts,
    setAlerts,
    toast,
  } = useApp();
  const [symbol, setSymbol] = useState("BTC");
  const [showEma, setShowEma] = useState(true);
  const [showMacd, setShowMacd] = useState(true);
  const [showRsi, setShowRsi] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [checklistSide, setChecklistSide] = useState<"BUY" | "SELL" | null>(
    null,
  );
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("symbol");
    if (requested && coins.some((coin) => coin.symbol === requested))
      setSymbol(requested);
  }, []);
  const coin = coins.find((item) => item.symbol === symbol) ?? coins[0];
  const fixture = useMemo(
    () => createMarketFixture(coin, timeframe),
    [coin, timeframe],
  );
  const watched = watchlist.includes(symbol);
  const alerted = alerts.includes(symbol);
  const recent = fixture.candles.slice(-3).reverse();
  const lastCandle = fixture.candles[fixture.candles.length - 1];
  const periodCandles = fixture.candles.slice(
    -Math.max(
      1,
      Math.round(
        86400 / { "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 }[timeframe],
      ),
    ),
  );
  const high = Math.max(...periodCandles.map((item) => item.high));
  const low = Math.min(...periodCandles.map((item) => item.low));
  const conditionSide =
    checklistSide ?? (fixture.signal === "SELL" ? "SELL" : "BUY");
  const conditions = fixture.conditions[conditionSide];
  const passedCount = conditions.filter((condition) => condition.passed).length;
  const changeCoin = (value: string) => {
    setSymbol(value);
    const url = new URL(window.location.href);
    url.searchParams.set("symbol", value);
    window.history.replaceState({}, "", url);
  };
  return (
    <div className="market-page">
      <div className="market-breadcrumb">
        <Link href="/">
          <ArrowLeft size={15} /> Dashboard
        </Link>
        <span>/</span>
        <span>Markets</span>
        <span>/</span>
        <strong>{symbol} / USDT</strong>
      </div>
      <div className="market-heading">
        <div className="market-identity">
          <CoinIcon coin={coin} />
          <div>
            <div className="market-title-row">
              <h1>
                {symbol}
                <span>/USDT</span>
              </h1>
              <span className="market-spot">SPOT</span>
            </div>
            <p>
              {coin.name}
              <span> · </span>Tether USD
            </p>
          </div>
          <button
            className={`market-star ${watched ? "is-watched" : ""}`}
            onClick={() => {
              setWatchlist(
                watched
                  ? watchlist.filter((item) => item !== symbol)
                  : [...watchlist, symbol],
              );
              toast(
                watched
                  ? `${symbol} removed from watchlist`
                  : `${symbol} added to watchlist`,
              );
            }}
            aria-label={
              watched
                ? `Remove ${symbol} from watchlist`
                : `Add ${symbol} to watchlist`
            }
            aria-pressed={watched}
          >
            <Star size={20} fill={watched ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="market-heading-actions">
          <label className="market-coin-select">
            <select
              aria-label="Select cryptocurrency"
              value={symbol}
              onChange={(event) => changeCoin(event.target.value)}
            >
              {coins.map((item) => (
                <option value={item.symbol} key={item.symbol}>
                  {item.symbol} / USDT
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
          <button
            className={`btn ${alerted ? "btn-ghost" : "btn-primary"}`}
            onClick={() => {
              setAlerts(
                alerted
                  ? alerts.filter((item) => item !== symbol)
                  : [...alerts, symbol],
              );
              toast(
                alerted
                  ? `${symbol} demo alert disabled`
                  : `${symbol} demo alert saved`,
              );
            }}
          >
            <BellPlus size={16} />
            {alerted ? "Alert saved" : "Create alert"}
          </button>
          <Link
            className="btn btn-ghost market-settings"
            href="/settings"
            aria-label="Configure indicators"
          >
            <SlidersHorizontal size={17} />
          </Link>
        </div>
      </div>
      <div className="market-price-strip">
        <div className="market-current-price">
          <strong>${formatPrice(lastCandle.close)}</strong>
          <span className={coin.change >= 0 ? "positive" : "negative"}>
            {coin.change >= 0 ? (
              <TrendingUp size={15} />
            ) : (
              <TrendingDown size={15} />
            )}
            {formatChange(coin.change)}
            <small>illustrative 24h</small>
          </span>
        </div>
        <div className="market-stat">
          <span>Fixture 24h high</span>
          <strong>${formatPrice(high)}</strong>
        </div>
        <div className="market-stat">
          <span>Fixture 24h low</span>
          <strong>${formatPrice(low)}</strong>
        </div>
        <div className="market-stat">
          <span>Illustrative volume</span>
          <strong>${coin.volume}</strong>
        </div>
        <div className="market-stat market-data-status">
          <span className="market-fixture-dot" />
          <div>
            <strong>Demo market</strong>
            <span>No live exchange connection</span>
          </div>
        </div>
      </div>
      <div className={`market-workspace ${expanded ? "market-expanded" : ""}`}>
        <Panel className="market-chart-panel">
          <div className="market-chart-toolbar">
            <div className="tabs">
              {timeframes.map((item) => (
                <button
                  type="button"
                  className={`tab ${timeframe === item ? "active" : ""}`}
                  key={item}
                  onClick={() => setTimeframe(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="market-chart-tools">
              <button
                title="Reset chart view"
                aria-label="Reset chart view"
                onClick={() => setResetKey((value) => value + 1)}
              >
                <Crosshair size={16} />
              </button>
              <button
                title={expanded ? "Exit expanded chart" : "Expand chart"}
                aria-label={expanded ? "Exit expanded chart" : "Expand chart"}
                aria-pressed={expanded}
                onClick={() => setExpanded(!expanded)}
              >
                <Expand size={16} />
              </button>
            </div>
          </div>
          <div className="market-chart-legend">
            <span>
              <strong>{symbol} / USDT</strong> · {timeframe}
            </span>
            <span>
              O <b>{formatPrice(lastCandle.open)}</b>
            </span>
            <span>
              H <b>{formatPrice(lastCandle.high)}</b>
            </span>
            <span>
              L <b>{formatPrice(lastCandle.low)}</b>
            </span>
            <span>
              C{" "}
              <b
                className={
                  lastCandle.close >= lastCandle.open ? "positive" : "negative"
                }
              >
                {formatPrice(lastCandle.close)}
              </b>
            </span>
          </div>
          <div className="market-indicator-toggles">
            <button
              className={showEma ? "enabled" : ""}
              onClick={() => setShowEma(!showEma)}
              aria-pressed={showEma}
            >
              <Eye size={12} />
              <span className="ema-fast">EMA 50</span>
              <b className="ema-fast">
                {formatPrice(fixture.ema50.at(-1)?.value ?? 0)}
              </b>
              <span className="ema-slow">EMA 200</span>
              <b className="ema-slow">
                {formatPrice(fixture.ema200.at(-1)?.value ?? 0)}
              </b>
            </button>
            <button
              className={showMacd ? "enabled" : ""}
              onClick={() => setShowMacd(!showMacd)}
              aria-pressed={showMacd}
            >
              MACD
            </button>
            <button
              className={showRsi ? "enabled" : ""}
              onClick={() => setShowRsi(!showRsi)}
              aria-pressed={showRsi}
            >
              RSI
            </button>
          </div>
          <MarketChart
            fixture={fixture}
            theme={theme}
            showEma={showEma}
            showMacd={showMacd}
            showRsi={showRsi}
            resetKey={resetKey}
          />
          <div className="market-chart-footer">
            <span>
              <Info size={12} />
              Deterministic OHLC fixture · Indicators calculated locally
            </span>
            <span>Scroll to zoom · Drag to pan</span>
          </div>
        </Panel>
        <aside className="market-sidebar">
          <Panel
            className={`market-signal-card signal-${fixture.signal.toLowerCase()}`}
          >
            <div className="market-card-label">
              <span>Current fixture signal</span>
              <span className="market-small-dot" />
            </div>
            <div className="market-signal-value">
              {fixture.signal === "BUY" ? (
                <TrendingUp />
              ) : fixture.signal === "SELL" ? (
                <TrendingDown />
              ) : (
                <Minus />
              )}
              {fixture.signal}
              <span>
                {fixture.signal === "BUY"
                  ? "Bullish setup"
                  : fixture.signal === "SELL"
                    ? "Bearish setup"
                    : "Awaiting confirmation"}
              </span>
            </div>
            <div className="market-signal-divider" />
            <dl>
              <div>
                <dt>Timeframe</dt>
                <dd>{timeframe}</dd>
              </div>
              <div>
                <dt>Candle close</dt>
                <dd>
                  {new Date(Number(lastCandle.time) * 1000).toLocaleString(
                    "en-GB",
                    {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "UTC",
                    },
                  )}{" "}
                  UTC
                </dd>
              </div>
              <div>
                <dt>Close price</dt>
                <dd>${formatPrice(lastCandle.close)}</dd>
              </div>
              <div>
                <dt>Strategy</dt>
                <dd>Default v1</dd>
              </div>
            </dl>
          </Panel>
          <Panel className="market-conditions-card">
            <div className="market-card-label">
              <span>Default {conditionSide} rules</span>
              <span className="market-condition-count">
                {passedCount} / {conditions.length}
              </span>
            </div>
            <div className="market-checklist-tabs">
              <button
                className={conditionSide === "BUY" ? "selected" : ""}
                onClick={() => setChecklistSide("BUY")}
              >
                Buy conditions
              </button>
              <button
                className={conditionSide === "SELL" ? "selected" : ""}
                onClick={() => setChecklistSide("SELL")}
              >
                Sell conditions
              </button>
            </div>
            <div className="market-condition-progress">
              <span
                style={{ width: `${(passedCount / conditions.length) * 100}%` }}
              />
            </div>
            <div className="market-conditions">
              {conditions.map((condition) => (
                <div className="market-condition" key={condition.label}>
                  <span
                    className={
                      condition.passed ? "condition-pass" : "condition-wait"
                    }
                  >
                    {condition.passed ? (
                      <Check size={11} strokeWidth={3} />
                    ) : (
                      <Minus size={11} />
                    )}
                  </span>
                  <div>
                    <strong>{condition.label}</strong>
                    <p>{condition.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel className="market-reason-card">
            <div className="market-card-label">
              <span>Why this signal?</span>
              <CircleHelp size={15} />
            </div>
            <p>
              {fixture.signal === "BUY"
                ? "The closed price and EMAs align with a bullish crossover between the previous and current closed candles. RSI is within the default 45–70 range."
                : fixture.signal === "SELL"
                  ? "The closed price and EMAs align with a bearish crossover between the previous and current closed candles. RSI is within the default 30–55 range."
                  : "Neither the complete BUY rule set nor the complete SELL rule set is met on this closed candle. A MACD line already above or below its signal is not a new crossover."}
            </p>
            <div className="market-reason-note">
              <Info size={14} />
              <span>
                Default v1 rules on closed demo candles. Chart markers use these
                same rules; saved settings are demo preferences.
              </span>
            </div>
            <Link href="/settings">
              Manage strategy rules
              <ExternalLink size={12} />
            </Link>
          </Panel>
        </aside>
      </div>
      <Panel
        className="market-recent-signals"
        title="Recent fixture candles"
        description={`Latest ${timeframe} closes for ${symbol} / USDT`}
        actions={
          <Link href="/signals" className="market-text-link">
            Signal history <ArrowDownLeft size={14} />
          </Link>
        }
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Close time (UTC)</th>
                <th>Market</th>
                <th>Timeframe</th>
                <th>Close price</th>
                <th>Candle move</th>
                <th>Fixture signal</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((candle, index) => (
                <tr key={Number(candle.time)}>
                  <td>
                    {new Date(Number(candle.time) * 1000).toLocaleString(
                      "en-GB",
                      {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "UTC",
                      },
                    )}
                  </td>
                  <td>
                    <div className="market-table-coin">
                      <CoinIcon coin={coin} small />
                      <strong>{symbol}</strong>
                      <span className="muted">/ USDT</span>
                    </div>
                  </td>
                  <td>{timeframe}</td>
                  <td>${formatPrice(candle.close)}</td>
                  <td
                    className={
                      candle.close >= candle.open ? "positive" : "negative"
                    }
                  >
                    {formatChange((candle.close / candle.open - 1) * 100)}
                  </td>
                  <td>
                    <SignalBadge
                      signal={
                        fixture.signals[fixture.candles.length - 1 - index]
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
