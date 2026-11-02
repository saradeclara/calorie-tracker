import Anthropic from "@anthropic-ai/sdk";
import { MODEL, TruncatedReplyError, anthropic, describeError, guard, parseDataUrl, quickThinking } from "@/lib/server/ai";
import type { LabelRead, Nutrients } from "@/lib/types";

export const maxDuration = 60;

// Reading, not estimating: only numbers that are printed.
const SYSTEM = `You read nutrition tables from camera photos for a UK calorie tracking app: packaged food labels, ready meals, frozen meals and meal-kit recipe cards (Gousto, HelloFresh etc).

Copy values EXACTLY as printed. Never estimate or guess.
- Return per-100 g (or per-100 ml) values if that column is printed, and per-serving/portion values if that column is printed. Either can be null.
- If only kJ is printed, convert to kcal (kJ ÷ 4.184).
- fibre = "Fibre"/"Dietary fibre". Any value not printed: null.
- servingSize: the serving/portion description as printed (e.g. "1/2 pack (200 g)", "per serving"), else "". servingGrams: the grams/ml of one serving if printed, else null.
- name / brand: only if visible in the photo, else "".
- If the photo is too blurry to read the numbers confidently, or there's no nutrition table, set found to false and say why in notes.

Reply with ONLY a JSON object:
{"found":true,"name":"","brand":"","unit":"g","per100":{"kcal":0,"protein":0,"carbs":0,"fat":0,"fibre":null},"perServing":{"kcal":0,"protein":0,"carbs":0,"fat":0,"fibre":null},"servingSize":"","servingGrams":null,"notes":""}`;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
};

type Partial5 = { [K in keyof Nutrients]: number | null };
const block = (b: unknown): Partial5 | null => {
  const o = b as Record<string, unknown> | null;
  if (!o || num(o.kcal) === null) return null;
  return { kcal: num(o.kcal), protein: num(o.protein), carbs: num(o.carbs), fat: num(o.fat), fibre: num(o.fibre) };
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
  if (!image) return Response.json({ error: "No photo received." }, { status: 400 });

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
            { type: "text", text: "Read the nutrition table." },
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
    const read: LabelRead = {
      found: raw.found !== false,
      name: String(raw.name ?? "").trim().slice(0, 120),
      brand: String(raw.brand ?? "").trim().slice(0, 60),
      unit: raw.unit === "ml" ? "ml" : "g",
      per100: block(raw.per100),
      perServing: block(raw.perServing),
      servingSize: String(raw.servingSize ?? "").trim().slice(0, 80),
      servingGrams: num(raw.servingGrams),
      notes: String(raw.notes ?? "").slice(0, 300),
    };
    if (!read.found || (!read.per100 && !read.perServing)) {
      return Response.json(
        { error: `Couldn't read the numbers${read.notes ? `: ${read.notes}` : ""}. Get closer, hold steady, and make sure the table is well lit.` },
        { status: 422 },
      );
    }
    return Response.json(read);
  } catch (err) {
    console.error("label failed", err);
    return Response.json({ error: describeError(err, MODEL) }, { status: 502 });
  }
}
