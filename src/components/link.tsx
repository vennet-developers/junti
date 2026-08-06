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
 *
 * `search` is re-declared for the same reason. The router infers its shape
 * from `to`, and `to` is `never` here, so every key on it is a type error at
 * the call site — which would push a second cast out to whoever needed a query
 * string. Declaring it as a plain record keeps the escape hatch in one file.
 */
export function Link({
  href,
  search,
  children,
  ...props
}: {
  href: string;
  search?: Record<string, string | undefined>;
  children?: ReactNode;
} & Omit<ComponentProps<typeof RouterLink>, "to" | "search" | "children">) {
  return (
    // `as never` twice, for the two things the route tree cannot check.
    <RouterLink to={href as never} search={search as never} {...props}>
      {children}
    </RouterLink>
  );
}
