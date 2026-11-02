"use client";

/** Last unexpected error, kept in localStorage so it survives iOS reloading the app. */
const KEY = "ct:lastError";

export interface RecordedError {
  message: string;
  where: string;
  at: string;
  ua: string;
}

export function recordError(err: unknown, where: string) {
  try {
    const e = err as { message?: string; stack?: string; name?: string };
    const entry: RecordedError = {
      message: `${e?.name && e.name !== "Error" ? `${e.name}: ` : ""}${e?.message ?? String(err)}`.slice(0, 500),
      where: `${where}${e?.stack ? `\n${e.stack.split("\n").slice(0, 4).join("\n")}` : ""}`.slice(0, 800),
      at: new Date().toISOString(),
      ua: navigator.userAgent.slice(0, 200),
    };
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {}
}

export function lastError(): RecordedError | null {
  try {
    const v = localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as RecordedError) : null;
  } catch {
    return null;
  }
}

export function clearLastError() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
