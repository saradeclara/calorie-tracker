"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getGoals } from "@/lib/db";
import { addDays, formatDay, fromKey, mealForNow, todayKey } from "@/lib/dates";
import { sum } from "@/lib/nutrition";
import { DEFAULT_GOALS, FoodEntry, Meal, MEALS } from "@/lib/types";
import { Icon } from "./ui";
import { Summary } from "./Summary";
import { WaterCard } from "./WaterCard";
import { MealSection } from "./MealSection";
import { AddFoodSheet } from "./AddFoodSheet";
import { EditEntrySheet } from "./EditEntrySheet";
import { Settings } from "./Settings";
import { InstallHint } from "./InstallHint";
import { RefluxView } from "./RefluxView";
import { TabBar } from "./TabBar";
import { useFoodIndex } from "@/lib/useFoods";
import { adjustmentFor, useGarminBurn, useGarminDay, useProfile } from "@/lib/garmin";
import { GarminCard } from "./GarminCard";
import { WeightView } from "./WeightView";
import { CoachView } from "./CoachView";
import { PlanView } from "./PlanView";
import { WeightInput } from "./WeightInput";

const longDay = (key: string) =>
  fromKey(key).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

export function App() {
  const [date, setDate] = useState<string | null>(null);
  const [view, setView] = useState<"today" | "weight" | "plan" | "coach" | "reflux" | "settings">("today");
  const [adding, setAdding] = useState<Meal | null>(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Date is client-only (the server doesn't know your timezone).
  useEffect(() => {
    let lastToday = todayKey();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only value, avoids hydration mismatch
    setDate(lastToday);
    // Roll over to the new day if the app was left open past midnight
    // (only when you were looking at "today").
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const now = todayKey();
      if (now !== lastToday) {
        const prev = lastToday;
        setDate((d) => (d === prev ? now : d));
        lastToday = now;
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const entries = useLiveQuery(
    () => (date ? db.entries.where("date").equals(date).sortBy("createdAt") : []),
    [date],
  );
  const water = useLiveQuery(
    () => (date ? db.water.where("date").equals(date).toArray() : []),
    [date],
  );
  const goals = useLiveQuery(() => getGoals(), []) ?? DEFAULT_GOALS;
  const foods = useFoodIndex();
  const profile = useProfile();
  const garmin = useGarminDay(date);
  const { burn } = useGarminBurn();

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200);
  }, []);

  if (!date) return <div className="min-h-dvh bg-bg" />;

  const totals = sum(entries ?? []);
  const adj = garmin.data?.configured ? adjustmentFor(garmin.data.activeKcal, profile, burn) : null;
  const waterMl = (water ?? []).reduce((acc, w) => acc + w.ml, 0);

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      {view === "settings" ? (
        <Settings onBack={() => setView("today")} notify={notify} />
      ) : view === "reflux" ? (
        <RefluxView foods={foods} />
      ) : view === "weight" ? (
        <WeightView notify={notify} />
      ) : view === "plan" ? (
        <PlanView notify={notify} />
      ) : view === "coach" ? (
        <CoachView notify={notify} />
      ) : (
        <>
          <header className="pt-safe sticky top-0 z-20 bg-bg/90 px-5 pb-3 backdrop-blur-xl">
            <div className="flex items-end justify-between gap-3">
              <button className="min-w-0 text-left" onClick={() => setDate(todayKey())} aria-label="Go to today">
                <div className="font-display truncate text-[2rem] leading-tight font-bold">{formatDay(date)}</div>
                <div className="text-sm text-muted">
                  {longDay(date)}
                  {date !== todayKey() && <span className="font-medium text-brand"> · back to today</span>}
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-1 pb-1">
                <button
                  className="grid h-10 w-10 place-items-center rounded-full bg-card text-ink active:scale-95"
                  onClick={() => setDate(addDays(date, -1))}
                  aria-label="Previous day"
                >
                  <Icon name="left" weight="bold" className="h-4 w-4" />
                </button>
                <button
                  className="grid h-10 w-10 place-items-center rounded-full bg-card text-ink active:scale-95 disabled:opacity-30"
                  onClick={() => setDate(addDays(date, 1))}
                  disabled={date >= addDays(todayKey(), 7)}
                  aria-label="Next day"
                >
                  <Icon name="right" weight="bold" className="h-4 w-4" />
                </button>
                <button
                  className="ml-1 grid h-10 w-10 place-items-center rounded-full bg-card text-ink active:scale-95"
                  onClick={() => setView("settings")}
                  aria-label="Goals & settings"
                >
                  <Icon name="settings" className="h-5 w-5" />
                </button>
              </div>
            </div>
          </header>

          <main className="space-y-3 px-4 pb-40">
            <InstallHint />
            <Summary totals={totals} goals={goals} bonus={adj?.adjustment ?? 0} />
            <WaterCard date={date} totalMl={waterMl} goalMl={goals.waterMl} logs={water ?? []} />
            <section className="rounded-[1.375rem] bg-card p-5">
              <WeightInput date={date} notify={notify} />
            </section>
            <GarminCard
              loading={garmin.loading}
              data={garmin.data}
              error={garmin.error}
              adj={adj}
              hasProfile={!!profile}
              onReload={garmin.reload}
            />
            {MEALS.map((m) => (
              <MealSection
                key={m.id}
                meal={m.id}
                label={m.label}
                entries={(entries ?? []).filter((e) => e.meal === m.id)}
                onAdd={() => setAdding(m.id)}
                onEdit={setEditing}
                foods={foods}
              />
            ))}
          </main>

          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-lg justify-end px-4">
            <button
              onClick={() => setAdding(date === todayKey() ? mealForNow() : "snack")}
              className="pointer-events-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-brand text-on-brand shadow-lg shadow-black/25 active:scale-95"
              aria-label="Add food"
            >
              <Icon name="plus" weight="bold" className="h-7 w-7" />
            </button>
          </div>
        </>
      )}

      {view !== "settings" && <TabBar value={view} onChange={setView} />}

      {adding && (
        <AddFoodSheet
          date={date}
          initialMeal={adding}
          onClose={() => setAdding(null)}
          notify={notify}
        />
      )}
      {editing && <EditEntrySheet entry={editing} onClose={() => setEditing(null)} notify={notify} />}

      {toast && (
        <div className="animate-fade fixed inset-x-0 top-0 z-50 flex justify-center pt-safe" role="status">
          <div className="mt-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  );
}
