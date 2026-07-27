"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";

import { Alert, AlertDescription, AlertTitle } from "@stackmyth/alert";
import { Button } from "@stackmyth/button";
import { Card, CardContent, CardHeader, CardTitle } from "@stackmyth/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@stackmyth/field";
import { Input } from "@stackmyth/input";
import { Flex, Stack } from "@stackmyth/layout";
import { RadioGroup, RadioGroupItem } from "@stackmyth/radio-group";
import { Spinner } from "@stackmyth/spinner";
import { Text } from "@stackmyth/text";

import { copy } from "@/config/copy";

import { submitRsvp, type RsvpState } from "./actions";

/** Declared here, not in actions.ts: a "use server" module exports only async functions. */
const EMPTY_STATE: RsvpState = { errors: {} };

const ATTENDANCE_OPTIONS = [
  { value: "in", label: copy.attendance.in },
  { value: "out", label: copy.attendance.out },
  { value: "maybe", label: copy.attendance.maybe },
] as const;

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();

  // STACKMYTH-GAP: Button `loading` hardcodes an English SR string with no
  // override. Composed from a disabled Button + labelled Spinner instead.
  // See STACKMYTH-GAPS.md #4.
  return (
    <Button type="submit" size="lg" fullWidth disabled={pending}>
      {pending ? <Spinner size="sm" label={copy.rsvp.submitting} /> : null}
      {pending ? copy.rsvp.submitting : editing ? copy.rsvp.submitEditing : copy.rsvp.submit}
    </Button>
  );
}

export interface RsvpFormProps {
  publicToken: string;
  /** The RSVP this device already owns, if it has one. */
  mine: { displayName: string; attendance: string } | null;
}

export function RsvpForm({ publicToken, mine }: RsvpFormProps) {
  const action = submitRsvp.bind(null, publicToken);
  const [state, formAction] = useActionState<RsvpState, FormData>(action, EMPTY_STATE);

  const nameId = useId();
  const editing = mine !== null;

  // `waitlisted` is only ever set by a successful submission.
  const defaultAttendance =
    mine?.attendance === "out" || mine?.attendance === "maybe" ? mine.attendance : "in";

  return (
    <Card surface="outlined">
      <CardHeader>
        <CardTitle>{editing ? copy.rsvp.headingEditing : copy.rsvp.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} noValidate>
          <Stack gap="4">
            {state.waitlisted ? (
              // A response to the user's own action, so an assertive live
              // region is the right behaviour here.
              <Alert variant="warning" soft>
                <AlertTitle>{copy.event.full}</AlertTitle>
                <AlertDescription>{copy.rsvp.waitlistedNotice}</AlertDescription>
              </Alert>
            ) : null}

            {state.errors._form ? (
              <Text color="error" role="alert">
                {state.errors._form}
              </Text>
            ) : null}

            {editing ? (
              <Text variant="small" color="muted">
                {copy.rsvp.yourRsvp(mine.displayName)}
              </Text>
            ) : null}

            <Field invalid={Boolean(state.errors.displayName)}>
              <FieldLabel htmlFor={nameId}>{copy.rsvp.nameLabel}</FieldLabel>
              <Input
                id={nameId}
                name="displayName"
                fullWidth
                size="lg"
                required
                maxLength={40}
                autoComplete="name"
                defaultValue={mine?.displayName ?? ""}
                placeholder={copy.rsvp.namePlaceholder}
                status={state.errors.displayName ? "error" : "default"}
              />
              {state.errors.displayName ? (
                <FieldError>{state.errors.displayName}</FieldError>
              ) : (
                <FieldDescription>{copy.rsvp.nameHelp}</FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel>{copy.rsvp.attendanceLabel}</FieldLabel>
              {/*
                RadioGroup renders real <input type="radio" name>, so unlike
                Select it submits natively and needs no hidden mirror.
              */}
              <RadioGroup name="attendance" defaultValue={defaultAttendance} orientation="vertical">
                <Stack gap="3">
                  {ATTENDANCE_OPTIONS.map((option) => (
                    <Flex key={option.value} as="label" gap="3" align="center">
                      <RadioGroupItem value={option.value} />
                      <Text as="span">{option.label}</Text>
                    </Flex>
                  ))}
                </Stack>
              </RadioGroup>
            </Field>

            <SubmitButton editing={editing} />
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
