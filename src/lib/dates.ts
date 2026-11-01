import type { Meal } from "./types";

export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

export function todayKey(): string {
  return toKey(new Date());
}

export function formatDay(key: string): string {
  const today = todayKey();
  if (key === today) return "Today";
  if (key === addDays(today, -1)) return "Yesterday";
  if (key === addDays(today, 1)) return "Tomorrow";
  return fromKey(key).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Best-guess meal slot from the time of day. */
export function mealForNow(now = new Date()): Meal {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h >= 4 && h < 10.5) return "breakfast";
  if (h >= 11.5 && h < 14.5) return "lunch";
  if (h >= 17.5 && h < 21.5) return "dinner";
  return "snack";
}

/** "YYYY-MM-DDTHH:mm" for a datetime-local input: now if the day is today, else that day at the current time. */
export function defaultReactionTime(dateKey: string): string {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return `${dateKey === toKey(now) ? toKey(now) : dateKey}T${hhmm}`;
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  return `${formatDay(toKey(d))}, ${formatTime(ms)}`;
}
