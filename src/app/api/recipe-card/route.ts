import Anthropic from "@anthropic-ai/sdk";
import { MODEL, TruncatedReplyError, anthropic, describeError, guard, parseDataUrl, quickThinking } from "@/lib/server/ai";
import type { RecipeCard } from "@/lib/types";

export const maxDuration = 60;

// Reading, not estimating: the numbers must be the ones printed on the card.
const SYSTEM = `You read meal-kit recipe cards and app screenshots (Gousto, HelloFresh, Mindful Chef and similar) for a calorie tracking app.

Copy the nutrition values EXACTLY as printed for ONE serving/portion. Do not estimate or "correct" anything.
- If there are "per serving/portion" and "per 100 g" columns, use per serving.
- If only kJ is printed, convert to kcal (kJ ÷ 4.184).
- If the card shows values for the whole recipe and the number of servings, divide by servings.
- fibre = "Fibre"/"Dietary fibre". If a value isn't printed, use null. Never guess.
- name: the recipe title as printed (without "Serves 2" etc). provider: the brand if visible or obvious from the design, else "".
- If there's no nutrition panel in the image, set found to false.

Reply with ONLY a JSON object:
{"found":true,"name":"...","provider":"Gousto","kcal":0,"protein":0,"carbs":0,"fat":0,"fibre":null,"servingNote":"per serving, 2 servings","notes":"anything unclear, or empty"}`;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
};

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  let body: { image?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const image = body.image ? parseDataUrl(body.image) : null;
  if (!image) return Response.json({ error: "Add a photo or screenshot of the recipe card." }, { status: 400 });

  try {
    const res = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 2000,
      ...quickThinking(),
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
            { type: "text", text: "Read the per-serving nutrition from this recipe card." },
          ],
        },
      ],
    });
    if (res.stop_reason === "max_tokens") throw new TruncatedReplyError();
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const raw = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const card: RecipeCard = {
      found: raw.found !== false,
      name: String(raw.name ?? "").trim().slice(0, 120),
      provider: String(raw.provider ?? "").trim().slice(0, 40),
      kcal: num(raw.kcal),
      protein: num(raw.protein),
      carbs: num(raw.carbs),
      fat: num(raw.fat),
      fibre: num(raw.fibre),
      servingNote: String(raw.servingNote ?? "").slice(0, 120),
      notes: String(raw.notes ?? "").slice(0, 300),
    };
    if (!card.found || card.kcal === null) {
      return Response.json({ error: "Couldn't find a nutrition panel in that image. Try a closer photo of the nutrition table." }, { status: 422 });
    }
    return Response.json(card);
  } catch (err) {
    console.error("recipe-card failed", err);
    return Response.json({ error: describeError(err, MODEL) }, { status: 502 });
  }
}
