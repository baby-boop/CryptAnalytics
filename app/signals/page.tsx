"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  History,
  Info,
  Search,
  X,
} from "lucide-react";
import {
  CoinIcon,
  EmptyState,
  PageHeading,
  Panel,
  Select,
  SignalBadge,
} from "@/components/ui";
import { useApp } from "@/components/app-provider";
import {
  coins,
  formatChange,
  formatPrice,
  history,
  type HistorySignal,
} from "@/lib/data";
import "../insights.css";

type Horizon = 1 | 3 | 6;
const pageSize = 8;
const resultAt = (signal: HistorySignal, horizon: Horizon) =>
  horizon === 1
    ? signal.result1
    : horizon === 3
      ? signal.result3
      : signal.result6;
const formatTime = (time: string) =>
  new Date(time).toLocaleString("en-GB", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });

export default function SignalsPage() {
  const { toast } = useApp();
  const [symbol, setSymbol] = useState("all");
  const [timeframe, setTimeframe] = useState("all");
  const [signal, setSignal] = useState("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("2026-10-13");
  const [until, setUntil] = useState("2026-10-19");
  const [horizon, setHorizon] = useState<Horizon>(3);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      history.filter(
        (row) =>
          (symbol === "all" || row.symbol === symbol) &&
          (timeframe === "all" || row.timeframe === timeframe) &&
          (signal === "all" || row.signal === signal) &&
          (!from || row.time.slice(0, 10) >= from) &&
          (!until || row.time.slice(0, 10) <= until) &&
          `${row.symbol} ${row.reason}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [symbol, timeframe, signal, from, until, query],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const buyCount = filtered.filter((row) => row.signal === "BUY").length;
  const evaluatedCount = filtered.filter(
    (row) => resultAt(row, horizon) !== null,
  ).length;
  const hasFilters =
    symbol !== "all" ||
    timeframe !== "all" ||
    signal !== "all" ||
    query !== "" ||
    from !== "2026-10-13" ||
    until !== "2026-10-19";

  function resetFilters() {
    setSymbol("all");
    setTimeframe("all");
    setSignal("all");
    setQuery("");
    setFrom("2026-10-13");
    setUntil("2026-10-19");
    setPage(1);
  }

  function exportCsv() {
    const cell = (value: string | number | null) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const values = filtered.map((row) => [
      row.time,
      row.symbol,
      row.timeframe,
      row.signal,
      row.price,
      row.rsi,
      resultAt(row, horizon),
      row.reason,
    ]);
    const csv = [
      [
        "UTC time",
        "Symbol",
        "Timeframe",
        "Signal",
        "Close price (USDT)",
        "RSI",
        `Price change after ${horizon} candles (%)`,
        "Reason",
      ],
      ...values,
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "signal-history-demo.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast(`${filtered.length} demo signals exported as CSV`);
  }

  return (
    <div className="insights-page">
      <PageHeading
        eyebrow="YOUR SIGNAL ARCHIVE"
        title="Signal history"
        description="Every signal, its context, and what happened next."
        actions={
          <button
            className="btn btn-ghost"
            onClick={exportCsv}
            disabled={!filtered.length}
          >
            <ArrowDownToLine size={15} /> Export CSV
          </button>
        }
      />
      <div className="history-overview section-gap">
        <div className="history-summary">
          <span className="history-summary-icon">
            <History size={20} />
          </span>
          <div>
            <span className="muted">Signals in this view</span>
            <strong>
              {filtered.length}
              <small>closed-candle signals</small>
            </strong>
          </div>
        </div>
        <div className="history-summary">
          <span className="history-small-dot buy-dot" />
          <div>
            <span className="muted">Buy signals</span>
            <strong>
              {buyCount}
              <small>
                {filtered.length
                  ? Math.round((buyCount / filtered.length) * 100)
                  : 0}
                % of signals
              </small>
            </strong>
          </div>
        </div>
        <div className="history-summary">
          <span className="history-small-dot sell-dot" />
          <div>
            <span className="muted">Sell signals</span>
            <strong>
              {filtered.length - buyCount}
              <small>technical indications</small>
            </strong>
          </div>
        </div>
        <div className="history-summary">
          <span className="history-small-dot neutral-dot" />
          <div>
            <span className="muted">Evaluated</span>
            <strong>
              {evaluatedCount}
              <small>at {horizon}-candle horizon</small>
            </strong>
          </div>
        </div>
      </div>
      <Panel
        title="All signals"
        description="Generated on fully closed candles. All timestamps are UTC."
        actions={<span className="insights-count">{history.length} total</span>}
      >
        <div className="history-filter-area">
          <div className="filter-bar insights-filters">
            <label className="insights-search">
              <Search size={15} />
              <input
                aria-label="Search signal history"
                value={query}
                placeholder="Search symbol or reason…"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <Select
              ariaLabel="Filter by symbol"
              value={symbol}
              onChange={(value) => {
                setSymbol(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All symbols" },
                ...coins
                  .slice(0, 6)
                  .map((coin) => ({
                    value: coin.symbol,
                    label: `${coin.symbol} / USDT`,
                  })),
              ]}
            />
            <Select
              ariaLabel="Filter by timeframe"
              value={timeframe}
              onChange={(value) => {
                setTimeframe(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All timeframes" },
                ...["15m", "1h", "4h", "1d"].map((value) => ({
                  value,
                  label: value,
                })),
              ]}
            />
            <Select
              ariaLabel="Filter by signal"
              value={signal}
              onChange={(value) => {
                setSignal(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All signals" },
                { value: "BUY", label: "Buy signals" },
                { value: "SELL", label: "Sell signals" },
              ]}
            />
          </div>
          <div className="history-filter-bottom">
            <div className="insights-date-range">
              <CalendarDays size={14} />
              <input
                type="date"
                aria-label="Signals from date"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
              />
              <ArrowRight size={12} />
              <input
                type="date"
                aria-label="Signals until date"
                value={until}
                onChange={(event) => {
                  setUntil(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="history-horizon">
              <span className="muted">Result after</span>
              <div className="insights-segment">
                {([1, 3, 6] as const).map((value) => (
                  <button
                    key={value}
                    className={horizon === value ? "selected" : ""}
                    onClick={() => setHorizon(value)}
                  >
                    {value} candle{value > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </div>
            {hasFilters && (
              <button className="insights-text-button" onClick={resetFilters}>
                <X size={13} /> Clear filters
              </button>
            )}
          </div>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="data-table history-table">
              <thead>
                <tr>
                  <th>
                    Closed at <span className="muted">UTC</span>
                  </th>
                  <th>Symbol</th>
                  <th>Timeframe</th>
                  <th>Signal</th>
                  <th className="numeric">Close price</th>
                  <th className="numeric">RSI</th>
                  <th className="numeric">
                    Price change <span className="muted">{horizon}c</span>
                  </th>
                  <th>Signal reason</th>
                  <th aria-label="Signal details" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const coin = coins.find(
                    (item) => item.symbol === row.symbol,
                  )!;
                  const result = resultAt(row, horizon);
                  const open = expanded === row.id;
                  return (
                    <SignalRows
                      key={row.id}
                      row={row}
                      coin={coin}
                      result={result}
                      horizon={horizon}
                      open={open}
                      toggle={() => setExpanded(open ? null : row.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Filter}
            title="No matching signals"
            description="Try another symbol, timeframe, or date range to explore the archive."
            action={
              <button className="btn btn-ghost" onClick={resetFilters}>
                Clear filters
              </button>
            }
          />
        )}
        <div className="insights-table-footer">
          <span className="muted">
            {filtered.length
              ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} signals`
              : "0 signals"}
          </span>
          <div className="insights-pagination">
            <button
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: pages }, (_, index) => index + 1).map(
              (value) => (
                <button
                  key={value}
                  className={value === currentPage ? "selected" : ""}
                  aria-label={`Page ${value}`}
                  aria-current={value === currentPage ? "page" : undefined}
                  onClick={() => setPage(value)}
                >
                  {value}
                </button>
              ),
            )}
            <button
              aria-label="Next page"
              disabled={currentPage >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </Panel>
      <div className="insights-note section-gap">
        <Info size={15} />
        <p>
          Results show the observed close-price change after the selected number
          of candles. Positive means the price rose; negative means it fell.
          These are historical observations, not trading returns.
        </p>
      </div>
    </div>
  );
}

function SignalRows({
  row,
  coin,
  result,
  horizon,
  open,
  toggle,
}: {
  row: HistorySignal;
  coin: (typeof coins)[number];
  result: number | null;
  horizon: Horizon;
  open: boolean;
  toggle: () => void;
}) {
  return (
    <>
      <tr className={open ? "history-row is-expanded" : "history-row"}>
        <td>
          <span className="history-time">{formatTime(row.time)}</span>
        </td>
        <td>
          <span className="insights-coin-cell">
            <CoinIcon coin={coin} small />
            <strong>{row.symbol}</strong>
          </span>
        </td>
        <td>
          <span className="timeframe-tag">{row.timeframe}</span>
        </td>
        <td>
          <SignalBadge signal={row.signal} />
        </td>
        <td className="numeric">{formatPrice(row.price)}</td>
        <td className="numeric muted">{row.rsi.toFixed(1)}</td>
        <td
          className={`numeric ${result === null ? "muted" : result >= 0 ? "positive" : "negative"}`}
        >
          {result === null ? (
            <span className="pending-result">
              <Clock3 size={11} /> Pending
            </span>
          ) : (
            formatChange(result)
          )}
        </td>
        <td>
          <span className="history-reason">{row.reason}</span>
        </td>
        <td>
          <button
            className={`insights-icon-button ${open ? "rotated" : ""}`}
            aria-label={`${open ? "Close" : "Show"} ${row.symbol} signal details from ${formatTime(row.time)}`}
            aria-expanded={open}
            onClick={toggle}
          >
            <ChevronDown size={15} />
          </button>
        </td>
      </tr>
      {open && (
        <tr className="history-detail-row">
          <td colSpan={9}>
            <div className="history-detail">
              <div>
                <span className="eyebrow">SIGNAL CONTEXT</span>
                <h3>
                  {row.symbol}/USDT · {row.signal}
                </h3>
                <p>
                  {row.reason}. This fixture was recorded on a closed{" "}
                  {row.timeframe} candle with RSI at {row.rsi.toFixed(1)}.
                </p>
              </div>
              <div className="history-detail-stat">
                <span className="muted">Closed candle</span>
                <strong>{row.time.replace("T", " ").slice(0, 19)} UTC</strong>
                <span className="muted">{horizon}-candle price movement</span>
                <strong
                  className={
                    result === null
                      ? "muted"
                      : result >= 0
                        ? "positive"
                        : "negative"
                  }
                >
                  {result === null
                    ? "Awaiting more candles"
                    : formatChange(result)}
                </strong>
              </div>
              <div className="history-detail-note">
                <Info size={16} />
                <p>
                  Demo archive. Indicator snapshots and strategy versions will
                  accompany signals when a backend is connected.
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
