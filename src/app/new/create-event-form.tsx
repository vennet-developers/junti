"use client";

import { useState, useTransition } from "react";

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
import { SelectField } from "@/components/select-field";
import { copy } from "@/config/copy";
import { eventClientSchema } from "@/lib/validation";

import { createEvent, type CreateEventState } from "./actions";

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

const resolver = createZodResolver(eventClientSchema);

const DEFAULT_VALUES = {
  title: "",
  kind: "match",
  startsAtDate: "",
  startsAtTime: "",
  location: "",
  capacity: "",
  notes: "",
  costMode: "none",
  costAmount: "",
  currency: "COP",
};

export function CreateEventForm() {
  const [pending, startTransition] = useTransition();
  const [serverState, setServerState] = useState<CreateEventState>({ errors: {} });

  // Mirrors of the two controls that are not plain inputs, so the resolver can
  // see their values and the cost field can appear conditionally.
  const [costMode, setCostMode] = useState("none");

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
    <FormController resolver={resolver} defaultValues={DEFAULT_VALUES} mode="onBlur">
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
              <SelectField name="kind" options={KIND_OPTIONS} defaultValue="match" />
            </ControlledField>

            <ControlledField
              label={copy.createEvent.fields.startsAt}
              description={copy.createEvent.fields.startsAtHelp}
              error={serverState.errors.startsAtDate ?? serverState.errors.startsAtTime}
            >
              <DateTimeField dateName="startsAtDate" timeName="startsAtTime" />
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
                options={COST_MODE_OPTIONS}
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
