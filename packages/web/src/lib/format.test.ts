import { describe, expect, it } from "vitest";
import {
  formatEuro,
  formatNegativeEuro,
  formatPercent,
  formatWholePercent,
  formatRate,
  parseAmount,
  splitOnUrls,
  todayIso,
} from "./format.js";

// Intl inserts a narrow no-break space as the group and currency separator;
// comparing on the digits alone keeps these assertions readable.
const digits = (value: string) => value.replace(/\s/g, " ");

describe("parseAmount", () => {
  it("reads plain numbers", () => {
    expect(parseAmount("1500")).toBe(1500);
    expect(parseAmount("0")).toBe(0);
  });

  it("reads the Portuguese decimal comma", () => {
    expect(parseAmount("1500,50")).toBe(1500.5);
    expect(parseAmount("10,46")).toBe(10.46);
  });

  it("reads a keyboard-typed decimal point", () => {
    expect(parseAmount("1500.50")).toBe(1500.5);
    expect(parseAmount("1.5")).toBe(1.5);
  });

  it("treats a lone dot before three digits as thousands grouping", () => {
    expect(parseAmount("1.500")).toBe(1500);
    expect(parseAmount("29.542")).toBe(29542);
  });

  it("handles both separators together, in either convention", () => {
    expect(parseAmount("1.500,75")).toBe(1500.75);
    expect(parseAmount("1,500.75")).toBe(1500.75);
    expect(parseAmount("29.542,15")).toBe(29542.15);
  });

  it("ignores spaces and the euro sign", () => {
    expect(parseAmount(" 1 500,00 € ")).toBe(1500);
  });

  it("returns null for anything that is not a number", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("3.5oo")).toBeNull();
    expect(parseAmount("-100")).toBeNull();
    expect(parseAmount(",")).toBeNull();
  });
});

describe("formatEuro", () => {
  it("always shows two decimals", () => {
    expect(digits(formatEuro(1500))).toBe("1500,00 €");
    expect(digits(formatEuro(1500.5))).toBe("1500,50 €");
  });

  it("groups thousands from five digits up, as pt-PT does", () => {
    expect(digits(formatEuro(29542.15))).toBe("29 542,15 €");
  });

  it("never renders a negative zero", () => {
    expect(digits(formatEuro(-0))).toBe("0,00 €");
  });
});

describe("formatNegativeEuro", () => {
  it("prefixes a real minus sign", () => {
    expect(digits(formatNegativeEuro(168.17))).toBe("−168,17 €");
  });

  it("writes a nil deduction plainly", () => {
    // "−0,00 €" reads as a bug on a payslip line.
    expect(digits(formatNegativeEuro(0))).toBe("0,00 €");
  });
});

describe("percentages", () => {
  it("shows one decimal for computed rates", () => {
    expect(digits(formatPercent(0.11211))).toBe("11,2%");
  });

  it("shows none for the schedule's round rates", () => {
    expect(digits(formatWholePercent(0.75))).toBe("75%");
    expect(digits(formatWholePercent(1))).toBe("100%");
  });
});

describe("todayIso", () => {
  it("formats the local date, not the UTC one", () => {
    // 23:30 local on the 31st is already the 1st in UTC; the dataset lookup
    // must follow the calendar the user is living in.
    const localLateEvening = new Date(2026, 11, 31, 23, 30);
    expect(todayIso(localLateEvening)).toBe("2026-12-31");
  });

  it("pads month and day", () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("splitOnUrls", () => {
  it("pulls the URL out of a provenance sentence", () => {
    expect(
      splitOnUrls("Despacho n.º 233-A/2026 — https://example.pt/a.pdf"),
    ).toEqual([
      { text: "Despacho n.º 233-A/2026 — ", isUrl: false },
      { text: "https://example.pt/a.pdf", isUrl: true },
    ]);
  });

  it("keeps text on both sides of the URL", () => {
    expect(splitOnUrls("ver https://example.pt/a.pdf (2026)")).toEqual([
      { text: "ver ", isUrl: false },
      { text: "https://example.pt/a.pdf", isUrl: true },
      { text: " (2026)", isUrl: false },
    ]);
  });

  it("stops the URL at a closing parenthesis", () => {
    const segments = splitOnUrls("fonte (https://example.pt/a.pdf) de 2026");
    expect(segments.find((s) => s.isUrl)?.text).toBe(
      "https://example.pt/a.pdf",
    );
  });

  it("handles text with no URL at all", () => {
    expect(splitOnUrls("sem fonte")).toEqual([
      { text: "sem fonte", isUrl: false },
    ]);
  });
});

describe("formatRate", () => {
  it("keeps a statutory rate exact", () => {
    // 23,8 % would misquote the Código Contributivo.
    expect(digits(formatRate(0.2375))).toBe("23,75%");
  });

  it("drops decimals a round rate does not need", () => {
    expect(digits(formatRate(0.11))).toBe("11%");
  });
});
