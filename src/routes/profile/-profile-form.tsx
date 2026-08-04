"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Box, Stack } from "@stackmyth/layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@stackmyth/select";
import { Text } from "@stackmyth/text";
import { toast } from "@stackmyth/toast";
import { useRouter } from "@tanstack/react-router";

import { useCopy } from "@/components/copy-provider";
import { ControlledField, FormError } from "@/components/form-shell";
import { LanguageCombobox } from "@/components/language-combobox";
import { LOCALES, getCopy } from "@/config/copy";
import { detectTimeZone, timeZoneLabel, timeZoneOptions } from "@/lib/time-zones";

import { saveProfileFn, type ProfileState } from "./-fns";

/**
 * Language and timezone for the signed-in reader.
 *
 * **The empty option is the default and it is not a blank — it is "follow my
 * browser".** That is the whole of the override the owner asked for: choosing a
 * value turns it on, choosing the automatic option turns it off. One piece of
 * state rather than a checkbox that can disagree with a dropdown next to it.
 *
 * Language is the same {@link LanguageCombobox} the account drawer opens, so
 * the two places a language is chosen look and behave alike — and so a third
 * and fourth language arrive in a list that filters rather than in a row of
 * buttons that wraps. Only the option set differs: this screen is where
 * "follow my browser" lives, and it carries a sentinel value because a
 * combobox item is keyed by a non-empty string while the stored preference for
 * "no override" is empty. The two are mapped at this boundary and nowhere
 * else.
 *
 * The timezone stays a `Select`: its list is a fixed set that is read rather
 * than searched, and it is grouped, which a flat combobox list would lose.
 *
 * Both are used directly rather than through `SelectField`, because this form
 * has no `FormController` around it — two fields and no cross-field rules do
 * not need the validation machinery, but they do need the design system. An
 * earlier version reached for native `<select>` elements here and they stood
 * out immediately: browser chrome in the middle of a styled page.
 */

/** What the combobox calls "follow my browser"; stored as an empty value. */
const FOLLOW_BROWSER = "auto";
export function ProfileForm({
  initialLocale,
  initialTimeZone,
}: {
  /** Null means the account has no override stored. */
  initialLocale: string | null;
  initialTimeZone: string | null;
}) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ProfileState>({ errors: {} });

  const [locale, setLocale] = useState(initialLocale ?? "");
  const [timeZone, setTimeZone] = useState(initialTimeZone ?? "");

  /**
   * What the browser would pick, shown next to the automatic option so the
   * choice is not abstract. Server snapshot is empty — it genuinely cannot
   * know — and React fills it in after hydration without a mismatch.
   */
  const detected = useSyncExternalStore(
    () => () => {},
    () => detectTimeZone(),
    () => "",
  );

  const zoneOptions = useMemo(
    () => timeZoneOptions(timeZone || detected || "UTC", copy.intlLocale, new Date()),
    [timeZone, detected, copy.intlLocale],
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("timeZone", timeZone);

    startTransition(async () => {
      const result = await saveProfileFn({ data: formData });
      setState(result);

      // Field errors stay inline, next to the field that caused them. Only the
      // "it worked" half becomes a toast: there is nothing left to look at on
      // this page once it has, and an inline banner would push the form down
      // to say so.
      if (result.ok) {
        // Every rendered string can change, not just this page — re-running
        // the loaders is Next's `revalidatePath("/", "layout")`, said the
        // TanStack way.
        await router.invalidate();
        toast.success(copy.profile.saved);
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="5">
        <FormError message={state.errors._form} />

        <ControlledField
          label={copy.profile.languageLabel}
          error={state.errors.locale}
          htmlFor="profile-locale"
        >
          <LanguageCombobox
            id="profile-locale"
            value={locale === "" ? FOLLOW_BROWSER : locale}
            onValueChange={(next) => setLocale(next === FOLLOW_BROWSER ? "" : next)}
            options={[
              { value: FOLLOW_BROWSER, label: copy.profile.languageAuto },
              ...LOCALES.map((option) => ({
                value: option,
                label: getCopy(option).localeName,
              })),
            ]}
            ariaLabel={copy.profile.languageLabel}
          />
        </ControlledField>

        <ControlledField
          label={copy.profile.timeZoneLabel}
          description={copy.profile.timeZoneHelp}
          error={state.errors.timeZone}
          htmlFor="profile-timezone"
        >
          <Select value={timeZone} onValueChange={setTimeZone} id="profile-timezone">
            <SelectTrigger fullWidth size="lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{copy.profile.timeZoneAuto}</SelectItem>
              {zoneOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ControlledField>

        {detected && timeZone === "" ? (
          <Text variant="small" color="muted">
            {copy.profile.autoHelp(timeZoneLabel(detected, copy.intlLocale, new Date()))}
          </Text>
        ) : null}

        <Text variant="small" color="muted">
          {copy.profile.storedNotice}
        </Text>

        {/* Same rule as SubmitButton: full-bleed for a thumb, capped for a
            pointer. */}
        <Box width="100%" maxWidth={{ base: "100%", md: "22rem" }}>
          <Button type="submit" size="lg" fullWidth disabled={pending}>
            {pending ? copy.profile.saving : copy.profile.save}
          </Button>
        </Box>
      </Stack>
    </form>
  );
}
