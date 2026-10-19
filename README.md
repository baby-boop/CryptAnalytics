# Crypto Signal Agent

Next.js + TypeScript UI, Fastify backend, Binance Spot REST/WebSocket, MongoDB native driver. BUY/SELL/WAIT дохиог бодит **хаагдсан лаа** дээр EMA, MACD, RSI болон хадгалсан strategy параметрээр тооцоолно. Арилжааны order болон хөрөнгө удирдах код байхгүй.

## Ажиллуулах

Node.js **24 LTS** болон MongoDB ашиглана. Төслийн root `.env` дотор нууц тохиргоогоо хадгална. Байгаа `.env`-ээ дарж хуулж болохгүй; `.env.example` нь зөвхөн загвар.

```dotenv
PORT=3001
MONGODB_URI=mongodb://USERNAME:PASSWORD@HOST:27017/
MONGODB_DB=crypto_signal_agent
```

`MONGODB_URI` утга нь `mongodb://` эсвэл `mongodb+srv://` гэж эхэлнэ. URI, Telegram token, admin password/hash, session secret-ийг чат болон frontend-д оруулахгүй. `.env` нь Git болон Docker build context-оос хасагдсан.

```bash
npm install
npm run dev
```

Энэ команд backend болон Next.js dev server-ийг хамт ажиллуулна. UI нь `http://127.0.0.1:3000`; backend нь `.env` дэх `PORT` (тусдаа `API_PORT` байвал тэрийг) ашиглана. Backend 3000 port ашиглавал UI автоматаар 3002 болно. Development API хүсэлтүүд backend рүү proxy хийгдэнэ.

Production-д:

```bash
npm run build
npm start
```

Fastify нь `out/` дахь build болон `/api/*` endpoint-үүдийг **нэг origin** дээр үйлчилнэ. `http://127.0.0.1:<PORT>` хаягаар нээнэ. Database холболт болон index үүсгэлт startup дээр шалгагдана.

## Бодит өгөгдлийн урсгал

1. Binance-ийн `data-api.binance.vision` public REST API-аас ticker болон symbol/timeframe бүрийн 1,000 OHLCV лаа татна. Public market data-д API key шаардахгүй.
2. Combined WebSocket stream-ээс ticker болон candle update авна. Нэг timeframe бүрд нэг холболт, ticker subscription зөвхөн нэг холболтод байна.
3. `x=true` хаагдсан лааг баталгаажуулж, `technicalindicators`-оор EMA/MACD/RSI тооцоолно. MACD crossover нь өмнөх ба одоогийн хоёр хаагдсан лааг харьцуулна. Алдагдсан хэсэг байвал indicator warm-up дахин эхэлнэ.
4. MongoDB-д зөвхөн хаагдсан лаа, BUY/SELL дохио, strategy/preferences, notification log хадгална. WAIT нь UI-д харагдана.
5. Frontend REST snapshot + SSE update ашиглана. Chart нь нээлттэй лааг харуулж шинэчилдэг; баталгаажсан дохио хаагдсан лаанд хамаарна.

WebSocket тасарвал exponential backoff-оор дахин холбогдож REST synchronization хийнэ. Мөн 60 секунд тутам reconciliation хийж тасалдсан лааг нөхнө. Rate-limit болон Retry-After хариуг мөрдөнө. Өгөгдөл ирээгүй, дутуу, эсвэл хуучирсан үед UI loading/error/stale төлөв харуулна; demo үнэ рүү шилжихгүй.

Анхны synchronization нь exchange backfill гэж тэмдэглэгдэнэ, хуучин дохиог Telegram-аар илгээхгүй. Нэг symbol + timeframe + strategy version + candle close timestamp дээр давхар дохио үүсэхгүй. Strategy өөрчлөгдвөл шинэ version үүсч, өмнөх indicator snapshot болон шалтгаан хадгалагдана. Хуучин version-ийн pending үр дүнг мөн дараагийн хаагдсан лаануудаар нөхөж тооцоолно.

## Дэлгэцүүд

| Хаяг | Боломж |
| --- | --- |
| `/` | Бодит ticker, timeframe-ийн signal, watchlist, market momentum |
| `/markets/?symbol=BTC` | Streaming candle, volume, EMA/MACD/RSI, closed signal checklist |
| `/signals/` | MongoDB archive, filters, CSV, strategy snapshot, source |
| `/analytics/` | Бодит 1/3/6-candle үнийн өөрчлөлт, directional accuracy |
| `/settings/` | MongoDB-д strategy хадгалж, live analysis-д хэрэглэх |
| `/watchlist/` | Watchlist болон alert preferences-ийг серверт хадгалах |
| `/notifications/` | Backend configuration status, test delivery, бодит delivery log |
| `/sign-in/` | Backend session authentication; localhost mode-д workspace нээх |

Analytics нь BUY-ийн дараах өсөлт, SELL-ийн дараах бууралтыг favorable гэж үзнэ. Бүрдээгүй future candles-ийн үр дүн Pending; signal үүсгэхдээ future candles ашиглахгүй. Үр дүн нь арилжааны ашиг биш. UI хамгийн сүүлийн 5,000 archive мөрөөр ажиллана.

Higher timeframe confirmation одоогоор идэвхгүй. Volume confirmation нь өмнөх 20 хаагдсан лааны дундажтай харьцуулдаг. Бусад идэвхтэй indicator/RSI параметрүүд хадгалсан strategy-г ашиглана.

## Нууц тохиргоо ба нэвтрэлт

Backend default-аар зөвхөн `127.0.0.1` дээр сонсоно. Admin hash тохируулаагүй local mode-д backend өөрийн компьютероос нээлттэй. Public сервер дээр байрлуулахын өмнө:

```dotenv
HOST=0.0.0.0
PUBLIC_ORIGIN=https://signal.example.com
FRONTEND_ORIGIN=https://signal.example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=YOUR_SCRYPT_HASH
SESSION_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
```

`npm run hash-password` нь stdin-ээс password авч scrypt hash гаргана. Password-оо command argument-д бүү оруул. Session cookie нь HttpOnly, HTTPS дээр Secure; login rate limit болон mutation Origin/CSRF шалгалттай. Public bind нь admin authentication шаарддаг. Зөвхөн хэрэгтэй database-д readWrite эрхтэй MongoDB хэрэглэгч ашиглана; admin/root database account шаардлагагүй.

Telegram ашиглах бол `.env` дотор `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` тохируулж backend-ийг дахин асаана. UI token-ийг хүлээж авахгүй, хадгалахгүй. Delivery settings default-аар унтраалттай. Анхны backfill мэдэгдэлгүй; шинээр үүссэн live дохиог сонгосон asset болон BUY/SELL preference-ээр шүүнэ. Delivery log нь давхардлыг хориглож, батлагдаагүй timeout үр дүнг сохроор дахин илгээхгүй.

## Hosted preview

Telegram chart link нь `includeChart` тохиргоо болон backend-ийн `PUBLIC_ORIGIN` хаягтай үед мессежид нэмэгдэнэ.

Sites дээрх static preview нь public backend URL тохируулаагүй үед Binance public API-тай browser-оос шууд холбогдоно. Үнэ, лаа, дохио бодит; **MongoDB болон серверийн хадгалалт холбогдоогүй** гэж footer/status дээр харуулна. Browser хаалттай үед энэ feed ажиллахгүй. Strategy серверт хадгалах, Telegram болон нэвтрэлт нь таны backend-ийг шаарддаг.

Байрлуулсан backend-ийг тусдаа frontend-д холбох бол build хийхдээ `NEXT_PUBLIC_API_URL=https://api.example.com` тохируулна. Энэ нь зөвхөн API origin; нууц утга байх ёсгүй. Backend-ийн `FRONTEND_ORIGIN`-д frontend-ийн яг origin-ийг тохируулна. Same-origin reverse proxy ашиглах нь хамгийн энгийн.

## Docker

```bash
docker compose up -d --build
```

Compose нь гаднах `.env`-ийн MongoDB URI-г runtime-д уншина; шинэ database service үүсгэхгүй. Container bind-д admin hash/session secret шаардлагатай. UI/API нь host-ийн loopback `PORT` дээр байрлана. `.env`-ийн өөрчлөлт backend restart шаарддаг.

## Шалгалт ба бүтэц

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Node unit тест нь Binance/Telegram/MongoDB шаардлагагүй. Playwright нь backend REST/SSE-г deterministic fixture-ээр орлуулж, realtime UI update, closed-candle signal, offline states, filters/CSV, settings, notifications, authentication шалгана. Test fixture нь production өгөгдөлд орохгүй.

```text
app/                    Next.js 8 route болон styles
components/             shared UI, market context, incremental charts
lib/binance.ts          validated REST + WebSocket transport
lib/market-analysis.ts  pure closed-candle indicators, rules, evaluation
lib/strategy.ts         shared validated strategy parameters/version
backend/                Fastify, MongoDB, collector, auth, Telegram
scripts/                development runner, static preview, password hashing
tests/                  unit болон Playwright tests
```

Charts: [TradingView Lightweight Charts](https://www.tradingview.com/lightweight-charts/) (Apache 2.0). Market sources: [Binance public market data](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md).
