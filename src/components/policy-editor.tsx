"use client";

import { useEffect, useState } from "react";

import { Button } from "@stackmyth/button";
import { Card } from "@stackmyth/card";
import { ChevronDownIcon, ChevronRightIcon } from "@stackmyth/icons";
import { Field, FieldLabel } from "@stackmyth/field";
import { useFormContext } from "@stackmyth/form";
import { Input } from "@stackmyth/input";
import { Box, Divider, Flex, Stack } from "@stackmyth/layout";
import { Switch } from "@stackmyth/switch";
import { Text } from "@stackmyth/text";

import { MAX_POLICIES_PER_EVENT } from "@/lib/validation";

import { useCopy } from "./copy-provider";
import { Notice } from "./notice";

/**
 * One catalogue entry, as the server resolved it for this reader.
 *
 * Mirrors `PolicyOption` from `src/lib/catalog.ts`, redeclared here because
 * that module is `server-only` and this component is not.
 */
export interface PolicyOptionView {
  id: string;
  slug: string;
  handler: string;
  label: string;
  description: string | null;
  isDefault: boolean;
  isSupported: boolean;
}

export interface PolicyDraft {
  /** Absent on a row the organizer just added. */
  id?: string;
  /** The catalogue entry this is an instance of. */
  definitionId: string;
  /** NULL follows the catalogue; a value is the organizer's own wording. */
  label: string | null;
  description: string | null;
}

/**
 * Sets up what an event asks for before somebody counts as confirmed.
 *
 * **The whole catalogue is always on screen, each entry behind a switch.**
 * This replaced an add-and-remove design — chips to add, a "Quitar" button to
 * delete — that made a reversible preference feel like construction work: what
 * you had not added was invisible, and backing out of a requirement read as
 * demolishing something you built. A switch says what this actually is: every
 * requirement the platform knows, each one on or off, togglable for as long as
 * the organizer keeps changing their mind. The catalogue is two entries today,
 * which is exactly the size where seeing everything at once beats a picker.
 *
 * **Turning one off forgets nothing.** The custom name and instructions of a
 * switched-off row are parked in component state, and flipping it back on
 * restores them — regret costs zero keystrokes. Only what is ON travels to the
 * server, so an abandoned draft of an override never outlives the session.
 *
 * The overrides live behind a "Personalizar" fold, collapsed by default,
 * because they are overrides: empty means "whatever the catalogue says, in the
 * reader's language", and most organizers never need different words. A row
 * that arrives with overrides already set (editing an existing event) opens
 * unfolded, because hiding words the organizer wrote would read as losing them.
 *
 * The list travels to the server as one JSON field rather than as
 * `policies[0][label]`-style names, because rows toggle on and off here and
 * indexed names leave a hole the moment the middle one turns off.
 */
export function PolicyEditor({
  name,
  options,
  defaultValue = [],
}: {
  name: string;
  /** Everything this event type offers, suggested ones first. */
  options: PolicyOptionView[];
  defaultValue?: PolicyDraft[];
}) {
  const { copy } = useCopy();
  const [drafts, setDrafts] = useState<PolicyDraft[]>(defaultValue);

  /**
   * Overrides of rows currently switched off, keyed by definition.
   *
   * The regret buffer: turning a requirement off moves its draft here instead
   * of discarding it, and turning it back on moves it back. Session-scoped on
   * purpose — an override the organizer switched off and then saved is one
   * they decided against, and resurrecting it next visit would be the app
   * remembering harder than they do.
   */
  const [parked, setParked] = useState<Map<string, PolicyDraft>>(new Map());

  /** Which rows have their "Personalizar" fold open. */
  const [unfolded, setUnfolded] = useState<Set<string>>(
    // Rows that arrive with overrides open unfolded — hiding words the
    // organizer already wrote would read as having lost them.
    () => new Set(defaultValue.filter((d) => d.label || d.description).map((d) => d.definitionId)),
  );

  const form = useFormContext();
  form?.store.register(name);

  useEffect(() => {
    form?.store.setValue(name, JSON.stringify(drafts));
    // `form` is a fresh object each render; keying on the data avoids a loop.
  }, [drafts, name]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = new Map(drafts.map((draft) => [draft.definitionId, draft]));
  const full = drafts.length >= MAX_POLICIES_PER_EVENT;

  // Suggested entries first, keeping the catalogue's own order within each
  // half. The association marks what is suggested, not what is permitted.
  const rows = [...options.filter((o) => o.isDefault), ...options.filter((o) => !o.isDefault)];

  function turnOn(option: PolicyOptionView) {
    if (full) return;
    const revived = parked.get(option.id);
    setDrafts((current) => [
      ...current,
      revived ?? { definitionId: option.id, label: null, description: null },
    ]);
    if (revived) {
      setParked((current) => {
        const next = new Map(current);
        next.delete(option.id);
        return next;
      });
      // Unfold what came back, for the same reason rows with overrides arrive
      // unfolded: restored words the organizer cannot see read as lost words.
      // The park-and-revive dance is only reassuring if you watch it happen.
      setUnfolded((current) => new Set(current).add(option.id));
    }
  }

  function turnOff(option: PolicyOptionView) {
    const draft = active.get(option.id);
    if (!draft) return;
    // Park the overrides so a change of heart restores them intact.
    if (draft.label || draft.description) {
      setParked((current) => new Map(current).set(option.id, draft));
    }
    setDrafts((current) => current.filter((d) => d.definitionId !== option.id));
    setUnfolded((current) => {
      const next = new Set(current);
      next.delete(option.id);
      return next;
    });
  }

  function update(definitionId: string, patch: Partial<PolicyDraft>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.definitionId === definitionId ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function toggleFold(definitionId: string) {
    setUnfolded((current) => {
      const next = new Set(current);
      if (next.has(definitionId)) next.delete(definitionId);
      else next.add(definitionId);
      return next;
    });
  }

  return (
    <Stack gap="4">
      <Stack gap="1">
        <Text weight="semibold">{copy.policies.sectionTitle}</Text>
        <Text variant="small" color="muted">
          {copy.policies.sectionHelp}
        </Text>
      </Stack>

      {/*
        One card, one row per catalogue entry, dividers between. `padding="0"`
        so the dividers run edge to edge — the same reasoning as the event
        card's bands: a rule that stops short of the frame reads as a stripe.
      */}
      <Card surface="outlined" padding="0">
        <Stack gap="0">
          {rows.map((option, index) => {
            const draft = active.get(option.id);
            const on = draft !== undefined;
            const open = on && unfolded.has(option.id);
            const switchId = `policy-switch-${option.slug}`;

            return (
              <Box key={option.id}>
                {index > 0 ? <Divider /> : null}

                <Stack gap="3" px="5" py="4">
                  {/*
                    The whole header is one implicit label — the composition
                    Checkbox rows already use in this app, because `htmlFor`
                    is not a layout prop. Tapping the name, the description or
                    the switch all toggle: the row is the control. The switch
                    still carries an explicit aria-label so a screen reader
                    announces the requirement's name, not the paragraph.
                  */}
                  <Flex as="label" justify="between" align="start" gap="3" cursor="pointer">
                    <Box minWidth="0">
                      <Stack gap="1">
                        <Text weight="semibold" color={on ? undefined : "muted"}>
                          {option.label}
                        </Text>
                        {/*
                          What switching it on actually does, in one line —
                          visible in both states, because the moment you most
                          need it is while deciding whether to turn it on.
                        */}
                        <Text variant="small" color="muted">
                          {copy.policies.handlerHelp[option.handler] ?? option.description ?? ""}
                        </Text>
                      </Stack>
                    </Box>

                    <Box flexShrink={0} pt="1">
                      <Switch
                        id={switchId}
                        size="lg"
                        checked={on}
                        disabled={!on && full}
                        aria-label={option.label}
                        onCheckedChange={(checked) => (checked ? turnOn(option) : turnOff(option))}
                      />
                    </Box>
                  </Flex>

                  {/* A catalogue row naming a behaviour this build does not
                      have. It blocks nobody — see ParticipantCompliance —
                      but the organizer should know why nothing happens. */}
                  {on && !option.isSupported ? (
                    <Notice tone="warning" title={copy.policies.unsupported} />
                  ) : null}

                  {on ? (
                    <Stack gap="3">
                      <Box>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleFold(option.id)}
                          aria-expanded={open}
                        >
                          <Flex gap="1" align="center">
                            {open ? (
                              <ChevronDownIcon size={14} aria-hidden="true" />
                            ) : (
                              <ChevronRightIcon size={14} aria-hidden="true" />
                            )}
                            {copy.policies.customize}
                          </Flex>
                        </Button>
                      </Box>

                      {open ? (
                        <Stack gap="3" pl="4">
                          <Field>
                            <FieldLabel htmlFor={`policy-label-${option.slug}`}>
                              {copy.policies.labelField}
                            </FieldLabel>
                            <Input
                              id={`policy-label-${option.slug}`}
                              fullWidth
                              size="lg"
                              maxLength={60}
                              value={draft.label ?? ""}
                              placeholder={option.label}
                              onChange={(event) =>
                                update(option.id, { label: event.target.value || null })
                              }
                            />
                          </Field>
                          <Text variant="small" color="muted">
                            {copy.policies.labelOverrideHelp}
                          </Text>

                          <Field>
                            <FieldLabel htmlFor={`policy-description-${option.slug}`}>
                              {copy.policies.descriptionField}
                            </FieldLabel>
                            <Input
                              id={`policy-description-${option.slug}`}
                              fullWidth
                              size="lg"
                              maxLength={400}
                              value={draft.description ?? ""}
                              placeholder={option.description ?? ""}
                              onChange={(event) =>
                                update(option.id, { description: event.target.value || null })
                              }
                            />
                          </Field>
                          <Text variant="small" color="muted">
                            {copy.policies.descriptionOverrideHelp}
                          </Text>
                        </Stack>
                      ) : null}
                    </Stack>
                  ) : null}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </Card>

      {full ? (
        <Text variant="small" color="muted">
          {copy.policies.maxReached(MAX_POLICIES_PER_EVENT)}
        </Text>
      ) : null}
    </Stack>
  );
}
