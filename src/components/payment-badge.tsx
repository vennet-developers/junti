import { Badge } from "@stackmyth/badge";

import type { Copy } from "@/config/copy";
import type { PaymentStatus } from "@/domain/types";

// STACKMYTH-GAP: Badge's `dot` prop discards its children — <Badge dot>Pagó</Badge>
// renders an empty span with no warning, even though BadgeProps accepts
// children next to it. The status is carried by `variant` + `soft` instead.
// See STACKMYTH-GAPS.md #3.

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
