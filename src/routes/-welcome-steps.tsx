"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Link, useRouter } from "@tanstack/react-router";

import { useCopy } from "@/components/copy-provider";
import { ROUTES } from "@/config/routes";
import { trackClient } from "@/lib/track-client";

import { finishWelcomeFn } from "./-welcome-fns";

/**
 * Three screens and two ways out of every one of them.
 *
 * **Skippable at every step**, which the card calls for and which is also the
 * only honest shape: this content is optional by definition, and a screen that
 * makes you read three things before letting you leave has decided its own
 * importance on the reader's behalf.
 *
 * Both exits — finishing and skipping — record the same thing. The card asks
 * that skipping be "neither penalized nor re-prompted", and one timestamp for
 * both outcomes is what makes a future difference in treatment impossible
 * rather than merely unintended.
 */
export function WelcomeSteps() {
  const { copy } = useCopy();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [, startTransition] = useTransition();

  const steps = copy.welcome.steps;
  const isLast = step === steps.length - 1;

  useEffect(() => {
    trackClient("welcome_step_viewed", { step: step + 1 });
  }, [step]);

  /**
   * Records that this account has seen it, then goes wherever they chose.
   *
   * Fire-and-forget on the navigation: the write matters, but somebody
   * pressing "create my first event" should not wait on it — and if it fails,
   * the worst case is the prompt appearing once more on an empty agenda.
   */
  function finish(destination: string, skipped: boolean) {
    startTransition(async () => {
      await finishWelcomeFn({ data: { step: step + 1, skipped } }).catch(() => {});
      await router.navigate({ href: destination });
    });
  }

  const current = steps[step];

  return (
    <Stack gap="5">
      {/* Position, without a clickable stepper: three screens read in order
          do not need navigation, and a control that can skip ahead makes the
          order a suggestion. */}
      <Flex gap="2" align="center" aria-hidden="true">
        {steps.map((_, index) => (
          <Box
            key={index}
            height="0.25rem"
            width="100%"
            borderRadius="var(--sm-radius-sm)"
            className={index <= step ? "junti-wizard-dot--on" : "junti-wizard-dot"}
          />
        ))}
      </Flex>

      <Card surface="outlined">
        <CardContent>
          <Stack gap="3">
            <Text as="h2" variant="h4" fontFamily="var(--junti-display)">
              {current.heading}
            </Text>
            <Text color="muted">{current.body}</Text>
          </Stack>
        </CardContent>
      </Card>

      <Stack gap="3">
        <Box width="100%" maxWidth={{ base: "100%", md: "22rem" }}>
          {isLast ? (
            <Button
              type="button"
              size="lg"
              variant="primary"
              fullWidth
              onClick={() => finish(ROUTES.newEvent, false)}
            >
              {copy.welcome.finish}
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              variant="primary"
              fullWidth
              onClick={() => setStep((n) => n + 1)}
            >
              {copy.welcome.next}
            </Button>
          )}
        </Box>

        <Flex gap="3" align="center" wrap="wrap">
          {step > 0 ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setStep((n) => n - 1)}>
              {copy.welcome.back}
            </Button>
          ) : null}

          {/*
            The way out, on every screen including the last. On the last it
            says "not now" rather than "skip", because by then there is nothing
            left to skip — the choice is whether to make an event, and "skip"
            would be describing the wrong thing.
          */}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => finish(ROUTES.myEvents, true)}
          >
            {isLast ? copy.welcome.finishSecondary : copy.welcome.skip}
          </Button>
        </Flex>
      </Stack>

      {/* A way back to the agenda that is not a decision. Somebody who lands
          here by accident should not have to answer anything. */}
      <Box>
        <Text variant="small" color="muted">
          <Link to={ROUTES.myEvents}>{copy.auth.myEventsLink}</Link>
        </Text>
      </Box>
    </Stack>
  );
}
