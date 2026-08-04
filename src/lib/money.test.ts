import { describe, expect, it } from "vitest";

import {
  SUPPORTED_CURRENCIES,
  formatMoney,
  isSupportedCurrency,
  minorUnitExponent,
  toMajorUnits,
  toMinorUnits,
} from "./format";
import { toDecimalString } from "./validation";

/**
 * The edges of the money path: what somebody types, and what gets stored.
 *
 * The arithmetic in the middle (`src/domain/split.ts`) was always tested. These
 * two ends were not, and both bugs found in the August 2026 audit were here —
 * a hundred-fold misreading of a decimal amount, and a currency code nobody
 * checked. A wrong split is visible to whoever compares the numbers; a wrong
 * parse looks like a perfectly ordinary price.
 */

/** What the organizer typed, read as pesos: no decimals anywhere. */
describe("reading an amount in a zero-decimal currency", () => {
  const asPesos = (raw: string) => toDecimalString(raw, 0);

  it("accepts the separators a Colombian actually types", () => {
    expect(asPesos("50.000")).toBe("50000");
    expect(asPesos("50,000")).toBe("50000");
    expect(asPesos("50 000")).toBe("50000");
    expect(asPesos("50000")).toBe("50000");
  });

  it("reads a grouped million the same way however it is punctuated", () => {
    expect(asPesos("1.500.000")).toBe("1500000");
    expect(asPesos("1,500,000")).toBe("1500000");
  });
});

describe("reading an amount in a two-decimal currency", () => {
  const asDollars = (raw: string) => toDecimalString(raw, 2);

  /**
   * The regression. `"50.50"` used to have its dot stripped like a thousands
   * separator, yielding 5050, which `toMinorUnits` then multiplied by a hundred
   * — a bill for $5.050,00 instead of $50,50.
   */
  it("treats a trailing separator as the decimal point", () => {
    expect(asDollars("50.50")).toBe("50.50");
    expect(asDollars("50,50")).toBe("50.50");
    expect(asDollars("0.99")).toBe("0.99");
    expect(asDollars("7.5")).toBe("7.5");
  });

  it("reads both grouping conventions the same way", () => {
    expect(asDollars("1,234.56")).toBe("1234.56");
    expect(asDollars("1.234,56")).toBe("1234.56");
  });

  it("keeps three trailing digits as grouping, not as a fraction", () => {
    // "1.500" is fifteen hundred in every convention that writes it that way;
    // no currency here has three decimal places.
    expect(asDollars("1.500")).toBe("1500");
    expect(asDollars("1,500")).toBe("1500");
  });

  it("survives an amount with no separators at all", () => {
    expect(asDollars("50")).toBe("50");
  });
});

describe("the hundred-fold bug, end to end", () => {
  it("stores fifty dollars fifty as 5050 minor units, not 505000", () => {
    const stored = toMinorUnits(Number(toDecimalString("50.50", minorUnitExponent("USD"))), "USD");

    expect(stored).toBe(5050);
    expect(formatMoney(stored, "USD", "en-US")).toBe("$50.50");
  });

  it("still stores fifty thousand pesos as fifty thousand", () => {
    const stored = toMinorUnits(Number(toDecimalString("50.000", minorUnitExponent("COP"))), "COP");

    expect(stored).toBe(50_000);
  });
});

describe("minor and major units", () => {
  it("treats a peso as its own minor unit", () => {
    expect(minorUnitExponent("COP")).toBe(0);
    expect(toMinorUnits(50_000, "COP")).toBe(50_000);
    expect(toMajorUnits(50_000, "COP")).toBe(50_000);
  });

  it("splits a dollar into cents", () => {
    expect(minorUnitExponent("USD")).toBe(2);
    expect(toMinorUnits(50.5, "USD")).toBe(5050);
    expect(toMajorUnits(5050, "USD")).toBe(50.5);
  });

  it("round-trips every supported currency without drift", () => {
    for (const currency of SUPPORTED_CURRENCIES) {
      const stored = toMinorUnits(1234.56, currency);
      expect(Number.isInteger(stored)).toBe(true);
      expect(toMinorUnits(toMajorUnits(stored, currency), currency)).toBe(stored);
    }
  });

  it("is case-insensitive about the code", () => {
    expect(minorUnitExponent("cop")).toBe(0);
    expect(isSupportedCurrency("usd")).toBe(true);
  });
});

describe("the currency allowlist", () => {
  it("accepts what the app knows how to read", () => {
    expect(isSupportedCurrency("COP")).toBe(true);
    expect(isSupportedCurrency("USD")).toBe(true);
  });

  /**
   * The point of the list. An unvetted code used to be accepted and then parsed
   * as though it were pesos, so its decimals — whatever they are — were wrong
   * by construction.
   */
  it("rejects a code nobody has vetted", () => {
    expect(isSupportedCurrency("XYZ")).toBe(false);
    expect(isSupportedCurrency("BTC")).toBe(false);
  });

  it("knows the exponent of everything it allows", () => {
    // The guarantee the parser leans on: no supported currency has an exponent
    // that is merely the fallback guess.
    for (const currency of SUPPORTED_CURRENCIES) {
      expect([0, 2]).toContain(minorUnitExponent(currency));
    }
  });
});
