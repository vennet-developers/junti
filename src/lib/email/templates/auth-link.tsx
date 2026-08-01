import { Button, Section, Text } from "@react-email/components";

import { getCopy, isLocale, DEFAULT_LOCALE } from "@/config/copy";

import { EmailLayout, emailText } from "./layout";

/**
 * The way in: confirm your address, or sign in.
 *
 * **Supabase used to send this one itself**, from `noreply@mail.app.supabase.io`,
 * in English, with none of the frame every other message here carries. It now
 * arrives through the Send Email Hook instead — Supabase calls the app, the app
 * renders this, and the same `EmailLayout` puts the chapa on top and Vennet's
 * mark at the bottom. A message that credits its maker differently from the page
 * it came from reads as a forgery, and the sign-in message was the one doing it.
 *
 * Two shapes behind one template, because from the reader's side they are the
 * same act — opening the thing that gets them in:
 *
 * - **signup** is a first-time address confirming itself;
 * - **magiclink** is somebody who already has an account coming back.
 *
 * They differ only in wording. Splitting them into two templates would duplicate
 * the frame, the button and the expiry line to vary one sentence.
 */
export type AuthLinkAction = "signup" | "magiclink" | "recovery" | "email_change";

export interface AuthLinkValues {
  /** Absolute, and already pointing at this app's callback — see the hook. */
  url: string;
  action: AuthLinkAction;
  /** Minutes until the token stops working, as a string. */
  expiresInMinutes: string;
}

function wording(action: AuthLinkAction, copy: ReturnType<typeof getCopy>["emails"]["authLink"]) {
  // `email_change` and `recovery` cannot arise in this product — there are no
  // passwords, and nothing offers to change an address — but the hook receives
  // whatever Supabase sends, and a message with no words at all is worse than a
  // slightly generic one.
  return action === "signup" ? copy.signup : copy.magiclink;
}

export function AuthLinkEmail({
  values,
  locale,
  origin,
}: {
  values: AuthLinkValues;
  locale: string;
  origin: string;
}) {
  const copy = getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.authLink;
  const words = wording(values.action, copy);

  return (
    <EmailLayout preview={words.preview} origin={origin}>
      <Section>
        <Text style={emailText.heading}>{words.heading}</Text>

        <Text style={emailText.paragraph}>{words.body}</Text>

        <Button href={values.url} style={emailText.button}>
          {words.cta}
        </Button>

        {/*
          Said plainly and near the button. A link that has quietly expired is
          the single most common reason somebody ends up back on the sign-in
          form convinced the app is broken.
        */}
        <Text style={{ ...emailText.paragraph, fontSize: "13px", margin: "20px 0 0" }}>
          {copy.expiry(Number(values.expiresInMinutes) || 60)}
        </Text>

        <Text style={{ ...emailText.paragraph, fontSize: "13px", margin: "8px 0 0" }}>
          {copy.ignore}
        </Text>
      </Section>
    </EmailLayout>
  );
}

/** The subject line, kept beside the message it belongs to. */
export function authLinkSubject(values: AuthLinkValues, locale: string): string {
  const copy = getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.authLink;
  return wording(values.action, copy).subject;
}
