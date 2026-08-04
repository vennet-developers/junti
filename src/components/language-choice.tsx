"use client";

import { useTransition } from "react";

import { Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";
import { LanguageCombobox } from "@/components/language-combobox";
import { LOCALES, getCopy, type Locale } from "@/config/copy";
import { useRouter } from "@tanstack/react-router";

import { setLocaleFn } from "@/lib/preference-fns";

/**
 * The language switch in the account drawer, for signed-in and signed-out
 * alike.
 *
 * Choosing here writes immediately — there is no save button in a drawer — and
 * sets an explicit language: a preference, not a detection, so it overrides
 * whatever the browser asked for until `/profile` clears it. That screen keeps
 * the "follow my browser" option, which a quick switch has no room to explain.
 *
 * The control itself is {@link LanguageCombobox}, shared with `/profile` so
 * the two cannot drift.
 */
export function LanguageChoice() {
  const { copy, locale } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Stack gap="2">
      <Text variant="small" color="muted">
        {copy.common.language}
      </Text>

      <LanguageCombobox
        value={locale}
        onValueChange={(next) => {
          if (next === locale) return;
          startTransition(async () => {
            await setLocaleFn({ data: { locale: next } });
            await router.invalidate();
          });
        }}
        options={LOCALES.map((option: Locale) => ({
          value: option,
          label: getCopy(option).localeName,
        }))}
        ariaLabel={copy.common.changeLanguage}
        disabled={pending}
      />
    </Stack>
  );
}
