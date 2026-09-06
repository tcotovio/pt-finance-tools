import { describe, expect, it } from "vitest";
import {
  addDays,
  addPeriods,
  daysBetween,
  monthOf,
  periodEnd,
  periodKind,
  periodOf,
  periodsBetween,
  quarterOf,
} from "./period.js";

describe("periodKind", () => {
  it("tells the three units apart", () => {
    expect(periodKind("2026-07")).toBe("month");
    expect(periodKind("2026-Q2")).toBe("quarter");
    expect(periodKind("2026")).toBe("year");
    expect(periodKind("2026-07-01")).toBeNull();
  });
});

describe("addPeriods", () => {
  it("steps months across a year boundary", () => {
    expect(addPeriods("2026-12", 1)).toBe("2027-01");
    expect(addPeriods("2026-01", -1)).toBe("2025-12");
  });

  it("steps quarters across a year boundary", () => {
    expect(addPeriods("2026-Q4", 1)).toBe("2027-Q1");
    expect(addPeriods("2026-Q1", -1)).toBe("2025-Q4");
  });

  it("steps years", () => {
    expect(addPeriods("2026", 1)).toBe("2027");
  });

  it("keeps the two-digit month padded, so labels still sort", () => {
    // "2026-9" would sort after "2026-10", which is the whole reason every
    // comparison in this package can be a string comparison.
    expect(addPeriods("2026-08", 1)).toBe("2026-09");
    expect(addPeriods("2026-09", 1) < addPeriods("2026-09", 2)).toBe(true);
  });
});

describe("periodEnd", () => {
  it("finds the last day of a month, February included", () => {
    expect(periodEnd("2026-01")).toBe("2026-01-31");
    expect(periodEnd("2026-02")).toBe("2026-02-28");
    expect(periodEnd("2028-02")).toBe("2028-02-29");
  });

  it("finds the last day of a quarter", () => {
    expect(periodEnd("2026-Q1")).toBe("2026-03-31");
    expect(periodEnd("2026-Q2")).toBe("2026-06-30");
    expect(periodEnd("2026-Q4")).toBe("2026-12-31");
  });

  it("finds the last day of a year", () => {
    expect(periodEnd("2026")).toBe("2026-12-31");
  });
});

describe("dates", () => {
  it("counts days across a month boundary", () => {
    expect(daysBetween("2026-08-31", "2026-09-06")).toBe(6);
    expect(daysBetween("2026-09-06", "2026-08-31")).toBe(-6);
  });

  it("shifts a date across a year boundary", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("rejects a date it cannot parse rather than producing NaN", () => {
    expect(() => daysBetween("06-09-2026", "2026-09-06")).toThrow(/ISO YYYY-MM-DD/);
  });
});

describe("period of a date", () => {
  it("maps a date onto each unit", () => {
    expect(monthOf("2026-09-06")).toBe("2026-09");
    expect(quarterOf("2026-09-06")).toBe("2026-Q3");
    expect(quarterOf("2026-01-01")).toBe("2026-Q1");
    expect(quarterOf("2026-12-31")).toBe("2026-Q4");
    expect(periodOf("year", "2026-09-06")).toBe("2026");
  });
});

describe("periodsBetween", () => {
  it("measures a gap in each unit", () => {
    expect(periodsBetween("2026-07", "2026-09")).toBe(2);
    expect(periodsBetween("2026-Q1", "2027-Q1")).toBe(4);
    expect(periodsBetween("2026", "2024")).toBe(-2);
  });

  it("refuses to compare different units", () => {
    expect(() => periodsBetween("2026-07", "2026")).toThrow(/Cannot measure/);
  });
});
