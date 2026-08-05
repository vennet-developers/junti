import { createFileRoute } from "@tanstack/react-router";

/**
 * The sweep: everything written down and not yet sent.
 *
 * **A safety net, not the mechanism.** Every message is dispatched the moment
 * it is enqueued, so this only ever sees what failed, what was enqueued by a
 * process that died before sending it, and what is waiting out a backoff.
 *
 * Guarded by the same secret as `/api/retention`, and for a milder version of
 * the same reason: this one does not delete, but it does send, and an endpoint
 * that sends on request is one somebody will eventually request.
 *
 * Shares the retention secret rather than adding a second: two secrets is two
 * things to rotate and two things to have configured wrong, for two endpoints
 * that are only ever called by the same workflow.
 */
export const Route = createFileRoute("/api/outbox")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Dynamic, because this file ships to the browser as part of the route
        // tree even though it only defines a server handler.
        const [{ timingSafeEqual }, { dispatchPending }] = await Promise.all([
          import("node:crypto"),
          import("@/lib/outbox"),
        ]);

        function matches(given: string, expected: string): boolean {
          const a = Buffer.from(given);
          const b = Buffer.from(expected);
          return a.length === b.length && timingSafeEqual(a, b);
        }

        const secret = process.env.RETENTION_SECRET?.trim() ?? "";
        if (!secret) {
          return Response.json({ error: "outbox not configured" }, { status: 500 });
        }

        const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        if (!matches(given, secret)) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        const report = await dispatchPending();

        // Printed into the workflow log, so a sweep that stops working does
        // not look identical to one with nothing to do.
        return Response.json(report);
      },
    },
  },
});
