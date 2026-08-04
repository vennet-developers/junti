import { Fragment } from "react";
import { Link } from "@/components/link";

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
                    asChild so the anchor is next/link's: a client-side
                    transition, and no <a> nested inside another. The class is
                    merged with the component's own rather than replacing it, so
                    the crumb keeps its link styling and gains the width cap.

                    `href` lives on the Link alone. It used to be repeated on
                    BreadcrumbLink as well, because the clone wrote its own
                    `undefined` over the child's value and the crumb rendered as
                    a dead anchor. Fixed at source in 0.24.3 — the child's href
                    wins when the component was not given one — so the
                    duplication is gone.
                  */
                  <BreadcrumbLink asChild>
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
