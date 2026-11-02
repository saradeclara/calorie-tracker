"use client";

import { useRef, useState } from "react";
import { readRecipeCard } from "@/lib/api";
import { logEntry, saveRecipe } from "@/lib/db";
import { resizeImage } from "@/lib/image";
import { MEALS, type Meal, type RecipeCard } from "@/lib/types";
import { Button, Field, Icon, Spinner, inputClass } from "./ui";
import { EntryForm } from "./EntryForm";

const PROVIDERS = ["Gousto", "HelloFresh", "Mindful Chef"];

/**
 * Photo/screenshot of a meal-kit card → read the printed per-serving nutrition → review →
 * save as a recipe (and optionally log one serving now).
 */
export function RecipeCardFlow({
  logTo,
  onDone,
}: {
  /** When set, offer "also log 1 serving" to this day/meal */
  logTo?: { date: string; meal: Meal };
  onDone: (msg: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [card, setCard] = useState<RecipeCard | null>(null);
  const [provider, setProvider] = useState("");
  const [logNow, setLogNow] = useState(!!logTo);

  const read = async (file: File) => {
    setError("");
    setCard(null);
    setReading(true);
    try {
      // Bigger than food photos: the nutrition table's small print needs to stay legible.
      const img = await resizeImage(file, 1600, 0.85);
      setImage(img);
      const c = await readRecipeCard(img);
      setCard(c);
      setProvider(c.provider);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  };

  const missing = card ? (["protein", "carbs", "fat", "fibre"] as const).filter((k) => card[k] === null) : [];

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) read(f);
        }}
      />

      {!card && (
        <>
          <p className="text-sm text-muted">
            Take a photo of the <b>nutrition table</b> on your Gousto or HelloFresh recipe card, or a screenshot of the recipe in
            their app. The numbers are copied as printed, per serving.
          </p>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Recipe card" className="max-h-48 w-full rounded-2xl object-cover" />
          )}
          {error && <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{error}</p>}
          <Button className="w-full" disabled={reading} onClick={() => fileRef.current?.click()}>
            {reading ? (
              <>
                <Spinner /> Reading the card…
              </>
            ) : (
              <>
                <Icon name="camera" /> {image ? "Try another photo" : "Photo or screenshot"}
              </>
            )}
          </Button>
        </>
      )}

      {card && (
        <>
          <div className="flex items-center gap-3 rounded-2xl bg-card p-3">
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
            )}
            <p className="text-xs text-muted">
              Read from your photo{card.servingNote ? ` (${card.servingNote})` : ""}. Check the numbers match the card.
              {missing.length > 0 && <> Not printed: {missing.join(", ")}, so fill in if you know them.</>}
              {card.notes && <> {card.notes}</>}
            </p>
          </div>

          <Field label="Brand">
            <input className={inputClass} value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. Gousto" list="kit-providers" />
            <datalist id="kit-providers">
              {PROVIDERS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>

          {logTo && (
            <label className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-sm">
              <input type="checkbox" checked={logNow} onChange={(e) => setLogNow(e.target.checked)} className="h-5 w-5 accent-[var(--ink)]" />
              Also log 1 serving to {MEALS.find((m) => m.id === logTo.meal)?.label.toLowerCase()} now
            </label>
          )}

          <EntryForm
            initial={{
              name: card.name,
              portion: "1 serving",
              kcal: card.kcal ?? undefined,
              protein: card.protein ?? undefined,
              carbs: card.carbs ?? undefined,
              fat: card.fat ?? undefined,
              fibre: card.fibre ?? undefined,
            }}
            submitLabel={logTo && logNow ? "Save recipe & log" : "Save recipe"}
            onSubmit={async (v) => {
              const recipe = { name: v.name, provider, kcal: v.kcal, protein: v.protein, carbs: v.carbs, fat: v.fat, fibre: v.fibre };
              await saveRecipe(recipe);
              if (logTo && logNow) {
                await logEntry({ ...recipe, brand: provider.trim() || undefined, portion: "1 serving", source: "manual", ...logTo });
                onDone(`Saved and logged ${v.name}`);
              } else {
                onDone(`Saved ${v.name} to your kits`);
              }
            }}
          />
        </>
      )}
    </div>
  );
}
