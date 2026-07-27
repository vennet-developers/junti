/**
 * Name of the cookie that lets a device amend its own RSVP.
 *
 * Lives outside the `"use server"` action module because a file carrying that
 * directive may only export async functions — every export becomes a callable
 * server action.
 *
 * Scoped per event so one phone can hold RSVPs for several events at once
 * without them overwriting each other. Keyed by event id rather than public
 * token to keep the cookie short.
 */
export function editCookieName(eventId: string): string {
  return `rsvp_${eventId}`;
}

/** One year — long enough that the same phone still recognises itself next season. */
export const EDIT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
