import { describe, expect, it } from "vitest";

import { escapeLike, pageCount, parseDirectoryParams } from "./directory";

/**
 * The directory's URL interpretation. Pinned because every wrong answer
 * silently shows the owner the wrong slice of their own data — and because
 * an unescaped LIKE wildcard is the classic way a search quietly matches
 * everything.
 */

describe("parsing", () => {
  it("defaults to page one of the users list", () => {
    expect(parseDirectoryParams({})).toEqual({
      kind: "usuarios",
      q: "",
      page: 1,
      filter: "todos",
    });
  });

  it("degrades garbage to the default, never to an error", () => {
    expect(parseDirectoryParams({ tipo: "drop table", pagina: "-3" }).kind).toBe("usuarios");
    expect(parseDirectoryParams({ pagina: "abc" }).page).toBe(1);
    expect(parseDirectoryParams({ pagina: "2.5" }).page).toBe(1);
  });

  /** The event filter belongs to events; on another list it silently resets. */
  it("only honours the state filter on the events list", () => {
    expect(parseDirectoryParams({ tipo: "eventos", estado: "cancelados" }).filter).toBe(
      "cancelados",
    );
    expect(parseDirectoryParams({ tipo: "usuarios", estado: "cancelados" }).filter).toBe("todos");
  });

  it("trims and caps the search text", () => {
    expect(parseDirectoryParams({ q: "  ana  " }).q).toBe("ana");
    expect(parseDirectoryParams({ q: "x".repeat(200) }).q).toHaveLength(80);
  });
});

describe("like escaping", () => {
  it("neutralises the wildcards instead of stripping them", () => {
    expect(escapeLike("50%_off")).toBe("50\\%\\_off");
    expect(escapeLike("plain")).toBe("plain");
  });
});

describe("page count", () => {
  it("rounds up, and an empty list still has one page", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(20)).toBe(1);
    expect(pageCount(21)).toBe(2);
  });
});
