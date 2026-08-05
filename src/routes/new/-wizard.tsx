"use client";

import { useEffect, useRef } from "react";

import { Button } from "@stackmyth/button";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";
import { WIZARD_STEPS, type WizardStep } from "@/domain/wizard";
import { trackClient } from "@/lib/track-client";

/**
 * The three screens of the create form, and the controls between them.
 *
 * Split out of the form itself because the form is already long and these are
 * a different kind of thing: the form knows about fields, this knows about
 * order. Everything here lives inside `<Form>`, so `useFormContext` reaches
 * the same store the fields write to.
 */

/**
 * One step's fields — hidden rather than unmounted.
 *
 * `FormController` holds values in a store, so unmounting would not lose them.
 * What it would lose is DOM state: a date picker left half open, a cursor
 * position, the scroll inside a long textarea. Coming back to a step should be
 * where you left it, not a re-render of it.
 *
 * `hidden` rather than `display: none` on purpose: it takes the fields out of
 * the tab order and out of the accessibility tree, which a CSS rule alone does
 * not. A screen reader must not walk into step 3 from step 1.
 */
export function StepPanel({ active, children }: { active: boolean; children: React.ReactNode }) {
  /*
    The tree shape must NOT depend on `active`.

    This wrapped the children in a `Stack` only when the step was showing, and
    that one conditional cost an afternoon: React compares element types by
    position, so flipping between `<Stack>{fields}</Stack>` and bare `{fields}`
    unmounts and remounts every input in the step. The store kept its values —
    the DOM did not — so leaving a step and coming back showed an empty form
    with the right data behind it. AC-3 failing while every other signal said
    it worked.
  */
  return (
    <Box hidden={!active} aria-hidden={!active}>
      <Stack gap="5">{children}</Stack>
    </Box>
  );
}

/**
 * Where you are, in three dots and a line of text.
 *
 * Not a clickable stepper. Jumping to step 3 from step 1 skips the validation
 * that makes the steps mean anything, and a control that is sometimes allowed
 * and sometimes not is worse than one that is never there.
 */
export function WizardProgress({ step, total }: { step: WizardStep; total: number }) {
  const { copy } = useCopy();

  // Only the steps this event actually has. A free event is two steps long and
  // the bar says two — a third segment that never fills reads as something
  // that went wrong.
  const shown = WIZARD_STEPS.slice(0, total);

  return (
    <Stack gap="2">
      <Flex gap="2" align="center" aria-hidden="true">
        {shown.map((n) => (
          // `Box background` takes named surfaces, not colours. The filled
          // segment borrows the Progress component's own token so the bar
          // matches every other progress indicator in the app.
          <Box
            key={n}
            height="0.25rem"
            width="100%"
            borderRadius="var(--sm-radius-sm)"
            className={n <= step ? "junti-wizard-dot--on" : "junti-wizard-dot"}
          />
        ))}
      </Flex>

      <Text variant="small" color="muted">
        {copy.createEvent.wizard.progress(step, total)} ·{" "}
        {copy.createEvent.wizard.stepTitle[step]}
      </Text>
    </Stack>
  );
}

/**
 * Back, and forward.
 *
 * The advance control is the last thing in the DOM and the only primary
 * button on screen, which is AC-8's real requirement: on a 375px viewport the
 * thing you press next has to be reachable without scrolling past content you
 * have already dealt with.
 */
export function WizardNav({
  step,
  pending,
  freeEvent,
  onBack,
}: {
  step: WizardStep;
  pending: boolean;
  /** No money on this event, so step 3 has nothing to ask. */
  freeEvent: boolean;
  onBack: () => void;
}) {
  const { copy } = useCopy();

  /*
    The last step is 3, but an event with no cost has nothing to fill in there
    — so the button on step 2 says "create" rather than "next" and submits.
    AC-1 calls step 3 skippable; this is what skippable means in practice,
    rather than hiding a step and renumbering the other two.
  */
  const submits = step === 3 || (step === 2 && freeEvent);

  return (
    <Stack gap="3">
      <Box width="100%" maxWidth={{ base: "100%", md: "22rem" }}>
        {/* Always a submit. Advancing and creating both go through the form's
            own validation — that is what puts the errors inline beside each
            field instead of in a summary this component would have to invent. */}
        <Button type="submit" size="lg" variant="primary" fullWidth disabled={pending}>
          {pending
            ? copy.createEvent.submitting
            : submits
              ? copy.createEvent.submit
              : copy.createEvent.wizard.next}
        </Button>
      </Box>

      {/* `outline`, not `ghost`. A ghost button under a filled primary reads
          as a caption rather than a control — it was there and nobody could
          see it. Going back is a real move in a wizard and needs an edge. */}
      {step > 1 ? (
        <Flex>
          <Button type="button" size="md" variant="outline" disabled={pending} onClick={onBack}>
            {copy.createEvent.wizard.back}
          </Button>
        </Flex>
      ) : null}
    </Stack>
  );
}

/**
 * Fires `create_step_viewed` once per arrival, and `create_abandoned` on the
 * way out of an unfinished form.
 *
 * The abandonment event is the point of the whole card — without it
 * "the simplified form is better" is an assertion — and it is the awkward one
 * to record, because the moment it happens is the moment the page stops
 * running. `visibilitychange` rather than `beforeunload`: Safari on iOS often
 * never fires `beforeunload`, and a tab switched away from and killed by the
 * OS is exactly the abandonment worth counting.
 */
export function StepTracking({ step, finished }: { step: WizardStep; finished: boolean }) {
  const lastStep = useRef(step);
  const reported = useRef(false);

  // Read through a ref so the listener below never has to be torn down and
  // re-attached — re-attaching it mid-form is how the `reported` guard would
  // get bypassed. Written in an effect rather than during render: a ref
  // mutated while rendering is a tear waiting for concurrent mode.
  const finishedRef = useRef(finished);

  useEffect(() => {
    finishedRef.current = finished;
  }, [finished]);

  useEffect(() => {
    lastStep.current = step;
    trackClient("create_step_viewed", { step });
  }, [step]);

  useEffect(() => {
    function onHide() {
      if (document.visibilityState !== "hidden") return;
      // Once. A phone that switches apps four times should not report four
      // abandonments of the same form.
      if (reported.current || finishedRef.current) return;
      reported.current = true;
      trackClient("create_abandoned", { last_step: lastStep.current });
    }

    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  return null;
}

