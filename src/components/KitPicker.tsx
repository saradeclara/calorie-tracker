"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { PLAN_KITS_KEY, setTickedKits } from "@/lib/planner";
import { Icon, Sheet, cx } from "./ui";
import { RecipeCardFlow } from "./RecipeCardFlow";

/** "My kits this week": tick saved meal-kit recipes to build the plan around them. */
export function KitPicker({ notify }: { notify: (m: string) => void }) {
  const kits = useLiveQuery(() => db.foods.orderBy("lastUsed").reverse().filter((f) => f.kind === "recipe").toArray(), []);
  const ticked = useLiveQuery(() => db.settings.get(PLAN_KITS_KEY).then((r) => (r?.value as number[]) ?? []), []);
  const [adding, setAdding] = useState(false);

  if (!kits || !ticked) return null;
  const on = new Set(ticked.filter((id) => kits.some((k) => k.id === id)));
  const kcal = kits.filter((k) => on.has(k.id!)).reduce((a, k) => a + k.kcal, 0);

  return (
    <section className="space-y-2 rounded-3xl bg-card p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">My kits this week</h2>
        {on.size > 0 && <span className="tabular text-xs text-muted">{Math.round(kcal)} kcal ticked</span>}
      </div>
      <p className="text-xs text-muted">
        Tick the Gousto/HelloFresh meals to include. They keep the exact numbers from the card, and the rest of the day is planned around them.
      </p>
      <ul className="space-y-1.5">
        {kits.map((k) => {
          const checked = on.has(k.id!);
          return (
            <li key={k.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => setTickedKits(checked ? [...on].filter((x) => x !== k.id) : [...on, k.id!])}
                className={cx("flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left", checked ? "bg-ink text-bg" : "bg-soft")}
              >
                <span
                  className={cx(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-md border-2",
                    checked ? "border-bg bg-bg text-ink" : "border-line",
                  )}
                >
                  {checked && <Icon name="check" className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{k.name}</span>
                  <span className={cx("tabular block text-xs", checked ? "opacity-75" : "text-muted")}>
                    {[k.brand, `${Math.round(k.kcal)} kcal`, `P ${Math.round(k.protein)}`, `Fi ${Math.round(k.fibre)}`].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 py-1 text-sm font-medium">
        <Icon name="plus" className="h-4 w-4" /> Add a kit from its recipe card
      </button>

      {adding && (
        <Sheet open onClose={() => setAdding(false)} title="Add a meal kit">
          <RecipeCardFlow
            onDone={(msg) => {
              setAdding(false);
              notify(msg);
            }}
          />
        </Sheet>
      )}
    </section>
  );
}
