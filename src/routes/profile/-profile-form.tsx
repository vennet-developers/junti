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
import { LOCALES, getCopy } from "@/config/copy";
import { currencyOptions } from "@/lib/format";
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
 * All three fields are the same `Select`, on purpose. Language was briefly
 * the filterable combobox the account drawer uses, and on this page it stood
 * out immediately: the combobox trigger is an input and the select trigger is
 * a button, and the kit gives them different heights — three stacked fields
 * in two visibly different suits read as a mistake, which is exactly what got
 * reported. The drawer keeps the combobox, where it stands alone and its
 * dialog-stacking fix has been through the wars; here, beside two selects,
 * being identical matters more than filtering a list of two. When the
 * language list outgrows a select, this is the seam to revisit — the old
 * control is one revert away in history.
 *
 * Both are used directly rather than through `SelectField`, because this form
 * has no `FormController` around it — two fields and no cross-field rules do
 * not need the validation machinery, but they do need the design system. An
 * earlier version reached for native `<select>` elements here and they stood
 * out immediately: browser chrome in the middle of a styled page.
 */

export function ProfileForm({
  initialLocale,
  initialTimeZone,
  initialCurrency,
}: {
  /** Null means the account has no override stored. */
  initialLocale: string | null;
  initialTimeZone: string | null;
  /** Null means new events start in the app's default, COP. */
  initialCurrency: string | null;
}) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ProfileState>({ errors: {} });

  const [locale, setLocale] = useState(initialLocale ?? "");
  const [timeZone, setTimeZone] = useState(initialTimeZone ?? "");
  const [currency, setCurrency] = useState(initialCurrency ?? "");

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
    formData.set("currency", currency);

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
          {/* The empty value IS "follow my browser" — same convention as the
              timezone below, no sentinel needed now that a select item may be
              keyed by "". Each language names itself: "English" is legible to
              somebody who cannot read the Spanish beside it. */}
          <Select value={locale} onValueChange={setLocale} id="profile-locale">
            <SelectTrigger fullWidth size="lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{copy.profile.languageAuto}</SelectItem>
              {LOCALES.map((option) => (
                <SelectItem key={option} value={option}>
                  {getCopy(option).localeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        <ControlledField
          label={copy.profile.currencyLabel}
          description={copy.profile.currencyHelp}
          error={state.errors.currency}
          htmlFor="profile-currency"
        >
          {/* Same shape as the timezone: a fixed, read-not-searched list, and
              the empty option IS the default rather than a blank — the same
              one-piece-of-state rule the other two fields follow. */}
          <Select value={currency} onValueChange={setCurrency} id="profile-currency">
            <SelectTrigger fullWidth size="lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{copy.profile.currencyDefault}</SelectItem>
              {currencyOptions(copy.intlLocale).map((option) => (
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
