"use client";

import { useState, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@stackmyth/field";
import { Flex, Stack } from "@stackmyth/layout";
import { Input } from "@stackmyth/input";
import { toast } from "@stackmyth/toast";

import { ConfirmDialog } from "@/components/confirm-dialog";
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
 * Deleting a group.
 *
 * The dialog stays open while the delete runs — closing it on click would
 * leave somebody looking at the page they just deleted with no sign anything
 * happened. It closes when the navigation takes them away, or on failure so
 * they can read the toast against the screen they are still on.
 */
export function DeleteGroupControl({ groupId, name }: { groupId: string; name: string }) {
  const { copy } = useCopy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteGroupFn({ data: { groupId } });

      if (result.errors._form) {
        setOpen(false);
        toast.error(result.errors._form);
        return;
      }

      toast.success(copy.groups.deleted);
      await router.navigate({ to: "/groups" });
    });
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" size="sm" variant="ghost">
          {copy.groups.delete}
        </Button>
      }
      title={copy.groups.deleteConfirm(name)}
      description={copy.groups.deleteConfirmBody}
      confirmLabel={copy.groups.delete}
      pending={pending}
      pendingLabel={copy.groups.deleting}
      onConfirm={remove}
    />
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
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function leave() {
    startTransition(async () => {
      const result = await leaveGroupFn({ data: { groupId } });
      setOpen(false);

      if (result.errors._form) {
        toast.error(result.errors._form);
        return;
      }

      toast.success(copy.groups.left);
      await router.invalidate();
    });
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" size="sm" variant="ghost">
          {copy.groups.leave}
        </Button>
      }
      title={copy.groups.leaveConfirm(name)}
      description={copy.groups.leaveConfirmBody}
      confirmLabel={copy.groups.leave}
      pending={pending}
      pendingLabel={copy.groups.leaving}
      onConfirm={leave}
    />
  );
}
