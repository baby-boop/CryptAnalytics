"use client";

import { useEffect, useState } from "react";
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
  Radio,
  RefreshCw,
  SlidersHorizontal,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import { useMarket } from "@/components/market-provider";
import { MarketStatus } from "@/components/market-status";
import { CoinIcon, EmptyState, Panel, SignalBadge } from "@/components/ui";
import { MarketChart } from "@/components/market-chart";
import { formatChange, formatPrice, timeframes } from "@/lib/data";
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
  const { markets, analyses, status, symbolErrors, setActiveSymbol, strategy, refresh } = useMarket();
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
    if (requested && markets.some((coin) => coin.symbol === requested))
      setSymbol(requested);
    // Only resolve the initial query. Ticker updates must preserve the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setActiveSymbol(symbol); }, [symbol, setActiveSymbol]);
  const coin = markets.find((item) => item.symbol === symbol) ?? markets[0];
  const analysis = analyses[symbol];
  const watched = watchlist.includes(symbol);
  const alerted = alerts.includes(symbol);
  const recent = analysis?.candles.filter((candle) => candle.closed).slice(-3).reverse() ?? [];
  const lastCandle = analysis?.candles.at(-1);
  const closedCandle = analysis?.closedCandle;
  const conditionSide =
    checklistSide ?? (analysis?.signal === "SELL" ? "SELL" : "BUY");
  const conditions = analysis?.conditions[conditionSide] ?? [];
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
              {markets.map((item) => (
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
                  ? `${symbol} alert disabled`
                  : `${symbol} alert preference saved`,
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
          <strong>{coin.price === null ? "—" : `$${formatPrice(coin.price)}`}</strong>
          <span className={coin.change === null ? "muted" : coin.change >= 0 ? "positive" : "negative"}>
            {coin.change === null ? null : coin.change >= 0 ? (
              <TrendingUp size={15} />
            ) : (
              <TrendingDown size={15} />
            )}
            {formatChange(coin.change)}
            <small>24h change</small>
          </span>
        </div>
        <div className="market-stat">
          <span>24h high</span>
          <strong>{formatPrice(coin.high)}</strong>
        </div>
        <div className="market-stat">
          <span>24h low</span>
          <strong>{formatPrice(coin.low)}</strong>
        </div>
        <div className="market-stat">
          <span>24h volume · USDT</span>
          <strong>{coin.volume ?? "—"}</strong>
        </div>
        <div className="market-stat market-data-status">
          <span className={`status-dot ${status === "live" ? "" : "amber"}`} />
          <div>
            <strong>Binance Spot</strong>
            <span>{status === "live" ? "Live exchange stream" : status === "loading" ? "Connecting to exchange" : "Stream reconnecting"}</span>
          </div>
        </div>
      </div>
      <MarketStatus symbol={symbol} />
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
              O <b>{formatPrice(lastCandle?.open)}</b>
            </span>
            <span>
              H <b>{formatPrice(lastCandle?.high)}</b>
            </span>
            <span>
              L <b>{formatPrice(lastCandle?.low)}</b>
            </span>
            <span>
              C{" "}
              <b
                className={
                  !lastCandle ? "muted" : lastCandle.close >= lastCandle.open ? "positive" : "negative"
                }
              >
                {formatPrice(lastCandle?.close)}
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
              <span className="ema-fast">EMA {strategy.emaFast}</span>
              <b className="ema-fast">
                {formatPrice(analysis?.ema50.at(-1)?.value)}
              </b>
              <span className="ema-slow">EMA {strategy.emaSlow}</span>
              <b className="ema-slow">
                {formatPrice(analysis?.ema200.at(-1)?.value)}
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
          {analysis?.candles.length ? <MarketChart
            analysis={analysis}
            datasetKey={`${symbol}:${timeframe}`}
            strategy={strategy}
            theme={theme}
            showEma={showEma}
            showMacd={showMacd}
            showRsi={showRsi}
            resetKey={resetKey}
          /> : <EmptyState icon={status === "loading" ? Radio : RefreshCw} title={status === "loading" ? "Loading candle history" : "Candle data unavailable"} description={symbolErrors[symbol] || `Waiting for Binance ${symbol}/USDT ${timeframe} candles.`} action={<button className="btn btn-primary" onClick={refresh} disabled={status === "loading"}>Retry</button>} />}
          <div className="market-chart-footer">
            <span>
              <Info size={12} />
              Binance OHLCV · Live candle in progress · Indicators use closed candles
            </span>
            <span>Scroll to zoom · Drag to pan</span>
          </div>
        </Panel>
        <aside className="market-sidebar">
          <Panel
            className={`market-signal-card signal-${analysis?.signal?.toLowerCase() ?? "wait"}`}
          >
            <div className="market-card-label">
              <span>Last closed-candle signal</span>
              <span className="market-small-dot" />
            </div>
            <div className="market-signal-value">
              {analysis?.signal === "BUY" ? (
                <TrendingUp />
              ) : analysis?.signal === "SELL" ? (
                <TrendingDown />
              ) : (
                <Minus />
              )}
              {analysis?.signal ?? "—"}
              <span>
                {analysis?.signal === "BUY"
                  ? "Bullish setup"
                  : analysis?.signal === "SELL"
                    ? "Bearish setup"
                    : analysis?.signal === "WAIT" ? "Awaiting confirmation" : "Waiting for complete candle data"}
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
                  {closedCandle ? new Date(closedCandle.closeTime).toLocaleString(
                    "en-GB",
                    {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "UTC",
                    },
                  ) + " UTC" : "—"}
                </dd>
              </div>
              <div>
                <dt>Close price</dt>
                <dd>{formatPrice(closedCandle?.close)}</dd>
              </div>
              <div>
                <dt>Strategy</dt>
                <dd title={analysis?.strategyVersion}>{analysis?.strategyVersion ?? "—"}</dd>
              </div>
            </dl>
          </Panel>
          <Panel className="market-conditions-card">
            <div className="market-card-label">
              <span>{conditionSide} rules</span>
              <span className="market-condition-count">
                {conditions.length ? `${passedCount} / ${conditions.length}` : "—"}
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
                style={{ width: `${conditions.length ? (passedCount / conditions.length) * 100 : 0}%` }}
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
              {!conditions.length && <p className="muted">Waiting for closed-candle indicators.</p>}
            </div>
          </Panel>
          <Panel className="market-reason-card">
            <div className="market-card-label">
              <span>Why this signal?</span>
              <CircleHelp size={15} />
            </div>
            <p>
              {analysis?.reason ?? "Load completed candles to evaluate your strategy against real market data."}
            </p>
            <div className="market-reason-note">
              <Info size={14} />
              <span>
                Signals and chart markers use your saved strategy on completed Binance candles. The current open candle never triggers a signal.
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
        title="Recent closed candles"
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
                <th>Closed-candle signal</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((candle) => (
                <tr key={Number(candle.time)}>
                  <td>
                    {new Date(candle.closeTime).toLocaleString(
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
                        analysis?.signals[analysis.candles.findIndex((item) => item.time === candle.time)] ?? null
                      }
                    />
                  </td>
                </tr>
              ))}
              {!recent.length && <tr><td colSpan={6} className="muted">No closed candles received yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
