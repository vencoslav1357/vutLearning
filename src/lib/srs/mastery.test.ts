import { describe, expect, it } from "vitest";

import {
  MATURE_INTERVAL_DAYS,
  deriveMastery,
  masteryClasses,
  masteryColor,
  masteryLabel,
  summarizeCourse,
} from "./mastery";
import { createQuestionState } from "./scheduler";
import { MASTERY_LEVELS, type QuestionState } from "@/lib/progress/types";

const NOW = Date.UTC(2026, 0, 15, 10, 0, 0);

function stateOf(overrides: Partial<QuestionState> = {}): QuestionState {
  return {
    ...createQuestionState({
      questionId: overrides.questionId ?? "izp-01-ukazatele",
      setId: "izp-01",
      course: "izp",
      materialHash: "h",
      now: NOW,
    }),
    ...overrides,
  };
}

describe("deriveMastery", () => {
  it("bez pokusu je otázka nová", () => {
    expect(deriveMastery(stateOf())).toBe("nova");
  });

  it("opakované zapomínání s čerstvou chybou je slabina", () => {
    const state = stateOf({ attempts: 6, correct: 4, lapses: 2, lastOutcome: "incorrect" });
    expect(deriveMastery(state)).toBe("slabina");
  });

  it("nízká úspěšnost při dost pokusech je taky slabina", () => {
    const state = stateOf({ attempts: 4, correct: 1, lapses: 0, lastOutcome: "correct", streak: 1 });
    expect(deriveMastery(state)).toBe("slabina");
  });

  it("dva pokusy s jednou chybou ještě slabina nejsou", () => {
    const state = stateOf({ attempts: 2, correct: 1, lapses: 1, lastOutcome: "correct", streak: 1 });
    expect(deriveMastery(state)).toBe("ucim-se");
  });

  it("slabina přebije i dlouhou sérii", () => {
    const state = stateOf({
      attempts: 10,
      correct: 3,
      lapses: 4,
      streak: 5,
      intervalDays: 30,
      lastOutcome: "correct",
    });
    expect(deriveMastery(state)).toBe("slabina");
  });

  it("krátká série je ucim-se, delší skoro", () => {
    expect(
      deriveMastery(stateOf({ attempts: 1, correct: 1, streak: 1, lastOutcome: "correct" })),
    ).toBe("ucim-se");
    expect(
      deriveMastery(
        stateOf({ attempts: 2, correct: 2, streak: 2, intervalDays: 6, lastOutcome: "correct" }),
      ),
    ).toBe("skoro");
  });

  it("zvládnutá je až od série 3 a zralého intervalu", () => {
    const almost = stateOf({
      attempts: 3,
      correct: 3,
      streak: 3,
      intervalDays: MATURE_INTERVAL_DAYS - 1,
      lastOutcome: "correct",
    });
    const mastered = { ...almost, intervalDays: MATURE_INTERVAL_DAYS };

    expect(deriveMastery(almost)).toBe("skoro");
    expect(deriveMastery(mastered)).toBe("zvladnuta");
  });

  it("série 2 se zralým intervalem ještě není zvládnutá", () => {
    const state = stateOf({
      attempts: 2,
      correct: 2,
      streak: 2,
      intervalDays: 40,
      lastOutcome: "correct",
    });
    expect(deriveMastery(state)).toBe("skoro");
  });
});

describe("summarizeCourse", () => {
  it("spočítá dlaždici předmětu", () => {
    const states = [
      stateOf({
        questionId: "a",
        attempts: 4,
        correct: 4,
        streak: 4,
        intervalDays: 30,
        lastOutcome: "correct",
        dueAt: NOW + 10_000,
      }),
      stateOf({
        questionId: "b",
        attempts: 5,
        correct: 1,
        lapses: 3,
        lastOutcome: "incorrect",
        dueAt: NOW - 1,
      }),
      stateOf({
        questionId: "c",
        attempts: 1,
        correct: 1,
        streak: 1,
        intervalDays: 1,
        lastOutcome: "correct",
        dueAt: NOW + 86_400_000,
      }),
    ];

    const summary = summarizeCourse(states, 10, { course: "izp", now: NOW });

    expect(summary).toMatchObject({
      course: "izp",
      total: 10,
      seen: 3,
      zvladnuta: 1,
      slabiny: 1,
      dueNow: 1,
    });
    expect(summary.progress).toBeCloseTo(0.1);
  });

  it("prázdný předmět dá nuly a nedělí nulou", () => {
    const summary = summarizeCourse([], 0, { course: "iel", now: NOW });
    expect(summary.progress).toBe(0);
    expect(summary.seen).toBe(0);
  });

  it("filtruje podle předmětu", () => {
    const states = [
      stateOf({ questionId: "a", course: "izp", attempts: 1, lastOutcome: "correct" }),
      stateOf({ questionId: "b", course: "idm", attempts: 1, lastOutcome: "correct" }),
    ];
    expect(summarizeCourse(states, 5, { course: "idm", now: NOW }).seen).toBe(1);
  });
});

describe("popisky", () => {
  it("každá úroveň má český popisek i barevný token", () => {
    for (const level of MASTERY_LEVELS) {
      expect(masteryLabel(level).length).toBeGreaterThan(0);
      expect(masteryColor(level)).toBeTypeOf("string");
      expect(masteryClasses(level)).toContain("text-");
    }
  });
});
