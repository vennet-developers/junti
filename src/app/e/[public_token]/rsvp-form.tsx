"use client";

import { useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@stackmyth/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@stackmyth/card";
import { Input } from "@stackmyth/input";
import { Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import {
  ControlledField,
  FormController,
  FormError,
  FormField,
  SubmitButton,
  createZodResolver,
} from "@/components/form-shell";
import { Notice } from "@/components/notice";
import { RadioField } from "@/components/radio-field";
import { copy } from "@/config/copy";
import { rsvpSchema } from "@/lib/validation";

import { submitRsvp, type RsvpState } from "./actions";

const ATTENDANCE_OPTIONS = [
  { value: "in", label: copy.attendance.in },
  { value: "out", label: copy.attendance.out },
  { value: "maybe", label: copy.attendance.maybe },
] as const;

const resolver = createZodResolver(rsvpSchema);

export interface RsvpFormProps {
  publicToken: string;
  /** The RSVP this device already owns, if it has one. */
  mine: { displayName: string; attendance: string } | null;
  /** Event is at capacity, so "Voy" will land on the waitlist. */
  isFull: boolean;
}

export function RsvpForm({ publicToken, mine, isFull }: RsvpFormProps) {
  const [pending, startTransition] = useTransition();
  const [serverState, setServerState] = useState<RsvpState>({ errors: {} });

  const editing = mine !== null;

  const defaultAttendance =
    mine?.attendance === "out" || mine?.attendance === "maybe" ? mine.attendance : "in";

  function submit(data: Record<string, unknown>) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      formData.set(key, value == null ? "" : String(value));
    }

    startTransition(async () => {
      const result = await submitRsvp(publicToken, { errors: {} }, formData);
      setServerState(result);
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
        >
          {({ handleSubmit }) => (
            <form onSubmit={handleSubmit(submit)} noValidate>
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
                  <Notice tone="warning" title={copy.rsvp.willBeWaitlisted} />
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
                    options={ATTENDANCE_OPTIONS}
                    defaultValue={defaultAttendance}
                  />
                </ControlledField>

                <SubmitButton
                  pending={pending}
                  idleLabel={editing ? copy.rsvp.submitEditing : copy.rsvp.submit}
                  pendingLabel={copy.rsvp.submitting}
                />
              </Stack>
            </form>
          )}
        </FormController>
      </CardContent>
    </Card>
  );
}
