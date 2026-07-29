import { Fragment } from "react";
import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@stackmyth/breadcrumb";

/**
 * One step in the trail. Everything but the last one carries an `href`.
 */
export interface Crumb {
  label: string;
  /** Omitted on the current page, which is text rather than a link. */
  href?: string;
}

/**
 * Where you are, above the heading.
 *
 * This replaced the per-page "Back" link. A back link only ever answered "how
 * do I undo this navigation"; the trail answers "where am I, and what contains
 * this" — the question that actually matters on the deep screens, where an
 * evidence photo three levels inside an event gave no clue what it belonged to.
 *
 * The last crumb is the current page and is deliberately not a link:
 * `BreadcrumbPage` marks it `aria-current="page"`, so a screen reader announces
 * the position rather than offering a link to the screen you are already on.
 */
export function PageBreadcrumb({ label, items }: { label: string; items: Crumb[] }) {
  // A single crumb is not a trail — it would only restate the page's own <h1>.
  if (items.length < 2) return null;

  return (
    <Breadcrumb aria-label={label}>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            /*
              Item and separator are siblings, not parent and child: both
              render <li>, and the list is an <ol>. Nesting the separator
              inside the item would put an <li> inside an <li>.
            */
            <Fragment key={`${item.label}-${index}`}>
              <BreadcrumbItem>
                {isLast || !item.href ? (
                  <BreadcrumbPage className="breadcrumb-crumb">{item.label}</BreadcrumbPage>
                ) : (
                  /*
                    `href` is given to BreadcrumbLink as well as to the Link it
                    wraps, and both are load-bearing. Under `asChild` the
                    component clones its child with `href: <its own href>` — so
                    passing it only to the inner Link means the clone overwrites
                    it with `undefined` and the crumb renders as a dead anchor.
                    Handing it to both is the shape that survives the clone.

                    asChild at all so the anchor is next/link's: a client-side
                    transition, and no <a> nested inside another.
                  */
                  <BreadcrumbLink asChild href={item.href}>
                    {/* `asChild` merges this class with the component's own
                        rather than replacing it, so the crumb keeps its link
                        styling and gains the width cap. */}
                    <Link href={item.href} className="breadcrumb-crumb">
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>

              {isLast ? null : <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
