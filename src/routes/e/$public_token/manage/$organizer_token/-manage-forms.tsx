"use client";

import { useMemo, useState, useTransition } from "react";

import { Input } from "@stackmyth/input";
import { Stack } from "@stackmyth/layout";
import { Textarea } from "@stackmyth/textarea";
import { toast } from "@stackmyth/toast";

import { DateTimeField } from "@/components/date-time-field";
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
import { Notice } from "@/components/notice";
import { PolicyEditor, type PolicyDraft, type PolicyOptionView } from "@/components/policy-editor";
import { SelectField } from "@/components/select-field";
import {
  currencyOptions,
  formatMoney,
  toDatePartValue,
  toMajorUnits,
  toTimePartValue,
} from "@/lib/format";
import type { EventView } from "@/lib/roster";
import { timeZoneLabel, timeZoneOptions } from "@/lib/time-zones";
import { makeEventClientSchema } from "@/lib/validation";

import { useRouter } from "@tanstack/react-router";

import { editEventFn, type ManageState } from "./-fns";

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

export function EditEventForm({
  publicToken,
  organizerToken,
  event,
  policies,
  eventTypes,
  policyOptionsByType,
  collectedMinor,
}: Ctx & {
  event: EventView;
  policies: PolicyDraft[];
  /** Money already confirmed for this event, for the remove-the-cost warning. */
  collectedMinor: number;
  eventTypes: { id: string; slug: string; label: string }[];
  policyOptionsByType: Record<string, PolicyOptionView[]>;
}) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverState, setServerState] = useState<ManageState>({ errors: {} });
  const [costMode, setCostMode] = useState<string>(event.costMode);
  const [currency, setCurrencyChoice] = useState<string>(event.currency);
  const [timeZone, setTimeZone] = useState(event.timeZone);
  const [eventTypeId, setEventTypeId] = useState(event.eventTypeId);

  const kindOptions = eventTypes.map((type) => ({ value: type.id, label: type.label }));

  /**
   * Everything on offer here, plus whatever this event already uses.
   *
   * The union matters when a policy was retired from the catalogue, or when the
   * organizer changes the kind of event: without it, a requirement the event
   * genuinely has would render with no name and silently vanish on save.
   */
  const policyOptions = (() => {
    const forType = policyOptionsByType[eventTypeId] ?? [];
    const seen = new Set(forType.map((option) => option.id));
    const extra = Object.values(policyOptionsByType)
      .flat()
      .filter(
        (option) => policies.some((p) => p.definitionId === option.id) && !seen.has(option.id),
      );
    return [...forType, ...extra];
  })();

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

  /** Memoised for the same reason as the create form — see the note there. */
  const defaults = useMemo(
    () => ({
      title: event.title,
      eventTypeId: event.eventTypeId,
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
    }),
    [event, policies],
  );

  function submit(data: Record<string, unknown>) {
    startTransition(async () => {
      const formData = toFormData(data);
      formData.set("publicToken", publicToken);
      formData.set("organizerToken", organizerToken);
      const result = await editEventFn({ data: formData });
      // Both views read this event; re-running the loaders is what the old
      // server-side refresh() did for whichever page is open.
      if (result.ok) await router.invalidate();
      setServerState(result);

      // Field errors stay by their fields; only the confirmation floats. This
      // form is long enough that an inline "saved" at the top would land off
      // screen from the button that caused it.
      if (result.ok) toast.success(copy.manage.editEventSaved);
    });
  }

  return (
    <FormController
      resolver={eventResolver}
      defaultValues={defaults}
      mode="onBlur"
      reValidateMode="onChange"
    >
      <Form onValid={submit}>
        <Stack gap="4">
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

          <ControlledField
            label={copy.createEvent.fields.kind}
            error={serverState.errors.eventTypeId}
          >
            <SelectField
              name="eventTypeId"
              options={kindOptions}
              defaultValue={event.eventTypeId}
              onValueChange={setEventTypeId}
            />
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

          {/*
            Removing the cost from an event that already collected money.

            The record of who paid survives this now — see `planLedger` — but
            it stops being visible, because there is no money UI on a free
            event. Saying so beforehand is the difference between a decision
            and a surprise: the organizer keeps their receipts either way, and
            can put the cost back to see them again.
          */}
          {costMode !== "none" ? (
            <ControlledField
              label={copy.createEvent.fields.currency}
              description={collectedMinor > 0 ? copy.errors.currencyLocked : undefined}
              error={serverState.errors.currency}
            >
              {/*
                Disabled the moment anything has been collected, and the help
                line says why: the stored amounts are integers in THIS
                currency's minor units, and 25.000 pesos handed over do not
                become 25.000 of something else because a label changed. The
                server enforces the same rule for whoever bypasses the form.
              */}
              <SelectField
                name="currency"
                options={currencyOptions(copy.intlLocale)}
                defaultValue={event.currency}
                onValueChange={setCurrencyChoice}
                disabled={collectedMinor > 0}
              />
            </ControlledField>
          ) : null}

          {/* The amount stays as WRITTEN when the currency changes — 15.000
              was pesos and is about to mean dollars. Say so while the field
              is on screen and editable. */}
          {costMode !== "none" && currency !== event.currency ? (
            <Notice tone="warning" title={copy.manage.currencyChanged(currency)} />
          ) : null}

          {costMode === "none" && event.costMode !== "none" && collectedMinor > 0 ? (
            <Notice
              tone="warning"
              title={copy.manage.removingCostWithCollected(
                formatMoney(collectedMinor, event.currency, copy.intlLocale),
              )}
            />
          ) : null}

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

          <PolicyEditor name="policies" options={policyOptions} defaultValue={policies} />

          <SubmitButton
            pending={pending}
            idleLabel={copy.common.save}
            pendingLabel={copy.common.loading}
            variant="secondary"
            size="md"
          />
        </Stack>
      </Form>
    </FormController>
  );
}
