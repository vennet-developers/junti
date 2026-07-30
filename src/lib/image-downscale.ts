/**
 * Shrinks a photo in the browser before it is ever uploaded.
 *
 * A screenshot of a banking app off a modern phone is 1–3 MB. What the
 * organizer needs to read off it — an amount, a date, a reference — survives
 * 1400px and quality 0.8 completely, at a fraction of the size. So the resizing
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
  | { ok: true; blob: Blob; width: number; height: number; mime: string }
  | { ok: false; reason: DownscaleFailure };

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

/**
 * Whether this browser can actually ENCODE WebP from a canvas.
 *
 * Decoding and encoding are different capabilities, and the test has to be for
 * encoding. It also cannot be skipped: `toBlob` does not fail on a format it
 * does not support, it quietly gives you PNG instead — which for a photograph
 * is several times LARGER than the JPEG we would have got. A silent fallback to
 * a worse format is the one outcome worth writing code to avoid.
 *
 * `toDataURL` reports the format it actually produced, so a 1px canvas answers
 * the question for the price of one allocation. Memoised: the answer cannot
 * change while the page is open.
 */
let webpEncodable: boolean | null = null;

function canEncodeWebp(): boolean {
  if (webpEncodable !== null) return webpEncodable;

  try {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    webpEncodable = probe.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpEncodable = false;
  }

  return webpEncodable;
}

/** The format receipts are stored and served in, per browser. */
export function evidenceMimeType(): "image/webp" | "image/jpeg" {
  return canEncodeWebp() ? "image/webp" : "image/jpeg";
}

function toBlob(canvas: HTMLCanvasElement, quality: number, mime: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

/**
 * Returns one image under `TARGET_BYTES`, or explains why it could not.
 *
 * WebP where the browser can encode it, JPEG everywhere else. WebP carries the
 * same receipt in meaningfully fewer bytes, and every one of those bytes is paid
 * for three times here: uploaded over mobile data by someone standing outside a
 * pitch, stored as a row in Postgres — which is only defensible because the size
 * is predictable — and downloaded again by the organizer.
 *
 * The server needs no change for this: `evidence-store.ts` already sniffs the
 * RIFF/WEBP magic bytes and serves the matching content type.
 *
 * Always re-encodes, even when the input was already small: a PNG screenshot of
 * a receipt is usually larger than the same thing re-encoded, and one output
 * format per browser means one thing to sniff and one thing to serve.
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

  const mime = evidenceMimeType();

  let quality = INITIAL_QUALITY;
  let blob = await toBlob(canvas, quality, mime);

  while (blob && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.12);
    blob = await toBlob(canvas, quality, mime);
  }

  if (!blob) return { ok: false, reason: "unsupported" };

  return { ok: true, blob, width, height, mime };
}
