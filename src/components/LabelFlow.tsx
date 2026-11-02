"use client";

import { useState } from "react";
import { readLabel } from "@/lib/api";
import { logEntry, saveRecipe } from "@/lib/db";
import { tickKit } from "@/lib/planner";
import { MEALS, type LabelRead, type Meal, type Product } from "@/lib/types";
import { Button, Icon, Spinner } from "./ui";
import { LabelCamera } from "./LabelCamera";
import { ProductPortion, type PickedFood } from "./ScanTab";
import { EntryForm } from "./EntryForm";

type Props =
  | { mode: "log"; date: string; meal: Meal; onDone: (msg: string) => void }
  | { mode: "plan"; onDone: (msg: string) => void };

/**
 * Nutrition label → camera → read printed numbers → choose portion / check → then either
 * log it (Add food) or save it as a meal and tick it for the plan (Plan tab).
 * Per-serving-only labels (meal-kit cards) are always kept as saved meals.
 */
export function LabelFlow(props: Props) {
  const [shot, setShot] = useState<string | null>(null);
  const [read, setRead] = useState<LabelRead | null>(null);
  const [error, setError] = useState("");

  const capture = async (img: string) => {
    setShot(img);
    setError("");
    try {
      setRead(await readLabel(img));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const retake = () => {
    setShot(null);
    setRead(null);
    setError("");
  };

  const finish = async (f: PickedFood, saveAsMeal: boolean) => {
    const id = saveAsMeal || props.mode === "plan" ? await saveRecipe({ ...f, provider: f.brand }) : undefined;
    if (props.mode === "plan") {
      await tickKit(id!);
      props.onDone(`Added ${f.name} to your meals`);
    } else {
      await logEntry({ ...f, date: props.date, meal: props.meal, source: "manual" });
      props.onDone(`Added ${f.name}`);
    }
  };

  if (!shot) return <LabelCamera onCapture={capture} />;

  if (!read) {
    return (
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-2xl bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shot} alt="Captured label" className="max-h-72 w-full object-contain opacity-80" />
          {!error && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm text-white">
                <Spinner className="h-4 w-4" /> Reading the label…
              </span>
            </div>
          )}
        </div>
        {error && (
          <>
            <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{error}</p>
            <Button className="w-full" onClick={retake}>
              <Icon name="camera" /> Try again
            </Button>
          </>
        )}
      </div>
    );
  }

  const action = props.mode === "plan" ? () => "Add to my meals" : (kcal: number) => `Add ${kcal} kcal`;
  const note = (
    <p className="text-xs text-muted">
      Read from the label{read.notes ? `: ${read.notes}` : ""}. Check the numbers match what&apos;s printed.
    </p>
  );

  // Per 100 g/ml printed: choose how much, like a barcode scan.
  if (read.per100) {
    const p = read.per100;
    const product: Product = {
      barcode: "",
      name: read.name,
      brand: read.brand || undefined,
      unit: read.unit,
      per100: { kcal: p.kcal ?? 0, protein: p.protein ?? 0, carbs: p.carbs ?? 0, fat: p.fat ?? 0, fibre: p.fibre ?? 0 },
      servingSize: read.servingSize || undefined,
      servingQuantity: read.servingGrams ?? undefined,
    };
    return (
      <div className="space-y-3">
        {note}
        <ProductPortion product={product} editName actionLabel={action} cancelLabel="Retake" onCancel={retake} onAdd={(f) => finish(f, false)} />
      </div>
    );
  }

  // Per serving only (meal-kit cards): check the numbers, save as a meal.
  const s = read.perServing!;
  const missing = (["protein", "carbs", "fat", "fibre"] as const).filter((k) => s[k] === null);
  return (
    <div className="space-y-3">
      {note}
      {missing.length > 0 && <p className="text-xs text-muted">Not printed: {missing.join(", ")}. Fill in if you know them.</p>}
      <EntryForm
        initial={{
          name: read.name || (read.brand ? `${read.brand} meal` : ""),
          portion: read.servingSize && !/^per\b/i.test(read.servingSize) ? read.servingSize : "1 serving",
          kcal: s.kcal ?? undefined,
          protein: s.protein ?? undefined,
          carbs: s.carbs ?? undefined,
          fat: s.fat ?? undefined,
          fibre: s.fibre ?? undefined,
        }}
        submitLabel={props.mode === "plan" ? "Add to my meals" : `Save & add to ${MEALS.find((m) => m.id === props.meal)?.label.toLowerCase()}`}
        onSubmit={(v) => finish({ ...v, portion: v.portion || "1 serving", brand: read.brand || undefined }, true)}
        extra={
          <Button type="button" variant="ghost" className="w-full" onClick={retake}>
            Retake
          </Button>
        }
      />
    </div>
  );
}
