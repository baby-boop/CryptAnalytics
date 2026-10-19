import type { Metadata } from "next";
import { AppProvider } from "@/components/app-provider";
import { AppShell } from "@/components/app-shell";
import { MarketProvider } from "@/components/market-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crypto Signal Agent — Market intelligence",
  description:
    "Live Binance cryptocurrency prices, closed-candle technical signals, and historical market analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <AppProvider>
          <MarketProvider><AppShell>{children}</AppShell></MarketProvider>
        </AppProvider>
      </body>
    </html>
  );
}
