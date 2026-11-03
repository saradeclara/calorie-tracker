"use client";

import { useSyncExternalStore } from "react";
import { Icon, cx } from "./ui";

const THEMES = [
  { id: "basil", label: "Basil", swatch: "#1f5c42" },
  { id: "aubergine", label: "Aubergine", swatch: "#43295e" },
  { id: "blueberry", label: "Blueberry", swatch: "#213a63" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

const listeners = new Set<() => void>();
const read = (): ThemeId => (document.documentElement.dataset.theme as ThemeId) || "basil";

function apply(id: ThemeId) {
  if (id === "basil") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = id;
  try {
    if (id === "basil") localStorage.removeItem("theme");
    else localStorage.setItem("theme", id);
  } catch {
    // private mode: the choice just won't stick
  }
  listeners.forEach((l) => l());
}

/** App colour: stored on this device (applied before first paint by the layout script). */
export function ThemePicker() {
  const theme = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => "basil" as ThemeId,
  );
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="App colour">
      {THEMES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={theme === t.id}
          onClick={() => apply(t.id)}
          className={cx(
            "flex flex-col items-center gap-2 rounded-2xl border-2 p-3 text-sm font-medium",
            theme === t.id ? "border-ink" : "border-transparent bg-soft",
          )}
        >
          <span className="grid h-10 w-10 place-items-center rounded-full text-white" style={{ background: t.swatch }}>
            {theme === t.id && <Icon name="check" weight="bold" className="h-5 w-5" />}
          </span>
          {t.label}
        </button>
      ))}
    </div>
  );
}
