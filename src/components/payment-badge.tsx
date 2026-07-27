import { Badge } from "@stackmyth/badge";

import { copy } from "@/config/copy";
import type { PaymentStatus } from "@/domain/types";

// STACKMYTH-GAP: Badge's `dot` prop discards its children — <Badge dot>Pagó</Badge>
// renders an empty span with no warning, even though BadgeProps accepts
// children next to it. The status is carried by `variant` + `soft` instead.
// See STACKMYTH-GAPS.md #3.

const STATUS_VARIANT = {
  confirmed: { variant: "success", soft: false, label: copy.money.paid },
  pending: { variant: "warning", soft: true, label: copy.money.pending },
  waived: { variant: "secondary", soft: true, label: copy.money.waived },
} as const;

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const config = STATUS_VARIANT[status];

  return (
    <Badge variant={config.variant} size="sm" soft={config.soft}>
      {config.label}
    </Badge>
  );
}
