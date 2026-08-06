import { smoothAreaPath } from "@/domain/chart";

/**
 * A trend compressed into the corner of a card.
 *
 * **A temporary mirror of `@stackmyth/charts`' Sparkline, same API by
 * construction.** The component now lives in Stackmyth (commit 9940329a, on
 * the grouped track) but is unreleased; when the next grouped version ships,
 * this file is deleted and the import moves — nothing else changes.
 *
 * Deliberately axis-less: a sparkline shows SHAPE and the number beside it
 * shows magnitude. For that same reason — and unlike the bars — it scales
 * between min and max, because a flat-ish series still has a shape worth
 * seeing and a zero baseline would iron it out.
 */
export function Sparkline({
  values,
  ariaLabel,
}: {
  values: readonly number[];
  ariaLabel: string;
}) {
  const { line, area } = smoothAreaPath(values, { width: 120, height: 36 });
  if (line === "") return null;

  return (
    <svg
      viewBox="0 0 120 36"
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
      className="junti-sparkline"
    >
      <path className="junti-sparkline__area" d={area} />
      <path className="junti-sparkline__line" d={line} />
    </svg>
  );
}
