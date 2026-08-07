"use client";

import { useState, useTransition } from "react";

import { Badge } from "@stackmyth/badge";
import { Button } from "@stackmyth/button";
import { Card, CardContent, CardHeader, CardTitle } from "@stackmyth/card";
import { Field, FieldError, FieldLabel } from "@stackmyth/field";
import { FileUpload } from "@stackmyth/file-upload";
import { Input } from "@stackmyth/input";
import { Box, Divider, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { toast } from "@stackmyth/toast";
import { Banner } from "@stackmyth/banner";
import { InfoIcon, TriangleAlertIcon } from "@stackmyth/icons";

import { useCopy } from "@/components/copy-provider";
import type { PolicyState } from "@/domain/policies";
import { findHandler } from "@/domain/policy-handlers";
import { downscaleImage, EVIDENCE_ACCEPT } from "@/lib/image-downscale";

import { useRouter } from "@tanstack/react-router";

import { submitPolicyResponseFn, type SubmissionState } from "./-fns";

export interface PolicyPanelItem {
  id: string;
  /** Behaviour key from the catalogue. */
  handler: string;
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
          {allDone ? <Banner variant="info" live="off" icon={<InfoIcon size={18} aria-hidden="true" />} title={copy.policies.allDone} /> : null}

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SubmissionState>({ errors: {} });

  // The shrunken image, held here until submit. Kept out of the file input so
  // what gets uploaded is always the processed one, never the original.
  const [prepared, setPrepared] = useState<Blob | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [note, setNote] = useState("");
  /** What FileUpload is showing; the shrunken copy lives in `prepared`. */
  const [chosen, setChosen] = useState<File[]>([]);

  const done = item.state === "approved";
  const waiting = item.state === "submitted";

  async function pickFiles(files: File[]) {
    setChosen(files);

    const file = files[0];
    if (!file) {
      setPrepared(null);
      return;
    }

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

    if (findHandler(item.handler)?.evidence === "image") {
      if (!prepared) {
        setState({ errors: { evidence: copy.errors.evidenceRequired } });
        return;
      }
      /*
        The blob carries its own type: `downscaleImage` re-encodes to WebP where
        the browser can, JPEG where it cannot. Reading it off the blob rather
        than naming a format here is what stops the two from drifting — the
        server sniffs the bytes anyway, so a mislabelled file would be served
        under the wrong content type rather than rejected.
      */
      const extension = prepared.type === "image/webp" ? "webp" : "jpg";
      formData.set(
        "evidence",
        new File([prepared], `receipt.${extension}`, { type: prepared.type }),
      );
    }

    startTransition(async () => {
      formData.set("publicToken", publicToken);
      const result = await submitPolicyResponseFn({ data: formData });
      setState(result);
      if (result.done) await router.invalidate();

      if (result.done) {
        setPrepared(null);
        setChosen([]);
        setNote("");

        // The badge on this item flips to "submitted" and the explanation below
        // it stays, so the toast only has to confirm that the upload landed —
        // the part that used to be invisible while the file was in flight.
        toast.success(copy.policies.submittedNotice);
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
        <Banner variant="warning" live="off" icon={<TriangleAlertIcon size={18} aria-hidden="true" />}
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

      {done ? null : findHandler(item.handler)?.evidence === "none" ? (
        <Button type="button" size="lg" fullWidth disabled={pending} loading={pending} onClick={submit}>
          {pending ? copy.policies.uploadSubmitting : copy.policies.acknowledgeSubmit}
        </Button>
      ) : (
        <Stack gap="3">
          <Field invalid={Boolean(state.errors.evidence)}>
            <FieldLabel htmlFor={`evidence-${item.id}`}>{copy.policies.uploadLabel}</FieldLabel>
            {/*
              `FileUpload` from @stackmyth/file-upload. An earlier version used
              a bare <input type="file"> under a comment claiming the library
              had no file field — it does; the package simply had never been
              installed, because the inventory was taken from what was present
              rather than from what the registry offers.

              Validation here is advisory. The bytes are re-checked server-side
              by sniffing the leading bytes, because `accept` is a hint to the
              file picker and nothing more.
            */}
            <FileUpload
              id={`evidence-${item.id}`}
              validation={{
                accept: EVIDENCE_ACCEPT.split(","),
                maxFiles: 1,
              }}
              disabled={pending || preparing}
              onValueChange={pickFiles}
              value={chosen}
              title={copy.policies.uploadChoose}
              hint={copy.policies.uploadHelp}
              size="md"
            />
            {state.errors.evidence ? <FieldError>{state.errors.evidence}</FieldError> : null}
          </Field>

          {/* Only the states FileUpload does not already show. The accepted
              formats are its `hint`; repeating them here printed the same
              sentence twice. */}
          {preparing || prepared ? (
            <Text variant="small" color="muted">
              {preparing
                ? copy.policies.uploadPreparing
                : `${Math.round(prepared!.size / 1024)} KB`}
            </Text>
          ) : null}

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
            loading={pending}
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
