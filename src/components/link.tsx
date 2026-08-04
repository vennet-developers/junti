import { Link as RouterLink } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";

/**
 * `next/link`'s shape on TanStack Router's engine.
 *
 * Every converted component changes exactly one line — the import — instead
 * of rewriting seventeen call sites from `href` to `to`. That is worth more
 * than it looks during the migration: the diffs stay reviewable, and a file
 * can move between branches without its JSX changing shape.
 *
 * The deliberate cost is typed routes: `href` is a plain string, so the
 * router cannot verify at compile time that the target exists — during the
 * migration most targets DON'T exist yet, which is exactly why. When the last
 * route lands (phase 6), the honest end state is to run the codemod this shim
 * postponed: swap `href` for a typed `to` everywhere and delete this file.
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
