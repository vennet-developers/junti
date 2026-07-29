import { Badge } from "@stackmyth/badge";

import type { Copy } from "@/config/copy";
import type { PaymentStatus } from "@/domain/types";

// Badge's `dot` prop discards its children BY DESIGN — a dot is labeled with
// `aria-label`, not text (a library test asserts this). This file once logged
// that as a gap; the entry was withdrawn. `variant` + `soft` carry the status
// because the roster wants the word visible, not a dot at all.
// See STACKMYTH-GAPS.md #3 (withdrawn, kept with correction).

/*
  Every state in this brand is a sticker: same proportions, a lean of −3°, a
  pastel behind dark text. The theme already maps each `--sm-<state>-soft` pair
  onto the kit's own chapita colours, so the variant does the colouring and the
  `junti-chapita` class only adds what a Badge cannot express — the lean.

  Paid is green, and green means nothing else in this product. Owing is the
  orange chapa, NOT red: someone who has not paid yet is not an error, and red
  here is reserved for a rejected field. `junti-chapita--debe` scopes the
  warning pair to the brand orange so `variant="warning"` paints it.

  No charge is the warm grey — a fact about the event, not a state of the
  person.
*/
const STATUS_STICKER = {
  confirmed: { variant: "success", soft: true, extra: "" },
  pending: { variant: "warning", soft: false, extra: " junti-chapita--debe" },
  waived: { variant: "secondary", soft: true, extra: "" },
} as const;

export function PaymentBadge({ status, copy }: { status: PaymentStatus; copy: Copy }) {
  const sticker = STATUS_STICKER[status];

  const label = {
    confirmed: copy.money.paid,
    pending: copy.money.pending,
    waived: copy.money.waived,
  }[status];

  return (
    <Badge
      variant={sticker.variant}
      size="sm"
      soft={sticker.soft}
      className={`junti-chapita${sticker.extra}`}
    >
      {label}
    </Badge>
  );
}
