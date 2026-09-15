import { describe, expect, it } from "vitest";

import {
  DEFAULT_EASE,
  MAX_EASE,
  MIN_EASE,
  createQuestionState,
  estimateReadingMs,
  gradeAnswer,
  jitterFactor,
  resetOnMaterialChange,
  schedule,
} from "./scheduler";
import { MS_PER_DAY } from "@/lib/progress/day";
import type { QuestionState } from "@/lib/progress/types";

const NOW = Date.UTC(2026, 0, 15, 10, 0, 0);

function stateOf(overrides: Partial<QuestionState> = {}): QuestionState {
  return {
    ...createQuestionState({
      questionId: "idm-03-relace-tranzitivita",
      setId: "idm-03",
      course: "idm",
      materialHash: "hash-a",
      now: NOW,
    }),
    ...overrides,
  };
}

describe("gradeAnswer", () => {
  it("mapuje výsledky na známky SM-2", () => {
    const base = { durationMs: 5_000, usedHint: false, promptLength: 120 };
    expect(gradeAnswer({ ...base, outcome: "skipped" })).toBe(0);
    expect(gradeAnswer({ ...base, outcome: "incorrect" })).toBe(1);
    expect(gradeAnswer({ ...base, outcome: "partial" })).toBe(2);
  });

  it("částečná odpověď je pod prahem úspěchu", () => {
    const grade = gradeAnswer({
      outcome: "partial",
      durationMs: 1_000,
      usedHint: false,
    });
    const next = schedule(stateOf({ streak: 3, intervalDays: 20 }), grade, NOW);
    expect(next.intervalDays).toBe(0);
    expect(next.streak).toBe(0);
  });

  it("odměňuje rychlost a trestá pomalost", () => {
    const input = { outcome: "correct" as const, usedHint: false, promptLength: 200 };
    const estimate = estimateReadingMs({ promptLength: 200 });

    expect(gradeAnswer({ ...input, durationMs: estimate / 2 })).toBe(5);
    expect(gradeAnswer({ ...input, durationMs: estimate * 1.5 })).toBe(4);
    expect(gradeAnswer({ ...input, durationMs: estimate * 5 })).toBe(3);
  });

  it("nápověda srazí známku o jednu, ale ne pod práh úspěchu", () => {
    const estimate = estimateReadingMs({ promptLength: 200 });
    const fast = { outcome: "correct" as const, promptLength: 200, durationMs: estimate / 2 };
    const slow = { outcome: "correct" as const, promptLength: 200, durationMs: estimate * 5 };

    expect(gradeAnswer({ ...fast, usedHint: true })).toBe(4);
    expect(gradeAnswer({ ...slow, usedHint: true })).toBe(3);
  });

  it("delší zadání a vyšší obtížnost zvedají odhad doby čtení", () => {
    expect(estimateReadingMs({ promptLength: 800 })).toBeGreaterThan(
      estimateReadingMs({ promptLength: 100 }),
    );
    expect(estimateReadingMs({ promptLength: 400, difficulty: 5 })).toBeGreaterThan(
      estimateReadingMs({ promptLength: 400, difficulty: 1 }),
    );
    expect(estimateReadingMs({ promptLength: 100, questionType: "matching" })).toBeGreaterThan(
      estimateReadingMs({ promptLength: 100, questionType: "trueFalse" }),
    );
  });
});

describe("schedule", () => {
  it("špatná odpověď shodí interval na nulu a otázka se vrátí hned", () => {
    const state = stateOf({ streak: 4, intervalDays: 30, lapses: 1, dueAt: NOW + 30 * MS_PER_DAY });
    const next = schedule(state, 1, NOW);

    expect(next.intervalDays).toBe(0);
    expect(next.streak).toBe(0);
    expect(next.lapses).toBe(2);
    expect(next.dueAt).toBe(NOW);
    expect(next.ease).toBeLessThan(state.ease);
  });

  it("tři správné odpovědi po sobě interval prodlužují", () => {
    const first = schedule(stateOf(), 4, NOW);
    const second = schedule(first, 4, NOW);
    const third = schedule(second, 4, NOW);

    expect(first.intervalDays).toBe(1);
    expect(second.intervalDays).toBe(6);
    expect(third.intervalDays).toBeGreaterThan(second.intervalDays);
    expect(first.streak).toBe(1);
    expect(third.streak).toBe(3);
    expect(third.lapses).toBe(0);
  });

  it("dueAt odpovídá intervalu s rozptylem do ±10 %", () => {
    const next = schedule(stateOf({ streak: 2, intervalDays: 6 }), 4, NOW);
    const offsetDays = (next.dueAt - NOW) / MS_PER_DAY;

    expect(offsetDays).toBeGreaterThanOrEqual(next.intervalDays * 0.9);
    expect(offsetDays).toBeLessThanOrEqual(next.intervalDays * 1.1);
  });

  it("ease se drží v mezích 1.3 až 3.0", () => {
    let hard = stateOf();
    for (let i = 0; i < 20; i += 1) hard = schedule(hard, 0, NOW);
    expect(hard.ease).toBe(MIN_EASE);

    let easy = stateOf();
    for (let i = 0; i < 20; i += 1) easy = schedule(easy, 5, NOW);
    expect(easy.ease).toBe(MAX_EASE);
    expect(easy.ease).toBeLessThanOrEqual(MAX_EASE);
  });

  it("rozptyl je deterministický – stejný stav dá vždy stejný termín", () => {
    const state = stateOf({ streak: 2, intervalDays: 6 });
    expect(schedule(state, 4, NOW).dueAt).toBe(schedule(state, 4, NOW).dueAt);
    expect(jitterFactor("idm-03-relace", 2)).toBe(jitterFactor("idm-03-relace", 2));
  });

  it("různé otázky dostanou různý rozptyl, ať nespadnou na jeden den", () => {
    const factors = new Set(
      ["a-jedna", "b-dva", "c-tri", "d-ctyri", "e-pet", "f-sest"].map((id) => jitterFactor(id, 1)),
    );
    expect(factors.size).toBeGreaterThan(1);
    for (const f of factors) {
      expect(f).toBeGreaterThanOrEqual(0.9);
      expect(f).toBeLessThanOrEqual(1.1);
    }
  });
});

describe("resetOnMaterialChange", () => {
  it("při změně materiálu zachová lapses i attempts", () => {
    const state = stateOf({
      streak: 5,
      intervalDays: 40,
      ease: 2.9,
      attempts: 12,
      correct: 9,
      lapses: 3,
      materialHash: "hash-a",
    });

    const reset = resetOnMaterialChange(state, "hash-b", NOW);

    expect(reset.lapses).toBe(3);
    expect(reset.attempts).toBe(12);
    expect(reset.correct).toBe(9);
    expect(reset.streak).toBe(0);
    expect(reset.intervalDays).toBe(0);
    expect(reset.ease).toBe(DEFAULT_EASE);
    expect(reset.materialHash).toBe("hash-b");
    expect(reset.dueAt).toBe(NOW);
  });

  it("stejný hash stav nemění", () => {
    const state = stateOf({ streak: 5, intervalDays: 40, materialHash: "hash-a" });
    expect(resetOnMaterialChange(state, "hash-a", NOW)).toBe(state);
  });
});
