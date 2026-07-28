import { Badge } from "@stackmyth/badge";

import type { Copy } from "@/config/copy";
import type { PaymentStatus } from "@/domain/types";

// Badge's `dot` prop discards its children BY DESIGN — a dot is labeled with
// `aria-label`, not text (a library test asserts this). This file once logged
// that as a gap; the entry was withdrawn. `variant` + `soft` carry the status
// because the roster wants the word visible, not a dot at all.
// See STACKMYTH-GAPS.md #3 (withdrawn, kept with correction).

const STATUS_VARIANT = {
  confirmed: { variant: "success", soft: false },
  pending: { variant: "warning", soft: true },
  waived: { variant: "secondary", soft: true },
} as const;

export function PaymentBadge({ status, copy }: { status: PaymentStatus; copy: Copy }) {
  const config = STATUS_VARIANT[status];

  const label = {
    confirmed: copy.money.paid,
    pending: copy.money.pending,
    waived: copy.money.waived,
  }[status];

  return (
    <Badge variant={config.variant} size="sm" soft={config.soft}>
      {label}
    </Badge>
  );
}
