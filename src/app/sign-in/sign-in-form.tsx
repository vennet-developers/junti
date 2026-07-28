"use client";

import { useState, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Field, FieldError, FieldLabel } from "@stackmyth/field";
import { GoogleIcon } from "@stackmyth/icons";
import { Divider, Stack } from "@stackmyth/layout";
import { Input } from "@stackmyth/input";
import { Spinner } from "@stackmyth/spinner";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";
import { ROUTES } from "@/config/routes";
import { Notice } from "@/components/notice";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Sign-in for organizers. Two passwordless routes:
 *
 * - **Google** — an OAuth redirect. Also the only way to get a profile photo,
 *   which is the reason the feature exists.
 * - **Email magic link** — for anyone without a Google account. Still no
 *   password to invent, lose or leak.
 *
 * Both land on /auth/callback, which exchanges the code for a session.
 */
export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const { copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function callbackUrl() {
    const url = new URL(ROUTES.authCallback, window.location.origin);
    url.searchParams.set("next", redirectTo);
    return url.toString();
  }

  function signInWithGoogle() {
    setError(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl() },
      });
      if (authError) setError(copy.auth.failed);
    });
  }

  function signInWithEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const value = email.trim();
    // Deliberately loose: the real check is whether the link arrives.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      setError(copy.auth.emailInvalid);
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: value,
        options: { emailRedirectTo: callbackUrl() },
      });
      if (authError) {
        setError(copy.auth.failed);
        return;
      }
      setSentTo(value);
    });
  }

  if (sentTo) {
    return <Notice tone="info" title={copy.auth.emailSent(sentTo)} />;
  }

  return (
    <Stack gap="5">
      {error ? (
        <Text color="error" role="alert">
          {error}
        </Text>
      ) : null}

      <Button type="button" size="lg" fullWidth onClick={signInWithGoogle} disabled={pending}>
        <GoogleIcon size={18} />
        {copy.auth.google}
      </Button>

      <Divider />

      <form onSubmit={signInWithEmail} noValidate>
        <Stack gap="4">
          <Field invalid={Boolean(error)}>
            <FieldLabel htmlFor="sign-in-email">{copy.auth.emailLabel}</FieldLabel>
            <Input
              id="sign-in-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              fullWidth
              size="lg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={copy.auth.emailPlaceholder}
              status={error ? "error" : "default"}
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>

          <Button type="submit" size="lg" fullWidth variant="secondary" disabled={pending}>
            {pending ? <Spinner size="sm" label={copy.auth.emailSending} /> : null}
            {pending ? copy.auth.emailSending : copy.auth.emailSubmit}
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
