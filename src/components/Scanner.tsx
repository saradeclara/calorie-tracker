"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "./ui";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

async function createDetector(): Promise<Detector> {
  // Native API on Android Chrome; WASM ponyfill (ZXing) on iPhone and elsewhere.
  const Native = (globalThis as { BarcodeDetector?: { new (o: object): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
  if (Native?.getSupportedFormats) {
    const supported = await Native.getSupportedFormats();
    if (FORMATS.every((f) => supported.includes(f))) return new Native({ formats: FORMATS });
  }
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  // Serve the decoder from our own origin (copied into /public at build time),
  // so scanning doesn't depend on a CDN and works offline.
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? `/${path}` : prefix + path,
    },
  });
  return new BarcodeDetector({ formats: FORMATS as never }) as unknown as Detector;
}

/**
 * Live camera barcode scanner. Calls onDetected once with a code that's been
 * read twice in a row (cuts down on misreads).
 */
export function Scanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [error, setError] = useState("");
  const doneRef = useRef(false);
  const callbackRef = useRef(onDetected);
  useEffect(() => {
    callbackRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let cancelled = false;
    let last = "";

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera isn't available here. Open the app over HTTPS, or type the barcode below.");
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const detector = await createDetector();
        if (cancelled) return;
        setStatus("scanning");

        const tick = async () => {
          if (cancelled || doneRef.current) return;
          try {
            if (video.readyState >= 2) {
              const codes = await detector.detect(video);
              const value = codes[0]?.rawValue;
              if (value) {
                if (value === last) {
                  doneRef.current = true;
                  navigator.vibrate?.(40);
                  callbackRef.current(value);
                  return;
                }
                last = value;
              }
            }
          } catch {
            // transient decode errors are fine
          }
          timer = window.setTimeout(tick, 150);
        };
        tick();
      } catch (e) {
        if (cancelled) return;
        const err = e as Error & { name?: string };
        setStatus("error");
        setError(
          err.name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access for this app in your browser settings, or type the barcode below."
            : err.message || "Couldn't start the camera.",
        );
      }
    })();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
      {status === "scanning" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-[38%] w-[78%] rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          <p className="absolute bottom-3 text-sm font-medium text-white/90">Line the barcode up in the box</p>
        </div>
      )}
      {status === "starting" && (
        <div className="absolute inset-0 grid place-items-center text-white">
          <Spinner />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/90">{error}</div>
      )}
    </div>
  );
}
