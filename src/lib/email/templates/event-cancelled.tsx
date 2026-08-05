import { Button, Section, Text } from "@react-email/components";

import { getCopy, isLocale, DEFAULT_LOCALE } from "@/config/copy";

import { EmailLayout, emailText } from "./layout";

/**
 * "It is off."
 *
 * The one message in this app that exists to undo something rather than to
 * confirm it, and it is sent to people who did nothing wrong and were counting
 * on a plan. So it says the thing first and explains second — nobody reading
 * this wants a paragraph of context before finding out whether Thursday is
 * still on.
 *
 * **It carries a CANCEL calendar file**, which is what actually removes the
 * entry from a calendar that already has it. The line about that is in the
 * message because a silent removal is unsettling: somebody who finds a gap
 * where their Thursday used to be should know why it went.
 *
 * **And it mentions money without pretending to solve it.** Junti never held
 * the payment, so a refund is between two people who know each other. Saying
 * nothing would be worse — it is the first question somebody who already paid
 * is going to have.
 */
export interface EventCancelledValues {
  eventTitle: string;
  /** Already formatted for the reader's language and the event's zone. */
  eventWhen: string;
  eventPath: string;
  /** "1" when this person had money recorded against the event. */
  hadPaid: string;
}

export function EventCancelledEmail({
  values,
  locale,
  origin,
}: {
  values: EventCancelledValues;
  locale: string;
  origin: string;
}) {
  const copy = getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.eventCancelled;

  return (
    <EmailLayout preview={copy.preview(values.eventTitle)} origin={origin}>
      <Section>
        <Text style={emailText.heading}>{copy.heading}</Text>
        <Text style={emailText.paragraph}>{copy.body(values.eventTitle)}</Text>

        <Text style={{ ...emailText.paragraph, fontWeight: 600, margin: "0 0 4px" }}>
          {values.eventTitle}
        </Text>
        <Text style={{ ...emailText.paragraph, margin: "0 0 20px" }}>{values.eventWhen}</Text>

        <Text style={{ ...emailText.paragraph, fontSize: "13px", margin: "0 0 20px" }}>
          {copy.calendarNote}
        </Text>

        {/* Only for somebody with money recorded against this event. Telling
            everybody about refunds invents a debt for people who owe nothing. */}
        {values.hadPaid === "1" ? (
          <Text style={{ ...emailText.paragraph, fontSize: "13px", margin: "0 0 20px" }}>
            {copy.moneyNote}
          </Text>
        ) : null}

        <Button href={`${origin}${values.eventPath}`} style={emailText.button}>
          {copy.cta}
        </Button>
      </Section>
    </EmailLayout>
  );
}

/** The subject line, beside the template that owns the words. */
export function eventCancelledSubject(values: EventCancelledValues, locale: string): string {
  return getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.eventCancelled.subject(
    values.eventTitle,
  );
}
