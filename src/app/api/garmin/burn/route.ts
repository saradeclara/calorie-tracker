import { connection, type NextRequest } from "next/server";
import { guardPasscode } from "@/lib/server/ai";
import { GarminError, garminConfigured, garminGet } from "@/lib/server/garmin";
import type { GarminBurn } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

// A day only counts if it looks like the watch was worn: Garmin still reports resting
// calories for unworn days, which would drag the average burn down.
const MIN_STEPS = 1000;

function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Average daily burn over the `days` complete days ending on `end` (the client's yesterday). */
export async function GET(request: NextRequest) {
  await connection();
  if (!garminConfigured()) return Response.json({ configured: false } satisfies GarminBurn);
  const denied = guardPasscode(request);
  if (denied) return denied;

  const end = request.nextUrl.searchParams.get("end") ?? "";
  const days = Math.min(42, Math.max(7, Number(request.nextUrl.searchParams.get("days")) || 28));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return Response.json({ error: "Bad date." }, { status: 400 });

  const dates = Array.from({ length: days }, (_, i) => addDays(end, -i));
  try {
    // A few at a time, to be gentle on the API.
    const rows: any[] = [];
    for (let i = 0; i < dates.length; i += 6) {
      const batch = await Promise.all(
        dates.slice(i, i + 6).map((d) =>
          garminGet<any>("/usersummary-service/usersummary/daily", { calendarDate: d }).catch((e) => {
            if (e instanceof GarminError && e.status === 401) throw e;
            return null; // one bad day shouldn't sink the average
          }),
        ),
      );
      rows.push(...batch);
    }
    const valid = rows.filter(
      (s) => Number(s?.totalKilocalories) > 0 && Number(s?.totalSteps) >= MIN_STEPS && s?.activeKilocalories != null,
    );
    const avg = (f: (s: any) => number) => Math.round(valid.reduce((a, s) => a + f(s), 0) / Math.max(1, valid.length));
    const body: GarminBurn = {
      configured: true,
      days: valid.length,
      from: dates[dates.length - 1],
      to: end,
      avgTotal: valid.length ? avg((s) => Number(s.totalKilocalories)) : null,
      avgActive: valid.length ? avg((s) => Number(s.activeKilocalories)) : null,
    };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("garmin burn failed", err);
    const e = err instanceof GarminError ? err : new GarminError("Couldn't reach Garmin. Try again.");
    return Response.json({ error: e.message }, { status: e.status });
  }
}
