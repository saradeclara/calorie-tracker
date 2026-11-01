import Anthropic from "@anthropic-ai/sdk";
import type { MealIdea } from "@/lib/types";
import { MODEL, anthropic, describeError, guard } from "@/lib/server/ai";

export const maxDuration = 60;

// Plain JSON in the reply (no structured-output schema), so there's no one-off
// schema compile delay. The reply is validated below.
const SYSTEM = `You suggest meals and snacks inside a personal calorie tracking app used in the UK.
The user describes what they want (e.g. "snack under 100 calories, high protein, use cottage cheese").

Give exactly 3 different suggestions that strictly meet every constraint they state (calorie limits, macros, ingredients, time, equipment).
- Use realistic UK supermarket ingredients with specific amounts in grams/ml or household measures.
- Work out calories, protein, carbs, fat and fibre (UK/AOAC convention) from those amounts using standard nutrition values. Be accurate rather than flattering; if a constraint is a calorie cap, stay safely under it.
- Keep them simple and quick unless asked otherwise. Method: one short sentence.

Reply with ONLY a JSON object, no other text, in this shape:
{"ideas":[{"name":"short dish name","description":"one short sentence","ingredients":["150 g cottage cheese", "..."],"method":"one short sentence","portion":"e.g. 1 bowl, ~200 g","kcal":0,"protein":0,"carbs":0,"fat":0,"fibre":0}]}
If the request isn't about food, reply {"ideas":[]}.`;

function num(n: unknown, dp: number): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  let body: { prompt?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const prompt = (body.prompt ?? "").trim().slice(0, 1000);
  if (!prompt) return Response.json({ error: "Describe what you'd like." }, { status: 400 });

  try {
    const message = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as { ideas?: unknown[] };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ideas: MealIdea[] = (parsed.ideas ?? []).slice(0, 3).map((raw: any) => ({
      name: str(raw?.name, 100) || "Idea",
      description: str(raw?.description, 200),
      ingredients: Array.isArray(raw?.ingredients) ? raw.ingredients.map((i: unknown) => str(i, 100)).filter(Boolean).slice(0, 12) : [],
      method: str(raw?.method, 300),
      portion: str(raw?.portion, 80),
      kcal: num(raw?.kcal, 0),
      protein: num(raw?.protein, 1),
      carbs: num(raw?.carbs, 1),
      fat: num(raw?.fat, 1),
      fibre: num(raw?.fibre, 1),
    }));
    return Response.json({ ideas });
  } catch (err) {
    console.error("suggest failed", err);
    return Response.json({ error: describeError(err, MODEL) }, { status: 502 });
  }
}
