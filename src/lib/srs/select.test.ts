import { describe, expect, it } from "vitest";

import { SHARE_DUE, SHARE_FRESH, SHARE_WEAK, selectForTraining, selectMistakes } from "./select";
import { createQuestionState } from "./scheduler";
import type { QuestionState } from "@/lib/progress/types";

const NOW = Date.UTC(2026, 0, 15, 10, 0, 0);
const DAY = 86_400_000;

function stateOf(questionId: string, overrides: Partial<QuestionState> = {}): QuestionState {
  return {
    ...createQuestionState({
      questionId,
      setId: "idm-03",
      course: "idm",
      materialHash: "h",
      now: NOW,
    }),
    ...overrides,
  };
}

/** Otázka po splatnosti, `overdueDays` dní přetažená. */
function due(id: string, overdueDays: number): QuestionState {
  return stateOf(id, {
    attempts: 3,
    correct: 3,
    streak: 3,
    intervalDays: 10,
    lastOutcome: "correct",
    lastSeenAt: NOW - overdueDays * DAY,
    dueAt: NOW - overdueDays * DAY,
  });
}

function weak(id: string): QuestionState {
  return stateOf(id, {
    attempts: 5,
    correct: 1,
    lapses: 3,
    lastOutcome: "incorrect",
    lastSeenAt: NOW - DAY,
    dueAt: NOW + 5 * DAY,
  });
}

function mastered(id: string): QuestionState {
  return stateOf(id, {
    attempts: 5,
    correct: 5,
    streak: 5,
    intervalDays: 40,
    lastOutcome: "correct",
    dueAt: NOW + 30 * DAY,
  });
}

describe("selectForTraining", () => {
  const dueStates = Array.from({ length: 20 }, (_, i) => due(`due-${i}`, 20 - i));
  const weakStates = Array.from({ length: 10 }, (_, i) => weak(`weak-${i}`));
  const masteredStates = Array.from({ length: 10 }, (_, i) => mastered(`mastered-${i}`));
  const freshIds = Array.from({ length: 20 }, (_, i) => `fresh-${i}`);
  const states = [...dueStates, ...weakStates, ...masteredStates];
  const allQuestionIds = [...states.map((s) => s.questionId), ...freshIds];

  it("drží poměry mixu", () => {
    const size = 20;
    const picked = selectForTraining({ states, allQuestionIds, size, now: NOW, seed: "s" });

    expect(picked).toHaveLength(size);
    const count = (prefix: string) => picked.filter((id) => id.startsWith(prefix)).length;

    expect(count("due-")).toBe(Math.round(size * SHARE_DUE));
    expect(count("weak-")).toBe(Math.round(size * SHARE_WEAK));
    expect(count("fresh-")).toBe(Math.round(size * SHARE_FRESH));
    expect(count("mastered-")).toBe(1);
  });

  it("bere nejdřív nejpřetaženější otázky", () => {
    const picked = selectForTraining({
      states: dueStates,
      allQuestionIds: dueStates.map((s) => s.questionId),
      size: 3,
      now: NOW,
      seed: 1,
    });
    // due-0 je přetažená o 20 dní, due-1 o 19 …
    expect(new Set(picked)).toEqual(new Set(["due-0", "due-1", "due-2"]));
  });

  it("nikdy nevrátí duplicitu, ani když je otázka po splatnosti i slabina", () => {
    const overlapping = stateOf("obojí", {
      attempts: 6,
      correct: 1,
      lapses: 4,
      lastOutcome: "incorrect",
      dueAt: NOW - 3 * DAY,
    });
    const picked = selectForTraining({
      states: [overlapping, ...weakStates],
      allQuestionIds: ["obojí", ...weakStates.map((s) => s.questionId)],
      size: 10,
      now: NOW,
      seed: "x",
    });

    expect(new Set(picked).size).toBe(picked.length);
    expect(picked).toContain("obojí");
  });

  it("doplní z ostatních skupin, když některá nemá dost", () => {
    const picked = selectForTraining({
      states: [],
      allQuestionIds: freshIds,
      size: 12,
      now: NOW,
      seed: "y",
    });
    expect(picked).toHaveLength(12);
  });

  it("nevrátí víc, než kolik je otázek", () => {
    const picked = selectForTraining({
      states: [],
      allQuestionIds: ["a", "b", "c"],
      size: 20,
      now: NOW,
      seed: 3,
    });
    expect(picked).toHaveLength(3);
  });

  it("zvládne prázdný vstup", () => {
    expect(selectForTraining({ states: [], allQuestionIds: [], size: 10, now: NOW })).toEqual([]);
    expect(selectForTraining({ states, allQuestionIds, size: 0, now: NOW })).toEqual([]);
  });

  it("stejný seed dá stejné pořadí, jiný seed jiné", () => {
    const args = { states, allQuestionIds, size: 20, now: NOW };
    expect(selectForTraining({ ...args, seed: "a" })).toEqual(
      selectForTraining({ ...args, seed: "a" }),
    );
    expect(selectForTraining({ ...args, seed: "a" })).not.toEqual(
      selectForTraining({ ...args, seed: "b" }),
    );
  });

  it("nemíchá po blocích – skupiny jsou promíchané", () => {
    const picked = selectForTraining({ states, allQuestionIds, size: 20, now: NOW, seed: "mix" });
    const prefixes = picked.map((id) => id.split("-")[0]);
    const blocks = prefixes.filter((p, i) => p !== prefixes[i - 1]).length;
    // Kdyby se řadilo po blocích, byly by nejvýš čtyři úseky.
    expect(blocks).toBeGreaterThan(4);
  });

  it("respektuje předmět", () => {
    const other = stateOf("iel-1", { course: "iel", attempts: 3, dueAt: NOW - DAY });
    const picked = selectForTraining({
      states: [...dueStates, other],
      allQuestionIds: [...dueStates.map((s) => s.questionId), "iel-1"],
      size: 20,
      now: NOW,
      course: "idm",
      seed: "c",
    });
    // Cizí předmět se smí objevit nejvýš jako "nová" otázka, ne jako splatná.
    expect(picked.filter((id) => id === "iel-1")).toHaveLength(0);
  });
});

const ids = (states: QuestionState[]) => states.map((s) => s.questionId);

describe("selectMistakes", () => {
  it("řadí podle závažnosti a respektuje limit", () => {
    const states = [
      stateOf("m1", { attempts: 3, lapses: 1, lastOutcome: "incorrect", lastSeenAt: NOW - 100 }),
      stateOf("m2", { attempts: 3, lapses: 4, lastOutcome: "partial", lastSeenAt: NOW - 500 }),
      stateOf("m3", { attempts: 3, lapses: 1, lastOutcome: "skipped", lastSeenAt: NOW - 10 }),
      stateOf("ok", { attempts: 3, lapses: 9, lastOutcome: "correct", lastSeenAt: NOW }),
    ];

    expect(ids(selectMistakes({ states, limit: 10 }))).toEqual(["m2", "m3", "m1"]);
    expect(ids(selectMistakes({ states, limit: 1 }))).toEqual(["m2"]);
  });

  it("nevrací nikdy neviděné otázky ani nic při nulovém limitu", () => {
    const states = [stateOf("nova"), stateOf("m", { attempts: 1, lastOutcome: "incorrect" })];
    expect(ids(selectMistakes({ states, limit: 5 }))).toEqual(["m"]);
    expect(selectMistakes({ states, limit: 0 })).toEqual([]);
  });

  it("filtruje podle předmětu", () => {
    const states = [
      stateOf("a", { attempts: 1, lastOutcome: "incorrect", course: "idm" }),
      stateOf("b", { attempts: 1, lastOutcome: "incorrect", course: "izp" }),
    ];
    expect(ids(selectMistakes({ states, limit: 5, course: "izp" }))).toEqual(["b"]);
  });
});
