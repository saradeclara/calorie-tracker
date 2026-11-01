"use client";

import { useRef, useState } from "react";
import { estimateFood } from "@/lib/api";
import { logEntries } from "@/lib/db";
import { scale, sum } from "@/lib/nutrition";
import { AiEstimate, AiItem, Food, Meal } from "@/lib/types";
import { norm } from "@/lib/foods";
import { useFoodIndex } from "@/lib/useFoods";
import { TriggerWarning } from "./Reflux";
import { Button, Icon, Spinner, StickyActions, cx } from "./ui";
import { NutrientPreview } from "./NutrientPreview";

/** Shrink a photo before upload: faster, cheaper, and plenty for food estimates. */
async function resizeImage(file: File, max = 1024): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Couldn't read that image."));
      i.src = url;
    });
    const ratio = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * ratio);
    canvas.height = Math.round(img.height * ratio);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const MULTIPLIERS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const EXAMPLES = [
  "2 slices sourdough toast with butter and 2 fried eggs",
  "Chicken tikka masala with pilau rice from a takeaway",
  "Large oat flat white and a blueberry muffin",
];

export function AiTab({ date, meal, onAdded }: { date: string; meal: Meal; onAdded: (msg: string) => void }) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AiEstimate | null>(null);
  const [picked, setPicked] = useState<{ on: boolean; mult: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { triggers } = useFoodIndex();

  /** A flagged food with the same name (matched in the app, no AI involved). */
  const triggerFor = (item: AiItem): Food | undefined => triggers.find((t) => norm(t.name) === norm(item.name));

  const submit = async () => {
    setLoading(true);
    setSlow(false);
    setError("");
    const slowTimer = window.setTimeout(() => setSlow(true), 12_000);
    try {
      const res = await estimateFood({ description: text, image: image ?? undefined });
      setResult(res);
      setPicked(res.items.map(() => ({ on: true, mult: 1 })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      window.clearTimeout(slowTimer);
      setLoading(false);
    }
  };

  if (result) {
    const chosen = result.items
      .map((item, i) => ({ item, ...picked[i] }))
      .filter((x) => x.on)
      .map((x) => ({ ...x.item, ...scale(x.item, x.mult), mult: x.mult, trigger: triggerFor(x.item) }));
    const total = sum(chosen);

    return (
      <div className="space-y-3">
        {result.items.length === 0 && (
          <p className="rounded-2xl bg-card p-4 text-sm text-muted">No food found in that.</p>
        )}
        <ul className="space-y-2">
          {result.items.map((item, i) => {
            const p = picked[i];
            const v = scale(item, p.mult);
            const trig = triggerFor(item);
            return (
              <li key={i} className={cx("rounded-2xl bg-card p-4 transition", !p.on && "opacity-45")}>
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setPicked((s) => s.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
                    className={cx(
                      "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2",
                      p.on ? "border-ink bg-ink text-bg" : "border-line",
                    )}
                    aria-label={p.on ? `Exclude ${item.name}` : `Include ${item.name}`}
                  >
                    {p.on && <Icon name="check" className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold leading-snug">{item.name}</p>
                      <p className="tabular shrink-0 font-semibold">{v.kcal}</p>
                    </div>
                    <p className="text-xs text-muted">
                      {item.portion}
                      {item.confidence === "low" && <span className="ml-1 text-accent">· rough guess</span>}
                    </p>
                    <p className="tabular mt-1 text-xs text-muted">
                      P {v.protein} · C {v.carbs} · F {v.fat} · Fi {v.fibre}
                    </p>
                    {trig && <TriggerWarning food={trig} />}
                    <div className="mt-2 flex gap-1 overflow-x-auto">
                      {MULTIPLIERS.map((m) => (
                        <button
                          key={m}
                          onClick={() => setPicked((s) => s.map((x, j) => (j === i ? { on: true, mult: m } : x)))}
                          className={cx(
                            "tabular h-7 shrink-0 rounded-lg px-2 text-xs font-medium",
                            p.mult === m ? "bg-ink text-bg" : "bg-soft text-muted",
                          )}
                        >
                          {m}×
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {result.notes && <p className="px-1 text-xs leading-relaxed text-muted">{result.notes}</p>}
        <NutrientPreview values={total} />
        <StickyActions error={saveError}>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button variant="secondary" onClick={() => setResult(null)}>Back</Button>
          <Button
            disabled={chosen.length === 0 || saving}
            onClick={async () => {
              setSaving(true);
              setSaveError("");
              try {
                await logEntries(
                chosen.map((c) => ({
                  // Same name as a flagged food: save with its brand so it links to that food record.
                  name: c.trigger?.name ?? c.name,
                  brand: c.trigger?.brand,
                  barcode: c.trigger?.barcode,
                  portion: c.mult === 1 ? c.portion : `${c.mult}× ${c.portion}`,
                  kcal: c.kcal,
                  protein: c.protein,
                  carbs: c.carbs,
                  fat: c.fat,
                  fibre: c.fibre,
                  date,
                  meal,
                  source: "ai" as const,
                })),
              );
                onAdded(chosen.length === 1 ? `Added ${chosen[0].name}` : `Added ${chosen.length} items`);
              } catch (e) {
                console.error(e);
                setSaveError(`Couldn't save: ${(e as Error)?.message ?? e}`);
                setSaving(false);
              }
            }}
          >
            Add {chosen.length} {chosen.length === 1 ? "item" : "items"} · {total.kcal} kcal
          </Button>
        </div>
        </StickyActions>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="What did you eat? Be as specific as you like — amounts, brands, how it was cooked."
        className="w-full resize-none rounded-2xl border border-line bg-card p-4 text-ink outline-none placeholder:text-muted/70 focus:border-ink/40"
      />

      {!text && !image && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setText(ex)} className="rounded-full bg-soft px-3 py-1.5 text-left text-xs text-muted">
              {ex}
            </button>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            setImage(await resizeImage(f));
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />

      {image ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Your food" className="max-h-56 w-full rounded-2xl object-cover" />
          <button
            onClick={() => setImage(null)}
            className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"
            aria-label="Remove photo"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Button variant="secondary" className="w-full" onClick={() => fileRef.current?.click()}>
          <Icon name="camera" /> Add a photo (optional)
        </Button>
      )}

      {error && <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{error}</p>}
      {loading && slow && (
        <p className="text-center text-xs text-muted">
          Taking longer than usual…
        </p>
      )}

      <Button className="w-full" disabled={loading || (!text.trim() && !image)} onClick={submit}>
        {loading ? (
          <>
            <Spinner /> Estimating…
          </>
        ) : (
          <>
            <Icon name="sparkle" /> Estimate
          </>
        )}
      </Button>
    </div>
  );
}
