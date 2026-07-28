import "server-only";

import type { User } from "@supabase/supabase-js";

import { getCurrentUser } from "./supabase/server";

/**
 * The signed-in organizer, reduced to what the UI actually renders.
 *
 * Nothing about the person is stored in our database — no profile table, no
 * copied name or avatar. The session already carries it, and the history page
 * only ever shows the viewer their own events, so there is no case where we
 * need another user's details. One less thing to keep in sync, and one less
 * place holding personal data.
 */
export interface Organizer {
  id: string;
  email: string | null;
  /** Google's display name, else the local part of the email. */
  displayName: string;
  /** Google profile photo. Null for email sign-ins. */
  avatarUrl: string | null;
}

function readMetadata(user: User): { name: string | null; avatar: string | null } {
  const meta = user.user_metadata as Record<string, unknown> | null;
  const pick = (...keys: string[]): string | null => {
    for (const key of keys) {
      const value = meta?.[key];
      if (typeof value === "string" && value.trim().length > 0) return value;
    }
    return null;
  };

  return {
    // Google populates these; the exact key has varied across provider
    // versions, so take whichever is present.
    name: pick("full_name", "name", "user_name", "preferred_username"),
    avatar: pick("avatar_url", "picture"),
  };
}

export function toOrganizer(user: User): Organizer {
  const { name, avatar } = readMetadata(user);
  const email = user.email ?? null;

  return {
    id: user.id,
    email,
    // Both sign-in routes carry a verified email, so the second branch is what
    // actually runs for an email sign-in and the third is unreachable in
    // practice. It is a dash rather than a word so that no language is
    // hardcoded into a name.
    displayName: name ?? email?.split("@")[0] ?? "—",
    avatarUrl: avatar,
  };
}

/** The current organizer, or null when nobody is signed in. */
export async function getOrganizer(): Promise<Organizer | null> {
  const user = await getCurrentUser();
  return user ? toOrganizer(user) : null;
}
