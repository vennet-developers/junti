/**
 * The owner panel's directory: which list, which page, which words.
 *
 * Pure interpretation of URL parameters, split from the queries for the same
 * reason `panel-range.ts` is: the parameters come from a URL, URLs get
 * mangled, and every wrong reading here silently shows the owner the wrong
 * slice of their own data. Mangled input degrades to the first page of the
 * default list, never to an error.
 */

export type DirectoryKind = "usuarios" | "eventos" | "grupos";

/** Event-only state filter. `todos` is the absence of one. */
export type EventFilter = "todos" | "con_costo" | "gratis" | "cancelados";

/**
 * Twenty rows a page. The reason the directory exists paginated at all: the
 * ask was explicitly "no saturar la carga de elementos en el DOM", and a
 * page the owner reads beats a thousand rows the browser chokes on.
 */
export const DIRECTORY_PAGE_SIZE = 20;

export interface DirectoryQuery {
  kind: DirectoryKind;
  /** The search text, trimmed. Empty means no search. */
  q: string;
  /** 1-based. */
  page: number;
  filter: EventFilter;
}

const KINDS: readonly DirectoryKind[] = ["usuarios", "eventos", "grupos"];
const FILTERS: readonly EventFilter[] = ["todos", "con_costo", "gratis", "cancelados"];

export function parseDirectoryParams(input: {
  tipo?: string;
  q?: string;
  pagina?: string;
  estado?: string;
}): DirectoryQuery {
  const kind = KINDS.includes(input.tipo as DirectoryKind)
    ? (input.tipo as DirectoryKind)
    : "usuarios";

  const parsedPage = Number(input.pagina);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  const filter =
    kind === "eventos" && FILTERS.includes(input.estado as EventFilter)
      ? (input.estado as EventFilter)
      : "todos";

  return {
    kind,
    q: (input.q ?? "").trim().slice(0, 80),
    page,
    filter,
  };
}

/**
 * A search term made safe for ILIKE.
 *
 * `%` and `_` are wildcards to LIKE, so somebody searching for a literal
 * underscore would otherwise match everything. Escaped rather than stripped:
 * the search should FIND "50%_descuento", not pretend it cannot be typed.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / DIRECTORY_PAGE_SIZE));
}
