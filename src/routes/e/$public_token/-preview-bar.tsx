import { Banner } from "@stackmyth/banner";
import { Button } from "@stackmyth/button";
import { EyeIcon } from "@stackmyth/icons";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { Link } from "@/components/link";
import type { Copy } from "@/config/copy";
import { PREVIEW_MODES, type PreviewMode } from "@/domain/preview";
import { participantPath } from "@/lib/paths";

interface Props {
  mode: PreviewMode;
  publicToken: string;
  copy: Copy;
}

/**
 * The bar that says whose eyes you are using.
 *
 * Blunt on purpose, and at the very top. The page underneath is missing things
 * the reader owns — their answer, what they owe, sometimes the roster itself —
 * and an organizer who has forgotten they are in a preview will read that as
 * the app having broken. So this is the first thing on the page, above even the
 * cancellation notice, and the way out is a button rather than a back-gesture
 * somebody has to guess at.
 *
 * The two modes are links and not a toggle: they are two different pages two
 * different people land on, and a toggle implies one thing with a setting.
 * Each is a real URL, so it survives a bookmark and a reload. The current one
 * stays visible as a disabled button rather than disappearing — a control that
 * vanishes when you use it makes the pair hard to find again.
 */
export function PreviewBar({ mode, publicToken, copy }: Props) {
  const strings = copy.event.preview;
  const path = participantPath(publicToken);
  const label: Record<PreviewMode, string> = {
    guest: strings.asGuest,
    stranger: strings.asStranger,
  };

  return (
    <Banner
      variant="info"
      /*
        Announced, unlike every other banner on this page.

        The others are part of the page on arrival, which is what `live="off"`
        is for. This one appears *because the reader just pressed something*,
        and it changes what everything below it means — the case a live region
        exists for.
      */
      live="polite"
      icon={<EyeIcon size={18} aria-hidden="true" />}
      title={strings.title}
    >
      <Stack gap="3">
        <Stack gap="1">
          <Text variant="small">
            {mode === "guest" ? strings.guestBody : strings.strangerBody}
          </Text>

          {/* Only for the mode that has something to press. A stranger gets a
              sign-in card and nothing that could commit them to anything. */}
          {mode === "guest" ? (
            <Text variant="small" weight="medium">
              {strings.guestWarning}
            </Text>
          ) : null}
        </Stack>

        <Flex gap="2" wrap="wrap" align="center">
          {PREVIEW_MODES.map((option) =>
            option === mode ? (
              <Button key={option} size="sm" variant="secondary" disabled>
                {label[option]}
              </Button>
            ) : (
              <Button key={option} asChild size="sm" variant="secondary">
                <Link href={path} search={{ as: option }}>
                  {label[option]}
                </Link>
              </Button>
            ),
          )}

          {/* Its own end of the row: leaving is a different kind of act from
              switching between two previews, and sitting beside them it read
              as a third mode. */}
          <Flex flexGrow={1} justify="end">
            <Button asChild size="sm">
              {/* Undefined rather than absent: an omitted key would leave the
                  current `?as=` in place, so the button would do nothing. */}
              <Link href={path} search={{ as: undefined }}>
                {strings.exit}
              </Link>
            </Button>
          </Flex>
        </Flex>
      </Stack>
    </Banner>
  );
}
