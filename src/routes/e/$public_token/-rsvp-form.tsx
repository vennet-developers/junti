"use client";

import { useMemo, useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@stackmyth/alert";
import { Switch } from "@stackmyth/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@stackmyth/card";
import { Input } from "@stackmyth/input";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { toast } from "@stackmyth/toast";
import { Banner } from "@stackmyth/banner";
import { TriangleAlertIcon } from "@stackmyth/icons";

import {
  ControlledField,
  Form,
  FormController,
  FormError,
  FormField,
  SubmitButton,
  createZodResolver,
} from "@/components/form-shell";
import { useCopy } from "@/components/copy-provider";
import { RadioField } from "@/components/radio-field";
import { SelectField } from "@/components/select-field";
import { pastRefundCutoff } from "@/domain/refund-policy";
import { makeRsvpSchema } from "@/lib/validation";

import { useRouter } from "@tanstack/react-router";

import { holdSpotsFn, submitRsvpFn, type RsvpState } from "./-fns";

export interface RsvpFormProps {
  publicToken: string;
  /** The RSVP this device already owns, if it has one. */
  mine: { displayName: string; attendance: string } | null;
  /** Event is at capacity, so "Voy" will land on the waitlist. */
  isFull: boolean;
  /**
   * The organizer's refund rule, when the event costs money and one was
   * stated. Shown BEFORE confirming — a rule that only surfaces once somebody
   * wants their money back is a trap, not a policy.
   */
  refund: { hours: number; startsAt: Date } | null;
  /**
   * Guest spots the answer can carry — Ivan's wizard step 1: "de una puedo
   * decir cuántos cupos, el mío y cuántos más". Null when the event does not
   * offer held spots or none remain.
   */
  guests: { remaining: number } | null;
  /** Fires after a successful save, with the answer that was recorded. */
  onSaved?: (attendance: string) => void;
}

export function RsvpForm({ publicToken, mine, isFull, refund, guests, onSaved }: RsvpFormProps) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverState, setServerState] = useState<RsvpState>({ errors: {} });

  // Both are built from `copy`, so they are per-render rather than module-level
  // constants. The resolver in particular has to carry the messages for the
  // language currently on screen.
  const attendanceOptions = [
    { value: "in", label: copy.attendance.in },
    { value: "out", label: copy.attendance.out },
    { value: "maybe", label: copy.attendance.maybe },
  ];

  const resolver = useMemo(() => createZodResolver(makeRsvpSchema(copy)), [copy]);

  const editing = mine !== null;

  const defaultAttendance =
    mine?.attendance === "out" || mine?.attendance === "maybe" ? mine.attendance : "in";

  /*
    Which answer the radio currently shows. Only diverges from the default
    after a click, so everything conditioned on it is client-only by
    construction — which is what lets the late-drop warning read the real
    clock below without an SSR/hydration mismatch.
  */
  const [selected, setSelected] = useState(defaultAttendance);

  /*
    The guests block, folded into the SAME acceptance — a switch opens the
    count, a count above zero unfolds the optional names. Holding seats is
    part of saying "voy con dos más", not a separate errand discovered later.
  */
  const [bringGuests, setBringGuests] = useState(false);
  const [guestCount, setGuestCount] = useState(1);
  const [guestNames, setGuestNames] = useState<string[]>([""]);

  function setGuestCountClamped(next: number) {
    const clamped = Math.min(Math.max(1, next), guests?.remaining ?? 1);
    setGuestCount(clamped);
    setGuestNames((current) => Array.from({ length: clamped }, (_, i) => current[i] ?? ""));
  }

  const backingOutLate =
    refund !== null &&
    mine?.attendance === "in" &&
    selected === "out" &&
    pastRefundCutoff(new Date(), refund.startsAt, refund.hours);

  function submit(data: Record<string, unknown>) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      formData.set(key, value == null ? "" : String(value));
    }

    startTransition(async () => {
      formData.set("publicToken", publicToken);
      const result = await submitRsvpFn({ data: formData });
      setServerState(result);

      const saved = Object.keys(result.errors).length === 0;

      /*
        The guest spots ride the same acceptance. The RSVP standing while the
        hold fails is the honest partial: the person IS coming, their extras
        are not held, and the error says which half needs another try.
      */
      if (saved && data.attendance === "in" && bringGuests && guestCount > 0 && guests) {
        const holdData = new FormData();
        holdData.set("publicToken", publicToken);
        holdData.set("count", String(guestCount));
        guestNames.forEach((name, index) => holdData.set(`name-${index}`, name));
        const held = await holdSpotsFn({ data: holdData });
        if (held.errors._form) {
          toast.error(held.errors._form);
        } else {
          setBringGuests(false);
          setGuestCount(1);
          setGuestNames([""]);
        }
      }

      // Nothing confirmed the save before this: the page just re-rendered and
      // you had to find yourself in the roster to know it worked.
      //
      // Not toasted when waitlisted — the Alert below says so at length, and
      // that consequence outlives a toast. One message per outcome.
      // The roster the reader is looking at includes them now; re-running
      // the loaders is what the server's revalidatePath used to do.
      if (saved) await router.invalidate();

      if (!result.waitlisted && saved) {
        toast.success(editing ? copy.rsvp.savedEditing : copy.rsvp.saved);
      }

      if (saved) onSaved?.(String(data.attendance ?? ""));
    });
  }

  return (
    <Card surface="outlined">
      <CardHeader>
        <CardTitle>{editing ? copy.rsvp.headingEditing : copy.rsvp.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <FormController
          resolver={resolver}
          defaultValues={{
            displayName: mine?.displayName ?? "",
            attendance: defaultAttendance,
          }}
          mode="onBlur"
          reValidateMode="onChange"
        >
          <Form onValid={submit}>
            <Stack gap="4">
              {serverState.waitlisted ? (
                // A response to the user's own action, so an assertive live
                // region is the right behaviour here.
                <Alert variant="warning" soft>
                  <AlertTitle>{copy.event.full}</AlertTitle>
                  <AlertDescription>{copy.rsvp.waitlistedNotice}</AlertDescription>
                </Alert>
              ) : null}

              {/* Say what will happen BEFORE they submit. Showing "Cupo
                  lleno" elsewhere on the page and only revealing the
                  consequence after submitting is the kind of surprise that
                  makes people distrust a form. Not shown to someone who
                  already holds a spot — they are not going anywhere. */}
              {isFull && mine?.attendance !== "in" && !serverState.waitlisted ? (
                <Banner variant="warning" live="off" icon={<TriangleAlertIcon size={18} aria-hidden="true" />} title={copy.rsvp.willBeWaitlisted} />
              ) : null}

              <FormError message={serverState.errors._form} />

              {editing ? (
                <Text variant="small" color="muted">
                  {copy.rsvp.yourRsvp(mine.displayName)}
                </Text>
              ) : null}

              <FormField name="displayName">
                {({ fieldProps, error }) => (
                  <ControlledField
                    label={copy.rsvp.nameLabel}
                    description={copy.rsvp.nameHelp}
                    error={error ?? serverState.errors.displayName}
                    htmlFor={fieldProps.id}
                  >
                    <Input
                      {...fieldProps}
                      fullWidth
                      size="lg"
                      maxLength={40}
                      autoComplete="name"
                      placeholder={copy.rsvp.namePlaceholder}
                      status={error ? "error" : "default"}
                    />
                  </ControlledField>
                )}
              </FormField>

              <ControlledField label={copy.rsvp.attendanceLabel}>
                <RadioField
                  name="attendance"
                  options={attendanceOptions}
                  defaultValue={defaultAttendance}
                  onValueChange={setSelected}
                />
              </ControlledField>

              {/* The rule, before the button that accepts it. */}
              {refund ? (
                <Text variant="small" color="muted">
                  {copy.rsvp.refundPolicy(refund.hours)}
                </Text>
              ) : null}

              {/* The consequence, at the exact moment it is about to bite:
                  someone who held a spot is choosing "No voy" inside the
                  window. Warned before submitting, not argued after. */}
              {refund && backingOutLate ? (
                <Banner
                  variant="warning"
                  live="off"
                  icon={<TriangleAlertIcon size={18} aria-hidden="true" />}
                  title={copy.rsvp.refundLate(refund.hours)}
                />
              ) : null}

              {/* Bringing people, declared with the answer itself. Only when
                  the answer being given is "voy" and spots remain. */}
              {guests && selected === "in" ? (
                <Stack gap="3">
                  <Flex gap="3" align="center" justify="between">
                    <Text variant="small" weight="medium">
                      {copy.heldSpots.switchLabel}
                    </Text>
                    <Switch
                      checked={bringGuests}
                      onCheckedChange={(checked) => setBringGuests(checked === true)}
                      aria-label={copy.heldSpots.switchLabel}
                    />
                  </Flex>

                  {bringGuests ? (
                    <Stack gap="3">
                      <ControlledField label={copy.heldSpots.countLabel}>
                        <SelectField
                          name="guestCount"
                          options={Array.from({ length: guests.remaining }, (_, i) => ({
                            value: String(i + 1),
                            label: String(i + 1),
                          }))}
                          defaultValue="1"
                          onValueChange={(value) => setGuestCountClamped(Number(value))}
                        />
                      </ControlledField>

                      {guestNames.map((name, index) => (
                        <Input
                          key={index}
                          fullWidth
                          size="lg"
                          maxLength={40}
                          value={name}
                          placeholder={copy.heldSpots.namePlaceholder}
                          aria-label={copy.heldSpots.nameLabel(index + 1)}
                          onChange={(event) =>
                            setGuestNames((current) =>
                              current.map((n, i) => (i === index ? event.target.value : n)),
                            )
                          }
                        />
                      ))}
                    </Stack>
                  ) : null}
                </Stack>
              ) : null}

              <SubmitButton
                pending={pending}
                idleLabel={editing ? copy.rsvp.submitEditing : copy.rsvp.submit}
                pendingLabel={copy.rsvp.submitting}
              />
            </Stack>
          </Form>
        </FormController>
      </CardContent>
    </Card>
  );
}
