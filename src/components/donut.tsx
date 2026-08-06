import type { ReactNode } from "react";

import { donutArc } from "@/domain/chart";

/**
 * One share of a whole, as a ring. Temporary mirror of `@stackmyth/charts`'
 * Donut — same API, same note as `sparkline.tsx`: deleted when the package
 * releases.
 *
 * Takes a single share, not a series, on purpose: multi-segment pies invite
 * comparing angles, which humans are measurably bad at. The center is a slot
 * because the number belongs inside the shape that describes it.
 */
export function Donut({
  share,
  ariaLabel,
  children,
}: {
  /** 0–1. Clamped, never validated — a rounding artifact deserves a full ring, not a crash. */
  share: number;
  ariaLabel: string;
  children?: ReactNode;
}) {
  const { dash } = donutArc(share, 15.5);

  return (
    <span className="junti-donut">
      <svg viewBox="0 0 36 36" role="img" aria-label={ariaLabel}>
        <circle className="junti-donut__track" cx="18" cy="18" r="15.5" />
        <circle
          className="junti-donut__fill"
          cx="18"
          cy="18"
          r="15.5"
          strokeDasharray={dash}
          transform="rotate(-90 18 18)"
        />
      </svg>
      {children ? <span className="junti-donut__center">{children}</span> : null}
    </span>
  );
}
