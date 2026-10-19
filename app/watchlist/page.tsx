"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowUpRight,
  Bell,
  CircleHelp,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import { useMarket } from "@/components/market-provider";
import { MarketStatus } from "@/components/market-status";
import {
  CoinIcon,
  EmptyState,
  PageHeading,
  Panel,
  SignalBadge,
  Sparkline,
  Toggle,
} from "@/components/ui";
import { formatChange, formatPrice } from "@/lib/data";
import "../insights.css";

export default function WatchlistPage() {
  const { watchlist, setWatchlist, alerts, setAlerts, toast } = useApp();
  const { markets, symbolErrors, mode, connected } = useMarket();
  const [search, setSearch] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [sort, setSort] = useState<"custom" | "change">("custom");
  const modalRef = useRef<HTMLElement>(null);
  const watched = [...new Set(watchlist)].flatMap((symbol) => {
    const coin = markets.find((item) => item.symbol === symbol);
    return coin ? [coin] : [];
  });
  const visible = watched.filter((coin) =>
    `${coin.symbol} ${coin.name}`.toLowerCase().includes(search.toLowerCase()),
  );
  if (sort === "change") visible.sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity));
  const available = markets.filter(
    (coin) =>
      !watchlist.includes(coin.symbol) &&
      `${coin.symbol} ${coin.name}`
        .toLowerCase()
        .includes(addSearch.toLowerCase()),
  );
  const enabled = watched.filter((coin) => alerts.includes(coin.symbol)).length;

  useEffect(() => {
    if (!adding) return;
    const previousFocus = document.activeElement;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setAdding(false);
      if (event.key !== "Tab") return;
      const controls = modalRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input, [href]",
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [adding]);

  function toggleAlert(symbol: string, checked: boolean) {
    setAlerts(
      checked
        ? [...new Set([...alerts, symbol])]
        : alerts.filter((item) => item !== symbol),
    );
    toast(
      `${symbol} alert preference ${checked ? "enabled" : "disabled"}`,
    );
  }

  function addSymbol(symbol: string) {
    setWatchlist([...watchlist, symbol]);
    toast(`${symbol}/USDT added to your watchlist`);
  }

  function removeSymbol(symbol: string) {
    setWatchlist(watchlist.filter((item) => item !== symbol));
    setAlerts(alerts.filter((item) => item !== symbol));
    toast(`${symbol}/USDT removed from your watchlist`);
  }

  return (
    <div className="insights-page">
      <PageHeading
        eyebrow="YOUR MARKET RADAR"
        title="Watchlist"
        description="Keep the markets that matter to you in one place."
        actions={
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add symbol
          </button>
        }
      />
      <MarketStatus />
      <div className="watchlist-summary section-gap">
        <div>
          <span className="watchlist-summary-symbol">
            <Star size={20} />
          </span>
          <span>
            <strong>{watched.length} symbols</strong>
            <small className="muted">in your watchlist</small>
          </span>
        </div>
        <span className="watchlist-summary-divider" />
        <div>
          <span className="watchlist-summary-symbol green">
            <Bell size={19} />
          </span>
          <span>
            <strong>{enabled} alerts enabled</strong>
            <small className="muted">notification preferences</small>
          </span>
        </div>
        <div className="watchlist-summary-right">
          <span className="status-dot" />
          <span>Binance Spot pairs</span>
          <CircleHelp size={14} />
        </div>
      </div>
      <Panel
        title="Your symbols"
        description="A focused view of your monitored markets."
        actions={
          <button
            className="insights-text-button"
            disabled={!watched.length}
            onClick={() => {
              const allEnabled = enabled === watched.length;
              setAlerts(
                allEnabled
                  ? alerts.filter((symbol) => !watchlist.includes(symbol))
                  : [...new Set([...alerts, ...watchlist])],
              );
              toast(
                `Watchlist alert preferences ${allEnabled ? "disabled" : "enabled"}`,
              );
            }}
          >
            <Bell size={13} />
            {enabled === watched.length && watched.length > 0
              ? "Disable all alerts"
              : "Enable all alerts"}
          </button>
        }
      >
        <div className="watchlist-toolbar">
          <label className="insights-search">
            <Search size={15} />
            <input
              aria-label="Search watchlist"
              placeholder="Search symbol or name…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button
            className="btn btn-ghost watchlist-sort"
            aria-pressed={sort === "change"}
            onClick={() => setSort(sort === "custom" ? "change" : "custom")}
          >
            <ArrowDownUp size={14} />
            {sort === "custom" ? "Sort by 24h change" : "Watchlist order"}
          </button>
        </div>
        {visible.length ? (
          <div className="table-wrap">
            <table className="data-table watchlist-table">
              <thead>
                <tr>
                  <th className="watchlist-number">#</th>
                  <th>Asset</th>
                  <th className="numeric">
                    Price <span className="muted">USDT</span>
                  </th>
                  <th className="numeric">24h change</th>
                  <th>Price trend</th>
                  <th>Signal</th>
                  <th className="watchlist-alert-head">Alerts</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visible.map((coin, index) => (
                  <tr key={coin.symbol}>
                    <td className="muted watchlist-number">
                      {String(index + 1).padStart(2, "0")}
                    </td>
                    <td>
                      <Link
                        href={`/markets/?symbol=${coin.symbol}`}
                        className="insights-coin-cell watchlist-asset"
                      >
                        <CoinIcon coin={coin} />
                        <span>
                          <strong>
                            {coin.symbol}
                            <span className="muted"> / USDT</span>
                          </strong>
                          <small className="muted">{coin.name}</small>
                        </span>
                      </Link>
                    </td>
                    <td className="numeric watchlist-price">
                      {formatPrice(coin.price)}
                    </td>
                    <td
                      className={`numeric ${coin.change === null ? "muted" : coin.change >= 0 ? "positive" : "negative"}`}
                    >
                      {formatChange(coin.change)}
                    </td>
                    <td>
                      {coin.sparkline.length > 1 ? <Sparkline
                        values={coin.sparkline}
                        negative={coin.change !== null && coin.change < 0}
                      /> : <span className="muted" title={symbolErrors[coin.symbol]}>—</span>}
                    </td>
                    <td>
                      <SignalBadge signal={coin.signal} />
                    </td>
                    <td className="watchlist-alert-cell">
                      <Toggle
                        checked={alerts.includes(coin.symbol)}
                        onChange={(checked) =>
                          toggleAlert(coin.symbol, checked)
                        }
                        label={`Enable ${coin.symbol} alerts`}
                      />
                    </td>
                    <td>
                      <button
                        className="insights-icon-button watchlist-remove"
                        aria-label={`Remove ${coin.symbol} from watchlist`}
                        onClick={() => removeSymbol(coin.symbol)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={search ? Search : Star}
            title={search ? "No matching symbols" : "Make this space yours"}
            description={
              search
                ? "Try a different symbol or coin name."
                : "Add a Spot pair to start building your personal market radar."
            }
            action={
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (search) setSearch("");
                  else setAdding(true);
                }}
              >
                {search ? "Clear search" : "Add your first symbol"}
              </button>
            }
          />
        )}
        <div className="insights-table-footer">
          <span className="muted">
            {visible.length} of {watched.length} symbols
          </span>
          <span className="watchlist-preference-note">
            <span className="history-small-dot buy-dot" />
            {mode === "server" && connected ? "Preferences sync with your workspace" : "Preferences saved on this device"}
          </span>
        </div>
      </Panel>
      <div className="watchlist-bottom section-gap">
        <div className="watchlist-tip">
          <span className="watchlist-tip-icon">
            <Bell size={20} />
          </span>
          <div>
            <h3>Your signals, your way</h3>
            <p>
              Choose alerts for each symbol, then configure BUY and SELL
              preferences in Telegram settings.
            </p>
            <Link href="/notifications/">
              Configure notifications <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
        <div className="watchlist-tip">
          <span className="watchlist-tip-icon blue">
            <Star size={20} />
          </span>
          <div>
            <h3>A little focus goes a long way</h3>
            <p>
              Keep a small watchlist to review the market clearly. Add and
              remove symbols whenever your focus changes.
            </p>
          </div>
        </div>
      </div>
      {adding && (
        <div
          className="insights-modal-backdrop"
          onClick={() => setAdding(false)}
        >
          <section
            ref={modalRef}
            className="insights-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-symbol-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="insights-modal-heading">
              <div>
                <span className="eyebrow">EXPAND YOUR RADAR</span>
                <h2 id="add-symbol-title">Add a symbol</h2>
                <p className="muted">
                  Choose a supported Binance Spot pair.
                </p>
              </div>
              <button
                className="insights-icon-button"
                aria-label="Close add symbol dialog"
                onClick={() => setAdding(false)}
              >
                <X size={19} />
              </button>
            </div>
            <label className="insights-search">
              <Search size={16} />
              <input
                autoFocus
                aria-label="Search available symbols"
                placeholder="Search symbol or name…"
                value={addSearch}
                onChange={(event) => setAddSearch(event.target.value)}
              />
            </label>
            <div className="watchlist-catalog">
              {available.length ? (
                available.map((coin) => (
                  <div key={coin.symbol}>
                    <span className="insights-coin-cell">
                      <CoinIcon coin={coin} />
                      <span>
                        <strong>
                          {coin.symbol}
                          <span className="muted"> / USDT</span>
                        </strong>
                        <small className="muted">{coin.name}</small>
                      </span>
                    </span>
                    <button
                      className="btn btn-ghost"
                      aria-label={`Add ${coin.symbol} to watchlist`}
                      onClick={() => addSymbol(coin.symbol)}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={Search}
                  title="No available symbols"
                  description={
                    addSearch
                      ? "Try another search. Symbols already in your watchlist are hidden."
                      : "Every supported symbol is already in your watchlist."
                  }
                />
              )}
            </div>
            <div className="watchlist-modal-foot">
              <CircleHelp size={14} />
              <span>
                Prices come from Binance Spot. Signals use completed candles.
              </span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
