"use client";

import { useState, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@stackmyth/field";
import { Input } from "@stackmyth/input";
import { Stack } from "@stackmyth/layout";

import { useCopy } from "@/components/copy-provider";
import { FormError } from "@/components/form-shell";

import { completeProfile, type OnboardingState } from "./actions";

/**
 * Two fields, one of them optional, and that is the whole design.
 *
 * This screen sits between somebody and the event they were invited to, so
 * every box on it is a reason to close the tab. Language and timezone are
 * already known — detected on the first paint and changeable later in the
 * profile — and a photo would cost storage the receipts are already competing
 * for. What is left is the name nobody has told us, and a way to be reached.
 *
 * Plain state rather than `FormController`: two fields with no rules between
 * them do not need a store, and the server validates either way.
 */
export function OnboardingForm({ next, defaultName }: { next: string; defaultName: string }) {
  const { copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<OnboardingState>({ errors: {} });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // A success redirects and never returns, so anything here is a failure.
      const result = await completeProfile(next, { errors: {} }, formData);
      setState(result);
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="5">
        <FormError message={state.errors._form} />

        <Field invalid={Boolean(state.errors.fullName)}>
          <FieldLabel htmlFor="fullName">{copy.onboarding.nameLabel}</FieldLabel>
          <FieldDescription>{copy.onboarding.nameHelp}</FieldDescription>
          <Input
            id="fullName"
            name="fullName"
            fullWidth
            size="lg"
            autoComplete="name"
            autoFocus
            defaultValue={defaultName}
            maxLength={80}
            placeholder={copy.onboarding.namePlaceholder}
            status={state.errors.fullName ? "error" : "default"}
          />
          {state.errors.fullName ? <FieldError>{state.errors.fullName}</FieldError> : null}
        </Field>

        <Field invalid={Boolean(state.errors.phone)}>
          <FieldLabel htmlFor="phone">{copy.onboarding.phoneLabel}</FieldLabel>
          {/* Says who sees it and why, next to the box that asks. A number is
              the one thing here somebody might reasonably not want to give, and
              "optional" alone does not answer the question they are asking. */}
          <FieldDescription>{copy.onboarding.phoneHelp}</FieldDescription>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            fullWidth
            size="lg"
            autoComplete="tel"
            maxLength={20}
            placeholder={copy.onboarding.phonePlaceholder}
            status={state.errors.phone ? "error" : "default"}
          />
          {state.errors.phone ? <FieldError>{state.errors.phone}</FieldError> : null}
        </Field>

        <Button type="submit" size="lg" fullWidth disabled={pending}>
          {pending ? copy.onboarding.submitting : copy.onboarding.submit}
        </Button>
      </Stack>
    </form>
  );
}
