"use client";

import { useState, useTransition } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@stackmyth/card";
import { Input } from "@stackmyth/input";
import { Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Textarea } from "@stackmyth/textarea";

import { DateTimeField } from "@/components/date-time-field";
import {
  ControlledField,
  FormController,
  FormError,
  FormField,
  SubmitButton,
  createZodResolver,
} from "@/components/form-shell";
import { RadioField } from "@/components/radio-field";
import { SelectField } from "@/components/select-field";
import { copy } from "@/config/copy";
import { toDatePartValue, toMajorUnits, toTimePartValue } from "@/lib/format";
import type { EventView } from "@/lib/roster";
import { addParticipantSchema, eventClientSchema } from "@/lib/validation";

import { addParticipant, editEvent, type ManageState } from "./actions";

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

const eventResolver = createZodResolver(eventClientSchema);
const participantResolver = createZodResolver(addParticipantSchema);

interface Ctx {
  publicToken: string;
  organizerToken: string;
}

/** Turns the validated store values into the FormData a server action expects. */
function toFormData(data: Record<string, unknown>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.set(key, value == null ? "" : String(value));
  }
  return formData;
}

export function AddParticipantForm({ publicToken, organizerToken }: Ctx) {
  const [pending, startTransition] = useTransition();
  const [serverState, setServerState] = useState<ManageState>({ errors: {} });
  const [formKey, setFormKey] = useState(0);

  function submit(data: Record<string, unknown>) {
    startTransition(async () => {
      const result = await addParticipant(
        publicToken,
        organizerToken,
        { errors: {} },
        toFormData(data),
      );
      setServerState(result);
      // Remount on success so the name field clears, ready for the next person.
      if (result.ok) setFormKey((key) => key + 1);
    });
  }

  return (
    <Card surface="outlined">
      <CardHeader>
        <CardTitle>{copy.manage.addParticipant}</CardTitle>
      </CardHeader>
      <CardContent>
        <FormController
          key={formKey}
          resolver={participantResolver}
          defaultValues={{ displayName: "", attendance: "in" }}
          mode="onBlur"
        >
          {({ handleSubmit }) => (
            <form onSubmit={handleSubmit(submit)} noValidate>
              <Stack gap="4">
                <FormError message={serverState.errors._form} />

                <FormField name="displayName">
                  {({ fieldProps, error }) => (
                    <ControlledField
                      label={copy.rsvp.nameLabel}
                      description={copy.manage.addParticipantHelp}
                      error={error ?? serverState.errors.displayName}
                      htmlFor={fieldProps.id}
                    >
                      <Input
                        {...fieldProps}
                        fullWidth
                        size="lg"
                        maxLength={40}
                        autoComplete="off"
                        status={error ? "error" : "default"}
                      />
                    </ControlledField>
                  )}
                </FormField>

                <ControlledField label={copy.rsvp.attendanceLabel}>
                  <RadioField
                    name="attendance"
                    options={ATTENDANCE_OPTIONS}
                    defaultValue="in"
                    orientation="horizontal"
                  />
                </ControlledField>

                <SubmitButton
                  pending={pending}
                  idleLabel={copy.manage.addParticipantSubmit}
                  pendingLabel={copy.common.loading}
                  variant="secondary"
                  size="md"
                />
              </Stack>
            </form>
          )}
        </FormController>
      </CardContent>
    </Card>
  );
}

export function EditEventForm({ publicToken, organizerToken, event }: Ctx & { event: EventView }) {
  const [pending, startTransition] = useTransition();
  const [serverState, setServerState] = useState<ManageState>({ errors: {} });
  const [costMode, setCostMode] = useState<string>(event.costMode);

  const defaults = {
    title: event.title,
    kind: event.kind,
    startsAtDate: toDatePartValue(event.startsAt),
    startsAtTime: toTimePartValue(event.startsAt),
    location: event.location ?? "",
    capacity: event.capacity === null ? "" : String(event.capacity),
    notes: event.notes ?? "",
    costMode: event.costMode,
    costAmount:
      event.costAmountMinor === null
        ? ""
        : String(toMajorUnits(event.costAmountMinor, event.currency)),
    currency: event.currency,
  };

  function submit(data: Record<string, unknown>) {
    startTransition(async () => {
      const result = await editEvent(publicToken, organizerToken, { errors: {} }, toFormData(data));
      setServerState(result);
    });
  }

  return (
    <Card surface="outlined">
      <CardHeader>
        <CardTitle>{copy.manage.editEvent}</CardTitle>
      </CardHeader>
      <CardContent>
        <FormController resolver={eventResolver} defaultValues={defaults} mode="onBlur">
          {({ handleSubmit }) => (
            <form onSubmit={handleSubmit(submit)} noValidate>
              <Stack gap="4">
                {serverState.ok ? (
                  <Text color="primary" role="status">
                    {copy.manage.editEventSaved}
                  </Text>
                ) : null}
                <FormError message={serverState.errors._form} />

                <FormField name="title">
                  {({ fieldProps, error }) => (
                    <ControlledField
                      label={copy.createEvent.fields.title}
                      error={error ?? serverState.errors.title}
                      htmlFor={fieldProps.id}
                    >
                      <Input
                        {...fieldProps}
                        fullWidth
                        size="lg"
                        maxLength={120}
                        status={error ? "error" : "default"}
                      />
                    </ControlledField>
                  )}
                </FormField>

                <ControlledField label={copy.createEvent.fields.kind}>
                  <SelectField name="kind" options={KIND_OPTIONS} defaultValue={event.kind} />
                </ControlledField>

                <ControlledField
                  label={copy.createEvent.fields.startsAt}
                  description={copy.createEvent.fields.startsAtHelp}
                  error={serverState.errors.startsAtDate ?? serverState.errors.startsAtTime}
                >
                  {/* allowPast: an event already under way must stay editable. */}
                  <DateTimeField
                    dateName="startsAtDate"
                    timeName="startsAtTime"
                    defaultDate={defaults.startsAtDate}
                    defaultTime={defaults.startsAtTime}
                    allowPast
                  />
                </ControlledField>

                <FormField name="location">
                  {({ fieldProps }) => (
                    <ControlledField
                      label={copy.createEvent.fields.location}
                      htmlFor={fieldProps.id}
                    >
                      <Input {...fieldProps} fullWidth size="lg" maxLength={200} />
                    </ControlledField>
                  )}
                </FormField>

                <FormField name="capacity">
                  {({ fieldProps, error }) => (
                    <ControlledField
                      label={copy.createEvent.fields.capacity}
                      description={copy.createEvent.fields.capacityHelp}
                      error={error ?? serverState.errors.capacity}
                      htmlFor={fieldProps.id}
                    >
                      <Input
                        {...fieldProps}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        fullWidth
                        size="lg"
                        status={error ? "error" : "default"}
                      />
                    </ControlledField>
                  )}
                </FormField>

                <ControlledField label={copy.createEvent.fields.costMode}>
                  <SelectField
                    name="costMode"
                    options={COST_MODE_OPTIONS}
                    defaultValue={event.costMode}
                    onValueChange={setCostMode}
                  />
                </ControlledField>

                {costMode !== "none" ? (
                  <FormField name="costAmount">
                    {({ fieldProps, error }) => (
                      <ControlledField
                        label={copy.createEvent.fields.costAmount}
                        description={
                          costMode === "total"
                            ? copy.createEvent.fields.costAmountHelpTotal
                            : copy.createEvent.fields.costAmountHelpPerPerson
                        }
                        error={error ?? serverState.errors.costAmount}
                        htmlFor={fieldProps.id}
                      >
                        <Input
                          {...fieldProps}
                          inputMode="numeric"
                          fullWidth
                          size="lg"
                          prefix="$"
                          status={error ? "error" : "default"}
                        />
                      </ControlledField>
                    )}
                  </FormField>
                ) : null}

                <FormField name="notes">
                  {({ fieldProps }) => (
                    <ControlledField label={copy.createEvent.fields.notes} htmlFor={fieldProps.id}>
                      <Textarea {...fieldProps} fullWidth rows={3} maxLength={2000} />
                    </ControlledField>
                  )}
                </FormField>

                <SubmitButton
                  pending={pending}
                  idleLabel={copy.common.save}
                  pendingLabel={copy.common.loading}
                  variant="secondary"
                  size="md"
                />
              </Stack>
            </form>
          )}
        </FormController>
      </CardContent>
    </Card>
  );
}
