import { createFileRoute } from "@tanstack/react-router";

/**
 * Serves an uploaded receipt — the port of the evidence route handler.
 *
 * **This route is the entire access control for evidence.** The image never
 * appears in any loader's data, never reaches the participant view, and has
 * no other way out of the database. Two independent checks, both required:
 * the caller is the organizer of the event named in the path, and the
 * submission belongs to THAT event — without the second, an organizer of any
 * event could read any submission by guessing an id.
 *
 * 404 rather than a redirect on every failure: this serves bytes to an
 * `<img>`, and a sign-in page rendered into an image element helps nobody.
 */
export const Route = createFileRoute(
  "/e/$public_token/manage/$organizer_token/evidence/$submission_id",
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const [{ getEvidence }, { resolveEventLocale }, { getCurrentUser }, roster_] =
          await Promise.all([
            import("@/lib/evidence-store"),
            import("@/lib/locale"),
            import("@/lib/supabase/server"),
            import("@/lib/roster"),
          ]);

        const user = await getCurrentUser();
        if (!user) return new Response(null, { status: 404 });

        const event = await roster_.authorizeOrganizer(
          params.public_token,
          params.organizer_token,
          user.id,
        );
        if (!event) return new Response(null, { status: 404 });

        const submission = await roster_.findSubmissionInEvent(
          event.id,
          params.submission_id,
          await resolveEventLocale(event.locale),
        );
        if (!submission) return new Response(null, { status: 404 });

        const evidence = await getEvidence(params.submission_id);
        if (!evidence) return new Response(null, { status: 404 });

        return new Response(new Uint8Array(evidence.bytes), {
          status: 200,
          headers: {
            "Content-Type": evidence.mimeType,
            "Content-Length": String(evidence.sizeBytes),
            // `no-store`: the URL contains the organizer token, and a copy in
            // a shared cache would outlive the decision to stop sharing it.
            "Cache-Control": "no-store, private",
            // Never render it as a document, whatever the sniffer concluded.
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
