export const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(
  /\/$/,
  "",
);

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiBase}/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
    signal: init.signal ?? AbortSignal.timeout(20000),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const value = body as { error?: { message?: string } } | null;
    if (response.status === 401)
      throw new Error(
        value?.error?.message ?? "Sign in to connect to your backend.",
      );
    throw new Error(
      value?.error?.message ?? `Backend request failed (${response.status}).`,
    );
  }
  return body as T;
}
