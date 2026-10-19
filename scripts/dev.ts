import { spawn } from "node:child_process";
import { loadEnvFile } from "node:process";
import path from "node:path";

try {
  loadEnvFile();
} catch {
  /* The backend will report missing configuration. */
}
const apiPort = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
const frontendPort = Number(
  process.env.FRONTEND_PORT ?? (apiPort === 3000 ? 3002 : 3000),
);
const backend = spawn(
  process.execPath,
  [path.resolve("node_modules/tsx/dist/cli.mjs"), "watch", "backend/server.ts"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(apiPort),
      FRONTEND_ORIGIN:
        process.env.FRONTEND_ORIGIN ?? `http://127.0.0.1:${frontendPort}`,
    },
    windowsHide: true,
  },
);
const frontend = spawn(
  process.execPath,
  [
    path.resolve("node_modules/next/dist/bin/next"),
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(frontendPort),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(frontendPort),
      API_ORIGIN: `http://127.0.0.1:${apiPort}`,
    },
    windowsHide: true,
  },
);
let closing = false;
function stop() {
  if (closing) return;
  closing = true;
  backend.kill();
  frontend.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
backend.on("exit", (code) => {
  if (!closing) {
    console.error(`Backend exited (${code ?? 1}).`);
    stop();
    process.exitCode = 1;
  }
});
frontend.on("exit", (code) => {
  if (!closing) {
    stop();
    process.exitCode = code ?? 1;
  }
});
