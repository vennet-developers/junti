/**
 * The half-filled create form, parked across a sign-in.
 *
 * Signing in with Google is a full navigation to another origin and back, which
 * throws away anything typed. Since the pill that offers it sits on top of the
 * form, that would mean the feature meant to help you attribute an event
 * silently costs you the event you were describing.
 *
 * `sessionStorage`, not `localStorage`: a draft is worth exactly one tab and one
 * sitting. Leaving it on the device for weeks would mean someone opening the
 * form months later finds a stale half-event they have no memory of.
 *
 * Client only.
 */

const KEY = "junti:new-event-draft";

/** Values are whatever `@stackmyth/form`'s store holds — strings and numbers. */
export type EventDraft = Record<string, unknown>;

export function saveDraft(values: EventDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(values));
  } catch {
    // Private mode, or storage full. Losing the draft is bad; failing to
    // navigate to sign-in because of it would be worse.
  }
}

/** Reads and immediately removes it — a draft is restored once, then gone. */
export function takeDraft(): EventDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;

    sessionStorage.removeItem(KEY);

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    return parsed as EventDraft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to do; the next read will simply return a stale draft once.
  }
}
