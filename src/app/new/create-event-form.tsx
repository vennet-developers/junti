"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";

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
import { PolicyEditor, type PolicyDraft, type PolicyOptionView } from "@/components/policy-editor";
import { SelectField } from "@/components/select-field";
import { Notice } from "@/components/notice";
import { clearDraft, takeDraft, type EventDraft } from "@/lib/event-draft";
import { detectTimeZone, timeZoneLabel, timeZoneOptions } from "@/lib/time-zones";
import { makeEventClientSchema } from "@/lib/validation";

import { createEvent, type CreateEventState } from "./actions";
import { SignInPill } from "./sign-in-pill";

export interface CreateEventFormProps {
  defaultTimeZone: string;
  defaultLocale: string;
  /** From the `event_types` catalogue, already resolved for this reader. */
  eventTypes: { id: string; slug: string; label: string }[];
  /**
   * What each type offers, keyed by type id. Loaded for every type at once so
   * changing the kind updates the list without a round trip.
   */
  policyOptionsByType: Record<string, PolicyOptionView[]>;
  /** Who the event will be attributed to, or null when signed out. */
  organizer: { displayName: string; avatarUrl: string | null } | null;
  /**
   * An event being duplicated, already shifted to next week.
   *
   * Outranks a parked draft: arriving here from "duplicate and edit" is an
   * explicit request for THIS event, and restoring something half-typed from an
   * earlier sitting over it would be baffling.
   */
  prefill: Record<string, unknown> | null;
}

/**
 * Read at most once per page load, and cached so `useSyncExternalStore` gets a
 * stable reference — returning a fresh object from `getSnapshot` makes React
 * re-render forever.
 */
let cachedDraft: EventDraft | null | undefined;

function draftSnapshot(): EventDraft | null {
  if (cachedDraft === undefined) cachedDraft = takeDraft();
  return cachedDraft;
}

/**
 * Restores a draft parked before signing in, then hands off.
 *
 * The restore has to remount the body rather than merely feed it new props:
 * `FormController` builds its store once, and several controls hold their own
 * state. Keying on whether a draft was found means exactly one remount, right
 * after hydration and before anybody has typed.
 */
export function CreateEventForm(props: CreateEventFormProps) {
  const parked = useSyncExternalStore(
    () => () => {},
    draftSnapshot,
    () => null,
  );

  const draft = props.prefill ?? parked;

  return (
    <CreateEventFormBody
      key={props.prefill ? "duplicate" : draft ? "restored" : "fresh"}
      {...props}
      draft={draft}
      restoredFromDraft={!props.prefill && draft !== null}
    />
  );
}

function CreateEventFormBody({
  defaultTimeZone,
  defaultLocale,
  eventTypes,
  policyOptionsByType,
  organizer,
  draft,
  restoredFromDraft,
}: CreateEventFormProps & { draft: EventDraft | null; restoredFromDraft: boolean }) {
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
      currency: "COP",
      policies: JSON.stringify(defaultPolicies(policyOptionsByType[eventTypes[0]?.id ?? ""])),
      // A restored draft wins over every default above it.
      ...(draft ?? {}),
    }),
    [eventTypes, policyOptionsByType, defaultTimeZone, defaultLocale, draft],
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
      const result = await createEvent({ errors: {} }, formData);
      // A successful create redirects, so anything returned is a failure.
      if (result) setServerState(result);
    });

    // The draft has served its purpose either way: on success the event exists,
    // and on failure the form is still on screen holding the same values.
    clearDraft();
  }

  return (
    <FormController resolver={resolver} defaultValues={defaultValues} mode="onBlur">
      {({ handleSubmit }) => (
        <form onSubmit={handleSubmit(submit)} noValidate>
          <Stack gap="5">
            {/* First, because attribution cannot be fixed after the fact. */}
            <SignInPill organizer={organizer} />

            {restoredFromDraft ? <Notice tone="info" title={copy.createEvent.draftKept} /> : null}

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
        </form>
      )}
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
