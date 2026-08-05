/**
 * The half-typed event, kept where the tab can be closed on it.
 *
 * AC-4 asks that a draft survive an accidental reload or tab close and be
 * recoverable **on the same device**, which is what `localStorage` literally
 * is. The card's guidance preferred a server-side draft row keyed on the
 * anonymous participant token — there is no anonymous token any more, and the
 * browser turned out to be the better answer for a reason the guidance did not
 * anticipate:
 *
 * **AC-7 becomes true by construction.** "Events are persisted as published
 * only at completion; abandoned drafts never appear in participant-facing
 * lists." If nothing is written server-side until submit, an abandoned draft
 * cannot appear anywhere because it does not exist. A drafts table would need
 * sweeping, excluding from every query that lists events, and remembering both
 * forever.
 *
 * No `server-only` import: this is browser-side by definition and is called
 * from a client component.
 */

const KEY = "junti:event-draft:v1";

/**
 * How long a draft is worth restoring.
 *
 * Long enough to survive a phone dying mid-form and being picked up after
 * lunch; short enough that the event you started planning three weeks ago does
 * not silently repopulate a form you opened for something else. Restoring
 * something stale is worse than restoring nothing: the fields look filled and
 * nobody re-reads a form that appears complete.
 */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface StoredDraft {
  at: number;
  values: Record<string, unknown>;
}

/** Saves, or quietly does nothing. Storage can be full, or disabled entirely. */
export function saveDraft(values: Record<string, unknown>): void {
  try {
    const payload: StoredDraft = { at: Date.now(), values };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Private browsing, a full quota, a locked-down device. A draft that
    // cannot be saved is a feature that did not happen, not an error worth
    // interrupting somebody mid-form to report.
  }
}

/**
 * The draft, if there is one worth restoring.
 *
 * Returns null rather than throwing on anything unexpected — a corrupted
 * value, a shape from an older version of the form, a key somebody else's
 * script wrote. The cost of being wrong here is a form that starts empty.
 */
export function loadDraft(): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed || typeof parsed.at !== "number" || typeof parsed.values !== "object") {
      return null;
    }

    if (Date.now() - parsed.at > MAX_AGE_MS) {
      clearDraft();
      return null;
    }

    return parsed.values;
  } catch {
    return null;
  }
}

/**
 * Called on a successful create, and only then.
 *
 * Not on abandonment: somebody who closes the tab is exactly who this exists
 * for. The age check is what eventually cleans up after them.
 */
export function clearDraft(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Same reasoning as `saveDraft`.
  }
}

/** Whether a set of values is worth calling a draft. */
export function isWorthRestoring(values: Record<string, unknown> | null): boolean {
  if (!values) return false;

  // A title alone is the signal. Every other field either has a default the
  // form supplies (timezone, currency, locale, the first event type) or is
  // genuinely optional, so their presence says nothing about whether somebody
  // typed anything — and offering to restore a form nobody filled is noise.
  return typeof values.title === "string" && values.title.trim().length > 0;
}

/**
 * The draft as an external store, for `useSyncExternalStore`.
 *
 * The same shape the timezone detection uses in this form, and for the same
 * reason: this is a value the server cannot know and the client can, so
 * reading it with `useState` + an effect means rendering once with the wrong
 * answer and then setting state — which is a cascading render and, in this
 * codebase, a lint error that is right.
 *
 * The snapshot has to be referentially stable or React re-renders forever, so
 * the parse happens once and is cached. `dismissDraft` is how a component
 * invalidates it after restoring or discarding.
 */
let snapshot: Record<string, unknown> | null | undefined;

export function subscribeDraft(): () => void {
  // Nothing to subscribe to: no other tab writes this key while a form is
  // open, and if one did, silently swapping what somebody is typing would be
  // worse than showing the older draft.
  return () => {};
}

export function getDraftSnapshot(): Record<string, unknown> | null {
  if (snapshot === undefined) {
    const loaded = loadDraft();
    snapshot = isWorthRestoring(loaded) ? loaded : null;
  }
  return snapshot;
}

/** The server has no storage, so it has no draft. */
export function getServerDraftSnapshot(): Record<string, unknown> | null {
  return null;
}

/** Stops the offer being made again, without touching what is stored. */
export function dismissDraft(): void {
  snapshot = null;
}
