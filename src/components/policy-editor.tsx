"use client";

import { useEffect, useState } from "react";

import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Field, FieldLabel } from "@stackmyth/field";
import { useFormContext } from "@stackmyth/form";
import { Input } from "@stackmyth/input";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { POLICY_SUGGESTIONS, type PolicyKind } from "@/domain/policies";
import type { EventKind } from "@/domain/types";
import { MAX_POLICIES_PER_EVENT } from "@/lib/validation";

import { useCopy } from "./copy-provider";

export interface PolicyDraft {
  /** Absent on a row the organizer just added. */
  id?: string;
  kind: PolicyKind;
  label: string;
  description: string | null;
}

const ALL_KINDS: PolicyKind[] = ["proof_of_payment", "acknowledgement"];

/**
 * Sets up what an event asks for before somebody counts as confirmed.
 *
 * The list travels to the server as **one JSON field** rather than as
 * `policies[0][label]`-style names. Rows are added and removed here, so indexed
 * names would leave a hole in the sequence the moment anyone deletes the middle
 * one, and every reader of the FormData would need to agree on how to close it.
 *
 * Suggestions follow the kind of event, but only ever as a button to press. An
 * organizer who picked "match" and wants no requirements at all should end up
 * with none, not have to delete something they never asked for.
 */
export function PolicyEditor({
  name,
  eventKind,
  defaultValue = [],
}: {
  name: string;
  eventKind: EventKind;
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

  const suggested = POLICY_SUGGESTIONS[eventKind] ?? [];
  const full = drafts.length >= MAX_POLICIES_PER_EVENT;

  function add(kind: PolicyKind) {
    if (full) return;
    setDrafts((current) => [
      ...current,
      { kind, label: copy.policies.defaultLabel[kind], description: null },
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
          {drafts.map((draft, index) => (
            <Card surface="outlined" key={draft.id ?? `new-${draft.kind}-${index}`}>
              <CardContent>
                <Stack gap="3">
                  <Flex justify="between" align="center" gap="2">
                    <Box minWidth="0">
                      <Text variant="small" color="muted">
                        {copy.policies.kinds[draft.kind]}
                      </Text>
                    </Box>
                    <Box flexShrink={0}>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(index)}
                        aria-label={`${copy.policies.remove}: ${draft.label}`}
                      >
                        {copy.policies.remove}
                      </Button>
                    </Box>
                  </Flex>

                  <Field>
                    <FieldLabel htmlFor={`policy-label-${index}`}>
                      {copy.policies.labelField}
                    </FieldLabel>
                    <Input
                      id={`policy-label-${index}`}
                      fullWidth
                      size="lg"
                      maxLength={60}
                      value={draft.label}
                      onChange={(event) => update(index, { label: event.target.value })}
                    />
                  </Field>

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
                      onChange={(event) =>
                        update(index, { description: event.target.value || null })
                      }
                      placeholder={copy.policies.descriptionHelp}
                    />
                  </Field>

                  <Text variant="small" color="muted">
                    {copy.policies.kindHelp[draft.kind]}
                  </Text>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {full ? null : (
        <Stack gap="2">
          {suggested.length > 0 ? (
            <Text variant="small" color="muted">
              {copy.policies.suggestedForKind}
            </Text>
          ) : null}

          <Flex gap="2" wrap="wrap">
            {/* Suggested kinds first, then the rest, so the recommended one is
                the leftmost thumb target. */}
            {[...suggested, ...ALL_KINDS.filter((kind) => !suggested.includes(kind))].map(
              (kind) => (
                <Button
                  key={kind}
                  type="button"
                  size="md"
                  variant="outline"
                  onClick={() => add(kind)}
                >
                  + {copy.policies.kinds[kind]}
                </Button>
              ),
            )}
          </Flex>
        </Stack>
      )}
    </Stack>
  );
}
