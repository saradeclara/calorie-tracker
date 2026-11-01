"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { buildFoodIndex } from "./foods";

/** Live index of the food database: lookups by id, and trigger matching. */
export function useFoodIndex() {
  const foods = useLiveQuery(() => db.foods.toArray(), []);
  return useMemo(() => buildFoodIndex(foods ?? []), [foods]);
}
