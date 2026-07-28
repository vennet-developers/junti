"use client";

import { useEffect, useState } from "react";

import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Field, FieldLabel } from "@stackmyth/field";
import { useFormContext } from "@stackmyth/form";
import { Input } from "@stackmyth/input";
import { Box, Flex, Stack } from "@stackmyth/layout";
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
 * The list of what CAN be asked comes from the database — `policy_definitions`
 * and its association to event types — not from a constant in this file. Adding
 * a requirement to the platform is a row; this component only ever renders what
 * it was handed.
 *
 * The name and instructions fields are **empty by default, showing the
 * catalogue text as a placeholder**. That is the interface for an override:
 * empty means "whatever the definition says, in whatever language the reader is
 * using", so renaming it in the catalogue renames it here too. Typing something
 * pins this event to those words.
 *
 * The list travels to the server as one JSON field rather than as
 * `policies[0][label]`-style names, because rows are added and removed here and
 * indexed names leave a hole the moment anyone deletes the middle one.
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

  const form = useFormContext();
  form?.store.register(name);

  useEffect(() => {
    form?.store.setValue(name, JSON.stringify(drafts));
    // `form` is a fresh object each render; keying on the data avoids a loop.
  }, [drafts, name]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = new Map(options.map((option) => [option.id, option]));
  const used = new Set(drafts.map((draft) => draft.definitionId));

  const full = drafts.length >= MAX_POLICIES_PER_EVENT;
  const available = options.filter((option) => !used.has(option.id));
  const suggested = available.filter((option) => option.isDefault);
  const rest = available.filter((option) => !option.isDefault);

  function add(option: PolicyOptionView) {
    if (full) return;
    setDrafts((current) => [
      ...current,
      { definitionId: option.id, label: null, description: null },
    ]);
  }

  function update(index: number, patch: Partial<PolicyDraft>) {
    setDrafts((current) =>
      current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)),
    );
  }

  function remove(index: number) {
    setDrafts((current) => current.filter((_, i) => i !== index));
  }

  return (
    <Stack gap="4">
      <Stack gap="1">
        <Text weight="semibold">{copy.policies.sectionTitle}</Text>
        <Text variant="small" color="muted">
          {copy.policies.sectionHelp}
        </Text>
      </Stack>

      {drafts.length === 0 ? (
        <Text variant="small" color="muted">
          {copy.policies.none}
        </Text>
      ) : (
        <Stack gap="3">
          {drafts.map((draft, index) => {
            const option = byId.get(draft.definitionId);

            return (
              <Card surface="outlined" key={draft.id ?? `new-${draft.definitionId}-${index}`}>
                <CardContent>
                  <Stack gap="3">
                    <Flex justify="between" align="center" gap="2">
                      <Box minWidth="0">
                        <Text weight="semibold">{option?.label ?? draft.definitionId}</Text>
                      </Box>
                      <Box flexShrink={0}>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => remove(index)}
                          aria-label={`${copy.policies.remove}: ${option?.label ?? ""}`}
                        >
                          {copy.policies.remove}
                        </Button>
                      </Box>
                    </Flex>

                    {/* A catalogue row naming a behaviour this build does not
                        have. It blocks nobody — see ParticipantCompliance —
                        but the organizer should know why nothing happens. */}
                    {option && !option.isSupported ? (
                      <Notice tone="warning" title={copy.policies.unsupported} />
                    ) : null}

                    <Field>
                      <FieldLabel htmlFor={`policy-label-${index}`}>
                        {copy.policies.labelField}
                      </FieldLabel>
                      <Input
                        id={`policy-label-${index}`}
                        fullWidth
                        size="lg"
                        maxLength={60}
                        value={draft.label ?? ""}
                        placeholder={option?.label ?? ""}
                        onChange={(event) => update(index, { label: event.target.value || null })}
                      />
                    </Field>
                    <Text variant="small" color="muted">
                      {copy.policies.labelOverrideHelp}
                    </Text>

                    <Field>
                      <FieldLabel htmlFor={`policy-description-${index}`}>
                        {copy.policies.descriptionField}
                      </FieldLabel>
                      <Input
                        id={`policy-description-${index}`}
                        fullWidth
                        size="lg"
                        maxLength={400}
                        value={draft.description ?? ""}
                        placeholder={option?.description ?? ""}
                        onChange={(event) =>
                          update(index, { description: event.target.value || null })
                        }
                      />
                    </Field>
                    <Text variant="small" color="muted">
                      {option
                        ? (copy.policies.handlerHelp[option.handler] ??
                          copy.policies.descriptionOverrideHelp)
                        : copy.policies.descriptionOverrideHelp}
                    </Text>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      {full || available.length === 0 ? null : (
        <Stack gap="3">
          {suggested.length > 0 ? (
            <Stack gap="2">
              <Text variant="small" color="muted">
                {copy.policies.suggestedForKind}
              </Text>
              <Flex gap="2" wrap="wrap">
                {suggested.map((option) => (
                  <AddButton key={option.id} option={option} onAdd={add} />
                ))}
              </Flex>
            </Stack>
          ) : null}

          {/* Everything else in the catalogue. The association decides what is
              suggested, not what is permitted — an "other" event whose
              organizer wants proof of payment should be able to say so. */}
          {rest.length > 0 ? (
            <Stack gap="2">
              <Text variant="small" color="muted">
                {copy.policies.otherAvailable}
              </Text>
              <Flex gap="2" wrap="wrap">
                {rest.map((option) => (
                  <AddButton key={option.id} option={option} onAdd={add} />
                ))}
              </Flex>
            </Stack>
          ) : null}
        </Stack>
      )}
    </Stack>
  );
}

function AddButton({
  option,
  onAdd,
}: {
  option: PolicyOptionView;
  onAdd: (option: PolicyOptionView) => void;
}) {
  return (
    <Button type="button" size="md" variant="outline" onClick={() => onAdd(option)}>
      + {option.label}
    </Button>
  );
}
