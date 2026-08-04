"use client";

import { useState } from "react";

import { Text } from "@stackmyth/text";

/**
 * A submitted receipt, shown where the decision is made.
 *
 * Both queues used to link the image out with `target="_blank"`: to judge one
 * receipt the organizer left the page, read it in another tab, came back and
 * approved from memory — once per row, with the remembered thing being an
 * amount. Clearing a dozen identical Thursday transfers is the whole job of
 * that screen, and it was a round trip each.
 *
 * **Thumbnail by default, readable on demand.** A receipt carries somebody's
 * full name, their bank and sometimes their phone, and putting twelve of those
 * on screen at a legible size is a different thing from putting one there. So
 * the default size is enough to recognise a receipt and match it to a row, and
 * reading it is a deliberate tap. The organizer gets their decision without
 * leaving the queue; a passer-by does not get a list of everyone's bank.
 *
 * A `<button>` wrapper rather than a click handler on the image, so the same
 * expansion works from the keyboard and announces itself.
 */
export function EvidenceImage({
  src,
  alt,
  expandLabel,
  goneLabel,
}: {
  src: string;
  /** Whose receipt this is — read out instead of the filename. */
  alt: string;
  expandLabel: string;
  /** Shown when the bytes are gone, in place of a broken image. */
  goneLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);

  /*
    Approved evidence is deleted the moment it is approved, and rejected
    evidence after ninety days, so a row can be listed while its bytes are
    already gone — most likely when the organizer has this queue open in two
    tabs. That is a fact about the submission, not a failure, and it should
    read like one instead of leaving a torn-page icon on the row.
  */
  if (failed) {
    return (
      <Text variant="small" color="muted">
        {goneLabel}
      </Text>
    );
  }

  return (
    <button
      type="button"
      className="evidence"
      aria-expanded={expanded}
      aria-label={expandLabel}
      onClick={() => setExpanded((current) => !current)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        /* These are phone photos of bank screenshots, often a megabyte or
           more, and a queue is skimmed as often as it is worked through.
           Nothing below the fold is fetched until it is scrolled to. */
        loading="lazy"
        decoding="async"
        className={expanded ? "evidence__img evidence__img--open" : "evidence__img"}
        onError={() => setFailed(true)}
      />
    </button>
  );
}
