import { createFileRoute } from "@tanstack/react-router";

/**
 * The scheduled deletion, triggered by the same cron that keeps the database
 * awake — the port of `src/app/api/retention/route.ts`, logic untouched.
 *
 * **Authenticated, unlike `/api/keep-alive`.** That one has nothing to protect:
 * it writes a heartbeat row and anyone hammering it achieves nothing but their
 * own boredom. This one deletes, and an endpoint that deletes on request is an
 * endpoint somebody will eventually request.
 *
 * GitHub Actions rather than Vercel Cron, for the reason already written into
 * `.github/workflows/keep-alive.yml`: Hobby cron is limited in frequency and
 * count, and Actions is free.
 */
export const Route = createFileRoute("/api/retention")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        /*
          Server modules arrive by dynamic import because this FILE ships to
          the browser: a route is part of the client route tree even when all
          it defines is server handlers, and a top-level import here would drag
          `node:crypto` and the retention module — and behind it the database
          client — into the client bundle.
        */
        const [{ timingSafeEqual }, { runRetention }] = await Promise.all([
          import("node:crypto"),
          import("@/lib/retention"),
        ]);

        /** Constant-time, so a wrong secret cannot be found one character at a time. */
        function matches(given: string, expected: string): boolean {
          const a = Buffer.from(given);
          const b = Buffer.from(expected);
          return a.length === b.length && timingSafeEqual(a, b);
        }

        const secret = process.env.RETENTION_SECRET?.trim() ?? "";

        // Unconfigured means refused, never open. The whole point of this route is
        // that it destroys things.
        if (!secret) {
          return Response.json({ error: "retention not configured" }, { status: 500 });
        }

        const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        if (!matches(given, secret)) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        const report = await runRetention();

        /*
          Reported rather than silent. A retention job that says nothing looks exactly
          like one that stopped running — which is the state this project was in for
          months while `deleteEvidence` existed and nothing called it. The cron prints
          this into the workflow log.
        */
        return Response.json(report);
      },
    },
  },
});
