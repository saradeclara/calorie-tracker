"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getGoals } from "@/lib/db";
import { addDays, formatDay, mealForNow, todayKey } from "@/lib/dates";
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
import { adjustmentFor, useGarminDay, useProfile } from "@/lib/garmin";
import { GarminCard } from "./GarminCard";

export function App() {
  const [date, setDate] = useState<string | null>(null);
  const [view, setView] = useState<"today" | "reflux" | "settings">("today");
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

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200);
  }, []);

  if (!date) return <div className="min-h-dvh bg-bg" />;

  const totals = sum(entries ?? []);
  const adj = garmin.data?.configured ? adjustmentFor(garmin.data.activeKcal, profile) : null;
  const waterMl = (water ?? []).reduce((acc, w) => acc + w.ml, 0);

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      {view === "settings" ? (
        <Settings onBack={() => setView("today")} notify={notify} />
      ) : view === "reflux" ? (
        <RefluxView foods={foods} />
      ) : (
        <>
          <header className="pt-safe sticky top-0 z-20 bg-bg/90 px-4 pb-2 backdrop-blur">
            <div className="flex items-center justify-between">
              <button
                className="grid h-10 w-10 place-items-center rounded-full text-muted active:bg-soft"
                onClick={() => setDate(addDays(date, -1))}
                aria-label="Previous day"
              >
                <Icon name="left" />
              </button>
              <button
                className="text-center"
                onClick={() => setDate(todayKey())}
                aria-label="Go to today"
              >
                <div className="text-lg font-semibold">{formatDay(date)}</div>
                {date !== todayKey() && <div className="text-xs text-muted">Tap for today</div>}
              </button>
              <div className="flex items-center">
                <button
                  className="grid h-10 w-10 place-items-center rounded-full text-muted active:bg-soft disabled:opacity-30"
                  onClick={() => setDate(addDays(date, 1))}
                  disabled={date >= todayKey()}
                  aria-label="Next day"
                >
                  <Icon name="right" />
                </button>
              </div>
            </div>
          </header>

          <main className="space-y-3 px-4 pb-44">
            <InstallHint />
            <Summary totals={totals} goals={goals} bonus={adj?.adjustment ?? 0} />
            <WaterCard date={date} totalMl={waterMl} goalMl={goals.waterMl} logs={water ?? []} />
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

            <button
              onClick={() => setView("settings")}
              className="mx-auto flex items-center gap-2 py-4 text-sm text-muted"
            >
              <Icon name="settings" className="h-4 w-4" /> Goals & settings
            </button>
          </main>

          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex justify-center">
            <button
              onClick={() => setAdding(date === todayKey() ? mealForNow() : "snack")}
              className="pointer-events-auto mb-3 flex h-14 items-center gap-2 rounded-full bg-ink px-7 font-semibold text-bg shadow-xl shadow-black/20 active:scale-95"
            >
              <Icon name="plus" /> Add food
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
