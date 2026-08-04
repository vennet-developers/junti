import { BRAND_NAME } from "@/config/brand";

/**
 * "`<page> · Junti`" — what Next's title template (`%s · Junti`) produced.
 *
 * TanStack's `head()` has no template concept: each route owns its whole
 * title. Routing every title through this helper is the template said as a
 * function, and the exceptions stay exceptions on purpose: the landing keeps
 * its absolute marketing title, and the root's fallback carries the tagline.
 */
export function pageTitle(title: string | undefined): string | undefined {
  return title ? `${title} · ${BRAND_NAME}` : undefined;
}
