import { Link as RouterLink } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";

/**
 * The untyped link, for targets that arrive as data.
 *
 * Born as a migration shim (next/link's `href` shape on TanStack's engine)
 * and kept, deliberately smaller, at the end of it: every link to a STATIC
 * route now uses the router's typed `<Link to>`, and what remains behind
 * this door is the handful of places where the destination is a string the
 * code computed or was handed — breadcrumb items, an event card's
 * precomputed path, a sign-in URL carrying a query string. The type system
 * cannot check those against the route tree no matter where the cast lives;
 * keeping the one `as never` HERE, named and documented, beats scattering it
 * across six call sites where each looks like an accident.
 */
export function Link({
  href,
  children,
  ...props
}: { href: string; children?: ReactNode } & Omit<
  ComponentProps<typeof RouterLink>,
  "to" | "children"
>) {
  return (
    // `as never` is the untyped-string escape hatch this file exists for.
    <RouterLink to={href as never} {...props}>
      {children}
    </RouterLink>
  );
}
