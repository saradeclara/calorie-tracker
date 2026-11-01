"use client";

import { useState } from "react";
import { suggestMeals } from "@/lib/api";
import { logEntry } from "@/lib/db";
import { MealIdea, Meal } from "@/lib/types";
import { Button, Icon, Spinner } from "./ui";

const EXAMPLES = [
  "Snack under 100 calories, high in protein. Use cottage cheese",
  "Quick high-fibre lunch under 450 calories",
  "Dinner with 40 g protein, no oven, 20 minutes",
];

/** Ask the AI for meal ideas; log the one you like with a tap. */
export function IdeasPanel({ date, meal, onAdded }: { date: string; meal: Meal; onAdded: (msg: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState("");
  const [ideas, setIdeas] = useState<MealIdea[] | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  const ask = async () => {
    setLoading(true);
    setSlow(false);
    setError("");
    const slowTimer = window.setTimeout(() => setSlow(true), 12_000);
    try {
      const res = await suggestMeals(prompt);
      setIdeas(res.ideas);
      if (res.ideas.length === 0) setError("No ideas for that. Try describing a meal or snack.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      window.clearTimeout(slowTimer);
      setLoading(false);
    }
  };

  const log = async (idea: MealIdea, i: number) => {
    setSaving(i);
    try {
      await logEntry({
        name: idea.name,
        portion: idea.portion || undefined,
        kcal: idea.kcal,
        protein: idea.protein,
        carbs: idea.carbs,
        fat: idea.fat,
        fibre: idea.fibre,
        source: "ai",
        date,
        meal,
      });
      onAdded(`Added ${idea.name}`);
    } catch (e) {
      setError(`Couldn't save: ${(e as Error)?.message ?? e}`);
      setSaving(null);
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        placeholder="What do you fancy? Calories, protein, ingredients to use, time…"
        className="w-full resize-none rounded-2xl border border-line bg-card p-4 text-ink outline-none placeholder:text-muted/70 focus:border-ink/40"
      />
      {!prompt && !ideas && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setPrompt(ex)} className="rounded-full bg-soft px-3 py-1.5 text-left text-xs text-muted">
              {ex}
            </button>
          ))}
        </div>
      )}

      <Button className="w-full" disabled={loading || !prompt.trim()} onClick={ask}>
        {loading ? (
          <>
            <Spinner /> Thinking…
          </>
        ) : (
          <>
            <Icon name="sparkle" /> {ideas ? "Different ideas" : "Suggest"}
          </>
        )}
      </Button>
      {loading && slow && <p className="text-center text-xs text-muted">Taking longer than usual…</p>}
      {error && <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{error}</p>}

      {ideas && ideas.length > 0 && !loading && (
        <ul className="space-y-3">
          {ideas.map((idea, i) => (
            <li key={`${idea.name}-${i}`} className="space-y-2 rounded-2xl bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold leading-snug">{idea.name}</p>
                <p className="tabular shrink-0 font-semibold">{idea.kcal} kcal</p>
              </div>
              {idea.description && <p className="text-sm text-muted">{idea.description}</p>}
              <p className="tabular text-xs text-muted">
                {idea.portion && `${idea.portion} · `}P {idea.protein} · C {idea.carbs} · F {idea.fat} · Fi {idea.fibre}
              </p>
              {idea.ingredients.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-sm">
                  {idea.ingredients.map((ing) => (
                    <li key={ing}>{ing}</li>
                  ))}
                </ul>
              )}
              {idea.method && <p className="text-sm text-muted">{idea.method}</p>}
              <Button variant="secondary" className="w-full" disabled={saving !== null} onClick={() => log(idea, i)}>
                <Icon name="plus" className="h-4 w-4" /> Log this
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="px-1 text-center text-xs text-muted">Nutrition for ideas is AI-calculated, so treat it as an estimate.</p>
    </div>
  );
}
