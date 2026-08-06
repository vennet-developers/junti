import { segmentGeometry } from "@/domain/chart";

/**
 * The honest pie: parts of a whole as lengths on a shared baseline, which is
 * the comparison humans judge best. Temporary mirror of `@stackmyth/charts`'
 * SegmentBar; colors here are Junti's own semantic attendance tokens rather
 * than the package's categorical palette, because "van" HAS a color in this
 * product and inventing a second one would make the dashboard disagree with
 * the roster.
 */
export function SegmentBar({
  parts,
  ariaLabel,
}: {
  parts: readonly { label: string; value: number; token: string }[];
  ariaLabel: string;
}) {
  const segments = segmentGeometry(
    parts.map((part) => part.value),
    { width: 520, gap: 4, minWidth: 8 },
  );
  if (segments.length === 0) return null;

  return (
    <div className="junti-segments">
      <svg viewBox="0 0 520 28" width="100%" role="img" aria-label={ariaLabel} className="junti-segments__bar">
        {segments.map((segment) => (
          <rect
            key={segment.index}
            x={segment.x}
            y="0"
            width={segment.width}
            height="28"
            rx="6"
            fill={parts[segment.index].token}
          />
        ))}
      </svg>
      <ul className="junti-segments__legend">
        {segments.map((segment) => (
          <li key={segment.index} className="junti-segments__item">
            <span className="junti-segments__swatch" style={undefined} aria-hidden="true">
              <svg viewBox="0 0 10 10" width="10" height="10">
                <rect width="10" height="10" rx="3" fill={parts[segment.index].token} />
              </svg>
            </span>
            <span className="junti-segments__name">{parts[segment.index].label}</span>
            <span className="junti-segments__value">{parts[segment.index].value.toLocaleString("es-CO")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
