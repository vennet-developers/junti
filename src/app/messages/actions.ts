"use server";

import { revalidatePath } from "next/cache";

import { getViewerCopy } from "@/lib/locale";
import { getOrganizer } from "@/lib/organizer";
import { loadStoredPreferences, saveStoredPreferences } from "@/lib/preferences";
import { SHARE_MESSAGE_MAX_LENGTH, shareMessageProblem } from "@/lib/share-message";

export interface MessagesState {
  errors: { message?: string; _form?: string };
  ok?: boolean;
}

/**
 * Stores the organizer's invitation, or clears it back to the app's.
 *
 * `null` is the reset: the column holds "this person wrote their own", and the
 * absence of a row is what makes the default apply. So restoring the default
 * deletes rather than copies the default in — otherwise an organizer who reset
 * would be frozen on today's wording while everybody else's improved with the
 * app.
 */
export async function saveShareMessage(
  _previous: MessagesState,
  formData: FormData,
): Promise<MessagesState> {
  const { copy } = await getViewerCopy();

  const organizer = await getOrganizer();
  if (!organizer) return { errors: { _form: copy.errors.signInRequired } };

  const raw = formData.get("message");
  const template = typeof raw === "string" ? raw.trim() : "";

  // An empty field is the reset, and reaches here as its own intent rather
  // than as a validation failure.
  if (formData.get("reset") === "1") {
    const stored = await loadStoredPreferences(organizer.id);
    await saveStoredPreferences(organizer.id, { ...stored, shareMessage: null });
    revalidatePath("/", "layout");
    return { errors: {}, ok: true };
  }

  const problem = shareMessageProblem(template);
  if (problem) {
    return {
      errors: {
        message:
          problem === "empty"
            ? copy.messages.errorEmpty
            : problem === "missing-link"
              ? copy.messages.errorMissingLink
              : copy.messages.errorTooLong(SHARE_MESSAGE_MAX_LENGTH),
      },
    };
  }

  // Read-then-write, so saving a message cannot clear the language, timezone
  // or appearance that live in the same row.
  const stored = await loadStoredPreferences(organizer.id);
  await saveStoredPreferences(organizer.id, { ...stored, shareMessage: template });

  // The share links are built on the server for every card in the list and on
  // the manage screen, so they all have to be rebuilt.
  revalidatePath("/", "layout");

  return { errors: {}, ok: true };
}
