import { Button, Section, Text } from "@react-email/components";

import { getCopy, isLocale, DEFAULT_LOCALE } from "@/config/copy";

import { EmailLayout, emailText } from "./layout";

/**
 * "Not that day."
 *
 * The sibling of {@link EventCancelledEmail}, and the difference between them
 * is the whole reason this exists: cancelling ends the plan, postponing only
 * ends its date. So this message spends its words on what SURVIVES — the
 * roster, the money, the person's own place in it — where the cancellation
 * spends them on what is over.
 *
 * It exists because of the failure Ivan named: somebody arriving on the day to
 * an empty field. That is why it is sent the moment the organizer marks it,
 * rather than waiting for a new date to announce — the old date is already
 * wrong, and being told late is the same as not being told.
 *
 * **It carries a CANCEL calendar file**, like the cancellation does, because a
 * date that will not happen has to leave the calendar. The note about that is
 * in the body for the same reason as there: a silent removal is unsettling.
 * The new date arrives later as its own invitation.
 *
 * **The money line says the opposite of the cancellation's.** There, a payment
 * became a debt between two people; here it stays exactly where it was, and
 * saying so heads off the question that would otherwise reach the organizer
 * from every person who already paid.
 */
export interface EventPostponedValues {
  eventTitle: string;
  /** The date being left behind, already formatted for the reader. */
  eventWhen: string;
  eventPath: string;
  /** "1" when this person had money recorded against the event. */
  hadPaid: string;
}

export function EventPostponedEmail({
  values,
  locale,
  origin,
}: {
  values: EventPostponedValues;
  locale: string;
  origin: string;
}) {
  const copy = getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.eventPostponed;

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

        {/* Only for somebody with money recorded against this event — the
            same rule the cancellation follows, for the same reason. */}
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
export function eventPostponedSubject(values: EventPostponedValues, locale: string): string {
  return getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.eventPostponed.subject(
    values.eventTitle,
  );
}
