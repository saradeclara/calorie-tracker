import type { NextRequest } from "next/server";
import { parseOffProduct } from "@/lib/nutrition";

const FIELDS = [
  "product_name",
  "product_name_en",
  "generic_name",
  "generic_name_en",
  "brands",
  "quantity",
  "categories",
  "nutriments",
  "nutrition_data_per",
  "serving_size",
  "serving_quantity",
  "image_front_small_url",
  "image_small_url",
].join(",");

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/barcode/[code]">) {
  const { code } = await ctx.params;
  if (!/^\d{6,14}$/.test(code)) {
    return Response.json({ error: "That isn't a valid barcode." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`,
      {
        // Open Food Facts asks apps to identify themselves.
        headers: { "User-Agent": "PersonalCalorieTracker/1.0 (personal use)" },
        signal: AbortSignal.timeout(8000),
      },
    );
  } catch {
    return Response.json({ error: "Couldn't reach Open Food Facts. Try again." }, { status: 502 });
  }

  if (res.status === 404) return Response.json({ error: "Not found" }, { status: 404 });
  if (!res.ok) {
    return Response.json({ error: `Open Food Facts error (${res.status})` }, { status: 502 });
  }

  const data = await res.json();
  if (data.status !== 1) return Response.json({ error: "Not found" }, { status: 404 });

  const product = parseOffProduct(code, data.product);
  if (!product) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(product, {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
