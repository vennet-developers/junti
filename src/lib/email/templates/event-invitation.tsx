import { Button, Section, Text } from "@react-email/components";

import { getCopy, isLocale, DEFAULT_LOCALE } from "@/config/copy";

import { EmailLayout, emailText } from "./layout";

/**
 * "You are invited" — the first message this app sends to somebody who is not
 * an account holder yet.
 *
 * That is new, and it is the point. Until now nothing here could reach a
 * participant, because nobody collected their address: people arrived through a
 * WhatsApp link and typed a name. The organizer's alternative was adding them to
 * the roster by hand, which put a name on a list on somebody else's say-so.
 * Asking them is the honest version of that, and asking requires an address.
 *
 * The link is the ordinary public event link. There is no invitation token and
 * no per-recipient URL: the invitation records that they were asked, it does not
 * grant anything the link does not already carry. A forwarded message therefore
 * works exactly as a forwarded WhatsApp link does, which is how this product has
 * always been shared and not a hole to plug.
 */
export interface EventInvitationValues {
  /** Who is asking, by their account's display name. */
  organizerName: string;
  eventTitle: string;
  /** Already formatted for the reader's language — this template does no dates. */
  eventWhen: string;
  /** Empty string when the event has no location, which the template checks. */
  eventWhere: string;
  /** The public participant path, e.g. "/e/abc123". */
  eventPath: string;
  /** Where "stop writing to me" goes. Already carries the address. */
  unsubscribePath: string;
}

export function EventInvitationEmail({
  values,
  locale,
  origin,
}: {
  values: EventInvitationValues;
  locale: string;
  origin: string;
}) {
  const copy = getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.eventInvitation;

  return (
    <EmailLayout preview={copy.preview(values.organizerName, values.eventTitle)} origin={origin}>
      <Section>
        <Text style={emailText.heading}>{copy.heading(values.organizerName)}</Text>

        <Text style={emailText.paragraph}>{copy.body(values.eventTitle)}</Text>

        {/* The what and the when, plainly. An inbox is not the roster, and a
            person deciding whether to open a link wants the two facts that
            settle it before they do. */}
        <Text style={{ ...emailText.paragraph, fontWeight: 600, margin: "0 0 4px" }}>
          {values.eventTitle}
        </Text>
        <Text style={{ ...emailText.paragraph, margin: "0 0 4px" }}>{values.eventWhen}</Text>
        {values.eventWhere ? (
          <Text style={{ ...emailText.paragraph, margin: "0 0 20px" }}>{values.eventWhere}</Text>
        ) : null}

        <Button href={`${origin}${values.eventPath}`} style={emailText.button}>
          {copy.cta}
        </Button>

        {/* Said here rather than discovered on arrival. Answering needs an
            account now, and finding that out after tapping through from an
            inbox is the kind of surprise that ends in nobody answering. */}
        <Text style={{ ...emailText.paragraph, fontSize: "13px", margin: "20px 0 0" }}>
          {copy.accountNote}
        </Text>

        {/*
          The only message here that goes to somebody who never asked for it.
          An organizer typed their address into a box; they have no account, no
          session and nothing to revoke with, so the way out has to be in the
          message itself and has to work in one click.
        */}
        <Text style={{ ...emailText.paragraph, fontSize: "12px", margin: "16px 0 0" }}>
          <a href={`${origin}${values.unsubscribePath}`} style={{ color: "inherit" }}>
            {copy.unsubscribe}
          </a>
        </Text>
      </Section>
    </EmailLayout>
  );
}

/** The subject line, kept beside the message it belongs to. */
export function eventInvitationSubject(values: EventInvitationValues, locale: string): string {
  return getCopy(isLocale(locale) ? locale : DEFAULT_LOCALE).emails.eventInvitation.subject(
    values.organizerName,
    values.eventTitle,
  );
}
