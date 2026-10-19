import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";

function outputHash(password: string) {
  if (password.length < 12) {
    console.error("Use at least 12 characters.");
    process.exitCode = 1;
    return;
  }
  const salt = randomBytes(16).toString("hex");
  console.log(
    `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
  );
}

if (process.stdin.isTTY) {
  process.stdout.write("Password (input hidden): ");
  process.stdin.setRawMode(true);
  process.stdin.setEncoding("utf8");
  process.stdin.resume();
  let password = "";
  const read = (input: string) => {
    if (input === "\u0003") {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      process.exitCode = 1;
      return;
    }
    if (input.includes("\r") || input.includes("\n")) {
      password += input.split(/[\r\n]/)[0];
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", read);
      process.stdout.write("\n");
      outputHash(password);
      password = "";
    } else if (input === "\u007f" || input === "\b")
      password = password.slice(0, -1);
    else if (!input.startsWith("\u001b")) password += input;
  };
  process.stdin.on("data", read);
} else {
  const input = createInterface({ input: process.stdin, terminal: false });
  input.once("line", (password) => {
    outputHash(password);
    input.close();
  });
}
