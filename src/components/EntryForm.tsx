"use client";

import { useState } from "react";
import { Nutrients } from "@/lib/types";
import { Button, Field, NumberInput, StickyActions, inputClass } from "./ui";

export interface EntryValues extends Nutrients {
  name: string;
  portion?: string;
}

type Draft = { name: string; portion: string } & Record<keyof Nutrients, number | "">;

export function EntryForm({
  initial,
  submitLabel,
  onSubmit,
  extra,
}: {
  initial: Partial<EntryValues>;
  submitLabel: string;
  onSubmit: (v: EntryValues) => Promise<void>;
  extra?: React.ReactNode;
}) {
  const [d, setD] = useState<Draft>({
    name: initial.name ?? "",
    portion: initial.portion ?? "",
    kcal: initial.kcal ?? "",
    protein: initial.protein ?? "",
    carbs: initial.carbs ?? "",
    fat: initial.fat ?? "",
    fibre: initial.fibre ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }));

  const valid = d.name.trim() !== "" && d.kcal !== "" && Number(d.kcal) >= 0;

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        setSaving(true);
        setSaveError("");
        try {
          await onSubmit({
            name: d.name.trim(),
            portion: d.portion.trim() || undefined,
            kcal: Number(d.kcal) || 0,
            protein: Number(d.protein) || 0,
            carbs: Number(d.carbs) || 0,
            fat: Number(d.fat) || 0,
            fibre: Number(d.fibre) || 0,
          });
        } catch (err) {
          console.error(err);
          setSaveError(`Couldn't save: ${(err as Error)?.message ?? err}`);
        } finally {
          setSaving(false);
        }
      }}
    >
      <Field label="Food">
        <input className={inputClass} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Greek yoghurt" />
      </Field>
      <Field label="Portion (optional)">
        <input className={inputClass} value={d.portion} onChange={(e) => set("portion", e.target.value)} placeholder="e.g. 150 g" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Calories">
          <NumberInput value={d.kcal} onChange={(v) => set("kcal", v)} suffix="kcal" min={0} />
        </Field>
        <Field label="Protein">
          <NumberInput value={d.protein} onChange={(v) => set("protein", v)} suffix="g" min={0} step="0.1" />
        </Field>
        <Field label="Carbs">
          <NumberInput value={d.carbs} onChange={(v) => set("carbs", v)} suffix="g" min={0} step="0.1" />
        </Field>
        <Field label="Fat">
          <NumberInput value={d.fat} onChange={(v) => set("fat", v)} suffix="g" min={0} step="0.1" />
        </Field>
        <Field label="Fibre">
          <NumberInput value={d.fibre} onChange={(v) => set("fibre", v)} suffix="g" min={0} step="0.1" />
        </Field>
      </div>
      <StickyActions error={saveError}>
        <Button type="submit" className="w-full" disabled={!valid || saving}>
          {submitLabel}
        </Button>
        {extra && <div className="mt-2">{extra}</div>}
      </StickyActions>
    </form>
  );
}
