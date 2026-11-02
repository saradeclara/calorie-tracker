# Calorie Tracker

A personal calorie, macro, fibre and water tracker. It's a PWA, so you install it to your phone's home screen from the browser.

- **Barcode scanning**: camera scanning with Open Food Facts lookups. It uses the native `BarcodeDetector` on Android and a self-hosted ZXing WASM decoder on iPhone.
- **AI estimates**: describe a meal and/or add a photo, and Claude splits it into items with kcal, protein, carbs, fat and fibre. You can tweak portions (0.5×–2×) and untick items before adding.
- **Manual entry and Recent**: one-tap re-adding of anything you've logged before.
- **Water**: +250/+500 ml buttons and undo.
- **Goals**: daily kcal, macros, fibre and water.
- **Data**: stored on-device in IndexedDB, with JSON export/import for backups.
- **Offline**: the app shell is cached by a service worker, so logging works without signal. Scanning and AI still need a connection.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Dexie (IndexedDB) · `@anthropic-ai/sdk` · `barcode-detector`

```
src/app/api/barcode/[code]/route.ts   Open Food Facts proxy (sets a User-Agent, normalises the data)
src/app/api/estimate/route.ts         Claude call with structured JSON output, passcode-protected
src/lib/db.ts                         Dexie schema, goals, write helpers, backup
src/components/                       UI (App → Summary, WaterCard, MealSection, AddFoodSheet tabs…)
public/sw.js                          Service worker
```

## Deploy to Vercel

1. Push this folder to a GitHub repo and import it in Vercel. Defaults are fine.
2. Under **Settings → Environment Variables**, add:

   | Name | Value |
   | --- | --- |
   | `ANTHROPIC_API_KEY` | Your key from console.anthropic.com |
   | `APP_PASSCODE` | Any long random string. Stops strangers who find your URL from spending your API credit |
   | `ANTHROPIC_MODEL` | *(optional)* defaults to `claude-sonnet-5-5`; `claude-haiku-5-5` is cheaper and faster |
   | `GARMIN_PERSONAL_API_KEY` | *(optional)* see [Garmin](#garmin-optional) |

3. Deploy, then open the URL on your phone:
   - **iPhone (Safari):** Share → **Add to Home Screen**
   - **Android (Chrome):** ⋮ menu → **Install app**
4. In the app, go to **Goals & settings**, enter the same passcode and set your goals.

## Garmin (optional)

Shows your Garmin activities on the day view and adds a MyFitnessPal-style **calorie adjustment** (positive only):

> projected burn = resting burn for the whole day (from the deficit calculator) + Garmin's active calories so far
> adjustment = projected burn − your maintenance (from the deficit calculator), if above zero

Maintenance already assumes your chosen activity level, so workouts aren't counted twice. Fill in the deficit calculator to enable the adjustment.

Setup:
1. Sign in to **Garmin Connect on the web** → Personal API Key → **Create Key**. Accept the terms and pick an expiry. The key is shown once.
2. In Vercel → Settings → Environment Variables, add `GARMIN_PERSONAL_API_KEY` with that key, then redeploy.
3. When the key expires, create a new one and update the variable.

The key stays on the server. The phone only talks to `/api/garmin/day`, which requires your app passcode.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in your key
npm run dev
```

The phone camera only works over HTTPS. To test scanning on your phone before deploying, use `next dev --experimental-https`, or a Vercel preview deploy.

## Notes

- **Your data lives on the phone.** Installing to the home screen protects it from Safari's storage clean-up. Still export a backup now and then.
- **Barcode data** comes from [Open Food Facts](https://openfoodfacts.org) (ODbL). If a product is missing, the app offers Manual or AI instead. Adding missing products in the Open Food Facts app helps everyone.
- **AI estimates are estimates.** They're good for "roughly how much was that", less so for precise tracking. Weighed food plus the label is always better.

## Ideas for next

Stats and trends charts · reflux diary (symptoms against foods and meal times) · saved meals/recipes · cloud sync (Supabase or DynamoDB) · Apple Health / Google Fit via a native wrapper
