import Anthropic from "@anthropic-ai/sdk";
import type { AiEstimate, AiItem } from "@/lib/types";
import { MODEL, TruncatedReplyError, anthropic, describeError, guard, parseDataUrl, quickThinking } from "@/lib/server/ai";

// Photo estimates can take a while; don't let the platform's default timeout cut them off.
export const maxDuration = 60;

const SYSTEM = `You are a careful nutrition estimator inside a personal calorie tracking app used in the UK.
The user describes food they ate (and may attach a photo). Break it into separate items and estimate, for the portion actually eaten:
kcal, protein (g), carbohydrates (g), fat (g) and fibre (g, AOAC/UK labelling convention).

Rules:
- Use stated quantities, weights and brands when given. Otherwise assume a typical UK portion and say what you assumed in "portion" (e.g. "1 medium slice, ~40 g").
- Include cooking oils, butter, sauces and dressings that are implied, as separate items when significant.
- Be realistic rather than optimistic: restaurant and takeaway portions are usually larger and oilier than home-cooked.
- confidence: "high" for packaged or weighed food, "medium" for clear descriptions, "low" when guessing size or contents.
- "notes": one or two short sentences on key assumptions or what would improve accuracy. Empty string if nothing to add.
- If the input isn't food or drink, return an empty items array and explain in notes.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "notes"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "portion", "kcal", "protein", "carbs", "fat", "fibre", "confidence"],
        properties: {
          name: { type: "string" },
          portion: { type: "string" },
          kcal: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          fibre: { type: "number" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    notes: { type: "string" },
  },
} as const;

function clean(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  let body: { description?: string; image?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const description = (body.description ?? "").trim().slice(0, 2000);
  const image = body.image ? parseDataUrl(body.image) : null;
  if (!description && !image) {
    return Response.json({ error: "Describe the food or add a photo." }, { status: 400 });
  }

  const content: Anthropic.ContentBlockParam[] = [];
  if (image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.data },
    });
  }
  content.push({
    type: "text",
    text: description
      ? `What I ate: ${description}`
      : "Estimate the food in this photo as one portion eaten by me.",
  });

  // Fail with a clear error before the platform kills the function.
  const client = anthropic();
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      ...quickThinking(),
      system: SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (message.stop_reason === "max_tokens") throw new TruncatedReplyError();
    const parsed = JSON.parse(text) as AiEstimate;

    const items: AiItem[] = (parsed.items ?? []).map((i) => ({
      name: String(i.name || "Food").slice(0, 120),
      portion: String(i.portion || "").slice(0, 120),
      kcal: Math.round(clean(i.kcal)),
      protein: Math.round(clean(i.protein) * 10) / 10,
      carbs: Math.round(clean(i.carbs) * 10) / 10,
      fat: Math.round(clean(i.fat) * 10) / 10,
      fibre: Math.round(clean(i.fibre) * 10) / 10,
      confidence: ["low", "medium", "high"].includes(i.confidence) ? i.confidence : "medium",
    }));

    return Response.json({ items, notes: String(parsed.notes ?? "") } satisfies AiEstimate);
  } catch (err) {
    console.error("estimate failed", err);
    return Response.json({ error: describeError(err, MODEL) }, { status: 502 });
  }
}
