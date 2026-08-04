"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";

import { Input } from "@stackmyth/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@stackmyth/input-group";
import { Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Textarea } from "@stackmyth/textarea";

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
import { PolicyEditor, type PolicyDraft, type PolicyOptionView } from "@/components/policy-editor";
import { SelectField } from "@/components/select-field";
import { currencyOptions } from "@/lib/format";
import { detectTimeZone, timeZoneLabel, timeZoneOptions } from "@/lib/time-zones";
import { makeEventClientSchema } from "@/lib/validation";

import { createEventFn, type CreateEventState } from "./-fns";

export interface CreateEventFormProps {
  defaultTimeZone: string;
  /** From the organizer's stored preference, else COP. */
  defaultCurrency: string;
  defaultLocale: string;
  /** From the `event_types` catalogue, already resolved for this reader. */
  eventTypes: { id: string; slug: string; label: string }[];
  /**
   * What each type offers, keyed by type id. Loaded for every type at once so
   * changing the kind updates the list without a round trip.
   */
  policyOptionsByType: Record<string, PolicyOptionView[]>;
  /** An event being duplicated, already shifted to next week. */
  prefill: Record<string, unknown> | null;
}

/**
 * The create form.
 *
 * This used to also restore a draft parked in `sessionStorage` before an OAuth
 * round trip, remounting the body once after hydration to feed the store values
 * `FormController` only reads at construction. That machinery existed for one
 * situation — being offered sign-in on top of a half-typed form — and the page
 * now requires a session before rendering any of this, so there is nothing to
 * park and nothing to come back to.
 */
export function CreateEventForm(props: CreateEventFormProps) {
  return <CreateEventFormBody {...props} draft={props.prefill} />;
}

function CreateEventFormBody({
  defaultTimeZone,
  defaultCurrency,
  defaultLocale,
  eventTypes,
  policyOptionsByType,
  draft,
}: CreateEventFormProps & { draft: Record<string, unknown> | null }) {
  const { copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [serverState, setServerState] = useState<CreateEventState>({ errors: {} });

  // Mirrors of the controls that are not plain inputs, so the resolver can see
  // their values and dependent fields can appear conditionally.
  const [costMode, setCostMode] = useState(str(draft?.costMode) ?? "none");
  // The first catalogue entry is the default. Nothing in code names a type,
  // so adding one and putting it first changes the default with no deploy.
  const [eventTypeId, setEventTypeId] = useState(
    str(draft?.eventTypeId) ?? eventTypes[0]?.id ?? "",
  );
  /**
   * The organizer's actual timezone.
   *
   * `useSyncExternalStore` rather than an effect, because this is exactly the
   * problem it exists for: a value the server cannot know and the client can.
   * The server snapshot renders the floor, React re-renders with the real zone
   * straight after hydration, and there is no mismatch and no `setState` in an
   * effect.
   *
   * `subscribe` is a no-op — a device does not change timezone mid-form.
   */
  const detectedTimeZone = useSyncExternalStore(
    () => () => {},
    () => detectTimeZone(),
    () => defaultTimeZone,
  );

  /** Null until the organizer picks one; their choice always wins. */
  const [chosenTimeZone, setChosenTimeZone] = useState<string | null>(str(draft?.timeZone) ?? null);
  const timeZone = chosenTimeZone ?? detectedTimeZone;

  const kindOptions = eventTypes.map((type) => ({ value: type.id, label: type.label }));

  const costModeOptions = [
    { value: "none", label: copy.createEvent.costModes.none },
    { value: "total", label: copy.createEvent.costModes.total },
    { value: "per_person", label: copy.createEvent.costModes.per_person },
  ];

  // `new Date()` only to label zones with their CURRENT offset, so a zone on
  // daylight saving reads the way the person checking the list expects.
  // Keyed on the CURRENT zone, so a detected one outside the curated list is
  // still in the picker rather than silently absent from it.
  const zoneOptions = useMemo(
    () => timeZoneOptions(timeZone, copy.intlLocale, new Date()),
    [timeZone, copy.intlLocale],
  );

  const resolver = useMemo(() => createZodResolver(makeEventClientSchema(copy)), [copy]);

  /**
   * Memoised, and it has to be.
   *
   * `FormController` treats a new `defaultValues` identity as a reset, and this
   * component re-renders on every keystroke and every picker change. Rebuilding
   * the object inline wiped the store between typing and submitting, and the
   * action arrived with empty FormData — silently, because a form that submits
   * nothing produces no validation errors to show.
   *
   * The dependencies are all props, so this is computed once per page load.
   */
  const defaultValues = useMemo(
    () => ({
      title: "",
      eventTypeId: eventTypes[0]?.id ?? "",
      startsAtDate: "",
      startsAtTime: "",
      timeZone: defaultTimeZone,
      locale: defaultLocale,
      location: "",
      capacity: "",
      notes: "",
      costMode: "none",
      costAmount: "",
      currency: str(draft?.currency) ?? defaultCurrency,
      policies: JSON.stringify(defaultPolicies(policyOptionsByType[eventTypes[0]?.id ?? ""])),
      // A restored draft wins over every default above it.
      ...(draft ?? {}),
    }),
    [eventTypes, policyOptionsByType, defaultTimeZone, defaultCurrency, defaultLocale, draft],
  );

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
      const result = await createEventFn({ data: formData });
      // A successful create redirects, so anything returned is a failure.
      if (result) setServerState(result);
    });
  }

  /*
   * `onSubmit`, not `onBlur`: nothing is validated and nothing turns red until
   * the create button is pressed once. Tabbing through a form you have not
   * finished should not accuse you of anything.
   *
   * `reValidateMode` is the second half: after that first press, each field
   * re-checks as it is corrected, so an error clears the moment the field is
   * fixed instead of surviving until the next press. Gap #15 — added to
   * @stackmyth/form in 0.20.0 for exactly this form.
   */
  return (
    <FormController
      resolver={resolver}
      defaultValues={defaultValues}
      mode="onSubmit"
      reValidateMode="onChange"
    >
      <Form onValid={submit}>
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

          <ControlledField
            label={copy.createEvent.fields.kind}
            error={serverState.errors.eventTypeId}
          >
            <SelectField
              name="eventTypeId"
              options={kindOptions}
              defaultValue={eventTypes[0]?.id ?? ""}
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
              defaultValue={timeZone}
              onValueChange={setChosenTimeZone}
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
            <ControlledField
              label={copy.createEvent.fields.currency}
              error={serverState.errors.currency}
            >
              {/* Before the amount on purpose: the currency decides how the
                  amount is READ ("50.50" is cents in dollars and a typo in
                  pesos), so it should be settled before typing begins. */}
              <SelectField
                name="currency"
                options={currencyOptions(copy.intlLocale)}
                defaultValue={str(draft?.currency) ?? defaultCurrency}
              />
            </ControlledField>
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
                  {/* The currency symbol is an addon, not a prop on the
                      input. `InputGroup` owns the border and focus ring via
                      `:has()`, so the symbol sits inside the same outline
                      instead of beside it. The addon comes AFTER the input in
                      the DOM and is placed by `align` — that is what keeps
                      keyboard focus landing on the field first. */}
                  <InputGroup fullWidth>
                    <InputGroupInput
                      {...fieldProps}
                      inputMode="numeric"
                      size="lg"
                      autoComplete="off"
                      placeholder="120000"
                      status={error ? "error" : "default"}
                    />
                    <InputGroupAddon align="inline-start">
                      <InputGroupText>$</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
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

          {/* Remounted when the kind changes (`key`), so switching from a
              match to a party swaps the suggestions AND the pre-added rows
              instead of leaving the previous type's choices behind. */}
          <PolicyEditor
            key={eventTypeId}
            name="policies"
            options={policyOptionsByType[eventTypeId] ?? []}
            defaultValue={defaultPolicies(policyOptionsByType[eventTypeId])}
          />

          <SubmitButton
            pending={pending}
            idleLabel={copy.createEvent.submit}
            pendingLabel={copy.createEvent.submitting}
          />
        </Stack>
      </Form>
    </FormController>
  );
}

/**
 * The requirements a kind of event starts with already added.
 *
 * `is_default` in `event_type_policies` — a match pre-adds proof of payment,
 * because that is the case the whole feature exists for. Everything else is
 * merely offered.
 */
function defaultPolicies(options: PolicyOptionView[] | undefined): PolicyDraft[] {
  return (options ?? [])
    .filter((option) => option.isDefault)
    .map((option) => ({ definitionId: option.id, label: null, description: null }));
}

/** A draft value as a string, or undefined when it is absent or not one. */
function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
