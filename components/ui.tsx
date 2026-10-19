import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Coin, Signal } from "@/lib/data";

export function SignalBadge({ signal }: { signal: Signal }) {
  return (
    <span className={`signal-badge ${signal.toLowerCase()}`}>
      <span />
      {signal}
    </span>
  );
}

export function CoinIcon({
  coin,
  small = false,
}: {
  coin: Coin;
  small?: boolean;
}) {
  return (
    <span
      className={`coin-icon ${small ? "small" : ""}`}
      style={{
        background: `${coin.color}19`,
        color: coin.color,
        borderColor: `${coin.color}35`,
      }}
    >
      {coin.icon}
    </span>
  );
}

export function Sparkline({
  values,
  negative = false,
  filled = false,
}: {
  values: number[];
  negative?: boolean;
  filled?: boolean;
}) {
  const min = Math.min(...values) - 3;
  const max = Math.max(...values) + 3;
  const points = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * 120},${40 - ((v - min) / (max - min)) * 36}`,
    )
    .join(" ");
  return (
    <svg
      className={`sparkline ${negative ? "negative" : ""}`}
      viewBox="0 0 120 44"
      role="img"
      aria-label={negative ? "Downward price trend" : "Upward price trend"}
    >
      {filled && (
        <polygon
          points={`0,44 ${points} 120,44`}
          fill="currentColor"
          opacity=".07"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MetricCard({
  label,
  value,
  change,
  icon: Icon,
  tone = "blue",
  children,
}: {
  label: string;
  value: string | number;
  change?: string;
  icon: LucideIcon;
  tone?: "blue" | "green" | "red" | "purple";
  children?: ReactNode;
}) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon size={17} />
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-bottom">
        {change && (
          <span className="metric-change">
            {tone === "red" ? (
              <ArrowDownRight size={14} />
            ) : (
              <ArrowUpRight size={14} />
            )}
            {change}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  ariaLabel,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <label className="select-wrap">
      {label && <span className="field-label">{label}</span>}
      <span className="select-control">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel ?? label}
        >
          {options.map((o) => (
            <option value={o.value} key={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} />
      </span>
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      className="toggle"
      role="switch"
      type="button"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={24} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
