import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export function passwordMatches(password: string, hash: string): boolean {
  const [algorithm, salt, expected] = hash.split(":");
  if (
    algorithm !== "scrypt" ||
    !/^[a-f0-9]{32,128}$/.test(salt ?? "") ||
    !/^[a-f0-9]{128}$/.test(expected ?? "")
  )
    return false;
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

export function createSession(username: string, secret: string) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      expires: Date.now() + 86400000,
      nonce: randomBytes(16).toString("hex"),
    }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function validSession(
  cookie: string | undefined,
  username: string,
  secret: string,
): boolean {
  if (!cookie || !secret) return false;
  const [payload, signature] = cookie.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return false;
  try {
    const value: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    );
    if (!value || typeof value !== "object") return false;
    const session = value as Record<string, unknown>;
    return (
      session.username === username &&
      typeof session.expires === "number" &&
      session.expires > Date.now()
    );
  } catch {
    return false;
  }
}

export function checkOrigin(
  request: FastifyRequest,
  reply: FastifyReply,
  allowed: Set<string>,
) {
  const origin = request.headers.origin;
  const sameOrigin = `${request.protocol}://${request.headers.host}`;
  if (origin && origin !== sameOrigin && !allowed.has(origin))
    return reply
      .code(403)
      .send({ error: { message: "Origin is not allowed." } });
  const site = request.headers["sec-fetch-site"];
  if (!origin && site === "cross-site")
    return reply
      .code(403)
      .send({ error: { message: "Cross-site requests are not allowed." } });
}
