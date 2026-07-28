"use client";

import { useRef, useState, useTransition } from "react";

import { Badge } from "@stackmyth/badge";
import { Button } from "@stackmyth/button";
import { Card, CardContent, CardHeader, CardTitle } from "@stackmyth/card";
import { Field, FieldError, FieldLabel } from "@stackmyth/field";
import { Input } from "@stackmyth/input";
import { Box, Divider, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";
import { Notice } from "@/components/notice";
import type { PolicyKind, PolicyState } from "@/domain/policies";
import { downscaleImage, EVIDENCE_ACCEPT } from "@/lib/image-downscale";

import { submitPolicyResponse, type SubmissionState } from "./actions";

export interface PolicyPanelItem {
  id: string;
  kind: PolicyKind;
  label: string;
  description: string | null;
  state: PolicyState;
  reviewNote: string | null;
}

/**
 * What the participant still has to do before they count as confirmed.
 *
 * Shown only to someone already on the roster — there is nothing to prove
 * before you have said you are coming.
 */
export function PolicyPanel({
  publicToken,
  items,
}: {
  publicToken: string;
  items: PolicyPanelItem[];
}) {
  const { copy } = useCopy();

  if (items.length === 0) return null;

  const allDone = items.every((item) => item.state === "approved");

  return (
    <Card surface="outlined">
      <CardHeader>
        <CardTitle>{copy.policies.yourStatusHeading}</CardTitle>
      </CardHeader>
      <CardContent>
        <Stack gap="5">
          {allDone ? <Notice tone="info" title={copy.policies.allDone} /> : null}

          {items.map((item, index) => (
            <Stack gap="4" key={item.id}>
              {index > 0 ? <Divider /> : null}
              <PolicyItem publicToken={publicToken} item={item} />
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

function StateBadge({ state }: { state: PolicyState }) {
  const { copy } = useCopy();

  const config = {
    approved: { variant: "success", soft: false },
    submitted: { variant: "warning", soft: true },
    rejected: { variant: "error", soft: true },
    missing: { variant: "secondary", soft: true },
  } as const;

  return (
    <Badge variant={config[state].variant} size="sm" soft={config[state].soft}>
      {copy.policies.status[state]}
    </Badge>
  );
}

function PolicyItem({ publicToken, item }: { publicToken: string; item: PolicyPanelItem }) {
  const { copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SubmissionState>({ errors: {} });

  // The shrunken image, held here until submit. Kept out of the file input so
  // what gets uploaded is always the processed one, never the original.
  const [prepared, setPrepared] = useState<Blob | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const done = item.state === "approved";
  const waiting = item.state === "submitted";

  async function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreparing(true);
    setState({ errors: {} });

    const result = await downscaleImage(file);
    setPreparing(false);

    if (!result.ok) {
      setPrepared(null);
      setState({
        errors: {
          evidence:
            result.reason === "unsupported"
              ? copy.errors.evidenceWrongType
              : copy.errors.evidenceUnreadable,
        },
      });
      return;
    }

    setPrepared(result.blob);
  }

  function submit() {
    const formData = new FormData();
    formData.set("policyId", item.id);
    formData.set("note", note);

    if (item.kind === "proof_of_payment") {
      if (!prepared) {
        setState({ errors: { evidence: copy.errors.evidenceRequired } });
        return;
      }
      // Always JPEG — `downscaleImage` re-encodes whatever came in.
      formData.set("evidence", new File([prepared], "receipt.jpg", { type: "image/jpeg" }));
    }

    startTransition(async () => {
      const result = await submitPolicyResponse(publicToken, { errors: {} }, formData);
      setState(result);

      if (result.done) {
        setPrepared(null);
        setNote("");
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  return (
    <Stack gap="3">
      <Flex justify="between" align="center" gap="3">
        <Box minWidth="0">
          <Text weight="semibold">{item.label}</Text>
        </Box>
        <Box flexShrink={0}>
          <StateBadge state={item.state} />
        </Box>
      </Flex>

      {item.description ? (
        <Text variant="small" color="muted">
          {item.description}
        </Text>
      ) : null}

      {state.errors._form ? (
        <Text color="error" role="alert">
          {state.errors._form}
        </Text>
      ) : null}

      {item.state === "rejected" ? (
        <Notice
          tone="warning"
          title={
            item.reviewNote
              ? copy.policies.rejectedNotice(item.reviewNote)
              : copy.policies.rejectedNoticeNoReason
          }
        />
      ) : null}

      {waiting ? (
        <Text variant="small" color="muted">
          {copy.policies.submittedNotice}
        </Text>
      ) : null}

      {done ? null : item.kind === "acknowledgement" ? (
        <Button type="button" size="lg" fullWidth disabled={pending} onClick={submit}>
          {pending ? copy.policies.uploadSubmitting : copy.policies.acknowledgeSubmit}
        </Button>
      ) : (
        <Stack gap="3">
          <Field invalid={Boolean(state.errors.evidence)}>
            <FieldLabel htmlFor={`evidence-${item.id}`}>{copy.policies.uploadLabel}</FieldLabel>
            {/*
              A bare file input rather than a Stackmyth control: the library has
              no file field, and `capture` matters more here than styling —
              on a phone it opens the camera directly, which is what somebody
              photographing a receipt wants.
            */}
            <input
              ref={fileRef}
              id={`evidence-${item.id}`}
              type="file"
              accept={EVIDENCE_ACCEPT}
              onChange={pickFile}
              disabled={pending || preparing}
            />
            {state.errors.evidence ? <FieldError>{state.errors.evidence}</FieldError> : null}
          </Field>

          <Text variant="small" color="muted">
            {preparing
              ? copy.policies.uploadPreparing
              : prepared
                ? `${Math.round(prepared.size / 1024)} KB`
                : copy.policies.uploadHelp}
          </Text>

          <Field>
            <FieldLabel htmlFor={`note-${item.id}`}>{copy.policies.noteLabel}</FieldLabel>
            <Input
              id={`note-${item.id}`}
              fullWidth
              size="lg"
              maxLength={200}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={copy.policies.notePlaceholder}
            />
          </Field>

          <Button
            type="button"
            size="lg"
            fullWidth
            disabled={pending || preparing || !prepared}
            onClick={submit}
          >
            {pending
              ? copy.policies.uploadSubmitting
              : waiting
                ? copy.policies.resubmit
                : copy.policies.uploadSubmit}
          </Button>

          <Text variant="small" color="muted">
            {copy.policies.onlyOrganizerSeesEvidence}
          </Text>
        </Stack>
      )}
    </Stack>
  );
}
