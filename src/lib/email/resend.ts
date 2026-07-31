import "server-only";

import type { EmailPort, OutboundMessage, SendResult } from "./port";

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
   * The From address, which must be on a domain verified with Resend.
   *
   * Per environment, so a mistake in development cannot spend production's
   * sending reputation — a bounce rate earned by `staging.junti.app` is that
   * subdomain's problem, and the address is what decides which one wears it.
   */
  from: string;
}

/**
 * Renders a template into what email needs.
 *
 * Deliberately the only place in the app that knows a message has a subject
 * line: the port's contract is a template and its values, precisely so the same
 * message can be handed to WhatsApp later without unlearning email's shape.
 *
 * Empty while the transport ships without a message to carry. The first
 * template lands here and in the port's union together, so neither can exist
 * without the other.
 */
function render(message: OutboundMessage): { subject: string; text: string } {
  throw new Error(`No template renderer for "${message.template}"`);
}

export function createResendAdapter(config: ResendConfig): EmailPort {
  return {
    name: "resend",

    async send(message: OutboundMessage): Promise<SendResult> {
      const { subject, text } = render(message);

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
            subject,
            text,
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
