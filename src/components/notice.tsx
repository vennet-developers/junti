import type { ReactNode } from "react";

import { Card, CardContent } from "@stackmyth/card";
import { InfoIcon, TriangleAlertIcon } from "@stackmyth/icons";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

// STACKMYTH-GAP: @stackmyth/alert renders role="alert" + aria-live="assertive"
// unconditionally. That is right for a message produced in response to an
// action, but wrong for a notice that is simply part of the page on arrival —
// assertive live regions interrupt a screen reader mid-sentence. There is no
// `live` prop to soften it, so static notices are composed from Card + icon
// instead. Alert is still used where a message really is a response.
// See STACKMYTH-GAPS.md #6.

// STACKMYTH-GAP: Card's `tone` prop is not usable here either. It sets a
// saturated fill (--sm-card-bg: var(--sm-info)) plus a matching text color via
// --sm-card-text, but that variable loses to any nested <Text color="…">, so
// the standard muted body style lands unreadable on the tinted background.
// There is no soft/tinted tone that composes safely with Text's own colors, so
// the card stays neutral and the tone is carried by the icon alone.
// See STACKMYTH-GAPS.md #9.

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
            Box supplies flexShrink (Text has no LayoutProps) so the icon keeps
            its width when the title wraps at 390px; Text supplies the color.

            The color comes from Text's own semantic set rather than a --sm-*
            token on purpose. `--sm-<status>-text` is the color to use ON TOP OF
            the matching `--sm-<status>` fill, not an accent for the page
            surface: in the default theme `--sm-info-text` is #fff, so an icon
            painted with it is invisible here. See STACKMYTH-GAPS.md #9.
          */}
          <Box flexShrink={0}>
            <Text as="span" color={tone === "warning" ? "error" : "muted"}>
              <Icon size={18} aria-hidden="true" />
            </Text>
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
