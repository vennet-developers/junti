"use client";

import { useMemo, useState, useTransition } from "react";

import { Badge } from "@stackmyth/badge";
import { Button } from "@stackmyth/button";
import { Checkbox } from "@stackmyth/checkbox";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { toast } from "@stackmyth/toast";

import { PersonAvatar } from "@/components/person-avatar";
import { useCopy } from "@/components/copy-provider";
import { ROUTES } from "@/config/routes";
import { formatDate } from "@/lib/format";
import type { InvitationView } from "@/lib/roster";

import { Link, useRouter } from "@tanstack/react-router";

import { inviteToEventFn, resendInvitationFn, type InviteState } from "./-fns";

interface Ctx {
  publicToken: string;
  organizerToken: string;
}

/** One invitable person: somebody who joined this event's group. */
export interface InvitableMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  /** They already have an invitation for this event. Shown, but not pickable. */
  invited: boolean;
}

export interface InviteFormProps extends Ctx {
  /** The event's group, or null when it has none. */
  group: { id: string; name: string } | null;
  members: InvitableMember[];
}

/**
 * Choosing who to invite, from the event's group.
 *
 * **What replaced the box for pasting addresses** — and before that, adding
 * somebody to the roster by hand. The shape of the control is the feature: an
 * organizer cannot type a person here, only recognise one. Everybody on this
 * list put themselves on it by accepting a group link, which is why sending is
 * a click instead of a consent decision made on somebody else's behalf.
 *
 * The empty states are doing real work rather than apologising. "No group"
 * offers the way to make one, because the alternative the organizer is looking
 * for — a box to type an address into — is not coming back, and a dead end
 * that explains nothing would just read as a missing feature.
 */
export function InviteForm({ publicToken, organizerToken, group, members }: InviteFormProps) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [state, setState] = useState<InviteState>({ errors: {} });

  const pickable = useMemo(() => members.filter((member) => !member.invited), [members]);

  function toggle(userId: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData();
    for (const userId of picked) formData.append("members", userId);

    startTransition(async () => {
      formData.set("publicToken", publicToken);
      formData.set("organizerToken", organizerToken);
      const result = await inviteToEventFn({ data: formData });
      if (result.ok) await router.invalidate();
      setState(result);

      if (!result.ok) return;

      // The selection is cleared only on success. A rejected send has to keep
      // it, so a rate limit does not cost the organizer the picking they did.
      setPicked(new Set());

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

  const error = state.errors.members ?? state.errors._form;

  if (!group) {
    return (
      <Stack gap="3">
        <Text weight="medium">{copy.invites.noGroupTitle}</Text>
        <Text variant="small" color="muted">
          {copy.invites.noGroupHelp}
        </Text>
        <Flex>
          <Button asChild size="sm" variant="secondary">
            <Link to={ROUTES.groups}>{copy.invites.noGroupCta}</Link>
          </Button>
        </Flex>
      </Stack>
    );
  }

  if (members.length === 0) {
    return (
      <Stack gap="2">
        <Text weight="medium">{copy.invites.emptyGroupTitle(group.name)}</Text>
        <Text variant="small" color="muted">
          {copy.invites.emptyGroupHelp}
        </Text>
      </Stack>
    );
  }

  if (pickable.length === 0) {
    return (
      <Stack gap="2">
        <Text weight="medium">{copy.invites.allInvitedTitle}</Text>
        <Text variant="small" color="muted">
          {copy.invites.allInvitedHelp}
        </Text>
      </Stack>
    );
  }

  const allPicked = pickable.every((member) => picked.has(member.userId));

  // No Card wrapper: the Disclosure containing this already supplies the frame.
  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="4">
        <Stack gap="1">
          <Text variant="small" color="muted">
            {copy.invites.help(group.name)}
          </Text>
        </Stack>

        {pickable.length > 1 ? (
          <Flex>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                setPicked(allPicked ? new Set() : new Set(pickable.map((m) => m.userId)))
              }
            >
              {allPicked ? copy.invites.clearSelection : copy.invites.selectAll}
            </Button>
          </Flex>
        ) : null}

        <Stack gap="2" role="group" aria-label={copy.invites.heading}>
          {members.map((member) => (
            <Flex key={member.userId} gap="3" align="center" justify="between">
              {/* `Flex as="label"` rather than a label prop — Checkbox is the
                  bare input, and this is the composition the approvals queue
                  and onboarding already use. It also makes the whole name
                  clickable, which is the target a thumb actually hits. */}
              <Flex as="label" gap="3" align="center">
                <Checkbox
                  checked={picked.has(member.userId)}
                  disabled={member.invited}
                  onChange={() => toggle(member.userId)}
                  aria-label={member.displayName}
                />
                <PersonAvatar name={member.displayName} src={member.avatarUrl} />
                <Text variant="small" color={member.invited ? "muted" : "default"}>
                  {member.displayName}
                </Text>
              </Flex>

              {member.invited ? <Badge variant="outline">{copy.invites.waiting}</Badge> : null}
            </Flex>
          ))}
        </Stack>

        {error ? (
          <Text variant="small" color="error">
            {error}
          </Text>
        ) : null}

        <Button type="submit" size="md" variant="secondary" disabled={pending || picked.size === 0}>
          {pending ? copy.invites.submitting : copy.invites.submit(picked.size)}
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
 *
 * Names, not addresses. This list used to print somebody's email onto the
 * organizer's screen for want of anything else to identify them by; an
 * invitation now names an account, and an account has a name.
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
      const result = await resendInvitationFn({
        data: { publicToken, organizerToken, invitationId: id },
      });
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
            <Text variant="small">{invitation.displayName}</Text>
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
