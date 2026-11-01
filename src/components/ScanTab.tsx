"use client";

import { useState } from "react";
import { lookupBarcode } from "@/lib/api";
import { logEntry } from "@/lib/db";
import { scale } from "@/lib/nutrition";
import { Meal, Product } from "@/lib/types";
import { Button, NumberInput, Segmented, Spinner, StickyActions, inputClass } from "./ui";
import { Scanner } from "./Scanner";
import { NutrientPreview } from "./NutrientPreview";
import { TriggerWarning } from "./Reflux";
import { useFoodIndex } from "@/lib/useFoods";

type State =
  | { kind: "scanning" }
  | { kind: "loading"; code: string }
  | { kind: "found"; product: Product }
  | { kind: "missing"; code: string }
  | { kind: "error"; code: string; message: string };

export function ScanTab({
  date,
  meal,
  onAdded,
  onManual,
  onAi,
}: {
  date: string;
  meal: Meal;
  onAdded: (msg: string) => void;
  onManual: (barcode: string) => void;
  onAi: () => void;
}) {
  const [state, setState] = useState<State>({ kind: "scanning" });
  const [typed, setTyped] = useState("");

  const lookup = async (code: string) => {
    setState({ kind: "loading", code });
    try {
      const product = await lookupBarcode(code);
      setState(product ? { kind: "found", product } : { kind: "missing", code });
    } catch (e) {
      setState({ kind: "error", code, message: (e as Error).message });
    }
  };

  if (state.kind === "found") {
    return (
      <ProductPortion
        product={state.product}
        onCancel={() => setState({ kind: "scanning" })}
        onAdd={async (values) => {
          await logEntry({
            ...values,
            name: state.product.name,
            brand: state.product.brand,
            barcode: state.product.barcode,
            date,
            meal,
            source: "barcode",
          });
          onAdded(`Added ${state.product.name}`);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {state.kind === "scanning" && <Scanner onDetected={lookup} />}

      {state.kind === "loading" && (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl bg-card text-muted">
          <Spinner />
          <span className="tabular text-sm">Looking up {state.code}…</span>
        </div>
      )}

      {(state.kind === "missing" || state.kind === "error") && (
        <div className="space-y-3 rounded-2xl bg-card p-5">
          <p className="font-semibold">
            {state.kind === "missing" ? "Not in Open Food Facts yet" : "Lookup failed"}
          </p>
          <p className="text-sm text-muted">
            {state.kind === "missing"
              ? `Barcode ${state.code} isn't in the database (or has no nutrition info). Copy the label into Manual, or describe it to the AI.`
              : state.message}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => onManual(state.code)}>Manual</Button>
            <Button variant="secondary" onClick={onAi}>Ask AI</Button>
          </div>
          <Button variant="ghost" className="w-full" onClick={() => setState({ kind: "scanning" })}>
            Scan again
          </Button>
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const code = typed.replace(/\D/g, "");
          if (code.length >= 6) lookup(code);
        }}
      >
        <input
          className={inputClass}
          inputMode="numeric"
          placeholder="Or type the barcode number"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <Button type="submit" variant="secondary" className="shrink-0 whitespace-nowrap" disabled={typed.replace(/\D/g, "").length < 6}>
          Look up
        </Button>
      </form>
    </div>
  );
}

function ProductPortion({
  product,
  onAdd,
  onCancel,
}: {
  product: Product;
  onAdd: (v: ReturnType<typeof scale> & { portion: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const hasServing = !!product.servingQuantity && product.servingQuantity > 0;
  const [unit, setUnit] = useState<"serving" | "base">(hasServing ? "serving" : "base");
  const [amount, setAmount] = useState<number | "">(hasServing ? 1 : 100);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const foods = useFoodIndex();
  const trig = foods.trigger({ name: product.name, brand: product.brand, barcode: product.barcode });

  const qty = Number(amount) || 0;
  const grams = unit === "serving" ? qty * (product.servingQuantity ?? 0) : qty;
  const values = scale(product.per100, grams / 100);
  const u = product.unit;
  const portion =
    unit === "serving"
      ? `${qty} × ${product.servingSize ?? `${product.servingQuantity} ${u}`}`
      : `${qty} ${u}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-4 rounded-2xl bg-card p-4">
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-soft object-contain" />
        )}
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{product.name}</p>
          {product.brand && <p className="text-sm text-muted">{product.brand}</p>}
          <p className="tabular mt-1 text-xs text-muted">
            per 100 {u}: {product.per100.kcal} kcal · P {product.per100.protein} · C {product.per100.carbs} · F{" "}
            {product.per100.fat} · Fi {product.per100.fibre}
          </p>
          {trig && <TriggerWarning food={trig} />}
        </div>
      </div>

      {hasServing && (
        <Segmented
          size="sm"
          value={unit}
          onChange={(v) => {
            setUnit(v);
            setAmount(v === "serving" ? 1 : Math.round(product.servingQuantity ?? 100));
          }}
          options={[
            { id: "serving", label: `Servings (${product.servingSize ?? `${product.servingQuantity} ${u}`})` },
            { id: "base", label: u === "ml" ? "Millilitres" : "Grams" },
          ]}
        />
      )}

      <NumberInput
        value={amount}
        onChange={setAmount}
        suffix={unit === "serving" ? "×" : u}
        min={0}
        step={unit === "serving" ? 0.5 : 1}
        aria-label="Amount"
      />

      <NutrientPreview values={values} />

      <StickyActions error={saveError}>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button variant="secondary" onClick={onCancel}>Rescan</Button>
          <Button
            disabled={qty <= 0 || saving}
            onClick={async () => {
              setSaving(true);
              setSaveError("");
              try {
                await onAdd({ ...values, portion });
              } catch (e) {
                console.error(e);
                setSaveError(`Couldn't save: ${(e as Error)?.message ?? e}`);
                setSaving(false);
              }
            }}
          >
            Add {values.kcal} kcal
          </Button>
        </div>
      </StickyActions>
    </div>
  );
}
