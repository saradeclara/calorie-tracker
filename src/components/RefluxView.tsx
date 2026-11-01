"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { formatDateTime, formatDay, toKey } from "@/lib/dates";
import type { FoodIndex } from "@/lib/foods";
import { Food, Reaction } from "@/lib/types";
import { Icon, Sheet } from "./ui";
import { SEVERITY_COLOR, SeverityChip } from "./Reflux";

/** Read-only overview. Everything is logged from the day view. */
export function RefluxView({ foods }: { foods: FoodIndex }) {
  const reactions = useLiveQuery(() => db.reactions.orderBy("at").reverse().toArray(), []);
  const [open, setOpen] = useState<Food | null>(null);

  const byFood = useMemo(() => {
    const map = new Map<number, Reaction[]>();
    for (const r of reactions ?? []) {
      const list = map.get(r.foodId) ?? [];
      list.push(r);
      map.set(r.foodId, list);
    }
    return map;
  }, [reactions]);

  const triggers = useMemo(
    () =>
      [...foods.triggers].sort(
        (a, b) =>
          (b.triggerSeverity ?? 1) - (a.triggerSeverity ?? 1) ||
          (byFood.get(b.id!)?.length ?? 0) - (byFood.get(a.id!)?.length ?? 0) ||
          a.name.localeCompare(b.name),
      ),
    [foods.triggers, byFood],
  );

  if (!reactions) return null;
  const empty = triggers.length === 0 && reactions.length === 0;

  return (
    <div className="pb-28">
      <header className="pt-safe sticky top-0 z-20 bg-bg/90 px-4 pb-2 backdrop-blur">
        <h1 className="py-2 text-center text-lg font-semibold">Reflux</h1>
      </header>

      <div className="space-y-4 px-4">
        {empty ? (
          <div className="rounded-3xl bg-card p-6 text-center shadow-sm">
            <Icon name="flame" className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-3 font-semibold">Nothing logged yet</p>
            <p className="mt-1 text-sm text-muted">
              When a food gives you reflux, tap it on the Today screen and choose <b>Log reaction</b>. It&apos;ll be flagged as a
              trigger and show up here, and you&apos;ll get a warning next time you go to add it.
            </p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="mb-2 px-1 text-sm font-semibold text-muted">Triggers · {triggers.length}</h2>
              {triggers.length === 0 ? (
                <p className="rounded-3xl bg-card p-5 text-sm text-muted shadow-sm">No foods flagged as triggers.</p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-card shadow-sm">
                  {triggers.map((f) => {
                    const rs = byFood.get(f.id!) ?? [];
                    return (
                      <li key={f.id}>
                        <button onClick={() => setOpen(f)} className="flex w-full items-start gap-3 px-5 py-3.5 text-left active:bg-soft">
                          <span
                            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: SEVERITY_COLOR[f.triggerSeverity ?? 1] }}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-medium">{f.name}</span>
                              <SeverityChip severity={f.triggerSeverity ?? 1} />
                            </div>
                            {f.brand && <div className="text-xs text-muted">{f.brand}</div>}
                            {f.triggerNote && <div className="mt-0.5 text-sm">{f.triggerNote}</div>}
                            <div className="mt-0.5 text-xs text-muted">
                              {rs.length > 0
                                ? `${rs.length} ${rs.length === 1 ? "reaction" : "reactions"} · last ${formatDay(toKey(new Date(rs[0].at)))}`
                                : "Flagged, no reactions logged"}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {reactions.length > 0 && (
              <section>
                <h2 className="mb-2 px-1 text-sm font-semibold text-muted">Recent reactions</h2>
                <ReactionList reactions={reactions.slice(0, 30)} foods={foods} showFood />
              </section>
            )}
          </>
        )}
      </div>

      {open && <TriggerSheet food={foods.byId.get(open.id!) ?? open} reactions={byFood.get(open.id!) ?? []} onClose={() => setOpen(null)} />}
    </div>
  );
}

function TriggerSheet({ food, reactions, onClose }: { food: Food; reactions: Reaction[]; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title={food.name}>
      <div className="space-y-4">
        <div className="space-y-2 rounded-2xl bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">{food.trigger ? "Trigger severity" : "Not flagged as a trigger"}</span>
            {food.trigger && <SeverityChip severity={food.triggerSeverity ?? 1} />}
          </div>
          {food.brand && <p className="text-sm text-muted">{food.brand}</p>}
          {food.triggerNote && <p className="text-sm">{food.triggerNote}</p>}
          <p className="text-xs text-muted">
            Logged {food.useCount} {food.useCount === 1 ? "time" : "times"} · last {formatDay(toKey(new Date(food.lastUsed)))}
          </p>
        </div>

        <div>
          <h3 className="mb-2 px-1 text-sm font-semibold text-muted">Reaction history</h3>
          {reactions.length === 0 ? (
            <p className="rounded-2xl bg-card p-4 text-sm text-muted">No reactions logged, flagged by hand.</p>
          ) : (
            <ReactionList reactions={reactions} />
          )}
        </div>

        <p className="px-1 text-xs text-muted">
          To change the severity or unflag this food, tap it on any day you logged it and use the Reflux trigger switch.
        </p>
      </div>
    </Sheet>
  );
}

function ReactionList({ reactions, foods, showFood }: { reactions: Reaction[]; foods?: FoodIndex; showFood?: boolean }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-card shadow-sm">
      {reactions.map((r) => (
        <li key={r.id} className="px-5 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">
              {showFood ? (foods?.byId.get(r.foodId)?.name ?? "Unknown food") : formatDateTime(r.at)}
            </span>
            <SeverityChip severity={r.severity} />
          </div>
          {showFood && <div className="text-xs text-muted">{formatDateTime(r.at)}</div>}
          {(r.symptoms.length > 0 || r.note) && (
            <div className="mt-0.5 text-sm text-muted">{[r.symptoms.join(", "), r.note].filter(Boolean).join(" · ")}</div>
          )}
        </li>
      ))}
    </ul>
  );
}
