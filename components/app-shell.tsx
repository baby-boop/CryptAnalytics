"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Bell,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  FlaskConical,
  LayoutDashboard,
  LogIn,
  Menu,
  Moon,
  Radio,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Star,
  Sun,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "./app-provider";
import { useMarket } from "./market-provider";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/markets/", label: "Market explorer", icon: ChartNoAxesCombined },
  { href: "/signals/", label: "Signal history", icon: Radio },
  { href: "/analytics/", label: "Performance", icon: Activity },
  { href: "/watchlist/", label: "Watchlist", icon: Star },
];
const configuration = [
  { href: "/settings/", label: "Strategy settings", icon: Settings2 },
  { href: "/notifications/", label: "Telegram alerts", icon: Send },
];

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark">
        <ChartNoAxesCombined size={21} strokeWidth={2.3} />
      </span>
      {!compact && (
        <span>
          signal<span className="brand-period">.</span>
          <small>CRYPTO INTELLIGENCE</small>
        </span>
      )}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme, watchlist, toast } = useApp();
  const market = useMarket();
  const [menuOpen, setMenuOpen] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.push("/watchlist/");
      }
      if (event.key === "Escape") {
        setHelp(false);
        setMenuOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (normalized === "/sign-in/") return <>{children}</>;
  const active = [...navigation, ...configuration].find(
    (n) => n.href === normalized,
  );

  function navLink(item: (typeof navigation)[number]) {
    const Icon = item.icon;
    return (
      <Link
        className={`nav-item ${normalized === item.href ? "active" : ""}`}
        href={item.href}
        key={item.href}
        onClick={() => setMenuOpen(false)}
      >
        <Icon size={18} />
        <span>{item.label}</span>
        {item.href === "/watchlist/" && (
          <span className="nav-count">{watchlist.length}</span>
        )}
        {normalized === item.href && <span className="nav-active-dot" />}
      </Link>
    );
  }

  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {menuOpen && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <Link href="/" className="brand-link" aria-label="Signal home">
          <Brand />
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
        <div className="workspace-switch">
          <span className="workspace-avatar">S</span>
          <div>
            Signal workspace<small>Personal workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">{navigation.map(navLink)}</nav>
        <div className="nav-label configuration-label">CONFIGURATION</div>
        <nav aria-label="Configuration">{configuration.map(navLink)}</nav>
        <div className="sidebar-bottom">
          <div className="engine-card">
            <div>
              <span className="engine-icon">
                <Zap size={16} fill="currentColor" />
              </span>
              <span>Signal engine</span>
              <span className="engine-bars">
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>
            <p>Rule based. Always explainable.</p>
            <span className="engine-version">
              <span className="status-dot" />
              Closed candles{" "}
              <span>{market.mode === "server" ? "MongoDB" : "Browser"}</span>
            </span>
          </div>
          <button
            className="sidebar-option"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
            <span>
              {theme === "dark" ? "Dark appearance" : "Light appearance"}
            </span>
            <span className="theme-switch">
              <span className={theme === "dark" ? "on" : ""} />
            </span>
          </button>
          <button className="sidebar-option" onClick={() => setHelp(true)}>
            <CircleHelp size={17} />
            <span>Help & resources</span>
            <ArrowUpRight size={14} />
          </button>
          <Link className="profile" href="/sign-in/">
            <span className="profile-avatar">A</span>
            <span>
              Admin workspace
              <small>
                {market.connected ? "Backend connected" : "Connection settings"}
              </small>
            </span>
            <LogIn size={16} />
          </Link>
        </div>
        <div className="sidebar-footnote">
          <ShieldCheck size={12} /> Technical signals only
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{active?.label ?? "Dashboard"}</strong>
          </div>
          <div className="topbar-actions">
            <Link href="/watchlist/" className="top-search">
              <Search size={15} />
              <span>Search assets</span>
              <kbd>
                <Command size={10} /> K
              </kbd>
            </Link>
            <span className="demo-chip">
              <Radio size={12} />{" "}
              {market.status === "live"
                ? "Binance live"
                : market.status === "rest"
                  ? "Binance snapshot"
                  : market.status === "loading"
                    ? "Connecting"
                    : "Reconnecting"}
            </span>
            <span className="topbar-divider" />
            <button
              className="icon-button notification-button"
              aria-label="View notification settings"
              onClick={() => {
                window.location.href = "/notifications/";
              }}
            >
              <Bell size={18} />
              <i />
            </button>
            <Link
              className="top-avatar"
              href="/sign-in/"
              aria-label="Open admin sign in"
            >
              A
            </Link>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="page-footer">
          <span>
            <ShieldCheck size={13} /> Signals inform. You decide.
          </span>
          <span>
            {market.mode === "server"
              ? market.connected
                ? "Server feed · MongoDB storage"
                : "Backend offline · storage unavailable"
              : "Browser feed · no server storage"}{" "}
            <span className="footer-dot">·</span> Technical signals only
          </span>
          <span>
            Crypto Signal Agent <span className="version-pill">v0.1</span>
          </span>
        </footer>
      </div>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="modal help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              onClick={() => setHelp(false)}
              aria-label="Close help"
            >
              <X size={20} />
            </button>
            <span className="help-icon">
              <CircleHelp size={24} />
            </span>
            <h2 id="help-title">Your signal workspace</h2>
            <p>
              Prices and candles come from Binance Spot. The local TypeScript
              backend stores closed candles and signals in MongoDB. The hosted
              browser feed has no server storage until an API origin is
              configured.
            </p>
            <ul>
              <li>
                <strong>Market explorer:</strong> candlesticks and technical
                indicators.
              </li>
              <li>
                <strong>Signal history:</strong> filter signals and export CSV.
              </li>
              <li>
                <strong>Strategy:</strong> save parameters to your backend.
              </li>
            </ul>
            <div className="notice">
              <ShieldCheck size={18} />
              <span>
                BUY and SELL labels describe technical conditions. They are not
                investment advice or executed trades.
              </span>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                setHelp(false);
                toast(
                  "Start with a coin in Market explorer to inspect its signal.",
                );
              }}
            >
              Got it
              <ArrowUpRight size={15} />
            </button>
            <a
              className="resource-link"
              href="https://www.tradingview.com/lightweight-charts/"
              target="_blank"
              rel="noreferrer"
            >
              Charts by TradingView <ArrowUpRight size={13} />
            </a>
          </section>
        </div>
      )}
    </div>
  );
}
