"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { Input } from "@stackmyth/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@stackmyth/input-group";
import { Banner } from "@stackmyth/banner";
import { Button } from "@stackmyth/button";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Textarea } from "@stackmyth/textarea";

import { DateTimeField } from "@/components/date-time-field";
import {
  ControlledField,
  Form,
  FormController,
  FormError,
  FormField,
  createZodResolver,
} from "@/components/form-shell";
import { useCopy } from "@/components/copy-provider";
import { useFormContext } from "@stackmyth/form";
import { PolicyEditor, type PolicyDraft, type PolicyOptionView } from "@/components/policy-editor";
import { SelectField } from "@/components/select-field";
import { LEAD_HOURS } from "@/domain/convocation";
import { currencyOptions } from "@/lib/format";
import { detectTimeZone, timeZoneLabel, timeZoneOptions } from "@/lib/time-zones";
import { makeEventClientSchema } from "@/lib/validation";
import {
  firstStepWithError,
  normaliseStep,
  isMoneyStepEmpty,
  nextStep as advance,
  previousStep,
  stepOf,
  totalSteps,
  type WizardStep,
} from "@/domain/wizard";
import {
  clearDraft,
  dismissDraft,
  getDraftSnapshot,
  getServerDraftSnapshot,
  isWorthRestoring,
  saveDraft,
  subscribeDraft,
} from "@/lib/event-draft";
import { trackClient } from "@/lib/track-client";

import { StepPanel, StepTracking, WizardNav, WizardProgress } from "./-wizard";

import { useNavigate, useSearch } from "@tanstack/react-router";

import { createEventFn, type CreateEventState } from "./-fns";

export interface CreateEventFormProps {
  defaultTimeZone: string;
  /** From the organizer's stored preference, else COP. */
  defaultCurrency: string;
  defaultLocale: string;
  /** From the `event_types` catalogue, already resolved for this reader. */
  eventTypes: { id: string; slug: string; label: string }[];
  /**
   * The organizer's own groups. Attaching one is what makes the event
   * invitable — without it there is nobody who consented to be asked, and the
   * only way in is the public link.
   */
  groups: { id: string; name: string }[];
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
  groups,
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

  // "Sin fecha límite" first and selected by default: most events do not need a
  // deadline, and one that appears because somebody skipped past a dropdown is
  // the kind of rule nobody remembers setting and everybody has to obey.
  const rsvpLeadOptions = [
    { value: "", label: copy.createEvent.fields.rsvpLeadNone },
    ...LEAD_HOURS.map((hours) => ({
      value: String(hours),
      label: copy.createEvent.fields.rsvpLeadOptions[hours],
    })),
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

  /*
    The step is a router search param, so the browser's back button and the
    wizard's own back control are the same action — AC-3.

    An earlier version pushed history entries by hand, on the theory that the
    router was remounting this component and wiping the form. **That diagnosis
    was wrong**: the culprit was `StepPanel` changing the shape of its subtree
    between active and inactive, which unmounted every input. Going around the
    router had a cost that took a while to surface — it left the router's idea
    of the current location behind the browser's, so the `redirect` thrown by
    a successful create could not be matched and escaped to the error boundary
    as a bare `Response`. The event was created; the organizer saw a crash.

    Through the router, both work.
  */
  const navigate = useNavigate();
  const search = useSearch({ from: "/new/" }) as { from?: string; step?: number };
  const step = normaliseStep(search.step);

  const setStep = useCallback(
    (next: WizardStep) => {
      /*
        Search-only, with no `to`. Passing `to: "/new"` from inside the `/new/`
        route resolves it RELATIVELY — the router built `/new//new/`, could not
        match it, and the `redirect` thrown by a successful create then escaped
        to the error boundary as a bare `Response`. The event was created and
        the organizer saw a crash, which is the worst shape a bug can take.
      */
      void navigate({
        to: ".",
        search: (prev: { from?: string; step?: number }) => ({ ...prev, step: next }),
      });
    },
    [navigate],
  );

  const goTo = setStep;

  /** Set on a successful create, so the abandonment listener stays quiet. */
  const [finished, setFinished] = useState(false);

  /**
   * A restored draft, and the counter that makes it take effect.
   *
   * `store.reset(values)` updates the store but not the inputs — they read
   * their value at construction, so a reset leaves the DOM showing the old
   * (empty) form over the new values. Remounting `FormController` with the
   * draft as its `defaultValues` is the path the library itself uses to put
   * values into fields, so it is the one that cannot disagree with itself.
   *
   * The counter is the remount: a changing `key` is what tells React to build
   * a new controller rather than update the existing one.
   */
  const [restored, setRestored] = useState<Record<string, unknown> | null>(null);
  const [generation, setGeneration] = useState(0);

  function restoreDraft(values: Record<string, unknown>) {
    setRestored(values);
    setGeneration((n) => n + 1);
    // Back to the first step: the restored form is a form nobody has walked
    // through yet, and dropping somebody on step 2 of it would be a puzzle.
    setStep(1);
  }

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
      rsvpLead: "",
      notes: "",
      costMode: "none",
      costAmount: "",
      currency: str(draft?.currency) ?? defaultCurrency,
      policies: JSON.stringify(defaultPolicies(policyOptionsByType[eventTypes[0]?.id ?? ""])),
      // A restored draft wins over every default above it.
      ...(draft ?? {}),
    }),
    /*
      Empty deps, deliberately, and this is the second time this object has
      caused a silent data loss.

      The comment above explains that a new identity is treated as a reset.
      What it did not anticipate is the wizard: `step` comes from the URL, so
      changing step re-renders this component, and the loader data arriving as
      fresh object identities was enough to rebuild this and wipe everything
      typed on the previous step — AC-3's "back navigation preserves entered
      data", failing in the least visible way possible.

      Defaults are read exactly once, at construction, so computing them more
      than once cannot be right. The lint rule wants the deps listed; the
      component wants them ignored.
    */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * Client validation has passed. Hand the raw values to the server action,
   * which re-validates them before touching the database.
   */
  /**
   * Validation passed. On the last step that means create; before it, advance.
   *
   * Routing both through the form's own submit is what makes the errors land
   * inline beside each field — the library paints them, this component does
   * not invent a second way to show them. AC-2.
   */
  function submit(data: Record<string, unknown>) {
    const lastStep = step === 3 || (step === 2 && isMoneyStepEmpty(String(data.costMode ?? "none")));

    if (!lastStep) {
      trackClient("create_step_completed", { step });
      goTo(advance(step));
      return;
    }

    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      formData.set(key, value == null ? "" : String(value));
    }

    startTransition(async () => {
      const result = await createEventFn({ data: formData });

      if (result?.redirectTo) {
        // Only here. Somebody who closed the tab is exactly who the draft is
        // for; the age check is what eventually cleans up after them.
        setFinished(true);
        clearDraft();
        void navigate({ href: result.redirectTo });
        return;
      }

      if (!result) return;

      setServerState(result);

      /*
        The server re-validates everything and can reject a field the client
        thought was fine — a group that stopped existing between steps, a
        currency no longer supported. Landing on the last step with an error
        about the title is how a form becomes unusable, so walk back to the
        earliest step that carries one.
      */
      const back = firstStepWithError(Object.keys(result.errors ?? {}));
      if (back !== null && back !== step) goTo(back);
    });
  }

  /**
   * Validation failed. Whether that blocks the organizer depends on WHERE.
   *
   * The resolver checks the whole event, so a missing amount on step 3 fails
   * while somebody is standing on step 1 — with the error painted on a field
   * they cannot see. That is the trap this handler exists for: if nothing that
   * failed belongs to the current step, the failure is not theirs yet and the
   * wizard advances. `firstStepWithError` then walks them to the earliest step
   * that does have a problem, so the error is always on screen when it blocks.
   */
  function handleInvalid(errors: Record<string, string[]>) {
    const fields = Object.keys(errors);
    const blocking = fields.filter((f) => stepOf(f) === step);

    if (blocking.length > 0) return;

    // Nothing on this step is wrong. Advance — or, on the last step, send them
    // back to whichever earlier step is actually blocking the create.
    const isLast = step === 3 || (step === 2 && isMoneyStepEmpty(costMode));
    if (!isLast) {
      trackClient("create_step_completed", { step });
      goTo(advance(step));
      return;
    }

    const back = firstStepWithError(fields);
    if (back !== null) goTo(back);
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
      key={generation}
      resolver={resolver}
      defaultValues={generation === 0 ? defaultValues : { ...defaultValues, ...(restored ?? {}) }}
      mode="onSubmit"
      reValidateMode="onChange"
    >
      <Form onValid={submit} onInvalid={handleInvalid}>
        <Stack gap="5">
          <FormError message={serverState.errors._form} />

          {/* First thing on the page, and it has to be: it asks a question
              about the form underneath it, and a question that arrives after
              the thing it is about is a question nobody answers. */}
          <DraftOffer onRestore={restoreDraft} />

          <WizardProgress
            step={step}
            total={totalSteps(costMode)}
            pending={pending}
            onBack={() => goTo(previousStep(step))}
          />

          {/* Every step's fields stay mounted and hidden rather than being
              unmounted. `FormController` holds the values either way, but a
              hidden input keeps its DOM state — a half-typed date, a picker
              mid-open — and coming back to a step you left should be exactly
              where you left it, not a re-render of it. */}
          <StepPanel active={step === 1}>
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

          {/* Optional on purpose. Plenty of events are a link in a chat and
              nothing more; a required group would turn "make a plan" into
              "first, build an address book". */}
          </StepPanel>

          <StepPanel active={step === 2}>
          <ControlledField
            label={copy.groups.eventFieldLabel}
            description={
              groups.length === 0 ? copy.groups.eventFieldEmpty : copy.groups.eventFieldHelp
            }
            error={serverState.errors.groupId}
          >
            <SelectField
              name="groupId"
              options={[
                { value: "", label: copy.groups.eventFieldNone },
                ...groups.map((group) => ({ value: group.id, label: group.name })),
              ]}
              defaultValue={str(draft?.groupId) ?? ""}
            />
          </ControlledField>
          </StepPanel>

          <StepPanel active={step === 1}>
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

          </StepPanel>

          <StepPanel active={step === 2}>
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

          <ControlledField
            label={
              <>
                {copy.createEvent.fields.rsvpLead}{" "}
                <Text as="span" variant="small" color="muted">
                  ({copy.common.optional})
                </Text>
              </>
            }
            description={copy.createEvent.fields.rsvpLeadHelp}
            error={serverState.errors.rsvpLead}
          >
            <SelectField
              name="rsvpLead"
              options={rsvpLeadOptions}
              defaultValue={str(draft?.rsvpLead) ?? ""}
            />
          </ControlledField>

          {/* The yes/no on money closes step 2, because the answer decides
              whether there is a step 3 at all. Asking it on step 3 was
              circular, and made the wizard promise three steps to somebody
              who would only fill two. */}
          <ControlledField label={copy.createEvent.fields.costMode}>
            <SelectField
              name="costMode"
              options={costModeOptions}
              defaultValue="none"
              onValueChange={setCostMode}
            />
          </ControlledField>
          </StepPanel>

          <StepPanel active={step === 3}>

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

          </StepPanel>

          <StepPanel active={step === 1}>
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

          </StepPanel>

          <StepPanel active={step === 2}>
          {/* Remounted when the kind changes (`key`), so switching from a
              match to a party swaps the suggestions AND the pre-added rows
              instead of leaving the previous type's choices behind. */}
          <PolicyEditor
            key={eventTypeId}
            name="policies"
            options={policyOptionsByType[eventTypeId] ?? []}
            defaultValue={defaultPolicies(policyOptionsByType[eventTypeId])}
          />

          </StepPanel>

          <WizardControls
            step={step}
            pending={pending}
            freeEvent={isMoneyStepEmpty(costMode)}
            finished={finished}
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

/**
 * The step gate, the draft and the per-step analytics.
 *
 * A child of `<Form>` rather than part of the body above, because all three
 * need the form store and `useFormContext` only reaches it from inside. It
 * renders the navigation and nothing else.
 */
function WizardControls({
  step,
  pending,
  freeEvent,
  finished,
}: {
  step: WizardStep;
  pending: boolean;
  freeEvent: boolean;
  finished: boolean;
}) {
  const form = useFormContext();


  /*
    Saved on a timer rather than on every keystroke: `localStorage` is
    synchronous and writing on each character of a title is work on the main
    thread during typing, which is the one moment a form must not stutter.
    Two seconds is well inside "I closed the tab by accident".
  */
  useEffect(() => {
    if (finished) return;

    const timer = window.setInterval(() => {
      const values = form?.store.getValues();
      if (values && isWorthRestoring(values)) saveDraft(values);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [form, finished]);

  return (
    <>
      <StepTracking step={step} finished={finished} />


      <WizardNav
        step={step}
        pending={pending}
        freeEvent={freeEvent}
      />
    </>
  );
}

/**
 * "You left one half filled — carry on, or start over?"
 *
 * Its own component, and at the top of the form, because it asks a question
 * about everything below it. It first shipped at the bottom, next to the
 * navigation, where it read as an unexplained pair of buttons after a form
 * that already looked empty.
 *
 * A child of `<Form>` so `useFormContext` reaches the store — restoring is
 * `store.reset(values)`, which is the same call the library uses to
 * initialise, so the restored form behaves exactly like a fresh one.
 */
function DraftOffer({ onRestore }: { onRestore: (values: Record<string, unknown>) => void }) {
  const { copy } = useCopy();
  /*
    `useSyncExternalStore` rather than an effect: this is a value the server
    cannot know and the client can, which is exactly what it exists for. An
    effect would render once with the wrong answer and then set state, which
    is a cascading render and, in this codebase, a lint error that is right.
  */
  const stored = useSyncExternalStore(subscribeDraft, getDraftSnapshot, getServerDraftSnapshot);

  // Local, so dismissing re-renders. The module-level snapshot is what stops
  // the offer coming back on the next render.
  const [dismissed, setDismissed] = useState(false);
  const offered = dismissed ? null : stored;

  if (!offered) return null;

  return (
    <Banner
      variant="info"
      live="off"
      title={copy.createEvent.wizard.draftFound}
      action={
        <Flex gap="2" wrap="wrap">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              dismissDraft();
              setDismissed(true);
              onRestore(offered);
            }}
          >
            {copy.createEvent.wizard.draftRestore}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              clearDraft();
              dismissDraft();
              setDismissed(true);
            }}
          >
            {copy.createEvent.wizard.draftDiscard}
          </Button>
        </Flex>
      }
    />
  );
}
