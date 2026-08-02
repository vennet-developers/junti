import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { runRetention } from "@/lib/retention";

/**
 * The scheduled deletion, triggered by the same cron that keeps the database
 * awake.
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
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Constant-time, so a wrong secret cannot be found one character at a time. */
function matches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const secret = process.env.RETENTION_SECRET?.trim() ?? "";

  // Unconfigured means refused, never open. The whole point of this route is
  // that it destroys things.
  if (!secret) {
    return NextResponse.json({ error: "retention not configured" }, { status: 500 });
  }

  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!matches(given, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const report = await runRetention();

  /*
    Reported rather than silent. A retention job that says nothing looks exactly
    like one that stopped running — which is the state this project was in for
    months while `deleteEvidence` existed and nothing called it. The cron prints
    this into the workflow log.
  */
  return NextResponse.json(report);
}
