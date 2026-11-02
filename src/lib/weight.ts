import { addDays } from "./dates";
import type { WeightEntry } from "./types";

export interface TrendPoint {
  date: string;
  kg: number;
  /** Average of your weigh-ins over the 7 days ending on this date */
  avg: number;
}

/** Daily weigh-ins plus a trailing 7-day average (smooths out water/salt swings). */
export function withTrend(entries: WeightEntry[]): TrendPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((e, i) => {
    const from = addDays(e.date, -6);
    const window = sorted.slice(0, i + 1).filter((x) => x.date >= from);
    const avg = window.reduce((a, x) => a + x.kg, 0) / window.length;
    return { date: e.date, kg: e.kg, avg: Math.round(avg * 10) / 10 };
  });
}

/** Change in the 7-day average vs `days` ago (using the nearest earlier weigh-in). */
export function trendChange(points: TrendPoint[], days: number): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const target = addDays(last.date, -days);
  const before = [...points].reverse().find((p) => p.date <= target);
  if (!before) return null;
  return Math.round((last.avg - before.avg) * 10) / 10;
}
