# Crypto Signal Agent

Нэг дизайн системтэй, TypeScript дээр бичсэн 8 дэлгэцийн ажилладаг UI. Хавсаргасан dark dashboard загварт тулгуурлав.

## Ажиллуулах

Node.js 20.9+ шаардлагатай (Node.js 24 дээр шалгасан).

```bash
npm install
npm run dev
```

`http://127.0.0.1:3000` хаягаар нээнэ.

```bash
npm run typecheck
npm run build
node scripts/preview.mjs
```

Build нь `out/` хавтас руу static export үүсгэнэ. `next start` нь static export-д тохирохгүй тул production preview-д дээрх Node server эсвэл static hosting ашиглана.

## Дэлгэцүүд

| Хаяг | Дэлгэц |
| --- | --- |
| `/` | Dashboard — market watch, signals, momentum |
| `/markets/?symbol=BTC` | Coin detail — candlestick, EMA, MACD, RSI |
| `/signals/` | Signal history — filters, pagination, CSV |
| `/analytics/` | Historical evaluation — period, candle horizon, outcomes |
| `/settings/` | Strategy parameters, conditions, appearance |
| `/watchlist/` | Asset management, notification preferences |
| `/notifications/` | Telegram settings, example message, connection state |
| `/sign-in/` | Admin sign-in UI, demo entry |

## Боломжууд

- Нэгдсэн өнгө, typography, spacing болон компонентууд; dark/light theme.
- Desktop болон mobile navigation, responsive хүснэгтүүд.
- TradingView Lightweight Charts 5: pan, zoom, markers, indicator toggles.
- Search, signal/date/symbol filters, CSV export, analytics horizon болон period.
- Watchlist, alert preference, theme, timeframe, strategy form-ууд browser-ийн localStorage-д хадгалагдана.
- Loading, empty, validation болон backend холбогдоогүй төлөвүүд.

**Энэ үе шат нь UI prototype.** Үнэ болон дохио нь `lib/data.ts` дэх illustrative fixture өгөгдөл; chart нь deterministic demo OHLC ашиглана. Backend, Binance live feed, MongoDB, бодит authentication болон Telegram хүргэлт одоогоор холбогдоогүй. Sign-in болон notification test нь backend байхгүйг тодорхой харуулна. Strategy-ийн локал тохиргоо chart-ийн жишээ тооцоололд нөлөөлөхгүй. Market explorer default индикаторуудаар жишээ шинжилгээ хийнэ.

BUY/SELL нь зөвхөн техникийн нөхцөлийн жишээ. Бодит арилжаа, order үүсгэх, хөрөнгө удирдах код байхгүй. Analytics нь үнийн чиглэл, өөрчлөлтийг харуулна; бодит арилжааны ашиг гэж үзэхгүй.

## Бүтэц

```text
app/                 8 route, shared layout, styles
components/          shell, reusable UI, preferences, market chart
lib/                 typed fixtures, indicator calculations, formatting
tests/               Playwright interaction tests
scripts/preview.mjs  static production preview
```

## Технологи ба шалгалт

Next.js App Router, React, TypeScript strict mode, Tailwind CSS 4, CSS semantic tokens, Lucide icons, TradingView Lightweight Charts 5, technicalindicators, Playwright. Үндсэн style-ууд `app/globals.css` дотор; page-specific styles гурван жижиг CSS файлд байна.

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

Тестүүд local production export дээр ажиллана, Binance болон Telegram холболт шаардахгүй.

Charts use [TradingView Lightweight Charts](https://www.tradingview.com/lightweight-charts/), distributed under Apache 2.0.
