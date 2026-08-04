"use client";

import { useState, useTransition } from "react";

import { Badge } from "@stackmyth/badge";
import { Button } from "@stackmyth/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@stackmyth/field";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Textarea } from "@stackmyth/textarea";
import { toast } from "@stackmyth/toast";

import { useCopy } from "@/components/copy-provider";
import { formatDate } from "@/lib/format";
import type { InvitationView } from "@/lib/roster";

import { useRouter } from "@tanstack/react-router";

import { inviteToEventFn, resendInvitationFn, type InviteState } from "./-fns";

interface Ctx {
  publicToken: string;
  organizerToken: string;
}

/**
 * Inviting people by address, and seeing who has answered.
 *
 * **What replaced adding somebody by hand.** That form wrote a name onto the
 * roster on the organizer's say-so — it took a spot, it could owe money, and the
 * person it named had never seen the event. This one only claims what is true:
 * they were asked. Whether they come is theirs to say.
 *
 * A plain textarea rather than a chip-per-address editor, because the input this
 * has to accept well is a paste — from a group chat, a spreadsheet column, a
 * previous email. Parsing whatever separator came along is the server's job, and
 * an editor that fights the paste is worse than a box that accepts it.
 */
export function InviteForm({ publicToken, organizerToken }: Ctx) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [emails, setEmails] = useState("");
  const [state, setState] = useState<InviteState>({ errors: {} });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData();
    formData.set("emails", emails);

    startTransition(async () => {
      formData.set("publicToken", publicToken);
      formData.set("organizerToken", organizerToken);
      const result = await inviteToEventFn({ data: formData });
      if (result.ok) await router.invalidate();
      setState(result);

      if (!result.ok) return;

      // Only the box is cleared, and only on success — a rejected paste has to
      // survive so the one bad address in twenty can be fixed rather than
      // retyped.
      setEmails("");

      // Said in the order the organizer cares about: what went, then what did
      // not. A silent partial failure is the outcome this whole shape exists
      // to prevent.
      const lines = [
        result.sent ? copy.invites.sent(result.sent) : null,
        result.skipped ? copy.invites.skipped(result.skipped) : null,
      ].filter(Boolean);

      if (lines.length > 0) toast.success(lines.join(" "));
      if (result.failed) toast.error(copy.invites.failed(result.failed));
    });
  }

  const error = state.errors.emails ?? state.errors._form;

  // No Card wrapper: the Disclosure containing this already supplies the frame.
  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="4">
        <Field invalid={Boolean(error)}>
          <FieldLabel htmlFor="invite-emails">{copy.invites.label}</FieldLabel>
          <FieldDescription>{copy.invites.help}</FieldDescription>
          <Textarea
            id="invite-emails"
            name="emails"
            rows={3}
            fullWidth
            value={emails}
            onChange={(event) => setEmails(event.target.value)}
            placeholder={copy.invites.placeholder}
            status={error ? "error" : "default"}
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>

        <Button type="submit" size="md" variant="secondary" disabled={pending || !emails.trim()}>
          {pending ? copy.invites.submitting : copy.invites.submit}
        </Button>
      </Stack>
    </form>
  );
}

export interface InvitedListProps extends Ctx {
  invitations: InvitationView[];
  /** The organizer's reading clock, for "sent on". */
  timeZone: string;
}

/**
 * Who was asked, and where each one stands.
 *
 * Unanswered first — that ordering comes from the query, and it is the point of
 * the list: the answered rows are already visible on the roster, so the only
 * thing this adds is the people who are not there yet.
 */
export function InvitedList({
  publicToken,
  organizerToken,
  invitations,
  timeZone,
}: InvitedListProps) {
  const { copy } = useCopy();
  const router = useRouter();
  const [resending, setResending] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (invitations.length === 0) {
    return <Text color="muted">{copy.invites.empty}</Text>;
  }

  function resend(id: string) {
    setResending(id);
    startTransition(async () => {
      const result = await resendInvitationFn({ data: { publicToken, organizerToken, invitationId: id } });
      setResending(null);

      if (result.errors._form) toast.error(result.errors._form);
      else if (result.sent) {
        toast.success(copy.invites.resent);
        // The list shows when each invitation was last sent; refresh it.
        await router.invalidate();
      }
    });
  }

  return (
    <Stack gap="3">
      {invitations.map((invitation) => (
        <Flex key={invitation.id} gap="3" align="center" justify="between" wrap="wrap">
          <Stack gap="1">
            <Text variant="small">{invitation.email}</Text>
            <Text variant="small" color="muted">
              {invitation.answered && invitation.participantName
                ? copy.invites.answered(invitation.participantName)
                : formatDate(invitation.sentAt, timeZone, copy.intlLocale)}
            </Text>
          </Stack>

          {invitation.answered ? (
            <Badge variant="success">{copy.policies.status.approved}</Badge>
          ) : (
            <Flex gap="2" align="center">
              <Badge variant="outline">{copy.invites.waiting}</Badge>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={resending === invitation.id}
                onClick={() => resend(invitation.id)}
              >
                {resending === invitation.id ? copy.invites.resending : copy.invites.resend}
              </Button>
            </Flex>
          )}
        </Flex>
      ))}
    </Stack>
  );
}
