"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, logWeight } from "@/lib/db";
import { withTrend } from "@/lib/weight";
import { Button, Icon, NumberInput } from "./ui";

/** Quick weigh-in for a day. Re-saving replaces that day's weight. */
export function WeightInput({ date, notify, compact }: { date: string; notify: (m: string) => void; compact?: boolean }) {
  const saved = useLiveQuery(() => db.weights.get(date), [date]);
  const all = useLiveQuery(() => db.weights.toArray(), []);
  const [draft, setDraft] = useState<{ date: string; value: number | "" } | null>(null);

  // Show the saved value until you start typing (and reset when the day changes).
  const value = draft && draft.date === date ? draft.value : (saved?.kg ?? "");
  const trend = all ? withTrend(all.filter((w) => w.date <= date)).at(-1) : undefined;
  const changed = value !== "" && value !== saved?.kg;

  const save = async () => {
    if (value === "" || !(value > 20 && value < 400)) return notify("Enter your weight in kg");
    try {
      await logWeight(date, Math.round(value * 10) / 10);
      setDraft(null);
      notify("Weight saved");
    } catch (e) {
      notify(`Couldn't save: ${(e as Error)?.message ?? e}`);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        {!compact && (
          <span className="flex shrink-0 items-center gap-2 font-semibold">
            <Icon name="scale" className="h-5 w-5 text-[var(--w-line)]" /> Weight
          </span>
        )}
        <div className="min-w-0 flex-1">
          <NumberInput
            value={value}
            onChange={(v) => setDraft({ date, value: v })}
            suffix="kg"
            step="0.1"
            min={0}
            placeholder={trend ? String(trend.kg) : "e.g. 65.0"}
            aria-label="Weight in kg"
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </div>
        <Button variant={changed ? "primary" : "secondary"} className="h-12 shrink-0 px-4" disabled={!changed} onClick={save}>
          {saved && !changed ? <Icon name="check" className="h-4 w-4" /> : "Save"}
        </Button>
      </div>
      {trend && (
        <p className="mt-2 text-xs text-muted">
          7-day average <span className="tabular font-medium text-ink">{trend.avg.toFixed(1)} kg</span>
          {saved ? "" : " · not weighed this day"}
        </p>
      )}
    </div>
  );
}
