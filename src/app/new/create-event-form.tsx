"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@stackmyth/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@stackmyth/field";
import { Input } from "@stackmyth/input";
import { Stack } from "@stackmyth/layout";
import { Spinner } from "@stackmyth/spinner";
import { Text } from "@stackmyth/text";
import { Textarea } from "@stackmyth/textarea";

import { SelectField } from "@/components/select-field";
import { copy } from "@/config/copy";

import { createEvent, type CreateEventState } from "./actions";

/** Declared here, not in actions.ts: a "use server" module exports only async functions. */
const EMPTY_STATE: CreateEventState = { errors: {} };

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

function SubmitButton() {
  const { pending } = useFormStatus();

  // STACKMYTH-GAP: Button's `loading` prop injects a hardcoded English
  // "Loading…" for screen readers with no prop to override it, in an app whose
  // every other string is Spanish. Spinner *does* expose `label`, so the
  // pending state is composed from a disabled Button plus a labelled Spinner
  // rather than using `loading`. See STACKMYTH-GAPS.md #4.
  return (
    <Button type="submit" size="lg" fullWidth disabled={pending}>
      {pending ? <Spinner size="sm" label={copy.createEvent.submitting} /> : null}
      {pending ? copy.createEvent.submitting : copy.createEvent.submit}
    </Button>
  );
}

export function CreateEventForm() {
  const [state, formAction] = useActionState(createEvent, EMPTY_STATE);
  const [costMode, setCostMode] = useState<string>("none");

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

  const showCost = costMode !== "none";

  return (
    <form action={formAction} noValidate>
      <Stack gap="5">
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
            autoComplete="off"
            placeholder={copy.createEvent.fields.titlePlaceholder}
            status={state.errors.title ? "error" : "default"}
          />
          {state.errors.title ? (
            <FieldError>{state.errors.title}</FieldError>
          ) : (
            <FieldDescription>{copy.createEvent.fields.titleHelp}</FieldDescription>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor={ids.kind}>{copy.createEvent.fields.kind}</FieldLabel>
          <SelectField id={ids.kind} name="kind" options={KIND_OPTIONS} defaultValue="match" />
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
            status={state.errors.startsAt ? "error" : "default"}
          />
          {state.errors.startsAt ? (
            <FieldError>{state.errors.startsAt}</FieldError>
          ) : (
            <FieldDescription>{copy.createEvent.fields.startsAtHelp}</FieldDescription>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor={ids.location}>
            {copy.createEvent.fields.location}{" "}
            <Text as="span" variant="small" color="muted">
              ({copy.common.optional})
            </Text>
          </FieldLabel>
          <Input
            id={ids.location}
            name="location"
            fullWidth
            size="lg"
            maxLength={200}
            autoComplete="off"
            placeholder={copy.createEvent.fields.locationPlaceholder}
          />
        </Field>

        <Field invalid={Boolean(state.errors.capacity)}>
          <FieldLabel htmlFor={ids.capacity}>
            {copy.createEvent.fields.capacity}{" "}
            <Text as="span" variant="small" color="muted">
              ({copy.common.optional})
            </Text>
          </FieldLabel>
          <Input
            id={ids.capacity}
            name="capacity"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            fullWidth
            size="lg"
            placeholder={copy.createEvent.fields.capacityPlaceholder}
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
            defaultValue="none"
            onValueChange={setCostMode}
          />
        </Field>

        {showCost ? (
          <Field invalid={Boolean(state.errors.costAmount)}>
            <FieldLabel htmlFor={ids.costAmount}>{copy.createEvent.fields.costAmount}</FieldLabel>
            <Input
              id={ids.costAmount}
              name="costAmount"
              inputMode="numeric"
              fullWidth
              size="lg"
              autoComplete="off"
              placeholder="120000"
              prefix="$"
              status={state.errors.costAmount ? "error" : "default"}
            />
            {state.errors.costAmount ? (
              <FieldError>{state.errors.costAmount}</FieldError>
            ) : (
              <FieldDescription>
                {costMode === "total"
                  ? copy.createEvent.fields.costAmountHelpTotal
                  : copy.createEvent.fields.costAmountHelpPerPerson}
              </FieldDescription>
            )}
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor={ids.notes}>
            {copy.createEvent.fields.notes}{" "}
            <Text as="span" variant="small" color="muted">
              ({copy.common.optional})
            </Text>
          </FieldLabel>
          <Textarea
            id={ids.notes}
            name="notes"
            fullWidth
            rows={3}
            maxLength={2000}
            placeholder={copy.createEvent.fields.notesPlaceholder}
          />
        </Field>

        <input type="hidden" name="currency" value="COP" />

        <SubmitButton />
      </Stack>
    </form>
  );
}
