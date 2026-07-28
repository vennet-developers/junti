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
import { PolicyEditor } from "@/components/policy-editor";
import { SelectField } from "@/components/select-field";
import type { EventKind } from "@/domain/types";
import { timeZoneLabel, timeZoneOptions } from "@/lib/time-zones";
import { makeEventClientSchema } from "@/lib/validation";

import { createEvent, type CreateEventState } from "./actions";

export function CreateEventForm({
  defaultTimeZone,
  defaultLocale,
}: {
  defaultTimeZone: string;
  defaultLocale: string;
}) {
  const { copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [serverState, setServerState] = useState<CreateEventState>({ errors: {} });

  // Mirrors of the controls that are not plain inputs, so the resolver can see
  // their values and dependent fields can appear conditionally.
  const [costMode, setCostMode] = useState("none");
  const [kind, setKind] = useState<EventKind>("match");
  const [timeZone, setTimeZone] = useState(defaultTimeZone);

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

  // `new Date()` only to label zones with their CURRENT offset, so a zone on
  // daylight saving reads the way the person checking the list expects.
  const zoneOptions = useMemo(
    () => timeZoneOptions(defaultTimeZone, copy.intlLocale, new Date()),
    [defaultTimeZone, copy.intlLocale],
  );

  const resolver = useMemo(() => createZodResolver(makeEventClientSchema(copy)), [copy]);

  const defaultValues = {
    title: "",
    kind: "match",
    startsAtDate: "",
    startsAtTime: "",
    timeZone: defaultTimeZone,
    locale: defaultLocale,
    location: "",
    capacity: "",
    notes: "",
    costMode: "none",
    costAmount: "",
    currency: "COP",
    policies: "[]",
  };

  /**
   * Client validation has passed. Hand the raw values to the server action,
   * which re-validates them before touching the database.
   */
  function submit(data: Record<string, unknown>) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      formData.set(key, value == null ? "" : String(value));
    }

    startTransition(async () => {
      const result = await createEvent({ errors: {} }, formData);
      // A successful create redirects, so anything returned is a failure.
      if (result) setServerState(result);
    });
  }

  return (
    <FormController resolver={resolver} defaultValues={defaultValues} mode="onBlur">
      {({ handleSubmit }) => (
        <form onSubmit={handleSubmit(submit)} noValidate>
          <Stack gap="5">
            <FormError message={serverState.errors._form} />

            <FormField name="title">
              {({ fieldProps, error }) => (
                <ControlledField
                  label={copy.createEvent.fields.title}
                  description={copy.createEvent.fields.titleHelp}
                  error={error ?? serverState.errors.title}
                  htmlFor={fieldProps.id}
                >
                  <Input
                    {...fieldProps}
                    fullWidth
                    size="lg"
                    maxLength={120}
                    autoComplete="off"
                    placeholder={copy.createEvent.fields.titlePlaceholder}
                    status={error ? "error" : "default"}
                  />
                </ControlledField>
              )}
            </FormField>

            <ControlledField label={copy.createEvent.fields.kind}>
              <SelectField
                name="kind"
                options={kindOptions}
                defaultValue="match"
                onValueChange={(value) => setKind(value as EventKind)}
              />
            </ControlledField>

            <ControlledField
              label={copy.createEvent.fields.startsAt}
              description={copy.createEvent.fields.startsAtHelp(
                timeZoneLabel(timeZone, copy.intlLocale, new Date()),
              )}
              error={serverState.errors.startsAtDate ?? serverState.errors.startsAtTime}
            >
              <DateTimeField dateName="startsAtDate" timeName="startsAtTime" />
            </ControlledField>

            <ControlledField
              label={copy.createEvent.fields.timeZone}
              description={copy.createEvent.fields.timeZoneHelp}
              error={serverState.errors.timeZone}
            >
              <SelectField
                name="timeZone"
                options={zoneOptions}
                defaultValue={defaultTimeZone}
                onValueChange={setTimeZone}
              />
            </ControlledField>

            <FormField name="location">
              {({ fieldProps }) => (
                <ControlledField
                  label={
                    <>
                      {copy.createEvent.fields.location}{" "}
                      <Text as="span" variant="small" color="muted">
                        ({copy.common.optional})
                      </Text>
                    </>
                  }
                  htmlFor={fieldProps.id}
                >
                  <Input
                    {...fieldProps}
                    fullWidth
                    size="lg"
                    maxLength={200}
                    autoComplete="off"
                    placeholder={copy.createEvent.fields.locationPlaceholder}
                  />
                </ControlledField>
              )}
            </FormField>

            <FormField name="capacity">
              {({ fieldProps, error }) => (
                <ControlledField
                  label={
                    <>
                      {copy.createEvent.fields.capacity}{" "}
                      <Text as="span" variant="small" color="muted">
                        ({copy.common.optional})
                      </Text>
                    </>
                  }
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
                    placeholder={copy.createEvent.fields.capacityPlaceholder}
                    status={error ? "error" : "default"}
                  />
                </ControlledField>
              )}
            </FormField>

            <ControlledField label={copy.createEvent.fields.costMode}>
              <SelectField
                name="costMode"
                options={costModeOptions}
                defaultValue="none"
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
                      autoComplete="off"
                      placeholder="120000"
                      prefix="$"
                      status={error ? "error" : "default"}
                    />
                  </ControlledField>
                )}
              </FormField>
            ) : null}

            <FormField name="notes">
              {({ fieldProps }) => (
                <ControlledField
                  label={
                    <>
                      {copy.createEvent.fields.notes}{" "}
                      <Text as="span" variant="small" color="muted">
                        ({copy.common.optional})
                      </Text>
                    </>
                  }
                  htmlFor={fieldProps.id}
                >
                  <Textarea
                    {...fieldProps}
                    fullWidth
                    rows={3}
                    maxLength={2000}
                    placeholder={copy.createEvent.fields.notesPlaceholder}
                  />
                </ControlledField>
              )}
            </FormField>

            <PolicyEditor name="policies" eventKind={kind} />

            <SubmitButton
              pending={pending}
              idleLabel={copy.createEvent.submit}
              pendingLabel={copy.createEvent.submitting}
            />
          </Stack>
        </form>
      )}
    </FormController>
  );
}
