import "@/server/assert-server";

import { render } from "@react-email/render";

import type { EmailPort, OutboundMessage, SendResult } from "./port";
import { sandboxSubject } from "./sandbox";
import {
  EventCreatedEmail,
  eventCreatedSubject,
  type EventCreatedValues,
} from "./templates/event-created";
import {
  RsvpConfirmedEmail,
  rsvpConfirmedSubject,
  type RsvpConfirmedValues,
} from "./templates/rsvp-confirmed";
import { AuthLinkEmail, authLinkSubject, type AuthLinkValues } from "./templates/auth-link";
import {
  EventCancelledEmail,
  eventCancelledSubject,
  type EventCancelledValues,
} from "./templates/event-cancelled";
import {
  EventInvitationEmail,
  eventInvitationSubject,
  type EventInvitationValues,
} from "./templates/event-invitation";
import {
  PendingApprovalEmail,
  pendingApprovalSubject,
  type PendingApprovalValues,
} from "./templates/pending-approval";
import {
  SettlementRequestEmail,
  settlementRequestSubject,
  type SettlementRequestValues,
} from "./templates/settlement-request";

/**
 * Resend, behind the port.
 *
 * **No SDK.** Sending is one POST with a JSON body and a bearer token, and the
 * package would add a dependency, a version to keep current and a second way to
 * configure the same thing. `fetch` is in the runtime.
 *
 * Everything provider-shaped is confined to this file: the endpoint, the header,
 * the response's field names. That is what makes the swap in `provider.ts` a
 * one-line change rather than a search for every place that knew about Resend.
 */

const ENDPOINT = "https://api.resend.com/emails";

export interface ResendConfig {
  apiKey: string;
  /**
   * Absolute origin of this deployment, for the images and links inside a
   * message. A relative path in an inbox resolves against the mail client.
   */
  origin: string;
  /**
   * The From address, which must be on a domain verified with Resend.
   *
   * Per environment, so a mistake in development cannot spend production's
   * sending reputation — a bounce rate earned by `staging.junti.app` is that
   * subdomain's problem, and the address is what decides which one wears it.
   */
  from: string;
  /**
   * Where a reply should land, when that is not the From address.
   *
   * Sending moves to a dedicated subdomain to keep Junti's reputation off the
   * company's own domain, and the moment it does, the From becomes an address
   * with no mailbox behind it. Somebody who hits reply — to ask what the event
   * is, or to say they cannot make it — deserves better than a bounce, and
   * "noreply@" is the industry's way of admitting it never solved this.
   *
   * Optional, and absent by default: while the From is still a real mailbox
   * there is nothing to redirect, and a Reply-To equal to the From is noise in
   * every header.
   */
  replyTo?: string;
}

/**
 * Turns a message into what email needs.
 *
 * Deliberately the only place in the app that knows a message has a subject
 * line and a body: the port's contract is a template and its values, precisely
 * so the same message can be handed to WhatsApp later without unlearning
 * email's shape. A WhatsApp adapter would render the identical input into
 * whatever that API wants, from this same union.
 *
 * The switch is exhaustive against `MessageTemplate`, so adding a name to that
 * union without writing its case fails the build rather than throwing in
 * production.
 *
 * `html` and `text` both, always. A text part is what stops a client that
 * refuses HTML from showing an empty message, and it is what most spam filters
 * read first.
 */
async function compose(
  message: OutboundMessage,
  origin: string,
): Promise<{ subject: string; html: string; text: string }> {
  switch (message.template) {
    case "pending-approval": {
      const values = message.values as unknown as PendingApprovalValues;
      const element = (
        <PendingApprovalEmail values={values} locale={message.locale} origin={origin} />
      );

      return {
        subject: pendingApprovalSubject(values, message.locale),
        html: await render(element),
        text: await render(element, { plainText: true }),
      };
    }

    case "auth-link": {
      const values = message.values as unknown as AuthLinkValues;
      const element = <AuthLinkEmail values={values} locale={message.locale} origin={origin} />;

      return {
        subject: authLinkSubject(values, message.locale),
        html: await render(element),
        text: await render(element, { plainText: true }),
      };
    }

    case "event-created": {
      const values = message.values as unknown as EventCreatedValues;
      const element = <EventCreatedEmail values={values} locale={message.locale} origin={origin} />;

      return {
        subject: eventCreatedSubject(values, message.locale),
        html: await render(element),
        text: await render(element, { plainText: true }),
      };
    }

    case "rsvp-confirmed": {
      const values = message.values as unknown as RsvpConfirmedValues;
      const element = (
        <RsvpConfirmedEmail values={values} locale={message.locale} origin={origin} />
      );

      return {
        subject: rsvpConfirmedSubject(values, message.locale),
        html: await render(element),
        text: await render(element, { plainText: true }),
      };
    }

    case "event-cancelled": {
      const values = message.values as unknown as EventCancelledValues;
      const element = (
        <EventCancelledEmail values={values} locale={message.locale} origin={origin} />
      );

      return {
        subject: eventCancelledSubject(values, message.locale),
        html: await render(element),
        text: await render(element, { plainText: true }),
      };
    }

    case "event-invitation": {
      const values = message.values as unknown as EventInvitationValues;
      const element = (
        <EventInvitationEmail values={values} locale={message.locale} origin={origin} />
      );

      return {
        subject: eventInvitationSubject(values, message.locale),
        html: await render(element),
        text: await render(element, { plainText: true }),
      };
    }

    case "settlement-request": {
      const values = message.values as unknown as SettlementRequestValues;
      const element = (
        <SettlementRequestEmail values={values} locale={message.locale} origin={origin} />
      );

      return {
        subject: settlementRequestSubject(values, message.locale),
        html: await render(element),
        text: await render(element, { plainText: true }),
      };
    }
  }
}

export function createResendAdapter(config: ResendConfig): EmailPort {
  return {
    name: "resend",

    async send(message: OutboundMessage): Promise<SendResult> {
      const composed = await compose(message, config.origin);
      const { html, text } = composed;
      const subject = sandboxSubject(composed.subject, message.sandbox);

      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: config.from,
            to: [message.to],
            // Omitted rather than sent empty: Resend rejects a `reply_to` that
            // is present and blank, and an unset key is the same as no header.
            ...(config.replyTo ? { reply_to: [config.replyTo] } : {}),
            subject,
            html,
            text,
            /*
              Base64, because Resend's API takes attachment content that way.
              Omitted entirely when there is nothing to attach — an empty array
              is a key the API has to think about for no reason.
            */
            ...(message.attachments?.length
              ? {
                  attachments: message.attachments.map((file) => ({
                    filename: file.filename,
                    content: Buffer.from(file.content, "utf-8").toString("base64"),
                    content_type: file.contentType,
                  })),
                }
              : {}),
          }),
        });

        if (!response.ok) {
          // The body carries Resend's own explanation — an unverified domain,
          // a malformed address — and losing it would leave a status code to
          // debug from.
          const detail = await response.text();
          return { status: "failed", reason: `${response.status} ${detail}`.trim() };
        }

        const body = (await response.json()) as { id?: string };
        return { status: "sent", id: body.id ?? "" };
      } catch (error) {
        // A network failure is not an exception the caller should have to
        // handle differently from a rejected send: both mean it did not go.
        return {
          status: "failed",
          reason: error instanceof Error ? error.message : "unknown transport error",
        };
      }
    },
  };
}
