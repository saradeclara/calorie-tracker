"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ensureFoodId, setTrigger } from "@/lib/db";
import { FoodEntry } from "@/lib/types";
import { Icon, cx } from "./ui";
import { SEVERITY_COLOR, SeverityPicker } from "./Reflux";

/** Optional reflux flag + severity for the food behind a logged item. */
export function RefluxSection({ entry, notify }: { entry: FoodEntry; notify: (m: string) => void }) {
  const [foodId, setFoodId] = useState<number | undefined>(entry.foodId);

  useEffect(() => {
    let live = true;
    ensureFoodId(entry).then((id) => live && setFoodId(id)).catch(console.error);
    return () => {
      live = false;
    };
  }, [entry]);

  const food = useLiveQuery(() => (foodId !== undefined ? db.foods.get(foodId) : undefined), [foodId]);
  const run = (p: Promise<unknown>) => p.catch((e) => notify(`Couldn't save: ${(e as Error)?.message ?? e}`));

  if (!food || foodId === undefined) return null;

  return (
    <section className="space-y-3 rounded-2xl bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 font-semibold">
            <Icon name="flame" className="h-4 w-4" style={{ color: food.trigger ? SEVERITY_COLOR[food.triggerSeverity ?? 1] : undefined }} />
            Reflux trigger
          </h3>
          <p className="text-xs text-muted">Applies every time you log {food.name}</p>
        </div>
        <Switch
          checked={food.trigger}
          label="Reflux trigger"
          onChange={(on) => run(setTrigger(foodId, { trigger: on, severity: food.triggerSeverity ?? 1 }))}
        />
      </div>
      {food.trigger && (
        <SeverityPicker
          value={food.triggerSeverity ?? 1}
          onChange={(s) => run(setTrigger(foodId, { trigger: true, severity: s }))}
        />
      )}
    </section>
  );
}
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative h-8 w-14 shrink-0 rounded-full transition", checked ? "bg-ink" : "bg-soft")}
    >
      <span
        className={cx(
          "absolute top-1 left-1 h-6 w-6 rounded-full bg-card shadow transition-transform",
          checked && "translate-x-6",
        )}
      />
    </button>
  );
}
