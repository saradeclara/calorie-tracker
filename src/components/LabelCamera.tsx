"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "./ui";

/**
 * Live camera for nutrition tables. Grabs a single frame from the video (no photo picker,
 * no full-resolution photo in memory) and stops the camera before handing it over.
 */
export function LabelCamera({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "error">("starting");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera isn't available here (the app needs HTTPS).");
        // Ask for as much resolution as the camera offers: small print needs it.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        const err = e as Error & { name?: string };
        setStatus("error");
        setError(
          err.name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access for this app in your phone's settings."
            : err.message || "Couldn't start the camera.",
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const max = 1600;
    const ratio = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * ratio);
    canvas.height = Math.round(video.videoHeight * ratio);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.88);
    canvas.width = canvas.height = 0; // release memory straight away (iOS)
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    navigator.vibrate?.(30);
    onCapture(data);
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
        {status === "ready" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-[72%] w-[86%] rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]" />
            <p className="absolute bottom-3 px-4 text-center text-sm font-medium text-white/90">
              Fill the frame with the nutrition table
            </p>
          </div>
        )}
        {status === "starting" && (
          <div className="absolute inset-0 grid place-items-center text-white">
            <Spinner />
          </div>
        )}
        {status === "error" && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/90">{error}</div>}
      </div>
      <button
        type="button"
        onClick={capture}
        disabled={status !== "ready"}
        aria-label="Capture"
        className="mx-auto grid h-16 w-16 place-items-center rounded-full border-4 border-brand/20 bg-brand text-on-brand disabled:opacity-30"
      >
        <span className="h-11 w-11 rounded-full border-2 border-bg" />
      </button>
    </div>
  );
}
