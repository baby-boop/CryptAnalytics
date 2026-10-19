"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCheck,
  ChevronRight,
  Info,
  Target,
} from "lucide-react";
import {
  CoinIcon,
  EmptyState,
  MetricCard,
  PageHeading,
  Panel,
} from "@/components/ui";
import { coins, formatChange, type HistorySignal } from "@/lib/data";
import { useMarket } from "@/components/market-provider";
import "../insights.css";

type Horizon = 1 | 3 | 6;
type Period = "24h" | "3d" | "7d" | "30d";
const periodHours: Record<Period, number> = {
  "24h": 24,
  "3d": 72,
  "7d": 168,
  "30d": 720,
};
const observed = (row: HistorySignal, horizon: Horizon) =>
  horizon === 1 ? row.result1 : horizon === 3 ? row.result3 : row.result6;
const average = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

export default function AnalyticsPage() {
  const { history, lastUpdate, status, error, refresh, mode } = useMarket();
  const [period, setPeriod] = useState<Period>("7d");
  const [horizon, setHorizon] = useState<Horizon>(3);
  const [chartView, setChartView] = useState<"trend" | "symbols">("trend");
  const latestTimestamp = lastUpdate ?? (history.length
    ? Math.max(...history.map((row) => new Date(row.time).getTime()))
    : null);
  const periodRows = useMemo(
    () =>
      history.filter(
        (row) =>
          latestTimestamp !== null &&
          new Date(row.time).getTime() >= latestTimestamp - periodHours[period] * 3600000 &&
          new Date(row.time).getTime() <= latestTimestamp,
      ),
    [history, latestTimestamp, period],
  );
  const evaluated = useMemo(
    () =>
      periodRows.flatMap((row) => {
        const result = observed(row, horizon);
        return result === null
          ? []
          : [{ ...row, movement: result * (row.signal === "BUY" ? 1 : -1) }];
      }),
    [periodRows, horizon],
  );
  const favorable = evaluated.filter((row) => row.movement > 0);
  const adverse = evaluated.filter((row) => row.movement < 0);
  const hitRate = evaluated.length
    ? (favorable.length / evaluated.length) * 100
    : 0;
  const buyCount = periodRows.filter((row) => row.signal === "BUY").length;
  const buyRatio = periodRows.length ? (buyCount / periodRows.length) * 100 : 0;
  const symbolRows = coins.map((coin) => {
      const rows = evaluated.filter((row) => row.symbol === coin.symbol);
      return {
        coin,
        count: rows.length,
        movement: average(rows.map((row) => row.movement)),
        accuracy: rows.length
          ? (rows.filter((row) => row.movement > 0).length / rows.length) * 100
          : 0,
      };
    })
    .filter((row) => row.count > 0);
  const days = [
    ...new Set(evaluated.map((row) => row.time.slice(0, 10))),
  ].sort();
  const chartPoints = days.map((day) => ({
    day,
    value: average(
      evaluated
        .filter((row) => row.time.startsWith(day))
        .map((row) => row.movement),
    ),
  }));
  const dateRange = latestTimestamp === null ? "Waiting for market data" : `${new Date(latestTimestamp - periodHours[period] * 3600000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} – ${new Date(latestTimestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;

  return (
    <div className="insights-page">
      <PageHeading
        eyebrow="HISTORICAL EVALUATION"
        title="Performance analytics"
        description="Understand how prices moved after your signals."
        actions={
          <div className="insights-segment analytics-periods">
            {(["24h", "3d", "7d", "30d"] as const).map((value) => (
              <button
                key={value}
                className={period === value ? "selected" : ""}
                onClick={() => setPeriod(value)}
              >
                {value}
              </button>
            ))}
          </div>
        }
      />
      <div className={`archive-feed-note section-gap ${error ? "has-error" : ""}`} role="status">
        <Info size={15} />
        <p>
          {error ?? (status === "loading"
            ? "Loading recorded signal outcomes…"
            : mode === "server"
              ? "Binance candle outcomes from the MongoDB signal archive."
              : "Historical replay from Binance candles. Backend persistence is unavailable in this preview.")}
          {(status === "offline" || status === "reconnecting") && history.length > 0 && <span> Showing the last received archive.</span>}
        </p>
        {(error || status === "offline") && <button className="btn btn-ghost" onClick={refresh}>Reconnect</button>}
      </div>
      <div className="analytics-context section-gap">
        <span>
          <span className="insights-calendar-dot" />
          {dateRange}
          <span className="muted">· UTC</span>
        </span>
        <div className="history-horizon">
          <span className="muted">Evaluation horizon</span>
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
      </div>
      <div className="grid-4 section-gap analytics-metrics">
        <MetricCard
          label="Evaluated signals"
          value={evaluated.length}
          icon={BarChart3}
          tone="blue"
        >
          <span className="muted">
            of {periodRows.length} signals in period
          </span>
        </MetricCard>
        <MetricCard
          label="Directional accuracy"
          value={evaluated.length ? `${hitRate.toFixed(1)}%` : "—"}
          icon={Target}
          tone="green"
        >
          <span className="muted">
            {favorable.length} moved in the signal direction
          </span>
        </MetricCard>
        <MetricCard
          label="Avg. favorable movement"
          value={
            favorable.length
              ? formatChange(average(favorable.map((row) => row.movement)))
              : "—"
          }
          icon={ArrowUpRight}
          tone="green"
        >
          <span className="muted">
            Across {favorable.length} favorable outcomes
          </span>
        </MetricCard>
        <MetricCard
          label="Avg. adverse movement"
          value={
            adverse.length
              ? formatChange(average(adverse.map((row) => row.movement)))
              : "—"
          }
          icon={ArrowDownRight}
          tone="red"
        >
          <span className="muted">
            Across {adverse.length} adverse outcomes
          </span>
        </MetricCard>
      </div>
      <div className="analytics-layout section-gap">
        <Panel
          title="Signal outcomes"
          description={`Directional price movement after ${horizon} closed candles`}
          actions={
            <div className="insights-segment">
              <button
                className={chartView === "trend" ? "selected" : ""}
                onClick={() => setChartView("trend")}
              >
                Over time
              </button>
              <button
                className={chartView === "symbols" ? "selected" : ""}
                onClick={() => setChartView("symbols")}
              >
                By symbol
              </button>
            </div>
          }
        >
          <div className="analytics-chart-summary">
            <div>
              <span className="muted">Average directional movement</span>
              <strong
                className={
                  average(evaluated.map((row) => row.movement)) >= 0
                    ? "positive"
                    : "negative"
                }
              >
                {evaluated.length
                  ? formatChange(average(evaluated.map((row) => row.movement)))
                  : "—"}
                <span className="analytics-average-label">
                  after {horizon} candles
                </span>
              </strong>
            </div>
            <span className="analytics-legend">
              <i />
              {chartView === "trend" ? "Daily average" : "Symbol average"}
            </span>
          </div>
          {!evaluated.length ? (
            <EmptyState
              icon={Activity}
              title={!periodRows.length ? status === "loading" ? "Loading signal outcomes" : "No signals in this period" : "Outcomes are still pending"}
              description={!periodRows.length ? "Signals are added when closed Binance candles satisfy your strategy. Choose a longer period to include older signals." : "This horizon requires more closed candles before an outcome can be evaluated."}
            />
          ) : chartView === "trend" ? (
            <MovementChart points={chartPoints} />
          ) : (
            <div className="analytics-symbol-bars">
              {symbolRows.map((row) => (
                <div key={row.coin.symbol}>
                  <span className="insights-coin-cell">
                    <CoinIcon coin={row.coin} small />
                    <strong>{row.coin.symbol}</strong>
                  </span>
                  <div className="analytics-bar-track">
                    <span
                      className={row.movement >= 0 ? "" : "adverse"}
                      style={{
                        width: `${Math.max(2, (Math.abs(row.movement) / Math.max(...symbolRows.map((item) => Math.abs(item.movement)), 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <strong
                    className={row.movement >= 0 ? "positive" : "negative"}
                  >
                    {formatChange(row.movement)}
                  </strong>
                </div>
              ))}
            </div>
          )}
          <div className="analytics-chart-foot">
            <Info size={13} />
            <span>
              Each point summarizes observed outcomes; signals are not
              compounded.
            </span>
          </div>
        </Panel>
        <Panel
          title="Signal distribution"
          description="Generated signals within this period"
          className="analytics-distribution"
        >
          <div
            className="analytics-donut"
            style={{
              background: periodRows.length ? `conic-gradient(var(--green, #18d69d) 0% ${buyRatio}%, var(--red, #f56578) ${buyRatio}% 100%)` : "var(--border, #1c2a3d)",
            }}
          >
            <div>
              <strong>{periodRows.length}</strong>
              <span>Total signals</span>
            </div>
          </div>
          <div className="analytics-distribution-legend">
            <div>
              <span>
                <i className="buy-dot" />
                Buy signals
              </span>
              <strong>
                {buyCount}
                <small>{buyRatio.toFixed(1)}%</small>
              </strong>
            </div>
            <div>
              <span>
                <i className="sell-dot" />
                Sell signals
              </span>
              <strong>
                {periodRows.length - buyCount}
                <small>{(periodRows.length ? 100 - buyRatio : 0).toFixed(1)}%</small>
              </strong>
            </div>
            <div>
              <span>
                <i className="neutral-dot" />
                Pending outcomes
              </span>
              <strong>{periodRows.length - evaluated.length}</strong>
            </div>
          </div>
          <p className="analytics-distribution-note">
            WAIT states are displayed on the dashboard and excluded from the
            signal archive. Includes {periodRows.filter((row) => row.source === "backfill").length} reconstructed backfill signals and {periodRows.filter((row) => row.source === "live").length} live-close signals.
          </p>
        </Panel>
      </div>
      <div className="analytics-bottom section-gap">
        <Panel
          title="Symbol breakdown"
          description="Compare outcomes across your monitored markets"
          actions={
            <span className="insights-count">{symbolRows.length} symbols</span>
          }
        >
          {symbolRows.length ? (
            <div className="table-wrap">
              <table className="data-table analytics-symbol-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="numeric">Evaluated</th>
                    <th>Directional accuracy</th>
                    <th className="numeric">Avg. movement</th>
                  </tr>
                </thead>
                <tbody>
                  {symbolRows.map((row) => (
                    <tr key={row.coin.symbol}>
                      <td>
                        <span className="insights-coin-cell">
                          <CoinIcon coin={row.coin} small />
                          <span>
                            <strong>{row.coin.symbol}</strong>
                            <small className="muted">{row.coin.name}</small>
                          </span>
                        </span>
                      </td>
                      <td className="numeric">{row.count}</td>
                      <td>
                        <div className="analytics-accuracy">
                          <div>
                            <span style={{ width: `${row.accuracy}%` }} />
                          </div>
                          <span>{row.accuracy.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td
                        className={`numeric ${row.movement >= 0 ? "positive" : "negative"}`}
                      >
                        {formatChange(row.movement)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Activity}
              title="No evaluated symbols yet"
              description="Select a shorter candle horizon or a longer period to see more outcomes."
            />
          )}
        </Panel>
        <Panel
          title="How evaluation works"
          description="A transparent view of signal quality"
          className="analytics-methodology"
        >
          <div className="analytics-method-icon">
            <CheckCheck size={23} />
          </div>
          <h3>Price movement, clearly measured.</h3>
          <p>
            We compare the signal candle’s close price with the close {horizon}{" "}
            candle{horizon > 1 ? "s" : ""} later.
          </p>
          <ul>
            <li>
              <ChevronRight size={14} />
              <span>BUY is favorable when price rises.</span>
            </li>
            <li>
              <ChevronRight size={14} />
              <span>SELL is favorable when price falls.</span>
            </li>
            <li>
              <ChevronRight size={14} />
              <span>Pending results are excluded from averages.</span>
            </li>
          </ul>
          <div className="analytics-method-note">
            <Info size={14} />
            <span>
              Outcomes use actual later closed-candle prices and the signal’s
              original strategy version. Fees, slippage, position sizing and
              execution are not modeled.
            </span>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MovementChart({
  points,
}: {
  points: { day: string; value: number }[];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 760,
    height = 250,
    left = 46,
    right = 22,
    top = 20,
    bottom = 38;
  const bound = Math.max(
    2,
    Math.ceil(Math.max(...points.map((point) => Math.abs(point.value))) / 2) *
      2,
  );
  const x = (index: number) =>
    points.length === 1
      ? (width + left - right) / 2
      : left + (index / (points.length - 1)) * (width - left - right);
  const y = (value: number) =>
    top + ((bound - value) / (bound * 2)) * (height - top - bottom);
  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.value)}`,
    )
    .join(" ");
  const area = `${path} L ${x(points.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`;
  const hoveredPoint = hovered === null ? null : points[hovered];
  return (
    <div className="analytics-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Daily average directional price movement in percent"
      >
        <defs>
          <linearGradient id="analytics-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b76fb" stopOpacity=".25" />
            <stop offset="100%" stopColor="#2b76fb" stopOpacity=".015" />
          </linearGradient>
        </defs>
        {[-bound, -bound / 2, 0, bound / 2, bound].map((value) => (
          <g key={value}>
            <line
              x1={left}
              x2={width - right}
              y1={y(value)}
              y2={y(value)}
              className={
                value === 0 ? "analytics-chart-zero" : "analytics-chart-grid"
              }
            />
            <text x={left - 12} y={y(value) + 4} textAnchor="end">
              {value > 0 ? "+" : ""}
              {value}%
            </text>
          </g>
        ))}
        {points.map((point, index) => (
          <g key={point.day}>
            <line
              className="analytics-chart-grid"
              x1={x(index)}
              x2={x(index)}
              y1={top}
              y2={height - bottom}
            />
            <text x={x(index)} y={height - 12} textAnchor="middle">
              {new Date(point.day).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                timeZone: "UTC",
              })}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#analytics-area)" />
        <path
          d={path}
          fill="none"
          stroke="#4a8bff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <g key={point.day}>
            <circle
              cx={x(index)}
              cy={y(point.value)}
              r={hovered === index ? 5 : 3.5}
              fill="#4a8bff"
              stroke="var(--panel, #0d1727)"
              strokeWidth="2"
            />
            <rect
              x={x(index) - 22}
              y={top}
              width="44"
              height={height - top - bottom}
              fill="transparent"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              tabIndex={0}
              role="button"
              aria-label={`${point.day}: ${formatChange(point.value)}`}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
            />
          </g>
        ))}
        {hovered !== null && hoveredPoint && (
          <g>
            <rect
              x={Math.min(width - 150, Math.max(left, x(hovered) - 65))}
              y={Math.max(0, y(hoveredPoint.value) - 42)}
              width="130"
              height="28"
              rx="6"
              fill="var(--raised, #17273d)"
              stroke="var(--border, #26364e)"
            />
            <text
              x={Math.min(width - 150, Math.max(left, x(hovered) - 65)) + 65}
              y={Math.max(0, y(hoveredPoint.value) - 42) + 18}
              textAnchor="middle"
              className="analytics-tooltip"
            >
              {formatChange(hoveredPoint.value)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
