"use client";

import type { KeyboardEvent } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@stackmyth/combobox";

import { useCopy } from "@/components/copy-provider";

export interface LanguageOption {
  value: string;
  label: string;
}

/**
 * One language picker, used by the account drawer and by `/profile`.
 *
 * **A combobox rather than a row of toggles.** Two languages fit in a
 * segmented control, the third does not, and the fourth wraps onto a second
 * line and takes the panel's rhythm with it. A list that filters and scrolls
 * costs the same at two options as at twenty, so the control is chosen for the
 * language list this app is going to have rather than the one it has today.
 *
 * **Each language names itself.** "English" is legible to somebody who cannot
 * read the Spanish beside it, which a translated "Inglés" would not be. It is
 * also what makes the filter useful: people type their language in their own.
 *
 * The two callers differ in what a choice means — the drawer writes it
 * immediately, the profile form holds it until save, and only the form offers
 * "follow my browser" — so they pass their own options and handler. What they
 * share, and the reason this is one component, is everything below.
 *
 * **The dropdown outlives its stacking context.** It portals to the document
 * and is lifted above the modal layer. Both halves are needed inside a dialog
 * and neither is a preference:
 *
 * - Portalling into the dialog's panel — which `container` exists for, and
 *   which this did first — breaks the position. The panel is animated with a
 *   `transform`, which makes it the containing block for `position: fixed`
 *   descendants, so the list is offset by the panel's own coordinates: at
 *   1280px the drawer sits at x=864 and the list rendered at x=1750, entirely
 *   off screen. It looked right only on a phone, where the panel starts at 0
 *   and the offset happens to be nothing.
 * - Left in the document at its own z-index, it renders *under* the dialog:
 *   the scale puts dropdowns at 1000 and dialog content at 1400.
 *
 * So it goes in the document and is raised, through the component's own
 * custom property rather than a hand-written `z-index`. Above a modal is the
 * `tooltip` step of the scale — the one defined as always visible above
 * modals. Outside a dialog the lift changes nothing: there is nothing between
 * 1000 and 1500 for it to jump over, and toasts stay above it where they
 * belong. Logged as STACKMYTH-GAP #19.
 */
export function LanguageCombobox({
  id,
  value,
  onValueChange,
  options,
  ariaLabel,
  disabled,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: LanguageOption[];
  ariaLabel: string;
  disabled?: boolean;
}) {
  const { copy } = useCopy();

  function choose(next: string | string[]) {
    // Single mode, so the array arm never arrives. Narrowing rather than
    // casting keeps that honest if `multiple` is ever switched on.
    const chosen = Array.isArray(next) ? next[0] : next;
    if (chosen) onValueChange(chosen);
  }

  /**
   * Escape closes the list, and only the list.
   *
   * The combobox handles Escape and calls `preventDefault`, but not
   * `stopPropagation`, and the dialog listens on `document` — so inside the
   * drawer one Escape closed the dropdown and the whole panel with it, and the
   * language you were half way through choosing went with it. Innermost layer
   * first is what every other dismissable thing here does.
   *
   * `aria-expanded` is the combobox's own record of whether the list is open,
   * and it still reads the pre-Escape state here: the component's handler runs
   * first in the same dispatch, but the attribute only changes when React
   * re-renders, which is after both handlers have returned.
   */
  function closeListOnly(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;

    const field = event.currentTarget.querySelector('input[role="combobox"]');
    if (field?.getAttribute("aria-expanded") === "true") event.stopPropagation();
  }

  return (
    // A wrapper for behaviour, not for looks: it carries no styles, and the
    // handler has to sit above the input to run after the component's own.
    <div onKeyDown={closeListOnly}>
      <Combobox value={value} onValueChange={choose} disabled={disabled} fullWidth>
        <ComboboxInput
          id={id}
          size="lg"
          fullWidth
          aria-label={ariaLabel}
          placeholder={copy.common.language}
        />
        <ComboboxContent>
          <ComboboxList>
            {options.map((option) => (
              <ComboboxItem key={option.value} value={option.value} label={option.label}>
                {option.label}
              </ComboboxItem>
            ))}
          </ComboboxList>
          <ComboboxEmpty>{copy.common.noMatches}</ComboboxEmpty>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
