import Anthropic from "@anthropic-ai/sdk";
import type { AiEstimate, AiItem } from "@/lib/types";

const MODEL = (process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5").trim();

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
- If the input isn't food or drink, return an empty items array and explain in notes.
- "knownTrigger": the user may list foods that give them reflux. If an item is clearly the same food as one on that list
  (e.g. "oat flat white" vs "Flat white"), use that exact list name as the item's "name" and also put it in "knownTrigger".
  Only match genuinely the same food, not just a shared ingredient. Otherwise use an empty string.`;

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
        required: ["name", "portion", "kcal", "protein", "carbs", "fat", "fibre", "confidence", "knownTrigger"],
        properties: {
          name: { type: "string" },
          portion: { type: "string" },
          kcal: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          fibre: { type: "number" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          knownTrigger: { type: "string" },
        },
      },
    },
    notes: { type: "string" },
  },
} as const;

type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

function parseDataUrl(dataUrl: string): { mediaType: ImageType; data: string } | null {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mediaType: match[1] as ImageType, data: match[2] };
}

function clean(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export async function POST(request: Request) {
  // Protect your API key: in production the app passcode must be configured and sent.
  // Trim so a stray space/newline pasted into Vercel doesn't break the comparison.
  const expected = process.env.APP_PASSCODE?.trim();
  if (!expected && process.env.NODE_ENV === "production") {
    return Response.json(
      { error: "Server isn't configured: set APP_PASSCODE in your Vercel environment variables." },
      { status: 500 },
    );
  }
  if (expected && (request.headers.get("x-app-passcode") ?? "").trim() !== expected) {
    return Response.json(
      { error: "Wrong or missing passcode. Add it in Settings." },
      { status: 401 },
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Server isn't configured: set ANTHROPIC_API_KEY." },
      { status: 500 },
    );
  }

  let body: { description?: string; image?: string; triggers?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const description = (body.description ?? "").trim().slice(0, 2000);
  const image = body.image ? parseDataUrl(body.image) : null;
  const triggers = Array.isArray(body.triggers)
    ? body.triggers.filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim().slice(0, 80)).slice(0, 150)
    : [];
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
  const triggerList = triggers.length
    ? `\n\nMy known reflux trigger foods:\n${triggers.map((t) => `- ${t}`).join("\n")}`
    : "\n\nMy known reflux trigger foods: (none)";
  content.push({
    type: "text",
    text:
      (description ? `What I ate: ${description}` : "Estimate the food in this photo as one portion eaten by me.") +
      triggerList,
  });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY.trim() });
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
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
      // Only accept matches against names we actually sent.
      knownTrigger: triggers.includes(String(i.knownTrigger ?? "")) ? String(i.knownTrigger) : "",
    }));

    return Response.json({ items, notes: String(parsed.notes ?? "") } satisfies AiEstimate);
  } catch (err) {
    console.error("estimate failed", err);
    return Response.json({ error: describeError(err) }, { status: 502 });
  }
}

/** Turn API failures into something you can act on from the phone. */
function describeError(err: unknown): string {
  if (err instanceof Anthropic.APIError) {
    const detail =
      (err.error as { error?: { message?: string } } | undefined)?.error?.message ?? err.message;
    switch (err.status) {
      case 401:
        return "Anthropic rejected the API key. Check ANTHROPIC_API_KEY in Vercel, then redeploy.";
      case 403:
        return `Anthropic refused the request (403): ${detail}`;
      case 404:
        return `Model "${MODEL}" wasn't found. Set ANTHROPIC_MODEL in Vercel or remove it. (${detail})`;
      case 429:
        return "Rate limited by Anthropic. Wait a moment and try again.";
      case 529:
      case 503:
        return "Anthropic is overloaded right now. Try again shortly.";
      default:
        if (/credit|billing|balance/i.test(detail)) {
          return `Anthropic account issue: ${detail}`;
        }
        return `AI request failed (${err.status ?? "?"}): ${detail}`;
    }
  }
  if (err instanceof SyntaxError) return "The AI replied in an unexpected format. Try again.";
  return `AI estimate failed: ${(err as Error)?.message ?? "unknown error"}`;
}
