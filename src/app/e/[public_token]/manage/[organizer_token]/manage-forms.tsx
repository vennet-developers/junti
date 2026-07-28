"use client";

import { useMemo, useState, useTransition } from "react";

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
import { useCopy } from "@/components/copy-provider";
import { PolicyEditor, type PolicyDraft } from "@/components/policy-editor";
import { RadioField } from "@/components/radio-field";
import { SelectField } from "@/components/select-field";
import { toDatePartValue, toMajorUnits, toTimePartValue } from "@/lib/format";
import type { EventView } from "@/lib/roster";
import { timeZoneLabel, timeZoneOptions } from "@/lib/time-zones";
import { makeAddParticipantSchema, makeEventClientSchema } from "@/lib/validation";

import { addParticipant, editEvent, type ManageState } from "./actions";

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
  const { copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [serverState, setServerState] = useState<ManageState>({ errors: {} });
  const [formKey, setFormKey] = useState(0);

  const attendanceOptions = [
    { value: "in", label: copy.attendance.in },
    { value: "out", label: copy.attendance.out },
    { value: "maybe", label: copy.attendance.maybe },
  ];

  const participantResolver = useMemo(
    () => createZodResolver(makeAddParticipantSchema(copy)),
    [copy],
  );

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

  // No Card wrapper: the Disclosure that contains this already supplies the
  // heading and the frame. Two nested titles read as a bug.
  return (
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
                options={attendanceOptions}
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
  );
}

export function EditEventForm({
  publicToken,
  organizerToken,
  event,
  policies,
}: Ctx & { event: EventView; policies: PolicyDraft[] }) {
  const { copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [serverState, setServerState] = useState<ManageState>({ errors: {} });
  const [costMode, setCostMode] = useState<string>(event.costMode);
  const [timeZone, setTimeZone] = useState(event.timeZone);

  const kindOptions = [
    { value: "match", label: copy.createEvent.kinds.match },
    { value: "party", label: copy.createEvent.kinds.party },
    { value: "kids_party", label: copy.createEvent.kinds.kids_party },
    { value: "other", label: copy.createEvent.kinds.other },
  ];

  const costModeOptions = [
    { value: "none", label: copy.createEvent.costModes.none },
    { value: "total", label: copy.createEvent.costModes.total },
    { value: "per_person", label: copy.createEvent.costModes.per_person },
  ];

  const zoneOptions = useMemo(
    () => timeZoneOptions(event.timeZone, copy.intlLocale, new Date()),
    [event.timeZone, copy.intlLocale],
  );

  const eventResolver = useMemo(() => createZodResolver(makeEventClientSchema(copy)), [copy]);

  const defaults = {
    title: event.title,
    kind: event.kind,
    /* Wall-clock in the event's OWN zone, so editing does not silently shift
       the start time by the difference from wherever the organizer is now. */
    startsAtDate: toDatePartValue(event.startsAt, event.timeZone),
    startsAtTime: toTimePartValue(event.startsAt, event.timeZone),
    timeZone: event.timeZone,
    locale: event.locale,
    location: event.location ?? "",
    capacity: event.capacity === null ? "" : String(event.capacity),
    notes: event.notes ?? "",
    costMode: event.costMode,
    costAmount:
      event.costAmountMinor === null
        ? ""
        : String(toMajorUnits(event.costAmountMinor, event.currency)),
    currency: event.currency,
    policies: JSON.stringify(policies),
  };

  function submit(data: Record<string, unknown>) {
    startTransition(async () => {
      const result = await editEvent(publicToken, organizerToken, { errors: {} }, toFormData(data));
      setServerState(result);
    });
  }

  return (
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
              <SelectField name="kind" options={kindOptions} defaultValue={event.kind} />
            </ControlledField>

            <ControlledField
              label={copy.createEvent.fields.startsAt}
              description={copy.createEvent.fields.startsAtHelp(
                timeZoneLabel(timeZone, copy.intlLocale, new Date()),
              )}
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

            <ControlledField
              label={copy.createEvent.fields.timeZone}
              description={copy.createEvent.fields.timeZoneHelp}
              error={serverState.errors.timeZone}
            >
              <SelectField
                name="timeZone"
                options={zoneOptions}
                defaultValue={event.timeZone}
                onValueChange={setTimeZone}
              />
            </ControlledField>

            <FormField name="location">
              {({ fieldProps }) => (
                <ControlledField label={copy.createEvent.fields.location} htmlFor={fieldProps.id}>
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
                options={costModeOptions}
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

            <PolicyEditor name="policies" eventKind={event.kind} defaultValue={policies} />

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
  );
}
