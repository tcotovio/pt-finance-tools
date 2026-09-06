// The calendar, which is the half of this tool that needs no network.

import { describe, expect, it } from "vitest";
import { compareEditions, expectedLatest, statusFor, type Schedule } from "./schedule.js";

const EURIBOR: Schedule = { kind: "periodic", unit: "month", lagDays: 5 };
const WAGE: Schedule = { kind: "periodic", unit: "quarter", lagDays: 45 };
const TAX: Schedule = { kind: "annual", nextEditionFrom: "12-15" };
const LAW: Schedule = { kind: "on-change", reviewEveryDays: 180 };

describe("expectedLatest — monthly", () => {
  it("waits out the publication lag before expecting a month", () => {
    // The ECB posts August's average in the first days of September, so on the
    // 3rd we still expect July and on the 6th we expect August.
    expect(expectedLatest(EURIBOR, "2026-09-03")).toBe("2026-07");
    expect(expectedLatest(EURIBOR, "2026-09-06")).toBe("2026-08");
  });

  it("crosses the new year without arithmetic trouble", () => {
    expect(expectedLatest(EURIBOR, "2027-01-08")).toBe("2026-12");
  });
});

describe("expectedLatest — quarterly", () => {
  it("expects a quarter only once its release window has passed", () => {
    // INE published Q2 2026 on 14 August; 45 days after 30 June is the 14th.
    expect(expectedLatest(WAGE, "2026-08-10")).toBe("2026-Q1");
    expect(expectedLatest(WAGE, "2026-08-20")).toBe("2026-Q2");
    expect(expectedLatest(WAGE, "2026-11-01")).toBe("2026-Q2");
    expect(expectedLatest(WAGE, "2026-11-20")).toBe("2026-Q3");
  });
});

describe("expectedLatest — annual", () => {
  it("expects next year's tables from the middle of December", () => {
    // The point of the window: the despacho appears while there is still time
    // to transcribe it before it takes effect on 1 January.
    expect(expectedLatest(TAX, "2026-09-06")).toBe("2026");
    expect(expectedLatest(TAX, "2026-12-14")).toBe("2026");
    expect(expectedLatest(TAX, "2026-12-15")).toBe("2027");
    expect(expectedLatest(TAX, "2027-01-02")).toBe("2027");
  });
});

describe("expectedLatest — on-change", () => {
  it("has no calendar at all, and says so", () => {
    expect(expectedLatest(LAW, "2026-09-06")).toBeNull();
  });
});

describe("statusFor", () => {
  it("is current while we ship the newest edition", () => {
    expect(statusFor(EURIBOR, "2026-08", "2026-09-06", "2026-08-19")).toBe("current");
  });

  it("is due one edition behind, overdue two", () => {
    expect(statusFor(EURIBOR, "2026-07", "2026-09-06", "2026-08-19")).toBe("due");
    expect(statusFor(EURIBOR, "2026-06", "2026-09-06", "2026-08-19")).toBe("overdue");
  });

  it("treats the December window as a prompt, not a defect", () => {
    // 2026's tables are still the law on 20 December 2026, even though 2027's
    // despacho should be out by then.
    expect(statusFor(TAX, "2026", "2026-12-20", "2026-08-18")).toBe("due");
  });

  it("treats last year's tables in the new year as a defect", () => {
    // This is the January failure the whole tool exists for: the app would
    // otherwise serve 2026's tables through 2027 behind a verified badge.
    expect(statusFor(TAX, "2026", "2027-01-02", "2026-08-18")).toBe("overdue");
  });

  it("nags about a law nobody has looked at within its review interval", () => {
    expect(statusFor(LAW, "2024", "2026-09-06", "2026-08-18")).toBe("current");
    expect(statusFor(LAW, "2024", "2026-09-06", "2026-01-18")).toBe("review-due");
  });

  it("does not nag about a periodic source merely because nobody looked", () => {
    // The calendar is a stronger signal than anyone's memory of having looked,
    // so a fresh edition stays "current" however long ago it was fetched.
    expect(statusFor(EURIBOR, "2026-08", "2026-09-06", "2024-01-01")).toBe("current");
  });
});

describe("compareEditions", () => {
  it("grades a probe's answer on the same scale as the calendar's", () => {
    // A probe that finds two editions ahead is not softened to "due" just
    // because the calendar only expected one.
    expect(compareEditions(EURIBOR, "2026-06", "2026-08", "2026-09-06")).toBe("overdue");
    expect(compareEditions(EURIBOR, "2026-08", "2026-08", "2026-09-06")).toBe("current");
  });

  it("treats an edition ahead of expectations as current", () => {
    // A dataset transcribed the day the despacho landed is ahead of the
    // calendar, and that is not a problem to report.
    expect(compareEditions(TAX, "2027", "2026", "2026-12-20")).toBe("current");
  });
});
