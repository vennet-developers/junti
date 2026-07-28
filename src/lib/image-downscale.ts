/**
 * Shrinks a photo in the browser before it is ever uploaded.
 *
 * A screenshot of a banking app off a modern phone is 1–3 MB. What the
 * organizer needs to read off it — an amount, a date, a reference — survives
 * 1400px and JPEG quality 0.8 completely, at 100–200 KB. So the resizing
 * happens here rather than server-side, which:
 *
 * - keeps the upload fast on mobile data, where this will mostly happen;
 * - keeps the stored size predictable, which is what makes putting images in
 *   Postgres defensible at all (see `evidence-store.ts`);
 * - needs no image library on the server, and `sharp` is explicitly not
 *   installed.
 *
 * Client only — depends on `Image`, `canvas` and `createObjectURL`.
 */

/**
 * What the file input offers, and the same three formats the server sniffs for.
 *
 * Lives here rather than beside the server-side cap because `evidence-store.ts`
 * is `server-only` and a client component importing from it fails the build.
 */
export const EVIDENCE_ACCEPT = "image/jpeg,image/png,image/webp";

const MAX_EDGE = 1400;
const INITIAL_QUALITY = 0.82;
const MIN_QUALITY = 0.5;

/** Comfortably under the server's cap, leaving room for the backstop to be a backstop. */
const TARGET_BYTES = 300_000;

export type DownscaleFailure = "unreadable" | "unsupported";

export type DownscaleResult =
  { ok: true; blob: Blob; width: number; height: number } | { ok: false; reason: DownscaleFailure };

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      // The bitmap is decoded and owned by the element now; the URL is not
      // needed and would otherwise be held for the life of the document.
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };

    image.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

/**
 * Returns a JPEG under `TARGET_BYTES`, or explains why it could not.
 *
 * Always re-encodes as JPEG, even when the input was already small: a PNG
 * screenshot of a receipt is often larger than the JPEG of the same thing, and
 * one output format means one thing to sniff and one thing to serve.
 *
 * Quality steps down until the size is met. Dimensions are not reduced further
 * — below 1400px the text on a receipt starts to go, and an unreadable receipt
 * defeats the point of collecting it.
 */
export async function downscaleImage(file: File): Promise<DownscaleResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, reason: "unsupported" };
  }

  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch {
    return { ok: false, reason: "unreadable" };
  }

  const { naturalWidth: sourceWidth, naturalHeight: sourceHeight } = image;

  if (sourceWidth === 0 || sourceHeight === 0) {
    return { ok: false, reason: "unreadable" };
  }

  // Only ever scale down. Enlarging a small photo would add bytes and no detail.
  const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return { ok: false, reason: "unsupported" };

  // White underneath, because a transparent PNG flattened onto nothing comes
  // out with black where the paper should be.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let quality = INITIAL_QUALITY;
  let blob = await toBlob(canvas, quality);

  while (blob && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.12);
    blob = await toBlob(canvas, quality);
  }

  if (!blob) return { ok: false, reason: "unsupported" };

  return { ok: true, blob, width, height };
}
