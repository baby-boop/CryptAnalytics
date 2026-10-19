"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Brand } from "@/components/app-shell";
import "../settings-views.css";

export default function SignInPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (username.trim().length < 3) {
      setError("Enter a username with at least 3 characters.");
      return;
    }
    if (password.length < 8) {
      setError("Enter a password with at least 8 characters.");
      return;
    }
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setError(
        "Authentication is not connected in this UI demo. Choose “Explore the demo” to open the workspace.",
      );
    }, 600);
  }

  return (
    <main className="signin-page">
      <section
        className="signin-hero"
        aria-label="Crypto Signal Agent introduction"
      >
        <Link className="signin-brand" href="/" aria-label="Signal home">
          <Brand />
        </Link>
        <div className="signin-aurora signin-aurora-one" />
        <div className="signin-aurora signin-aurora-two" />
        <div className="signin-star-field" />
        <svg
          className="signin-mountains"
          viewBox="0 0 1000 700"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="mountain-back" x1="0" y1="0" x2="0.8" y2="1">
              <stop stopColor="#344a73" />
              <stop offset="1" stopColor="#0a1428" />
            </linearGradient>
            <linearGradient id="mountain-front" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#18354b" />
              <stop offset="1" stopColor="#060d17" />
            </linearGradient>
            <linearGradient id="mountain-snow" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#8cacc2" stopOpacity=".7" />
              <stop offset="1" stopColor="#517287" stopOpacity=".1" />
            </linearGradient>
          </defs>
          <path
            d="M0 700V390L75 329 120 367 241 195 332 314 381 268 478 397 595 249 640 300 729 173 823 340 879 301 1000 409V700Z"
            fill="url(#mountain-back)"
          />
          <path
            d="m120 367 121-172 91 119-49-20-19-41-24 6-33 55-24-3-21 37Z"
            fill="url(#mountain-snow)"
          />
          <path
            d="m595 249 45 51 89-127 94 167-47-35-31-70-20-10-38 69-27 19Z"
            fill="url(#mountain-snow)"
          />
          <path
            d="M0 700V475l115-85 78 71 143-86 147 145 120-88 108 91 134-118 155 122v173Z"
            fill="url(#mountain-front)"
          />
          <path
            d="m0 475 115-85 78 71-73-28-18 13-46 6Z"
            fill="#56869c"
            opacity=".18"
          />
          <path
            d="m336 375 147 145-110-63-37-28-31 1-58 23Z"
            fill="#77a0b7"
            opacity=".12"
          />
          <path
            d="M0 700V610l168-77 149 67 174-42 109 59 178-81 222 69v95Z"
            fill="#070e1a"
          />
          <path
            d="m491 558 109 59 178-81-102 94-150-35-46 21-116-9Z"
            fill="#2e455e"
            opacity=".28"
          />
        </svg>
        <div className="signin-hero-content">
          <div className="signin-hero-eyebrow">
            <span /> YOUR EDGE IN EVERY MARKET
          </div>
          <h2>
            See the signal.
            <br />
            Find your <span>clarity.</span>
          </h2>
          <p>
            Real-time insights. Thoughtful analysis.
            <br />A clearer way to navigate the crypto market.
          </p>
          <div className="signin-feature-chips">
            <span>
              <Activity size={14} /> Technical intelligence
            </span>
            <span>
              <ShieldCheck size={14} /> Strategy first
            </span>
          </div>
        </div>
        <div className="signin-floating-signal">
          <span className="signin-signal-mark">₿</span>
          <div>
            <strong>
              BTC / USDT <span>4H</span>
            </strong>
            <p>EMA bullish · MACD confirmed</p>
          </div>
          <span className="signin-signal-tag">
            <Check size={11} /> BUY
          </span>
        </div>
        <div className="signin-hero-footer">
          <span>Built for a clearer perspective.</span>
          <span>
            <span className="settings-dot green" /> Focused by design
          </span>
        </div>
      </section>
      <section className="signin-form-section">
        <div className="signin-form-top">
          <span>New here?</span>
          <Link href="/">
            Explore the demo <ArrowRight size={13} />
          </Link>
        </div>
        <div className="signin-form-wrap">
          <div className="signin-welcome-icon">
            <KeyRound size={23} />
          </div>
          <div className="eyebrow">YOUR MARKET WORKSPACE</div>
          <h1>Welcome back.</h1>
          <p className="signin-intro">
            Sign in to turn market noise into your next move.
          </p>
          <form onSubmit={submit} noValidate>
            <label className="signin-field">
              <span>Username</span>
              <div>
                <UserRound size={16} />
                <input
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setError("");
                  }}
                  name="username"
                  autoComplete="username"
                  placeholder="Enter your username"
                  minLength={3}
                  required
                />
              </div>
            </label>
            <label className="signin-field">
              <span>Password</span>
              <div>
                <LockKeyhole size={16} />
                <input
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setVisible((value) => !value)}
                  aria-label={visible ? "Hide password" : "Show password"}
                >
                  {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <div className="signin-remember-row">
              <label>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />{" "}
                Remember me
              </label>
              <span className="signin-demo-label">Demo environment</span>
            </div>
            {error && (
              <div className="signin-error" role="alert">
                {error}
              </div>
            )}
            <button
              className="signin-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Checking connection…" : "Sign in"}
              <ArrowRight size={16} />
            </button>
          </form>
          <div className="signin-divider">
            <span />
            or take a look around
            <span />
          </div>
          <Link href="/" className="signin-demo-button">
            <Sparkles size={16} /> Explore the demo <ArrowRight size={15} />
          </Link>
          <div className="signin-security-note">
            <ShieldCheck size={16} />
            <span>
              Preview the workspace with sample data.
              <br />
              No account required for the demo.
            </span>
          </div>
        </div>
        <footer className="signin-form-footer">
          <span>© 2026 Crypto Signal Agent</span>
          <span>Designed for clarity.</span>
        </footer>
      </section>
    </main>
  );
}
