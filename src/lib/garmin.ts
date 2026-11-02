"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getGarminDay } from "./api";
import { db } from "./db";
import { Profile, calculate } from "./deficit";
import { todayKey } from "./dates";
import type { GarminDay } from "./types";

/**
 * MyFitnessPal-style calorie adjustment, positive only:
 *   projected burn = your resting burn for the whole day + Garmin's active calories so far
 *   adjustment     = projected burn − your maintenance (from the deficit calculator), if > 0
 * Maintenance already assumes your chosen activity level, so workouts aren't counted twice.
 * Resting uses the calculator's formula rather than Garmin's, so today isn't skewed by
 * Garmin only counting resting calories up to now.
 */
export function adjustmentFor(activeKcal: number | null | undefined, profile: Profile | null) {
  if (activeKcal == null || !profile) return null;
  const { bmr, maintenance } = calculate(profile);
  const projected = bmr + Math.round(activeKcal);
  return { resting: bmr, active: Math.round(activeKcal), projected, maintenance, adjustment: Math.max(0, projected - maintenance) };
}

export type Adjustment = NonNullable<ReturnType<typeof adjustmentFor>>;

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
