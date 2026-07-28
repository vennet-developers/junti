"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Stack } from "@stackmyth/layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@stackmyth/select";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";
import { ControlledField, FormError } from "@/components/form-shell";
import { Notice } from "@/components/notice";
import { LOCALES, getCopy } from "@/config/copy";
import { detectTimeZone, timeZoneLabel, timeZoneOptions } from "@/lib/time-zones";

import { saveProfile, type ProfileState } from "./actions";

/**
 * Language and timezone for the signed-in reader.
 *
 * **The empty option is the default and it is not a blank — it is "follow my
 * browser".** That is the whole of the override the owner asked for: choosing a
 * value turns it on, choosing the automatic option turns it off. One piece of
 * state rather than a checkbox that can disagree with a dropdown next to it.
 *
 * Stackmyth `Select` used directly rather than through `SelectField`, because
 * this form has no `FormController` around it — two fields and no cross-field
 * rules do not need the validation machinery, but they do need the design
 * system. An earlier version reached for native `<select>` elements here and
 * they stood out immediately: browser chrome in the middle of a styled page.
 */
export function ProfileForm({
  initialLocale,
  initialTimeZone,
}: {
  /** Null means the account has no override stored. */
  initialLocale: string | null;
  initialTimeZone: string | null;
}) {
  const { copy } = useCopy();
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
      setState(await saveProfile({ errors: {} }, formData));
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="5">
        {state.ok ? <Notice tone="info" title={copy.profile.saved} /> : null}
        <FormError message={state.errors._form} />

        <ControlledField
          label={copy.profile.languageLabel}
          error={state.errors.locale}
          htmlFor="profile-locale"
        >
          <Select value={locale} onValueChange={setLocale} id="profile-locale">
            <SelectTrigger fullWidth size="lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* The empty value is the default and is not a blank: it means
                  "follow my browser". */}
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

        {detected && timeZone === "" ? (
          <Text variant="small" color="muted">
            {copy.profile.autoHelp(timeZoneLabel(detected, copy.intlLocale, new Date()))}
          </Text>
        ) : null}

        <Text variant="small" color="muted">
          {copy.profile.storedNotice}
        </Text>

        <Button type="submit" size="lg" fullWidth disabled={pending}>
          {pending ? copy.profile.saving : copy.profile.save}
        </Button>
      </Stack>
    </form>
  );
}
