"use client";

import { useState, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { useFormContext } from "@stackmyth/form";
import { Card, CardContent } from "@stackmyth/card";
import { GoogleIcon } from "@stackmyth/icons";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";
import { PersonAvatar } from "@/components/person-avatar";
import { ROUTES, signInPath } from "@/config/routes";
import { saveDraft } from "@/lib/event-draft";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Who the event about to be created will belong to.
 *
 * It sits at the top of the form because attribution **cannot be fixed
 * afterwards**: an event created signed out has no owner, forever, and the only
 * moment that decision is visible is before the create button is pressed. The
 * page used to say nothing at all, so a session that had quietly expired
 * produced an unattributed event and no way to tell until it failed to appear
 * in My events.
 *
 * Signing out is never suggested here, and creating without an account stays
 * one tap away — the anonymous flow is the original product, not a degraded
 * one.
 */
export function SignInPill({
  organizer,
}: {
  organizer: { displayName: string; avatarUrl: string | null } | null;
}) {
  const { copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);

  // Reached through context rather than a prop, because `store` is not one of
  // FormController's render props — any child can ask for it, and this one is
  // rendered inside the form precisely so it can.
  const form = useFormContext();

  /**
   * Park the half-typed form before leaving.
   *
   * Signing in with Google is a navigation to another origin and back, so
   * without this the pill offering attribution would cost you the event you
   * were describing.
   */
  function parkDraft() {
    const values = form?.store.getValues();
    if (values) saveDraft(values);
  }

  if (organizer) {
    return (
      <Card surface="outlined">
        <CardContent>
          <Flex gap="3" align="center">
            <Box flexShrink={0}>
              <PersonAvatar src={organizer.avatarUrl} name={organizer.displayName} size="sm" />
            </Box>
            <Stack gap="0" minWidth="0">
              <Text variant="small" weight="semibold">
                {copy.createEvent.attributionSignedIn(organizer.displayName)}
              </Text>
              <Text variant="small" color="muted">
                {copy.createEvent.attributionSignedInHelp}
              </Text>
            </Stack>
          </Flex>
        </CardContent>
      </Card>
    );
  }

  if (dismissed) return null;

  function signInWithGoogle() {
    parkDraft();

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        // Straight back to the form, where the draft is waiting.
        options: {
          redirectTo: `${window.location.origin}${ROUTES.authCallback}?next=${encodeURIComponent(ROUTES.newEvent)}`,
        },
      });
    });
  }

  return (
    <Card surface="outlined">
      <CardContent>
        <Stack gap="3">
          <Stack gap="1">
            <Text weight="semibold">{copy.createEvent.attributionAnonTitle}</Text>
            <Text variant="small" color="muted">
              {copy.createEvent.attributionAnonHelp}
            </Text>
          </Stack>

          <Button type="button" size="md" fullWidth onClick={signInWithGoogle} disabled={pending}>
            <GoogleIcon size={18} />
            {copy.auth.google}
          </Button>

          <Button asChild size="md" variant="secondary" fullWidth onClick={parkDraft}>
            {/* Box(as="a") so `asChild` clones a Stackmyth primitive. A full
                navigation rather than next/link: the draft is written on click
                and a client transition could outrun it. */}
            <Box as="a" href={signInPath(ROUTES.newEvent)}>
              {copy.auth.emailSubmit}
            </Box>
          </Button>

          <Button type="button" size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            {copy.createEvent.attributionContinueAnon}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
