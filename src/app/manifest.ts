import type { MetadataRoute } from "next";

import { BRAND_DESCRIPTION, BRAND_NAME } from "@/config/brand";

/**
 * The web app manifest — what a phone uses when someone adds Junti to their
 * home screen.
 *
 * Worth having for this product specifically: everyone arrives from a WhatsApp
 * link on a phone, and an organizer who runs the same five-a-side every week
 * has a real reason to keep it one tap away. Without this they get a screenshot
 * of the page as an icon and the browser's own name as the label.
 *
 * `icons` lists WebP before PNG on purpose. A browser walks the array and takes
 * the first entry whose `type` it can decode, so Chrome on Android gets the
 * WebP — less than half the bytes at the same pixels, and losslessly identical,
 * not a re-compression — while anything that cannot decode it falls through to
 * the PNG. Declaring only WebP would be the version of this that breaks
 * silently on whatever cannot read it.
 *
 * The apple-touch-icon is NOT here and stays PNG: iOS reads it from the
 * `apple-icon.png` file convention and does not accept WebP for it.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    /*
      Paper and ink, matching the `themeColor` in the root layout. A launcher
      that flashes white before a cream page is the same rendering-bug feeling
      the browser chrome had.
    */
    background_color: "#faf7f2",
    theme_color: "#faf7f2",
    icons: [
      {
        src: "/brand/junti-favicon-192.webp",
        sizes: "192x192",
        type: "image/webp",
        purpose: "any",
      },
      {
        src: "/brand/junti-favicon-512.webp",
        sizes: "512x512",
        type: "image/webp",
        purpose: "any",
      },
      {
        src: "/brand/junti-favicon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/junti-favicon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
