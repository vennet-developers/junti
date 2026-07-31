import "server-only";

import { consoleAdapter } from "./console";
import type { EmailPort, OutboundMessage, SendResult } from "./port";
import { createResendAdapter } from "./resend";

/**
 * Which adapter this deployment sends through.
 *
 * **Adding a provider is a file and a case.** Write the adapter next to
 * `resend.ts`, add its name here, set `EMAIL_PROVIDER` and its key. Nothing
 * else in the app learns about it, because nothing else in the app imports
 * anything but `sendMessage` below.
 *
 * **The default is "send nothing".** Not a flag that has to be remembered in
 * development and unset in production, but the absence of configuration: a
 * machine with no `EMAIL_PROVIDER` gets the console adapter and cannot reach a
 * real person. Enabling delivery is an explicit act, and it is the same act in
 * every environment — which is why staging cannot email your users by
 * forgetting something.
 *
 * A misconfigured provider — named but missing its key — refuses to fall back
 * silently. Falling back would turn "production stopped emailing" into a line
 * in a log nobody reads.
 */
function resolveAdapter(): EmailPort {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (!provider || provider === "console") return consoleAdapter;

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();

    if (!apiKey || !from) {
      throw new Error(
        'EMAIL_PROVIDER="resend" needs RESEND_API_KEY and EMAIL_FROM. ' +
          "Set both, or leave EMAIL_PROVIDER unset to send nothing.",
      );
    }

    return createResendAdapter({ apiKey, from });
  }

  throw new Error(`Unknown EMAIL_PROVIDER "${provider}". Known: console, resend.`);
}

/**
 * Resolved once per process rather than per send.
 *
 * Lazily, so importing this module in a context that never sends — a page that
 * merely links to something — cannot fail a build over a variable it does not
 * need.
 */
let adapter: EmailPort | null = null;

function port(): EmailPort {
  adapter ??= resolveAdapter();
  return adapter;
}

/**
 * The one function the rest of the app calls.
 *
 * Everything about who delivers, how they are configured and what their API
 * looks like stops here. A call site names a message and a recipient.
 */
export async function sendMessage(message: OutboundMessage): Promise<SendResult> {
  return port().send(message);
}

/** Which adapter is live, for a health endpoint or an incident. */
export function activeProvider(): string {
  return port().name;
}
