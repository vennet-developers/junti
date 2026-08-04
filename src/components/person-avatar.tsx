import { Avatar, AvatarFallback, AvatarImage } from "@stackmyth/avatar";

import type { AvatarSize } from "@stackmyth/avatar";

import { avatarPaletteClass } from "@/lib/palette";

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
 * appear and the roster still reads correctly.
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
    <Avatar size={size} className={avatarPaletteClass(name)}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

/**
 * Up to two initials from a display name.
 *
 * Uses `Array.from` rather than indexing, because a name beginning with an
 * emoji or an accented character outside the BMP would otherwise be cut in half
 * and render as a replacement glyph.
 */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  const letters = words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("");

  return letters.toLocaleUpperCase() || "?";
}
