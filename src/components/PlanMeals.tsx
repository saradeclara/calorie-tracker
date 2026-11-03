"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, saveRecipe } from "@/lib/db";
import { PLAN_KITS_KEY, setTickedKits, tickKit } from "@/lib/planner";
import { Icon, Sheet, cx } from "./ui";
import { BarcodeFlow } from "./ScanTab";
import { LabelFlow } from "./LabelFlow";

/**
 * "Meals to include": saved meals (kits, ready meals, packaged food) with fixed portions and
 * exact numbers. Tick them and the plan is built around them. Add more by barcode or label.
 */
export function PlanMeals({ notify }: { notify: (m: string) => void }) {
  const meals = useLiveQuery(() => db.foods.orderBy("lastUsed").reverse().filter((f) => f.kind === "recipe").toArray(), []);
  const ticked = useLiveQuery(() => db.settings.get(PLAN_KITS_KEY).then((r) => (r?.value as number[]) ?? []), []);
  const [adding, setAdding] = useState<"barcode" | "label" | null>(null);

  if (!meals || !ticked) return null;
  const on = new Set(ticked.filter((id) => meals.some((k) => k.id === id)));
  const kcal = meals.filter((k) => on.has(k.id!)).reduce((a, k) => a + k.kcal, 0);
  const done = (msg: string) => {
    setAdding(null);
    notify(msg);
  };

  return (
    <section className="space-y-2 rounded-[1.375rem] bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Meals to include</h2>
        {on.size > 0 && <span className="tabular text-xs text-muted">{Math.round(kcal)} kcal ticked</span>}
      </div>
      <p className="text-xs text-muted">
        Meal kits, ready meals, frozen meals… Scan them and tick the ones you want. They keep their exact pack numbers, and the
        rest of the day is planned around them.
      </p>

      {meals.length > 0 && (
        <ul className="space-y-1.5">
          {meals.map((k) => {
            const checked = on.has(k.id!);
            return (
              <li key={k.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => setTickedKits(checked ? [...on].filter((x) => x !== k.id) : [...on, k.id!])}
                  className={cx("flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left", checked ? "bg-brand text-on-brand" : "bg-soft")}
                >
                  <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-md border-2", checked ? "border-bg bg-bg text-ink" : "border-line")}>
                    {checked && <Icon name="check" className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{k.name}</span>
                    <span className={cx("tabular block truncate text-xs", checked ? "opacity-75" : "text-muted")}>
                      {[k.brand, k.portion, `${Math.round(k.kcal)} kcal`, `P ${Math.round(k.protein)}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button type="button" onClick={() => setAdding("barcode")} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-soft text-sm font-semibold">
          <Icon name="barcode" className="h-4 w-4" /> Barcode
        </button>
        <button type="button" onClick={() => setAdding("label")} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-soft text-sm font-semibold">
          <Icon name="camera" className="h-4 w-4" /> Nutrition label
        </button>
      </div>

      {adding && (
        <Sheet open onClose={() => setAdding(null)} title={adding === "barcode" ? "Scan a barcode" : "Scan a nutrition label"}>
          {adding === "barcode" ? (
            <BarcodeFlow
              actionLabel={() => "Add to my meals"}
              onPicked={async (f) => {
                const id = await saveRecipe({ ...f, provider: f.brand });
                await tickKit(id);
                done(`Added ${f.name} to your meals`);
              }}
              onMissing={() => (
                <button type="button" onClick={() => setAdding("label")} className="h-11 w-full rounded-xl bg-soft text-sm font-semibold">
                  Scan its nutrition label instead
                </button>
              )}
            />
          ) : (
            <LabelFlow mode="plan" onDone={done} />
          )}
        </Sheet>
      )}
    </section>
  );
}
