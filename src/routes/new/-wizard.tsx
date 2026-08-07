"use client";

import { useEffect, useRef } from "react";

import { Button } from "@stackmyth/button";
import { ChevronLeftIcon } from "@stackmyth/icons";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";
import { WIZARD_STEPS, isLastStep, type WizardStep } from "@/domain/wizard";
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
export function WizardProgress({
  step,
  pending,
  onBack,
}: {
  step: WizardStep;
  pending: boolean;
  onBack: () => void;
}) {
  const { copy } = useCopy();

  // A fixed two. The count used to depend on the cost answer and MUTATED
  // mid-flight — the exact noise that retired the third step.
  const shown = WIZARD_STEPS;

  return (
    <Stack gap="2">
      {/*
        Back lives here, with the position indicator, rather than beside the
        advance button at the foot of the form. Two reasons, and the first is
        the one that bites: these steps are long, so a back control at the
        bottom means scrolling past everything you have already dealt with in
        order to fix something at the top. The second is that going back is
        navigation and the button below is a commitment — putting them in the
        same cluster invites pressing the wrong one, and one of them costs you
        your place.

        A ghost is right here for the same reason it was wrong down there: it
        is not competing with a filled primary an inch away.
      */}
      {step > 1 ? (
        <Flex>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onBack}>
            <Flex gap="1" align="center">
              <ChevronLeftIcon size={16} aria-hidden="true" />
              {copy.createEvent.wizard.back}
            </Flex>
          </Button>
        </Flex>
      ) : null}

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
        {copy.createEvent.wizard.progress(step, WIZARD_STEPS.length)} ·{" "}
        {copy.createEvent.wizard.stepTitle[step]}
      </Text>
    </Stack>
  );
}

/**
 * The one thing to press.
 *
 * Just the advance control — back moved up to the progress indicator. This is
 * the last thing in the DOM and the only primary button on screen, which is
 * AC-8's real requirement: on a 375px viewport the thing you press next has to
 * be reachable without scrolling past content you have already dealt with.
 */
export function WizardNav({
  step,
  pending,
}: {
  step: WizardStep;
  pending: boolean;
}) {
  const { copy } = useCopy();

  const submits = isLastStep(step);

  return (
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

