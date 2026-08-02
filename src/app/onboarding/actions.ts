"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ROUTES } from "@/config/routes";
import { recordConsent } from "@/lib/consent";
import { clientIp } from "@/lib/rate-limit";
import { getViewerCopy } from "@/lib/locale";
import { saveProfile } from "@/lib/profile";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import { field, fieldErrors, makeProfileSchema } from "@/lib/validation";

export type OnboardingState = { errors: Record<string, string> };

/**
 * Completes a profile, then sends them where they were originally going.
 *
 * **Written to two places, on purpose.** The row is what an organizer can read
 * — a name on a roster, a number to reach somebody on — and the session's
 * metadata is what every existing screen already renders from, through
 * `toOrganizer`. Writing both means the header, the one-tap join button and the
 * roster all start showing the real name immediately, with no change to any of
 * them.
 *
 * The phone goes only to the row. It has one reader, the organizer of an event
 * you joined, and putting it in the session would additionally place it in a
 * token that travels to the browser on every request for no benefit at all.
 */
export async function completeProfile(
  next: string,
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await getCurrentUser();
  const { copy } = await getViewerCopy();

  if (!user) return { errors: { _form: copy.errors.signInRequired } };

  const parsed = makeProfileSchema(copy).safeParse({
    fullName: field(formData, "fullName"),
    phone: field(formData, "phone"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  /*
    A phone with no consent behind it is not stored at all.

    Not stored-and-flagged: the organizer's view reads the column, so a number
    sitting there with a "not allowed" bit somewhere else is one careless join
    away from being shown. Refusing to write it is the only version of this that
    cannot be got wrong later.

    The box is unchecked by default and the phone is optional, so the ordinary
    path — leave both alone — is also the private one.
  */
  const agreed = field(formData, "whatsappConsent") === "on";
  const phone = agreed ? parsed.data.phone : null;

  await saveProfile(user.id, { fullName: parsed.data.fullName, phone });

  /*
    Recorded whenever a number was actually offered, granted or not. A refusal
    is evidence too: it is what answers "did you ask, and what did they say"
    six months from now.
  */
  if (parsed.data.phone) {
    await recordConsent(user.id, {
      purpose: "organizer_whatsapp",
      channel: "whatsapp",
      granted: agreed,
      sourceIp: clientIp(await headers()),
    });
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.updateUser({ data: { full_name: parsed.data.fullName } });

  // Relative paths only, the same rule the sign-in page applies: `next` came
  // through a query string and is not to be trusted with an absolute URL.
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : ROUTES.myEvents;

  redirect(destination);
}
