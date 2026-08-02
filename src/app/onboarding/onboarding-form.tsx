"use client";

import { useState, useTransition } from "react";

import Link from "next/link";

import { Button } from "@stackmyth/button";
import { Checkbox } from "@stackmyth/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@stackmyth/field";
import { Input } from "@stackmyth/input";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";
import { FormError } from "@/components/form-shell";
import { ROUTES } from "@/config/routes";

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

        {/*
          Unchecked, unbundled, and its own sentence.

          Ley 1581 does not recognise consent that arrived pre-ticked or rolled
          up with something else, so this box starts empty and says exactly one
          thing: the organizer may write to you on WhatsApp. Leaving it alone
          means the number is never stored — not stored-and-ignored — which is
          why the label can promise something the code actually enforces.
        */}
        <Stack gap="2">
          {/* `Flex as="label"` rather than a `label` prop — Checkbox is the bare
              input, and this is the composition the approvals queue already
              uses, so the two checkboxes in the product behave alike. */}
          <Flex as="label" gap="3" align="start">
            <Box flexShrink={0} pt="1">
              <Checkbox name="whatsappConsent" />
            </Box>
            <Text variant="small">{copy.onboarding.consentLabel}</Text>
          </Flex>

          <Text variant="small" color="muted">
            {copy.onboarding.consentHelp}{" "}
            <Box as={Link} href={ROUTES.privacy} target="_blank" rel="noopener noreferrer">
              {copy.onboarding.privacyLink}
            </Box>
          </Text>
        </Stack>

        <Button type="submit" size="lg" fullWidth disabled={pending}>
          {pending ? copy.onboarding.submitting : copy.onboarding.submit}
        </Button>
      </Stack>
    </form>
  );
}
