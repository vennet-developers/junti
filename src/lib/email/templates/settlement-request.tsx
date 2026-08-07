import { Button, Section, Text } from "@react-email/components";

import { getCopy, isLocale, DEFAULT_LOCALE } from "@/config/copy";

import { EmailLayout, emailText } from "./layout";

/**
 * "The share went up and part of yours is missing" — the organizer asking for
 * the dropout gap, through the app instead of one by one on WhatsApp.
 *
 * **Sent only when the organizer presses the button.** Never automatic: how
 * and when to chase money between friends is a social decision, and an app
 * that nags on its own schedule is an app that gets muted. The press is the
 * organizer saying "now".
 *
 * Consent-free for the same reason the RSVP receipt is: it is about money the
 * recipient already owes on an event they joined, sent to the address they
 * signed in with. It still honours the suppression list — "stop writing to
 * me" beats "you owe $4.000".
 *
 * The numbers are the same three the settlement card shows the organizer:
 * what was paid, the final share, the difference. Both sides of the
 * conversation read the same figures, which is what keeps the conversation
 * short.
 */
export interface SettlementRequestValues {
  eventTitle: string;
  /** All three already formatted with their currency. */
  paidAmount: string;
  finalShare: string;
  missingAmount: string;
  eventPath: string;
}

export function SettlementRequestEmail({
  values,
  locale,
  origin,
}: {
  values: SettlementRequestValues;
  locale: string;
  origin: string;
}) {
  const copy = getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.settlementRequest;

  return (
    <EmailLayout preview={copy.preview(values.eventTitle)} origin={origin}>
      <Section>
        <Text style={emailText.heading}>{copy.heading}</Text>
        <Text style={emailText.paragraph}>{copy.body(values.eventTitle)}</Text>

        <Text style={{ ...emailText.paragraph, margin: "0 0 4px" }}>
          {copy.numbers(values.paidAmount, values.finalShare)}
        </Text>
        <Text style={{ ...emailText.paragraph, fontWeight: 600, margin: "0 0 20px" }}>
          {copy.missing(values.missingAmount)}
        </Text>

        <Button href={`${origin}${values.eventPath}`} style={emailText.button}>
          {copy.cta}
        </Button>

        <Text style={{ ...emailText.paragraph, fontSize: "13px", margin: "20px 0 0" }}>
          {copy.note}
        </Text>
      </Section>
    </EmailLayout>
  );
}

export function settlementRequestSubject(values: SettlementRequestValues, locale: string): string {
  const copy = getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.settlementRequest;
  return copy.subject(values.eventTitle);
}
