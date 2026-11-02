"use client";

/**
 * Shrink a photo/screenshot before upload. Kept light on memory for iOS, which kills a
 * home-screen app that holds too much canvas/image memory:
 * - decode with createImageBitmap when available (and close it straight after)
 * - release the canvas backing store explicitly once the data URL is taken
 */
export async function resizeImage(file: File, max = 1024, quality = 0.82): Promise<string> {
  let source: ImageBitmap | HTMLImageElement;
  let url: string | null = null;
  try {
    source = await createImageBitmap(file);
  } catch {
    url = URL.createObjectURL(file);
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Couldn't read that image. Try a screenshot or a JPEG/PNG photo."));
      i.src = url!;
    });
  }
  const canvas = document.createElement("canvas");
  try {
    const w = source.width;
    const h = source.height;
    const ratio = Math.min(1, max / Math.max(w, h));
    canvas.width = Math.max(1, Math.round(w * ratio));
    canvas.height = Math.max(1, Math.round(h * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your phone couldn't process that image (out of memory). Close other apps and try again.");
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    if ("close" in source) source.close();
    else source.src = "";
    if (url) URL.revokeObjectURL(url);
    // iOS keeps canvas memory until GC unless the canvas is shrunk.
    canvas.width = 0;
    canvas.height = 0;
  }
}
