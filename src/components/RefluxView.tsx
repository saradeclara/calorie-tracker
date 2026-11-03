"use client";

import { formatDay, toKey } from "@/lib/dates";
import type { FoodIndex } from "@/lib/foods";
import { Icon, ScreenHeader } from "./ui";
import { SEVERITY_COLOR, SeverityChip } from "./Reflux";

/** Read-only list of foods you've flagged as reflux triggers. */
export function RefluxView({ foods }: { foods: FoodIndex }) {
  const triggers = [...foods.triggers].sort(
    (a, b) => (b.triggerSeverity ?? 1) - (a.triggerSeverity ?? 1) || a.name.localeCompare(b.name),
  );

  return (
    <div className="pb-28">
      <ScreenHeader title="Reflux triggers" />

      <div className="space-y-3 px-4">
        {triggers.length === 0 ? (
          <div className="rounded-[1.375rem] bg-card p-6 text-center">
            <Icon name="flame" className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-3 font-semibold">No triggers yet</p>
            <p className="mt-1 text-sm text-muted">
              Tap a food on the Today screen and switch on <b>Reflux trigger</b>. It&apos;ll be listed here, and you&apos;ll get a
              warning next time you add it.
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line overflow-hidden rounded-[1.375rem] bg-card">
              {triggers.map((f) => (
                <li key={f.id} className="flex items-start gap-3 px-5 py-3.5">
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
                    <div className="text-xs text-muted">
                      {[f.brand, `Logged ${f.useCount}× · last ${formatDay(toKey(new Date(f.lastUsed)))}`].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="px-2 text-center text-xs text-muted">
              To change the severity or remove a trigger, tap that food on any day you logged it.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
