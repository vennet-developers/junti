import { Avatar, AvatarFallback, AvatarImage } from "@stackmyth/avatar";

import type { AvatarSize } from "@stackmyth/avatar";

import { avatarToneFor } from "@/lib/palette";

/**
 * A participant's photo.
 *
 * `Avatar` is a container, not an image — the picture and the fallback are
 * children — so this wraps the three-part composition once instead of repeating
 * it at every call site.
 *
 * The fallback matters more than it looks: a Google avatar URL is served by
 * Google and can start 404ing when someone changes their photo, and the URL
 * stored on the row is a copy taken at RSVP time. When that happens the initials
 * appear and the roster still reads correctly. `AvatarFallback` derives them
 * from the name since 0.25.4 — this file used to carry its own version, and so
 * did `attendee-stack.tsx`, and the two had drifted apart on how they handle a
 * name that starts outside the BMP.
 *
 * The colour is seeded from the name, so somebody without a photo is the same
 * colour here as in the stack on their event card, and a list of them reads as
 * people rather than as a column of identical grey discs.
 */
export function PersonAvatar({
  name,
  src,
  size = "sm",
}: {
  name: string;
  src: string | null;
  size?: AvatarSize;
}) {
  return (
    <Avatar size={size} tone={avatarToneFor(name)}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback name={name} />
    </Avatar>
  );
}

