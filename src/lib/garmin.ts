"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getGarminBurn, getGarminDay } from "./api";
import { db, setSetting } from "./db";
import { Profile, calculate } from "./deficit";
import { addDays, todayKey } from "./dates";
import type { GarminBurn, GarminDay } from "./types";

/**
 * MyFitnessPal-style calorie adjustment, positive only.
 *
 * With Garmin maintenance (your average daily burn): you get today's active calories above
 * your average active calories. The average day is already in your maintenance, so only the
 * extra counts.
 *
 * With the formula: projected burn = formula resting for the whole day + Garmin active so far,
 * minus maintenance (resting × activity level).
 */
export function adjustmentFor(activeKcal: number | null | undefined, profile: Profile | null, burn?: GarminBurn | null) {
  if (activeKcal == null || !profile) return null;
  const c = calculate(profile, burn);
  const active = Math.round(activeKcal);
  if (c.source === "garmin") {
    const avgActive = burn!.avgActive!;
    return { mode: "garmin" as const, active, avgActive, days: burn!.days!, maintenance: c.maintenance, adjustment: Math.max(0, active - avgActive) };
  }
  const projected = c.bmr + active;
  return { mode: "formula" as const, resting: c.bmr, active, projected, maintenance: c.maintenance, adjustment: Math.max(0, projected - c.maintenance) };
}

export type Adjustment = NonNullable<ReturnType<typeof adjustmentFor>>;

// One request at a time, shared by every component that wants the average.
let inflight: Promise<unknown> | null = null;

/**
 * Your Garmin average daily burn over the last 28 complete days. Fetched at most once a day
 * and kept in settings, so the calculator and the day view share it.
 */
export function useGarminBurn(): { burn: GarminBurn | null; loading: boolean; error?: string; refresh: () => void } {
  // null = nothing cached yet; undefined = still reading (useLiveQuery's initial value).
  const row = useLiveQuery(() => db.settings.get("garminBurn").then((r) => r ?? null), []);
  const cached = row?.value as (GarminBurn & { fetchedOn?: string }) | undefined;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const fetchBurn = useCallback(() => {
    setLoading(true);
    setError(undefined);
    inflight ??= getGarminBurn(addDays(todayKey(), -1))
      .then((b) => setSetting("garminBurn", { ...b, fetchedOn: todayKey() }))
      .finally(() => (inflight = null));
    inflight.catch((e) => setError((e as Error).message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (row === undefined) return; // still reading the cache; null (never fetched) falls through
    if (cached?.fetchedOn === todayKey()) return;
    const t = window.setTimeout(fetchBurn, 0); // after render; once a day
    return () => window.clearTimeout(t);
  }, [row, cached?.fetchedOn, fetchBurn]);

  return { burn: cached ?? null, loading, error, refresh: fetchBurn };
}

/** The calculator profile, if it's filled in. */
export function useProfile(): Profile | null {
  const row = useLiveQuery(() => db.settings.get("deficitProfile"), []);
  const p = row?.value as Partial<Profile> | undefined;
  if (!p || !(Number(p.age) > 0 && Number(p.heightCm) > 0 && Number(p.weightKg) > 0)) return null;
  return p as Profile;
}

type State = { loading: boolean; data?: GarminDay; error?: string };

/** Garmin data for a day. Refreshes when the app comes back to the foreground. */
export function useGarminDay(date: string | null) {
  const [state, setState] = useState<Record<string, State>>({});

  const fetchDay = useCallback((d: string) => {
    getGarminDay(d)
      .then((data) => setState((s) => ({ ...s, [d]: { loading: false, data } })))
      .catch((e) => setState((s) => ({ ...s, [d]: { ...s[d], loading: false, error: (e as Error).message } })));
  }, []);

  // Manual/foreground refresh: show the spinner, then fetch.
  const reload = useCallback(
    (d: string) => {
      if (d > todayKey()) return;
      setState((s) => ({ ...s, [d]: { ...s[d], loading: true, error: undefined } }));
      fetchDay(d);
    },
    [fetchDay],
  );

  useEffect(() => {
    // Past days are fetched once; today is refetched whenever you come back to it.
    if (!date || date > todayKey()) return;
    if (!state[date] || date === todayKey()) fetchDay(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, fetchDay]);

  useEffect(() => {
    const onVisible = () => date && document.visibilityState === "visible" && date === todayKey() && reload(date);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [date, reload]);

  // `date` is null until the client knows it (no clock reads during server render).
  if (!date) return { loading: false, reload: () => {} };
  const current = state[date] ?? { loading: date <= todayKey() };
  return { ...current, reload: () => reload(date) };
}
