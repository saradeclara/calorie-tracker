"use client";

import { useState } from "react";
import { lookupBarcode } from "@/lib/api";
import { logEntry } from "@/lib/db";
import { scale } from "@/lib/nutrition";
import { Meal, Nutrients, Product } from "@/lib/types";
import { Button, Field, NumberInput, Segmented, Spinner, StickyActions, inputClass } from "./ui";
import { Scanner } from "./Scanner";
import { NutrientPreview } from "./NutrientPreview";
import { TriggerWarning } from "./Reflux";
import { LabelFlow } from "./LabelFlow";
import { useFoodIndex } from "@/lib/useFoods";

/** What a scan produces: a named food with a chosen portion and its nutrients. */
export interface PickedFood extends Nutrients {
  name: string;
  brand?: string;
  barcode?: string;
  portion: string;
}

/* ---------- Add food → Scan: Barcode | Nutrition label ---------- */

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
  const [mode, setMode] = useState<"barcode" | "label">("barcode");
  return (
    <div className="space-y-3">
      <Segmented
        size="sm"
        value={mode}
        onChange={setMode}
        options={[
          { id: "barcode", label: "Barcode" },
          { id: "label", label: "Nutrition label" },
        ]}
      />
      {mode === "barcode" ? (
        <BarcodeFlow
          actionLabel={(kcal) => `Add ${kcal} kcal`}
          onPicked={async (f) => {
            await logEntry({ ...f, date, meal, source: "barcode" });
            onAdded(`Added ${f.name}`);
          }}
          onMissing={(code) => (
            <div className="grid grid-cols-3 gap-2">
              <Button variant="secondary" onClick={() => setMode("label")}>Label</Button>
              <Button variant="secondary" onClick={() => onManual(code)}>Manual</Button>
              <Button variant="secondary" onClick={onAi}>AI</Button>
            </div>
          )}
        />
      ) : (
        <LabelFlow mode="log" date={date} meal={meal} onDone={onAdded} />
      )}
    </div>
  );
}

/* ---------- Barcode: scan → look up → choose portion ---------- */

type State =
  | { kind: "scanning" }
  | { kind: "loading"; code: string }
  | { kind: "found"; product: Product }
  | { kind: "missing"; code: string }
  | { kind: "error"; code: string; message: string };

export function BarcodeFlow({
  onPicked,
  actionLabel,
  onMissing,
}: {
  onPicked: (f: PickedFood) => Promise<void>;
  actionLabel: (kcal: number) => string;
  /** Extra options when a barcode isn't in the database */
  onMissing?: (code: string) => React.ReactNode;
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
        actionLabel={actionLabel}
        cancelLabel="Rescan"
        onCancel={() => setState({ kind: "scanning" })}
        onAdd={(v) => onPicked({ ...v, barcode: state.product.barcode || undefined })}
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
          <p className="font-semibold">{state.kind === "missing" ? "Not in Open Food Facts yet" : "Lookup failed"}</p>
          <p className="text-sm text-muted">
            {state.kind === "missing"
              ? `Barcode ${state.code} isn't in the database (or has no nutrition info). Scan the nutrition label instead.`
              : state.message}
          </p>
          {state.kind === "missing" && onMissing?.(state.code)}
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

/* ---------- Portion picker for per-100 g/ml foods ---------- */

export function ProductPortion({
  product,
  onAdd,
  onCancel,
  actionLabel,
  cancelLabel,
  editName,
}: {
  product: Product;
  onAdd: (v: Omit<PickedFood, "barcode">) => Promise<void>;
  onCancel: () => void;
  actionLabel: (kcal: number) => string;
  cancelLabel: string;
  /** Let the user name it (labels often don't show the product name) */
  editName?: boolean;
}) {
  const hasServing = !!product.servingQuantity && product.servingQuantity > 0;
  const [unit, setUnit] = useState<"serving" | "base">(hasServing ? "serving" : "base");
  const [amount, setAmount] = useState<number | "">(hasServing ? 1 : 100);
  const [name, setName] = useState(product.name);
  const [brand, setBrand] = useState(product.brand ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const foods = useFoodIndex();
  const trig = foods.trigger({ name, brand: brand || undefined, barcode: product.barcode || undefined });

  const qty = Number(amount) || 0;
  const grams = unit === "serving" ? qty * (product.servingQuantity ?? 0) : qty;
  const values = scale(product.per100, grams / 100);
  const u = product.unit;
  const portion =
    unit === "serving" ? `${qty} × ${product.servingSize ?? `${product.servingQuantity} ${u}`}` : `${qty} ${u}`;

  return (
    <div className="space-y-4">
      {editName ? (
        <div className="space-y-3">
          <Field label="Name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken tikka ready meal" />
          </Field>
          <Field label="Brand (optional)">
            <input className={inputClass} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. M&S" />
          </Field>
          <p className="tabular text-xs text-muted">
            Read per 100 {u}: {product.per100.kcal} kcal · P {product.per100.protein} · C {product.per100.carbs} · F {product.per100.fat} · Fi{" "}
            {product.per100.fibre}
          </p>
          {trig && <TriggerWarning food={trig} />}
        </div>
      ) : (
        <div className="flex gap-4 rounded-2xl bg-card p-4">
          {product.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-soft object-contain" />
          )}
          <div className="min-w-0">
            <p className="font-semibold leading-snug">{product.name}</p>
            {product.brand && <p className="text-sm text-muted">{product.brand}</p>}
            <p className="tabular mt-1 text-xs text-muted">
              per 100 {u}: {product.per100.kcal} kcal · P {product.per100.protein} · C {product.per100.carbs} · F {product.per100.fat} · Fi{" "}
              {product.per100.fibre}
            </p>
            {trig && <TriggerWarning food={trig} />}
          </div>
        </div>
      )}

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

      <NumberInput value={amount} onChange={setAmount} suffix={unit === "serving" ? "×" : u} min={0} step={unit === "serving" ? 0.5 : 1} aria-label="Amount" />

      <NutrientPreview values={values} />

      <StickyActions error={saveError}>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            disabled={qty <= 0 || saving || !name.trim()}
            onClick={async () => {
              setSaving(true);
              setSaveError("");
              try {
                await onAdd({ ...values, name: name.trim(), brand: brand.trim() || undefined, portion });
              } catch (e) {
                console.error(e);
                setSaveError(`Couldn't save: ${(e as Error)?.message ?? e}`);
                setSaving(false);
              }
            }}
          >
            {actionLabel(values.kcal)}
          </Button>
        </div>
      </StickyActions>
    </div>
  );
}
