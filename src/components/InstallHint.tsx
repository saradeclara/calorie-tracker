"use client";

import { useEffect, useState } from "react";
import { getSetting, setSetting } from "@/lib/db";
import { Icon } from "./ui";

/** One-time nudge to add the app to the home screen (keeps data safer on iPhone). */
export function InstallHint() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      // Installed: ask the browser to keep our storage.
      navigator.storage?.persist?.().catch(() => {});
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only check after hydration
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    getSetting("installHintDismissed", false).then((d) => setShow(!d));
  }, []);

  if (!show) return null;
  return (
    <div className="flex items-start gap-3 rounded-3xl bg-ink p-4 text-bg">
      <div className="flex-1 text-sm">
        <p className="font-semibold">Install on your home screen</p>
        <p className="mt-0.5 opacity-80">
          {ios
            ? "Tap the Share button in Safari, then “Add to Home Screen”."
            : "Open your browser menu and choose “Install app” or “Add to Home screen”."}{" "}
          It opens full-screen and keeps your data safer.
        </p>
      </div>
      <button
        onClick={() => {
          setShow(false);
          setSetting("installHintDismissed", true);
        }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bg/15"
        aria-label="Dismiss"
      >
        <Icon name="close" className="h-4 w-4" />
      </button>
    </div>
  );
}
