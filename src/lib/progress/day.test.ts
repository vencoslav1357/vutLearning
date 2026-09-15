import { describe, expect, it } from "vitest";

import { addDays, dayDiff, enumerateDays, isNextDay, isValidDayKey, startOfDay, toDayKey, todayKey } from "./day";

describe("klíče dnů", () => {
  it("používá lokální čas, ne UTC", () => {
    // 31. 12. 2025 ve 23:30 lokálně je pořád 31. 12., i když v UTC už může být leden.
    const silvestr = new Date(2025, 11, 31, 23, 30, 0);
    expect(toDayKey(silvestr)).toBe("2025-12-31");

    const rano = new Date(2026, 0, 1, 0, 15, 0);
    expect(toDayKey(rano)).toBe("2026-01-01");
  });

  it("doplňuje nuly", () => {
    expect(toDayKey(new Date(2026, 1, 3, 12, 0, 0))).toBe("2026-02-03");
  });

  it("dnešek odpovídá aktuálnímu datu", () => {
    const now = new Date();
    expect(todayKey()).toBe(toDayKey(now));
  });

  it("začátek dne je lokální půlnoc", () => {
    const at = new Date(2026, 4, 10, 17, 45, 12).getTime();
    const start = new Date(startOfDay(at));
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(toDayKey(start)).toBe("2026-05-10");
  });
});

describe("posuny a rozdíly", () => {
  it("posouvá přes konec měsíce i roku", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("přežije přechod na letní čas", () => {
    // V ČR se mění čas v noci na poslední březnovou neděli.
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(dayDiff("2026-03-30", "2026-03-28")).toBe(2);
    expect(dayDiff("2026-10-26", "2026-10-24")).toBe(2);
  });

  it("počítá rozdíl se znaménkem", () => {
    expect(dayDiff("2026-01-10", "2026-01-01")).toBe(9);
    expect(dayDiff("2026-01-01", "2026-01-10")).toBe(-9);
    expect(dayDiff("2026-01-01", "2026-01-01")).toBe(0);
    expect(isNextDay("2026-01-01", "2026-01-02")).toBe(true);
    expect(isNextDay("2026-01-01", "2026-01-03")).toBe(false);
  });

  it("vyjmenuje souvislou řadu dnů", () => {
    expect(enumerateDays("2026-01-30", "2026-02-02")).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
    ]);
    expect(enumerateDays("2026-02-02", "2026-01-30")).toEqual([]);
  });

  it("pozná neplatný klíč", () => {
    expect(isValidDayKey("2026-01-15")).toBe(true);
    expect(isValidDayKey("2026-02-30")).toBe(false);
    expect(isValidDayKey("15. 1. 2026")).toBe(false);
  });
});
