"use client";

import { useState, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@stackmyth/field";
import { Flex, Stack } from "@stackmyth/layout";
import { Input } from "@stackmyth/input";
import { toast } from "@stackmyth/toast";

import { useCopy } from "@/components/copy-provider";
import { GROUP_NAME_MAX } from "@/domain/groups";

import { useRouter } from "@tanstack/react-router";

import { answerGroupFn, createGroupFn, deleteGroupFn, leaveGroupFn } from "./-fns";

/**
 * Making a group.
 *
 * One field, because that is genuinely all a group is at creation: a name to
 * recognise it by. Everything else about it — who is in it — is not something
 * the owner fills in, and a form with a "members" box would suggest otherwise.
 */
export function CreateGroupForm() {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData();
    formData.set("name", name);

    startTransition(async () => {
      const result = await createGroupFn({ data: formData });
      setError(result.errors.name ?? result.errors._form ?? null);

      if (!result.ok) return;

      const created = name.trim();
      setName("");
      await router.invalidate();
      toast.success(copy.groups.created(created));
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="4">
        <Field invalid={Boolean(error)}>
          <FieldLabel htmlFor="group-name">{copy.groups.nameLabel}</FieldLabel>
          <FieldDescription>{copy.groups.nameHelp(GROUP_NAME_MAX)}</FieldDescription>
          <Input
            id="group-name"
            name="name"
            fullWidth
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={copy.groups.namePlaceholder}
            status={error ? "error" : "default"}
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>

        <Flex>
          <Button type="submit" size="md" variant="primary" disabled={pending || !name.trim()}>
            {pending ? copy.groups.creating : copy.groups.create}
          </Button>
        </Flex>
      </Stack>
    </form>
  );
}

/**
 * Deleting a group, with the confirm the browser already has.
 *
 * `confirm` rather than a modal: this is the one destructive control in the
 * feature, it is reached from a page nobody visits by accident, and a dialog
 * component here would be more machinery than the decision deserves.
 */
export function DeleteGroupControl({ groupId, name }: { groupId: string; name: string }) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm(copy.groups.deleteConfirm(name))) return;

    startTransition(async () => {
      const result = await deleteGroupFn({ data: { groupId } });

      if (result.errors._form) {
        toast.error(result.errors._form);
        return;
      }

      toast.success(copy.groups.deleted);
      await router.navigate({ to: "/groups" });
    });
  }

  return (
    <Button type="button" size="sm" variant="ghost" onClick={remove} disabled={pending}>
      {pending ? copy.groups.deleting : copy.groups.delete}
    </Button>
  );
}

/**
 * Answering somebody's group link.
 *
 * Both buttons are always here, and neither is styled as the obvious one. A
 * screen that makes "no" hard to find is asking for a yes it did not earn,
 * and the whole reason this page exists is that the yes has to be real.
 */
export function AnswerGroupControls({
  joinToken,
  showDecline,
}: {
  joinToken: string;
  showDecline: boolean;
}) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, setPending] = useState<"joined" | "declined" | null>(null);
  const [, startTransition] = useTransition();

  function answer(value: "joined" | "declined") {
    setPending(value);
    startTransition(async () => {
      const result = await answerGroupFn({ data: { joinToken, answer: value } });
      setPending(null);

      if (result.errors._form) {
        toast.error(result.errors._form);
        return;
      }

      await router.invalidate();
    });
  }

  return (
    <Flex gap="3" wrap="wrap">
      <Button
        type="button"
        size="md"
        variant="primary"
        disabled={pending !== null}
        onClick={() => answer("joined")}
      >
        {pending === "joined" ? copy.groups.joinAccepting : copy.groups.joinAccept}
      </Button>

      {showDecline ? (
        <Button
          type="button"
          size="md"
          variant="secondary"
          disabled={pending !== null}
          onClick={() => answer("declined")}
        >
          {pending === "declined" ? copy.groups.joinDeclining : copy.groups.joinDecline}
        </Button>
      ) : null}
    </Flex>
  );
}

/** Leaving, from the member's side of the join page. */
export function LeaveGroupControl({ groupId, name }: { groupId: string; name: string }) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function leave() {
    if (!window.confirm(copy.groups.leaveConfirm(name))) return;

    startTransition(async () => {
      const result = await leaveGroupFn({ data: { groupId } });

      if (result.errors._form) {
        toast.error(result.errors._form);
        return;
      }

      toast.success(copy.groups.left);
      await router.invalidate();
    });
  }

  return (
    <Button type="button" size="sm" variant="ghost" onClick={leave} disabled={pending}>
      {pending ? copy.groups.leaving : copy.groups.leave}
    </Button>
  );
}
