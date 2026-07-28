"use client";

import { useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Flex } from "@stackmyth/layout";

import { getCopy, LOCALES, type Locale } from "@/config/copy";
import { setLocale } from "@/lib/locale-actions";

import { useCopy } from "./copy-provider";

/**
 * Switches the interface language.
 *
 * Two buttons rather than a `Select`, because with two options a dropdown costs
 * an extra tap to reach the same place, and each language names itself —
 * "English" is legible to someone who cannot read the Spanish it sits next to,
 * which a translated label like "Inglés" would not be.
 *
 * Only the interface changes. Titles, notes and names stay in whatever language
 * the person who typed them used.
 */
export function LanguageSwitcher() {
  const { locale } = useCopy();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale || pending) return;
    startTransition(() => {
      void setLocale(next);
    });
  }

  return (
    <Flex gap="1" role="group" aria-label={getCopy(locale).common.changeLanguage}>
      {LOCALES.map((option) => {
        const active = option === locale;

        return (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={active ? "secondary" : "ghost"}
            aria-pressed={active}
            disabled={pending}
            onClick={() => choose(option)}
          >
            {getCopy(option).localeName}
          </Button>
        );
      })}
    </Flex>
  );
}
