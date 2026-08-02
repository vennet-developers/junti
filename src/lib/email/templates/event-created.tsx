import { Button, Section, Text } from "@react-email/components";

import { getCopy, isLocale, DEFAULT_LOCALE } from "@/config/copy";

import { EmailLayout, emailText } from "./layout";

/**
 * "Your event is live, here is the link to share."
 *
 * The one thing an organizer has to do immediately after creating an event is
 * paste its link into a group chat — and the moment they close the tab, that
 * link is somewhere they have to go and find. This puts it in their inbox,
 * which is a place they can forward from on a phone without opening the app.
 *
 * **Only the guest link.** The organizer link is full control of the event, and
 * an inbox is forwarded, screenshotted and left open on shared laptops. The
 * event lives in their history, so nothing here needs to carry the key to it.
 */
export interface EventCreatedValues {
  eventTitle: string;
  /** Already formatted for the reader's language and the event's zone. */
  eventWhen: string;
  /** The PUBLIC path. Never the manage one — see the note above. */
  eventPath: string;
}

export function EventCreatedEmail({
  values,
  locale,
  origin,
}: {
  values: EventCreatedValues;
  locale: string;
  origin: string;
}) {
  const copy = getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.eventCreated;

  return (
    <EmailLayout preview={copy.preview(values.eventTitle)} origin={origin}>
      <Section>
        <Text style={emailText.heading}>{copy.heading}</Text>
        <Text style={emailText.paragraph}>{copy.body}</Text>

        <Text style={{ ...emailText.paragraph, fontWeight: 600, margin: "0 0 4px" }}>
          {values.eventTitle}
        </Text>
        <Text style={{ ...emailText.paragraph, margin: "0 0 20px" }}>{values.eventWhen}</Text>

        <Button href={`${origin}${values.eventPath}`} style={emailText.button}>
          {copy.cta}
        </Button>

        {/* The link in plain text as well as behind the button: an organizer
            forwarding this to a group chat needs something they can copy, and
            a button is not copyable. */}
        <Text style={{ ...emailText.paragraph, fontSize: "13px", margin: "20px 0 0" }}>
          {`${origin}${values.eventPath}`}
        </Text>
      </Section>
    </EmailLayout>
  );
}

export function eventCreatedSubject(values: EventCreatedValues, locale: string): string {
  return getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.eventCreated.subject(
    values.eventTitle,
  );
}
