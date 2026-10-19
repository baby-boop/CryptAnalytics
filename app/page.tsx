"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  Filter,
  Layers3,
  ListFilter,
  MoreHorizontal,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  Star,
  TrendingDown,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";
import {
  CoinIcon,
  EmptyState,
  MetricCard,
  PageHeading,
  Panel,
  SignalBadge,
  Sparkline,
} from "@/components/ui";
import {
  coins,
  fixtureDate,
  formatChange,
  formatPrice,
  history,
  timeframes,
  type Signal,
} from "@/lib/data";

export default function Dashboard() {
  const {
    timeframe,
    setTimeframe,
    watchlist,
    alerts,
    setAlerts,
    sound,
    setSound,
    toast,
  } = useApp();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Signal | "ALL">("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<"default" | "change">("default");
  const [showFilters, setShowFilters] = useState(false);

  const watched = useMemo(
    () => coins.filter((c) => watchlist.includes(c.symbol)),
    [watchlist],
  );
  const visible = useMemo(() => {
    const result = watched.filter(
      (c) =>
        `${c.symbol} ${c.name}`.toLowerCase().includes(search.toLowerCase()) &&
        (filter === "ALL" || c.signal === filter),
    );
    return sort === "change"
      ? result.sort((a, b) => b.change - a.change)
      : result;
  }, [watched, search, filter, sort]);
  const buys = watched.filter((c) => c.signal === "BUY").length;
  const sells = watched.filter((c) => c.signal === "SELL").length;
  const waiting = watched.filter((c) => c.signal === "WAIT").length;
  const advancing = watched.filter((c) => c.change > 0).length;
  const breadth = watched.length
    ? Math.round((advancing / watched.length) * 100)
    : 0;

  function refresh() {
    setRefreshing(true);
    window.setTimeout(() => {
      setRefreshing(false);
      toast(
        "Demo snapshot reloaded. Connect a backend for live market updates.",
      );
    }, 700);
  }

  return (
    <div className="dashboard-page">
      <PageHeading
        eyebrow="YOUR SIGNAL WORKSPACE"
        title="Market overview"
        description="Less noise. More clarity. Every signal, in one place."
        actions={
          <>
            <span className="snapshot-status">
              <span className="status-dot amber" />
              Demo snapshot<span>Oct 19, 16:42 UTC</span>
            </span>
            <button
              className={`btn refresh-button ${refreshing ? "refreshing" : ""}`}
              onClick={refresh}
              disabled={refreshing}
            >
              <RefreshCw size={15} className={refreshing ? "spin" : ""} />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </>
        }
      />
      <div className="demo-notice">
        <div>
          <span className="demo-notice-icon">
            <Zap size={15} />
          </span>
          <span>
            <strong>A little more signal. A little less guesswork.</strong>
            <span>
              {" "}
              You’re exploring an interactive preview with illustrative data.
            </span>
          </span>
        </div>
        <Link href="/settings/">
          Explore your strategy
          <ArrowRight size={14} />
        </Link>
      </div>
      <div className="metrics-grid">
        <MetricCard
          label="Tracked assets"
          value={watched.length.toString().padStart(2, "0")}
          icon={Layers3}
          tone="blue"
        >
          <span>in your watchlist</span>
          <Link href="/watchlist/" aria-label="Manage tracked assets">
            <ArrowUpRight size={16} />
          </Link>
        </MetricCard>
        <MetricCard
          label="Buy signals"
          value={buys.toString().padStart(2, "0")}
          icon={TrendingUp}
          tone="green"
        >
          <span className="metric-caption">
            <span className="mini-dot green" />
            Bullish conditions met
          </span>
          <span className="metric-percent">
            {watched.length ? Math.round((buys / watched.length) * 100) : 0}%
          </span>
        </MetricCard>
        <MetricCard
          label="Sell signals"
          value={sells.toString().padStart(2, "0")}
          icon={TrendingDown}
          tone="red"
        >
          <span className="metric-caption">
            <span className="mini-dot red" />
            Bearish conditions met
          </span>
          <span className="metric-percent">
            {watched.length ? Math.round((sells / watched.length) * 100) : 0}%
          </span>
        </MetricCard>
        <MetricCard
          label="Awaiting confirmation"
          value={waiting.toString().padStart(2, "0")}
          icon={Clock3}
          tone="purple"
        >
          <span className="metric-caption">
            Patience is part of the strategy
          </span>
        </MetricCard>
      </div>
      <div className="dashboard-columns">
        <Panel
          className="market-panel"
          title="Your market watch"
          description="The assets you follow. The signals that matter."
          actions={
            <Link href="/watchlist/" className="btn btn-small">
              <Plus size={14} />
              Add asset
            </Link>
          }
        >
          <div className="market-toolbar">
            <div className="timeframe-control" aria-label="Chart timeframe">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={timeframe === tf ? "active" : ""}
                >
                  {tf}
                </button>
              ))}
            </div>
            <div className="table-search">
              <Search size={15} />
              <input
                aria-label="Search your market watch"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assets..."
              />
              {search && (
                <button aria-label="Clear search" onClick={() => setSearch("")}>
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              className={`icon-button toolbar-button ${sound ? "selected" : ""}`}
              title="Sound preference"
              aria-label={
                sound ? "Disable sound alerts" : "Enable sound alerts"
              }
              aria-pressed={sound}
              onClick={() => {
                setSound(!sound);
                toast(
                  sound
                    ? "Sound preference disabled."
                    : "Sound preference enabled. Alerts require a connected backend.",
                );
              }}
            >
              {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
            <button
              className={`icon-button toolbar-button ${showFilters ? "selected" : ""}`}
              aria-label="Filter market signals"
              aria-expanded={showFilters}
              onClick={() => setShowFilters(!showFilters)}
            >
              <ListFilter size={17} />
            </button>
          </div>
          {showFilters && (
            <div className="inline-filters">
              <span>Signal</span>
              {(["ALL", "BUY", "SELL", "WAIT"] as const).map((s) => (
                <button
                  className={`filter-chip ${filter === s ? "active" : ""}`}
                  key={s}
                  onClick={() => setFilter(s)}
                >
                  {s === "ALL" ? "All signals" : s}
                </button>
              ))}
              <button
                className="text-button"
                onClick={() => {
                  setFilter("ALL");
                  setSearch("");
                }}
              >
                Reset
              </button>
            </div>
          )}
          <div className="table-wrap">
            <table className="data-table market-table">
              <thead>
                <tr>
                  <th className="star-cell">
                    <Star size={13} />
                  </th>
                  <th>Asset</th>
                  <th className="align-right">
                    Price <span>USDT</span>
                  </th>
                  <th className="align-right">
                    <button
                      className="sort-header"
                      onClick={() =>
                        setSort(sort === "change" ? "default" : "change")
                      }
                    >
                      24h change
                      <ChevronRight
                        size={11}
                        className={sort === "change" ? "rotate" : ""}
                      />
                    </button>
                  </th>
                  <th>7d trend</th>
                  <th>Signal</th>
                  <th className="reason-column">Signal reason</th>
                  <th className="alert-cell">
                    <Bell size={13} />
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((coin) => (
                  <tr key={coin.symbol}>
                    <td className="star-cell">
                      <Star
                        size={14}
                        fill="currentColor"
                        className="watch-star"
                      />
                    </td>
                    <td>
                      <Link
                        className="asset-link"
                        href={`/markets/?symbol=${coin.symbol}`}
                      >
                        <CoinIcon coin={coin} />
                        <span>
                          <strong>
                            {coin.symbol}
                            <small>/ USDT</small>
                          </strong>
                          <span>{coin.name}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="align-right price-value">
                      {formatPrice(coin.price)}
                    </td>
                    <td
                      className={`align-right ${coin.change >= 0 ? "positive" : "negative"}`}
                    >
                      <span className="change-value">
                        {coin.change >= 0 ? (
                          <ArrowUpRight size={13} />
                        ) : (
                          <ArrowDownRight size={13} />
                        )}
                        {formatChange(coin.change)}
                      </span>
                    </td>
                    <td>
                      <Sparkline
                        values={coin.sparkline}
                        negative={coin.change < 0}
                        filled
                      />
                    </td>
                    <td>
                      <SignalBadge signal={coin.signal} />
                    </td>
                    <td className="reason-column">
                      <span className="signal-reason">{coin.reason}</span>
                      <span className="last-signal">
                        <Clock3 size={10} />
                        {coin.lastSignal}
                      </span>
                    </td>
                    <td className="alert-cell">
                      <button
                        className={`alert-toggle ${alerts.includes(coin.symbol) ? "enabled" : ""}`}
                        aria-label={`${alerts.includes(coin.symbol) ? "Disable" : "Enable"} ${coin.symbol} alerts`}
                        aria-pressed={alerts.includes(coin.symbol)}
                        onClick={() =>
                          setAlerts(
                            alerts.includes(coin.symbol)
                              ? alerts.filter((s) => s !== coin.symbol)
                              : [...alerts, coin.symbol],
                          )
                        }
                      >
                        <Bell size={14} />
                      </button>
                    </td>
                    <td>
                      <Link
                        href={`/markets/?symbol=${coin.symbol}`}
                        className="row-action"
                        aria-label={`View ${coin.symbol} analysis`}
                      >
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length === 0 && (
            <EmptyState
              icon={Search}
              title={
                watched.length ? "No matching assets" : "Your watch starts here"
              }
              description={
                watched.length
                  ? "Try a different search or clear the signal filter."
                  : "Add your first asset to start exploring technical signals."
              }
              action={
                <Link href="/watchlist/" className="btn btn-primary">
                  Manage watchlist
                  <ArrowRight size={14} />
                </Link>
              }
            />
          )}
          <div className="table-footer">
            <span>
              Showing <strong>{visible.length}</strong> of {watched.length}{" "}
              assets
            </span>
            <span>
              <span className="status-dot amber" />
              Illustrative 4h signals
              <Link href={`/markets/?symbol=BTC`}>
                Open {timeframe} chart
                <ArrowUpRight size={12} />
              </Link>
            </span>
          </div>
        </Panel>
        <Panel
          className="activity-panel"
          title="Signal pulse"
          actions={<span className="subtle-tag">RECENT</span>}
        >
          <div className="activity-intro">
            <span className="pulse-icon">
              <Radio size={19} />
            </span>
            <div>
              <strong>Every move has a reason.</strong>
              <p>A look at recent example signals.</p>
            </div>
          </div>
          <div className="signal-feed">
            {history.slice(0, 4).map((signal, index) => {
              const coin = coins.find((c) => c.symbol === signal.symbol)!;
              return (
                <Link
                  href={`/markets/?symbol=${coin.symbol}`}
                  key={signal.id}
                  className="feed-item"
                >
                  <div className="feed-line">
                    <CoinIcon coin={coin} small />
                    <strong>
                      {coin.symbol}
                      <span>/USDT</span>
                    </strong>
                    <SignalBadge signal={signal.signal} />
                  </div>
                  <p>{signal.reason}</p>
                  <div className="feed-bottom">
                    <span>
                      {new Date(signal.time).toLocaleTimeString("en-GB", {
                        timeZone: "UTC",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      UTC
                    </span>
                    <span>
                      4h timeframe
                      <ArrowUpRight size={11} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
          <Link href="/signals/" className="panel-bottom-link">
            View all signal history
            <ArrowRight size={14} />
          </Link>
        </Panel>
      </div>
      <div className="dashboard-lower">
        <Panel
          title="Market momentum"
          description="A quick read on your watchlist’s direction."
          actions={<span className="subtle-tag">24 HOURS</span>}
        >
          <div className="momentum-content">
            <div className="momentum-number">
              <span>
                {breadth}
                <small>%</small>
              </span>
              <div>
                <strong>of tracked assets are up</strong>
                <p>
                  {advancing} advancing <span>·</span>{" "}
                  {watched.length - advancing} declining
                </p>
              </div>
              <span className="momentum-symbol">
                <TrendingUp size={27} />
              </span>
            </div>
            <div className="breadth-bar">
              <span style={{ width: `${breadth}%` }} />
              <span />
            </div>
            <div className="breadth-labels">
              <span>
                <i className="mini-dot green" />
                Advancing
              </span>
              <span>
                Declining
                <i className="mini-dot red" />
              </span>
            </div>
            <div className="momentum-foot">
              <span className="muted">Based on the demo market snapshot</span>
              <Link href="/analytics/">
                Explore performance
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>
        </Panel>
        <Panel
          title="Built on clear conditions"
          description="Four indicators. One disciplined approach."
          actions={
            <Link
              href="/settings/"
              className="icon-button"
              aria-label="Edit strategy"
            >
              <Settings2 size={17} />
            </Link>
          }
        >
          <div className="strategy-pills">
            <div>
              <span className="strategy-mini blue">∿</span>
              <strong>
                EMA 50 / 200<small>Trend direction</small>
              </strong>
              <Check size={14} />
            </div>
            <div>
              <span className="strategy-mini purple">
                <ActivityIcon />
              </span>
              <strong>
                MACD<small>Momentum crossover</small>
              </strong>
              <Check size={14} />
            </div>
            <div>
              <span className="strategy-mini orange">≋</span>
              <strong>
                RSI 14<small>Strength confirmation</small>
              </strong>
              <Check size={14} />
            </div>
          </div>
          <div className="strategy-footer">
            <span>
              <span className="status-dot" />
              Closed candle analysis only
            </span>
            <Link href="/settings/">
              Strategy v1.0
              <ArrowUpRight size={12} />
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ActivityIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M2 12h5l3-8 4 16 3-8h5" />
    </svg>
  );
}
