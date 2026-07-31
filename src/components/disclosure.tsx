import type { ReactNode } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@stackmyth/accordion";
import { Box } from "@stackmyth/layout";

/**
 * A single collapsible section.
 *
 * The organizer panel was 5,200px — six phone screens — because the share
 * links and the whole edit form were always expanded. Both are things you need
 * occasionally, not every visit, so they collapse. The roster and the money,
 * which are why you opened the page, stay visible.
 *
 * **`variant="card"`, everywhere.** Every disclosure in the app comes through
 * here, so the choice is made once and cannot drift between screens. The card
 * treatment gives each section its own rounded surface that lifts when it
 * opens, which is what a collapsed section on this app's pages needs to be: the
 * default variant is a flat list separated by rules, and the organizer screen
 * already has rules — between the roster groups, under the money summary, in
 * every card — so a disclosure drawn the same way read as one more divider
 * rather than as something you could open.
 */
export function Disclosure({
  id,
  label,
  defaultOpen = false,
  children,
}: {
  /** Stable value for the accordion item. */
  id: string;
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <Accordion type="single" variant="card" collapsible defaultValue={defaultOpen ? id : undefined}>
      <AccordionItem value={id}>
        <AccordionTrigger>{label}</AccordionTrigger>
        <AccordionContent>
          {/* Breathing room between the trigger and the content. */}
          <Box pt="2">{children}</Box>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
