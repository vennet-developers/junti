import { Button, Section, Text } from "@react-email/components";

import { getCopy, isLocale, DEFAULT_LOCALE } from "@/config/copy";

import { EmailLayout, emailText } from "./layout";

/**
 * The first real message: somebody sent a receipt and it is waiting on you.
 *
 * Chosen as the first because it is the one message this product actually owes
 * an organizer today — the approvals queue exists precisely because receipts
 * pile up unseen, and a queue nobody is told about is a page nobody opens.
 *
 * This one goes to an account holder, who by definition has an address we did
 * not have to ask for. `event-invitation` is the other case — the only message
 * addressed to somebody who has no account yet, sent to a list the organizer
 * typed in.
 */
export interface PendingApprovalValues {
  /** Who sent the receipt. */
  participantName: string;
  eventTitle: string;
  /** How many are waiting in total, this one included. */
  pendingCount: string;
}

export function PendingApprovalEmail({
  values,
  locale,
  origin,
}: {
  values: PendingApprovalValues;
  locale: string;
  origin: string;
}) {
  const copy = getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.pendingApproval;
  const count = Number(values.pendingCount) || 1;

  return (
    <EmailLayout preview={copy.preview(values.participantName)} origin={origin}>
      <Section>
        <Text style={emailText.heading}>{copy.heading}</Text>

        <Text style={emailText.paragraph}>
          {copy.body(values.participantName, values.eventTitle)}
        </Text>

        {/* Only worth saying when there is more than this one waiting; a queue
            of one is not a queue. */}
        {count > 1 ? <Text style={emailText.paragraph}>{copy.alsoWaiting(count)}</Text> : null}

        <Button href={`${origin}/approvals`} style={emailText.button}>
          {copy.cta}
        </Button>
      </Section>
    </EmailLayout>
  );
}

/** The subject line, kept beside the message it belongs to. */
export function pendingApprovalSubject(values: PendingApprovalValues, locale: string): string {
  return getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.pendingApproval.subject(
    values.participantName,
  );
}
