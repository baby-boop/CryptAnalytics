"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { coins, type Timeframe } from "@/lib/data";

interface AppContextValue {
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  timeframe: Timeframe;
  setTimeframe: (timeframe: Timeframe) => void;
  watchlist: string[];
  setWatchlist: (symbols: string[]) => void;
  alerts: string[];
  setAlerts: (symbols: string[]) => void;
  sound: boolean;
  setSound: (sound: boolean) => void;
  toast: (message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [timeframe, setTimeframe] = useState<Timeframe>("4h");
  const [watchlist, setWatchlist] = useState([
    "BTC",
    "ETH",
    "SOL",
    "BNB",
    "XRP",
    "DOGE",
  ]);
  const [alerts, setAlerts] = useState(["BTC", "SOL", "BNB"]);
  const [sound, setSound] = useState(false);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("signal-agent-preferences") ?? "null",
      ) as Partial<AppContextValue> | null;
      if (saved) {
        if (saved.theme === "dark" || saved.theme === "light")
          setTheme(saved.theme);
        if (["15m", "1h", "4h", "1d"].includes(saved.timeframe ?? ""))
          setTimeframe(saved.timeframe!);
        const validSymbols = new Set(coins.map((coin) => coin.symbol));
        if (Array.isArray(saved.watchlist))
          setWatchlist([
            ...new Set(
              saved.watchlist.filter(
                (s) => typeof s === "string" && validSymbols.has(s),
              ),
            ),
          ]);
        if (Array.isArray(saved.alerts))
          setAlerts([
            ...new Set(
              saved.alerts.filter(
                (s) => typeof s === "string" && validSymbols.has(s),
              ),
            ),
          ]);
        if (typeof saved.sound === "boolean") setSound(saved.sound);
      }
    } catch {
      /* An unavailable browser store falls back to session preferences. */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (ready) {
      try {
        localStorage.setItem(
          "signal-agent-preferences",
          JSON.stringify({ theme, timeframe, watchlist, alerts, sound }),
        );
      } catch {
        /* Preferences remain usable in memory. */
      }
    }
  }, [theme, timeframe, watchlist, alerts, sound, ready]);

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(id);
  }, [message]);

  const toast = useCallback((text: string) => setMessage(text), []);
  return (
    <AppContext.Provider
      value={{
        theme,
        setTheme,
        timeframe,
        setTimeframe,
        watchlist,
        setWatchlist,
        alerts,
        setAlerts,
        sound,
        setSound,
        toast,
      }}
    >
      {children}
      {message && (
        <div className="toast" role="status">
          <span className="status-dot" />
          {message}
          <button
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
          >
            ×
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp requires AppProvider");
  return context;
}
