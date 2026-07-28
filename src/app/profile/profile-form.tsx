"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Stack } from "@stackmyth/layout";
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
 * Plain `<select>` elements rather than `SelectField`, because this form is not
 * inside a `FormController` — it has two fields and no cross-field rules, so
 * the validation machinery would be more moving parts than the problem has.
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
          <select
            id="profile-locale"
            name="locale"
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
          >
            <option value="">{copy.profile.languageAuto}</option>
            {LOCALES.map((option) => (
              <option key={option} value={option}>
                {getCopy(option).localeName}
              </option>
            ))}
          </select>
        </ControlledField>

        <ControlledField
          label={copy.profile.timeZoneLabel}
          description={copy.profile.timeZoneHelp}
          error={state.errors.timeZone}
          htmlFor="profile-timezone"
        >
          <select
            id="profile-timezone"
            name="timeZone"
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
          >
            <option value="">{copy.profile.timeZoneAuto}</option>
            {zoneOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
