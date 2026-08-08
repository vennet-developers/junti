import { Button, Section, Text } from "@react-email/components";

import { getCopy, isLocale, DEFAULT_LOCALE } from "@/config/copy";

import { EmailLayout, emailText } from "./layout";

/**
 * The first message, and the only one that arrives before anybody has done
 * anything.
 *
 * Which shapes what it can say. Every other email here reports a fact — a
 * receipt was approved, an event moved, somebody owes a balance — and has
 * that fact to lead with. This one has nothing to report, so it earns its
 * place only by answering the question a new account actually has: what do I
 * do now. One instruction, one button, and the sentence about links that is
 * the whole product in a line.
 *
 * Deliberately NOT sent at the instant an account is created. A magic-link
 * signup is already receiving a message in that same second, and two emails
 * landing together read as a malfunction; this goes out when the person has a
 * usable profile — immediately for Google, after onboarding for a link.
 */
export interface WelcomeValues {
  /** What they chose to be called, for one line of greeting. */
  name: string;
  /** Where "create your first event" goes. */
  createPath: string;
}

export function WelcomeEmail({
  values,
  locale,
  origin,
}: {
  values: WelcomeValues;
  locale: string;
  origin: string;
}) {
  const copy = getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.welcome;

  return (
    <EmailLayout preview={copy.preview} origin={origin}>
      <Section>
        <Text style={emailText.heading}>{copy.heading(values.name)}</Text>
        <Text style={emailText.paragraph}>{copy.body}</Text>

        <Text style={{ ...emailText.paragraph, margin: "0 0 20px" }}>{copy.howItWorks}</Text>

        <Button href={`${origin}${values.createPath}`} style={emailText.button}>
          {copy.cta}
        </Button>
      </Section>
    </EmailLayout>
  );
}

/** The subject line, beside the template that owns the words. */
export function welcomeSubject(_values: WelcomeValues, locale: string): string {
  return getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.welcome.subject;
}
