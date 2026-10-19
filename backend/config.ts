import { loadEnvFile } from "node:process";

try {
  loadEnvFile();
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
    throw new Error("Could not load the backend environment file.");
}

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be an integer between 1 and 65535.");
if (!process.env.MONGODB_URI)
  throw new Error("Set MONGODB_URI in the backend .env file.");
if (!/^mongodb(?:\+srv)?:\/\//.test(process.env.MONGODB_URI))
  throw new Error(
    "MONGODB_URI must start with mongodb:// or mongodb+srv://. Update the backend .env file; do not share the secret URL.",
  );

export const config = {
  port,
  host: process.env.HOST ?? "127.0.0.1",
  mongoUri: process.env.MONGODB_URI,
  database: process.env.MONGODB_DB ?? "crypto_signal_agent",
  publicOrigin: process.env.PUBLIC_ORIGIN ?? "",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:3000",
  username: process.env.ADMIN_USERNAME ?? "admin",
  passwordHash: process.env.ADMIN_PASSWORD_HASH ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  telegramToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChat: process.env.TELEGRAM_CHAT_ID ?? "",
};

if (config.passwordHash && config.sessionSecret.length < 32)
  throw new Error(
    "SESSION_SECRET must contain at least 32 characters when admin authentication is enabled.",
  );
if (
  !["127.0.0.1", "localhost", "::1"].includes(config.host) &&
  !config.passwordHash
)
  throw new Error(
    "Set ADMIN_PASSWORD_HASH and SESSION_SECRET before exposing the backend beyond localhost.",
  );
