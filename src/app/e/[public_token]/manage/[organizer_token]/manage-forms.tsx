"use client";

import { useActionState, useId } from "react";

import { Button } from "@stackmyth/button";
import { Card, CardContent, CardHeader, CardTitle } from "@stackmyth/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@stackmyth/field";
import { Input } from "@stackmyth/input";
import { Flex, Stack } from "@stackmyth/layout";
import { RadioGroup, RadioGroupItem } from "@stackmyth/radio-group";
import { Text } from "@stackmyth/text";
import { Textarea } from "@stackmyth/textarea";

import { SelectField } from "@/components/select-field";
import { copy } from "@/config/copy";
import { toDateTimeLocalValue, toMajorUnits } from "@/lib/format";
import type { EventView } from "@/lib/roster";

import { addParticipant, editEvent, type ManageState } from "./actions";

/** Declared here, not in actions.ts: a "use server" module exports only async functions. */
const EMPTY_STATE: ManageState = { errors: {} };

const KIND_OPTIONS = [
  { value: "match", label: copy.createEvent.kinds.match },
  { value: "party", label: copy.createEvent.kinds.party },
  { value: "kids_party", label: copy.createEvent.kinds.kids_party },
  { value: "other", label: copy.createEvent.kinds.other },
] as const;

const COST_MODE_OPTIONS = [
  { value: "none", label: copy.createEvent.costModes.none },
  { value: "total", label: copy.createEvent.costModes.total },
  { value: "per_person", label: copy.createEvent.costModes.per_person },
] as const;

const ATTENDANCE_OPTIONS = [
  { value: "in", label: copy.attendance.in },
  { value: "out", label: copy.attendance.out },
  { value: "maybe", label: copy.attendance.maybe },
] as const;

interface Ctx {
  publicToken: string;
  organizerToken: string;
}

export function AddParticipantForm({ publicToken, organizerToken }: Ctx) {
  const action = addParticipant.bind(null, publicToken, organizerToken);
  const [state, formAction, pending] = useActionState<ManageState, FormData>(
    action,
    EMPTY_STATE,
  );
  const nameId = useId();

  return (
    <Card surface="outlined">
      <CardHeader>
        <CardTitle>{copy.manage.addParticipant}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} noValidate>
          <Stack gap="4">
            {state.errors._form ? (
              <Text color="error" role="alert">
                {state.errors._form}
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
                autoComplete="off"
                status={state.errors.displayName ? "error" : "default"}
              />
              {state.errors.displayName ? (
                <FieldError>{state.errors.displayName}</FieldError>
              ) : (
                <FieldDescription>{copy.manage.addParticipantHelp}</FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel>{copy.rsvp.attendanceLabel}</FieldLabel>
              <RadioGroup name="attendance" defaultValue="in" orientation="horizontal">
                <Flex gap="4" wrap="wrap">
                  {ATTENDANCE_OPTIONS.map((option) => (
                    <Flex key={option.value} as="label" gap="2" align="center">
                      <RadioGroupItem value={option.value} />
                      <Text as="span">{option.label}</Text>
                    </Flex>
                  ))}
                </Flex>
              </RadioGroup>
            </Field>

            <Button type="submit" size="md" fullWidth variant="secondary" disabled={pending}>
              {copy.manage.addParticipantSubmit}
            </Button>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}

export function EditEventForm({
  publicToken,
  organizerToken,
  event,
}: Ctx & { event: EventView }) {
  const action = editEvent.bind(null, publicToken, organizerToken);
  const [state, formAction, pending] = useActionState<ManageState, FormData>(
    action,
    EMPTY_STATE,
  );

  const ids = {
    title: useId(),
    kind: useId(),
    startsAt: useId(),
    location: useId(),
    capacity: useId(),
    notes: useId(),
    costMode: useId(),
    costAmount: useId(),
  };

  return (
    <Card surface="outlined">
      <CardHeader>
        <CardTitle>{copy.manage.editEvent}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} noValidate>
          <Stack gap="4">
            {state.ok ? (
              <Text color="primary" role="status">
                {copy.manage.editEventSaved}
              </Text>
            ) : null}
            {state.errors._form ? (
              <Text color="error" role="alert">
                {state.errors._form}
              </Text>
            ) : null}

            <Field invalid={Boolean(state.errors.title)}>
              <FieldLabel htmlFor={ids.title}>{copy.createEvent.fields.title}</FieldLabel>
              <Input
                id={ids.title}
                name="title"
                fullWidth
                size="lg"
                required
                maxLength={120}
                defaultValue={event.title}
                status={state.errors.title ? "error" : "default"}
              />
              {state.errors.title ? <FieldError>{state.errors.title}</FieldError> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor={ids.kind}>{copy.createEvent.fields.kind}</FieldLabel>
              <SelectField
                id={ids.kind}
                name="kind"
                options={KIND_OPTIONS}
                defaultValue={event.kind}
              />
            </Field>

            <Field invalid={Boolean(state.errors.startsAt)}>
              <FieldLabel htmlFor={ids.startsAt}>{copy.createEvent.fields.startsAt}</FieldLabel>
              <Input
                id={ids.startsAt}
                name="startsAt"
                type="datetime-local"
                fullWidth
                size="lg"
                required
                defaultValue={toDateTimeLocalValue(event.startsAt)}
                status={state.errors.startsAt ? "error" : "default"}
              />
              {state.errors.startsAt ? (
                <FieldError>{state.errors.startsAt}</FieldError>
              ) : (
                <FieldDescription>{copy.createEvent.fields.startsAtHelp}</FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor={ids.location}>{copy.createEvent.fields.location}</FieldLabel>
              <Input
                id={ids.location}
                name="location"
                fullWidth
                size="lg"
                maxLength={200}
                defaultValue={event.location ?? ""}
              />
            </Field>

            <Field invalid={Boolean(state.errors.capacity)}>
              <FieldLabel htmlFor={ids.capacity}>{copy.createEvent.fields.capacity}</FieldLabel>
              <Input
                id={ids.capacity}
                name="capacity"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                fullWidth
                size="lg"
                defaultValue={event.capacity ?? ""}
                status={state.errors.capacity ? "error" : "default"}
              />
              {state.errors.capacity ? (
                <FieldError>{state.errors.capacity}</FieldError>
              ) : (
                <FieldDescription>{copy.createEvent.fields.capacityHelp}</FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor={ids.costMode}>{copy.createEvent.fields.costMode}</FieldLabel>
              <SelectField
                id={ids.costMode}
                name="costMode"
                options={COST_MODE_OPTIONS}
                defaultValue={event.costMode}
              />
            </Field>

            <Field invalid={Boolean(state.errors.costAmount)}>
              <FieldLabel htmlFor={ids.costAmount}>{copy.createEvent.fields.costAmount}</FieldLabel>
              <Input
                id={ids.costAmount}
                name="costAmount"
                inputMode="numeric"
                fullWidth
                size="lg"
                prefix="$"
                defaultValue={
                  event.costAmountMinor === null
                    ? ""
                    : String(toMajorUnits(event.costAmountMinor, event.currency))
                }
                status={state.errors.costAmount ? "error" : "default"}
              />
              {state.errors.costAmount ? (
                <FieldError>{state.errors.costAmount}</FieldError>
              ) : (
                <FieldDescription>{copy.createEvent.fields.costAmountHelpTotal}</FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor={ids.notes}>{copy.createEvent.fields.notes}</FieldLabel>
              <Textarea
                id={ids.notes}
                name="notes"
                fullWidth
                rows={3}
                maxLength={2000}
                defaultValue={event.notes ?? ""}
              />
            </Field>

            <input type="hidden" name="currency" value={event.currency} />

            <Button type="submit" size="md" fullWidth variant="secondary" disabled={pending}>
              {copy.common.save}
            </Button>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
