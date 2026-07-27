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
    <Accordion type="single" collapsible defaultValue={defaultOpen ? id : undefined}>
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
