import { Box, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { CopyButton } from "./copy-button";

export interface LinkPanelProps {
  label: string;
  help: string;
  url: string;
  copyLabel: string;
}

/**
 * Shows one of the two access links with a copy button.
 *
 * The URL is rendered as selectable text as well as a copy button, because on a
 * phone the copy button is the happy path but the visible text is the fallback
 * when the clipboard API is unavailable.
 */
export function LinkPanel({ label, help, url, copyLabel }: LinkPanelProps) {
  return (
    <Stack gap="2">
      <Text weight="semibold">{label}</Text>
      <Text variant="small" color="muted">
        {help}
      </Text>
      <Box
        p="3"
        background="raised"
        border
        borderRadius="var(--sm-radius-md)"
        wordBreak="break-all"
      >
        <Text variant="small" fontFamily="ui-monospace, SFMono-Regular, monospace">
          {url}
        </Text>
      </Box>
      <CopyButton value={url} label={copyLabel} fullWidth />
    </Stack>
  );
}
