import type { ReactNode } from "react";

import { Card, CardContent } from "@stackmyth/card";
import { InfoIcon, TriangleAlertIcon } from "@stackmyth/icons";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

// STACKMYTH-GAP: @stackmyth/alert renders role="alert" + aria-live="assertive"
// unconditionally. That is right for a message produced in response to an
// action, but wrong for a notice that is simply part of the page on arrival —
// assertive live regions interrupt a screen reader mid-sentence. There is no
// `live` prop to soften it, so static notices are composed from Card + icon
// instead. Alert is still used where a message really is a response.
// See STACKMYTH-GAPS.md #6.

export interface NoticeProps {
  tone?: "info" | "warning";
  title: string;
  children?: ReactNode;
}

export function Notice({ tone = "info", title, children }: NoticeProps) {
  const Icon = tone === "warning" ? TriangleAlertIcon : InfoIcon;

  return (
    <Card surface="outlined" tone={tone === "warning" ? "warning" : "info"}>
      <CardContent>
        <Flex gap="3" align="start">
          <Text as="span" color="muted" aria-hidden="true">
            <Icon size={18} />
          </Text>
          <Stack gap="1">
            <Text weight="semibold">{title}</Text>
            {children ? (
              <Text variant="small" color="muted">
                {children}
              </Text>
            ) : null}
          </Stack>
        </Flex>
      </CardContent>
    </Card>
  );
}
