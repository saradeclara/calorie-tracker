import Anthropic from "@anthropic-ai/sdk";

export const MODEL = (process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5").trim();

/**
 * Passcode + config checks shared by the AI routes. Returns an error Response, or null if OK.
 * The passcode stops anyone who finds your URL from spending your API credit.
 */
export function guard(request: Request): Response | null {
  // Trim so a stray space/newline pasted into Vercel doesn't break the comparison.
  const expected = process.env.APP_PASSCODE?.trim();
  if (!expected && process.env.NODE_ENV === "production") {
    return Response.json(
      { error: "Server isn't configured: set APP_PASSCODE in your Vercel environment variables." },
      { status: 500 },
    );
  }
  if (expected && (request.headers.get("x-app-passcode") ?? "").trim() !== expected) {
    return Response.json({ error: "Wrong or missing passcode. Add it in Settings." }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Server isn't configured: set ANTHROPIC_API_KEY." }, { status: 500 });
  }
  return null;
}

/** Client that fails with a clear error before the platform kills the function. */
export function anthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim(), timeout: 50_000, maxRetries: 1 });
}

/** Turn API failures into something you can act on from the phone. */
export function describeError(err: unknown, model: string): string {
  if (err instanceof Anthropic.APIError) {
    const detail =
      (err.error as { error?: { message?: string } } | undefined)?.error?.message ?? err.message;
    switch (err.status) {
      case 401:
        return "Anthropic rejected the API key. Check ANTHROPIC_API_KEY in Vercel, then redeploy.";
      case 403:
        return `Anthropic refused the request (403): ${detail}`;
      case 404:
        return `Model "${model}" wasn't found. Set ANTHROPIC_MODEL in Vercel or remove it. (${detail})`;
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
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return "The AI took too long to respond. Try again.";
  }
  if (err instanceof SyntaxError) return "The AI replied in an unexpected format. Try again.";
  return `AI estimate failed: ${(err as Error)?.message ?? "unknown error"}`;
}
