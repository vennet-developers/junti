import { Button, Section, Text } from "@react-email/components";

import { getCopy, isLocale, DEFAULT_LOCALE } from "@/config/copy";

import { EmailLayout, emailText } from "./layout";

/**
 * "You are on the list" — the receipt for answering.
 *
 * **A receipt, not a notification.** The person did something a moment ago and
 * this confirms it in a place that survives closing the tab: the day, the
 * place, and what they still owe. That is the whole reason it exists — an RSVP
 * you cannot check later is one you have to remember.
 *
 * Consent-free by nature, and that is not a loophole. It is about a thing they
 * just did, sent to the address they signed in with, for the event they chose.
 * It still honours the suppression list, because somebody who said "stop
 * writing to me" meant it.
 *
 * Waitlisted gets its own wording rather than a cheerful "you are in" with an
 * asterisk. Being twelfth for ten spots is a different fact and reading it as
 * confirmation is how somebody turns up to a game with no room for them.
 */
export interface RsvpConfirmedValues {
  eventTitle: string;
  /** Already formatted for the reader's language and the event's zone. */
  eventWhen: string;
  /** Empty when the event has no place set. */
  eventWhere: string;
  /** Their share, already formatted with its currency. Empty when free. */
  amount: string;
  /** "in" | "waitlisted" — the two outcomes worth a message. */
  attendance: string;
  eventPath: string;
}

export function RsvpConfirmedEmail({
  values,
  locale,
  origin,
}: {
  values: RsvpConfirmedValues;
  locale: string;
  origin: string;
}) {
  const copy = getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.rsvpConfirmed;
  const waitlisted = values.attendance === "waitlisted";
  const words = waitlisted ? copy.waitlisted : copy.confirmed;

  return (
    <EmailLayout preview={words.preview(values.eventTitle)} origin={origin}>
      <Section>
        <Text style={emailText.heading}>{words.heading}</Text>
        <Text style={emailText.paragraph}>{words.body(values.eventTitle)}</Text>

        <Text style={{ ...emailText.paragraph, fontWeight: 600, margin: "0 0 4px" }}>
          {values.eventTitle}
        </Text>
        <Text style={{ ...emailText.paragraph, margin: "0 0 4px" }}>{values.eventWhen}</Text>
        {values.eventWhere ? (
          <Text style={{ ...emailText.paragraph, margin: "0 0 4px" }}>{values.eventWhere}</Text>
        ) : null}

        {/* Only when there is one. A line reading "your share: nothing" on a
            free event is noise pretending to be information. */}
        {values.amount ? (
          <Text style={{ ...emailText.paragraph, margin: "0 0 20px" }}>
            {copy.yourShare(values.amount)}
          </Text>
        ) : null}

        <Button href={`${origin}${values.eventPath}`} style={emailText.button}>
          {copy.cta}
        </Button>

        <Text style={{ ...emailText.paragraph, fontSize: "13px", margin: "20px 0 0" }}>
          {copy.changeNote}
        </Text>
      </Section>
    </EmailLayout>
  );
}

export function rsvpConfirmedSubject(values: RsvpConfirmedValues, locale: string): string {
  const copy = getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.rsvpConfirmed;
  const words = values.attendance === "waitlisted" ? copy.waitlisted : copy.confirmed;
  return words.subject(values.eventTitle);
}
