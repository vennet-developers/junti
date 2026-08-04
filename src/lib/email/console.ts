import "@/server/assert-server";

import type { EmailPort, OutboundMessage, SendResult } from "./port";

/**
 * The adapter that sends nothing and says what it would have sent.
 *
 * **This is the default, and that is the point.** Development and staging must
 * not be able to reach a real person, and the way to guarantee that is for
 * reaching them to require an explicit choice — a provider named in the
 * environment — rather than for not reaching them to require remembering a
 * flag. A machine with no configuration cannot email anybody.
 *
 * It logs instead of dropping silently, because a feature whose transport is a
 * no-op is indistinguishable from a feature that is broken, and the difference
 * matters while building the message that will use it.
 */
export const consoleAdapter: EmailPort = {
  name: "console",

  async send(message: OutboundMessage): Promise<SendResult> {
    // Not the values: a template's interpolations are somebody's name, their
    // event, sometimes an amount. A development log is the wrong place for
    // them, and the shape is what is being debugged here anyway.
    console.info(
      `[email:console]${message.sandbox ? " [sandbox]" : ""} would send "${message.template}" to ${message.to} in ${message.locale}`,
    );

    return { status: "sent", id: `console-${message.template}` };
  },
};
