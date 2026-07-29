import type { ReactNode } from "react";

import { Card, CardContent } from "@stackmyth/card";
import { InfoIcon, TriangleAlertIcon } from "@stackmyth/icons";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

// This is NOT a gap any more, and the distinction is worth keeping.
//
// `Alert` used to be an assertive live region unconditionally, which is right
// for a message produced by an action and wrong for a notice that is part of
// the page on arrival — assertive regions interrupt a screen reader
// mid-sentence. `live` landed in 0.20.0 and fixed that (STACKMYTH-GAPS.md #6).
//
// This component stays composed from Card + icon by CHOICE. `<Alert live="off">`
// would now work, but a static notice and a toast are different things, and
// building the static one out of the alert component invites the next person to
// reach for `Alert` when they mean "say this quietly".

// Card's `tone` prop is still avoided here: it sets a saturated fill whose
// text color loses to any nested <Text color="…">, so the standard muted body
// style lands unreadable on the tinted background. The card stays neutral and
// the tone is carried by the icon alone — which since 0.22.0 has a token made
// for exactly this: `--sm-<state>-accent`, the state hue safe on the default
// surface. See STACKMYTH-GAPS.md #9.

export interface NoticeProps {
  tone?: "info" | "warning";
  title: string;
  children?: ReactNode;
}

export function Notice({ tone = "info", title, children }: NoticeProps) {
  const Icon = tone === "warning" ? TriangleAlertIcon : InfoIcon;

  return (
    <Card surface="outlined">
      <CardContent>
        <Flex gap="3" align="start">
          {/*
            flexShrink keeps the icon's width when the title wraps at 390px.
            The color is the on-surface state accent added in 0.22.0 — the
            first token in the set that means "this state's hue, readable on
            the default surface". Its on-fill sibling `--sm-<state>-text` is
            what an earlier version of this file reached for, and it rendered
            an invisible white icon; the history is in STACKMYTH-GAPS.md #9.
          */}
          <Box
            flexShrink={0}
            color={tone === "warning" ? "var(--sm-warning-accent)" : "var(--sm-info-accent)"}
          >
            <Icon size={18} aria-hidden="true" />
          </Box>
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
