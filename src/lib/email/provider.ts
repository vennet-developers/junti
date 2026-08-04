import "@/server/assert-server";

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
    /*
      Vercel gives the deployment's own host; locally there is none, so the dev
      server's address stands in. Absolute either way, because an <img> in an
      inbox has no page to be relative to.
    */
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim()
      ? process.env.NEXT_PUBLIC_SITE_URL.trim()
      : process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000";

    if (!apiKey || !from) {
      throw new Error(
        'EMAIL_PROVIDER="resend" needs RESEND_API_KEY and EMAIL_FROM. ' +
          "Set both, or leave EMAIL_PROVIDER unset to send nothing.",
      );
    }

    /*
      Set this once the From address stops being a mailbox somebody reads.
      Moving sending to a dedicated subdomain is what makes that happen, and a
      reply that bounces is a worse failure than the reputation risk the move
      was meant to avoid.
    */
    const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;

    return createResendAdapter({ apiKey, from, origin, replyTo });
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
/**
 * Whether this process is somewhere a real person's mail should not come from.
 *
 * `VERCEL_ENV` is "production" only on the production deployment; it is
 * "preview" on a branch deploy and undefined on a laptop. Asking for the one
 * positive case rather than listing the negatives means a new environment is
 * treated as a sandbox until somebody says otherwise, which is the safe way
 * round for a flag that decides whether mail looks real.
 */
export function isSandboxEnvironment(): boolean {
  return process.env.VERCEL_ENV !== "production";
}

/**
 * The one function the rest of the app calls.
 *
 * Everything about who delivers, how they are configured and what their API
 * looks like stops here. A call site names a message and a recipient.
 *
 * `sandbox` is filled in from the environment when the caller did not say,
 * so marking test mail is not something anybody has to remember. A caller that
 * DOES say wins, because there is one place where the environment is not the
 * answer: the send-email hook runs on production for a sign-in that may have
 * started on localhost.
 */
export async function sendMessage(message: OutboundMessage): Promise<SendResult> {
  // `??`, not a spread default: a caller passing `sandbox: undefined` — which
  // is what an optional variable does — would otherwise overwrite the default
  // with nothing and quietly send test mail that looks real.
  return port().send({ ...message, sandbox: message.sandbox ?? isSandboxEnvironment() });
}

/** Which adapter is live, for a health endpoint or an incident. */
export function activeProvider(): string {
  return port().name;
}
