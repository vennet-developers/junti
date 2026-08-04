import { readFileSync } from "node:fs";

import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { db } from "@/db/client";
import { eventNotes, events, eventTypes, participants, payments } from "@/db/schema";

/**
 * The roster the organizer screens are designed against: a busy one.
 *
 * Every other seeded event has one or two people on it, which is the case that
 * looks fine no matter what you build. A list is a different object at eight
 * rows: that is where a full-size sticker outweighs the name beside it, where
 * three filled buttons per person become a wall, and where "which row do these
 * controls belong to" stops being obvious. Judging those screens on a roster of
 * one is how they got that way.
 *
 * Eight of ten seats, so the capacity chip reads "Quedan 2 cupos" rather than
 * "Cupo lleno" — the state the screen spends most of its life in.
 *
 * **Idempotent**: it keys on the public token and rebuilds the roster from
 * scratch, so running it twice leaves the same eight people rather than
 * sixteen. Safe to run against a database that already has it.
 *
 *   pnpm tsx --conditions=react-server --env-file=.env.local scripts/seed-demo.ts
 */

const PUBLIC_TOKEN = "seeddemo8de10ab";
const ORGANIZER_TOKEN = "seeddemo8de10organizer0000000000";

/**
 * Names with and without a surname on purpose: the avatar falls back to
 * initials, and one letter has to look deliberate beside two.
 */
const ROSTER: {
  name: string;
  attendance: "in";
  payment: "pending" | "confirmed" | "waived";
  /** What they said they are bringing, if anything. */
  note?: string;
  reaction?: string;
}[] = [
  { name: "Andrés Mejía", attendance: "in", payment: "confirmed", note: "Yo llevo el balón", reaction: "⚽" },
  { name: "Caro", attendance: "in", payment: "confirmed", note: "Llevo hielo y vasos" },
  { name: "Juan Pablo Restrepo", attendance: "in", payment: "pending", reaction: "🔥" },
  { name: "Manu", attendance: "in", payment: "pending" },
  { name: "Sara Villegas", attendance: "in", payment: "confirmed", note: "Yo pongo la música", reaction: "🥁" },
  { name: "El Flaco", attendance: "in", payment: "pending", note: "Llego 15 min tarde, arranquen sin mí" },
  { name: "Diana Ospina", attendance: "in", payment: "waived", reaction: "🎉" },
  { name: "Nico", attendance: "in", payment: "pending", note: "Allí estaré", reaction: "🏃" },
];

/** Whoever owns the other seeded events, so this one lands in the same account. */
function organizerFromEnv(): string | null {
  try {
    const env = readFileSync(".env.local", "utf8");
    return /^SEED_ORGANIZER_ID=(.+)$/m.exec(env)?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const owner =
    organizerFromEnv() ??
    (await db.select({ id: events.organizerId }).from(events).limit(1))[0]?.id;

  if (!owner) throw new Error("No organizer to attach the demo event to.");

  const [type] = await db
    .select({ id: eventTypes.id })
    .from(eventTypes)
    .where(eq(eventTypes.slug, "match"))
    .limit(1);

  if (!type) throw new Error("No 'match' event type — run pnpm db:migrate first.");

  const [existing] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.publicToken, PUBLIC_TOKEN))
    .limit(1);

  const eventId = existing?.id ?? uuidv7();

  const fields = {
    title: "Fútbol de los viernes",
    eventTypeId: type.id,
    // A week out, so it never drifts into the past and starts rendering as
    // a finished event.
    startsAt: new Date(Date.now() + 7 * 86_400_000),
    location: "Cancha La 90, Medellín",
    capacity: 10,
    notes: "[siembra] ocho de diez — la lista larga para probar las pantallas",
    costMode: "per_person" as const,
    costAmountMinor: 20_000,
    currency: "COP",
    organizerId: owner,
  };

  if (existing) {
    // Everything but the owner: if somebody moved this fixture to their own
    // account to work on it, a re-run should not take it back.
    const { organizerId, ...mutable } = fields;
    void organizerId;
    await db.update(events).set(mutable).where(eq(events.id, eventId));

    // Rebuild rather than merge: this is a fixture, and a fixture that
    // accumulates is not a fixture. Payments go with them (cascade).
    const old = await db
      .select({ id: participants.id })
      .from(participants)
      .where(eq(participants.eventId, eventId));

    if (old.length > 0) {
      const ids = old.map((row) => row.id);
      await db.delete(eventNotes).where(inArray(eventNotes.participantId, ids));
      await db.delete(payments).where(inArray(payments.participantId, ids));
      await db.delete(participants).where(inArray(participants.id, ids));
    }
  } else {
    await db.insert(events).values({
      id: eventId,
      publicToken: PUBLIC_TOKEN,
      organizerToken: ORGANIZER_TOKEN,
      ...fields,
    });
  }

  const rows = ROSTER.map((person, index) => ({
    id: uuidv7(),
    eventId,
    displayName: person.name,
    attendance: person.attendance,
    userId: uuidv7(),
    // Spread the join times so the rounding remainder has an order to follow.
    createdAt: new Date(Date.now() - (ROSTER.length - index) * 3_600_000),
    payment: person.payment,
    note: person.note,
    reaction: person.reaction,
  }));

  await db.insert(participants).values(
    rows.map((row) => ({
      id: row.id,
      eventId: row.eventId,
      displayName: row.displayName,
      attendance: row.attendance,
      userId: row.userId,
      createdAt: row.createdAt,
    })),
  );

  await db.insert(payments).values(
    rows.map((row) => ({
      id: uuidv7(),
      participantId: row.id,
      amountMinor: fields.costAmountMinor,
      status: row.payment,
      confirmedAt: row.payment === "confirmed" ? new Date() : null,
    })),
  );

  /*
    Notes on some rows and not others, with one of each shape: note only,
    reaction only, both, and neither. A feed where every row looks the same is
    a feed that was never really looked at.
  */
  const spoken = rows.filter((row) => row.note || row.reaction);

  if (spoken.length > 0) {
    await db.insert(eventNotes).values(
      spoken.map((row) => ({
        id: uuidv7(),
        eventId,
        participantId: row.id,
        note: row.note ?? null,
        reaction: row.reaction ?? null,
        createdAt: row.createdAt,
      })),
    );
  }

  const paid = ROSTER.filter((p) => p.payment === "confirmed").length;

  console.log(`${existing ? "Actualizado" : "Creado"}: ${fields.title}`);
  console.log(
    `  ${ROSTER.length} de ${fields.capacity} cupos · ${paid} pagaron · ${spoken.length} dijeron qué llevan`,
  );
  console.log(`  invitados:   /e/${PUBLIC_TOKEN}`);
  console.log(`  organizador: /e/${PUBLIC_TOKEN}/manage/${ORGANIZER_TOKEN}`);

  process.exit(0);
}

main().catch((error) => {
  console.error("Falló:", error instanceof Error ? error.message : error);
  process.exit(1);
});
