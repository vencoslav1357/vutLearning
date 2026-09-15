/**
 * Testy běží v Node, kde IndexedDB není – store tedy spadne na paměťovou
 * variantu. To je záměr: ověřuje se tím rovnou i nouzový režim.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocalProgressStore } from "./local";
import { addDays, todayKey } from "./day";
import { DEFAULT_PREFS, type AttemptRecord } from "./types";

type Attempt = Omit<AttemptRecord, "id" | "synced">;

function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    questionId: "idm-03-relace",
    setId: "idm-03",
    course: "idm",
    at: Date.now(),
    outcome: "correct",
    score: 1,
    durationMs: 4_000,
    mode: "procvicovani",
    usedHint: false,
    materialHash: "hash-a",
    ...overrides,
  };
}

let store: LocalProgressStore;

beforeEach(() => {
  // Varování o chybějící IndexedDB je tady očekávané, ať nešpiní výstup.
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  store = new LocalProgressStore();
});

describe("nouzový režim", () => {
  it("bez IndexedDB jede v paměti a nespadne", async () => {
    expect(await store.storageKind()).toBe("memory");
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("recordAttempt", () => {
  it("založí stav a započítá správnou odpověď", async () => {
    const state = await store.recordAttempt(attempt());

    expect(state.attempts).toBe(1);
    expect(state.correct).toBe(1);
    expect(state.streak).toBe(1);
    expect(state.intervalDays).toBe(1);
    expect(state.mastery).toBe("ucim-se");
    expect(await store.getQuestionState("idm-03-relace")).toMatchObject({ attempts: 1 });
  });

  it("špatná odpověď vrátí otázku hned do hry a přidá lapse", async () => {
    const now = Date.now();
    await store.recordAttempt(attempt({ at: now }));
    const state = await store.recordAttempt(attempt({ at: now + 1_000, outcome: "incorrect" }));

    expect(state.attempts).toBe(2);
    expect(state.correct).toBe(1);
    expect(state.streak).toBe(0);
    expect(state.lapses).toBe(1);
    expect(state.intervalDays).toBe(0);
    expect(state.dueAt).toBeLessThanOrEqual(now + 1_000);
    expect(state.lastOutcome).toBe("incorrect");
  });

  it("při změně zadání resetuje plán, ale nechá historii chyb", async () => {
    const now = Date.now();
    await store.recordAttempt(attempt({ at: now, outcome: "incorrect" }));
    await store.recordAttempt(attempt({ at: now + 1, outcome: "incorrect" }));
    const before = await store.getQuestionState("idm-03-relace");
    expect(before?.lapses).toBe(2);

    const after = await store.recordAttempt(
      attempt({ at: now + 2, materialHash: "hash-b", outcome: "correct" }),
    );

    expect(after.attempts).toBe(3);
    expect(after.lapses).toBe(2);
    expect(after.materialHash).toBe("hash-b");
    expect(after.streak).toBe(1);
  });

  it("zapíše pokus do logu a do denní statistiky", async () => {
    const now = Date.now();
    await store.recordAttempt(attempt({ at: now, durationMs: 3_000 }));
    await store.recordAttempt(
      attempt({ questionId: "idm-03-jina", at: now + 5, outcome: "incorrect", durationMs: 7_000 }),
    );

    expect(await store.getRecentAttempts(10)).toHaveLength(2);
    const [day] = await store.getDayStats(todayKey(), todayKey());
    expect(day).toMatchObject({ answered: 2, correct: 1, timeMs: 10_000 });
  });

  it("přeskočená otázka se do denního počtu nezapočítá", async () => {
    await store.recordAttempt(attempt({ outcome: "skipped", score: 0 }));
    const [day] = await store.getDayStats(todayKey(), todayKey());
    expect(day.answered).toBe(0);
  });
});

describe("dotazy", () => {
  it("vrací splatné otázky a chyby", async () => {
    const now = Date.now();
    await store.recordAttempt(attempt({ questionId: "a", at: now, outcome: "correct" }));
    await store.recordAttempt(attempt({ questionId: "b", at: now, outcome: "incorrect" }));
    await store.recordAttempt(
      attempt({ questionId: "c", course: "izp", at: now, outcome: "incorrect" }),
    );

    const due = await store.getDueQuestions();
    expect(due.map((s) => s.questionId).sort()).toEqual(["b", "c"]);

    const mistakes = await store.getMistakes("idm");
    expect(mistakes.map((s) => s.questionId)).toEqual(["b"]);
    expect(await store.getStatesForCourse("izp")).toHaveLength(1);
    expect(await store.getStatesForSet("idm-03")).toHaveLength(3);
    expect(await store.getAllStates()).toHaveLength(3);
  });
});

describe("getStreak", () => {
  const dayMs = 86_400_000;

  it("bez dat je nula", async () => {
    expect(await store.getStreak()).toEqual({ current: 0, longest: 0, lastDay: null });
  });

  it("počítá řetěz dnů po sobě", async () => {
    const now = Date.now();
    for (const offset of [2, 1, 0]) {
      await store.recordAttempt(attempt({ questionId: `q${offset}`, at: now - offset * dayMs }));
    }

    const streak = await store.getStreak();
    expect(streak.current).toBe(3);
    expect(streak.longest).toBe(3);
    expect(streak.lastDay).toBe(todayKey());
  });

  it("dnešek bez odpovědi sérii netrhá", async () => {
    const now = Date.now();
    await store.recordAttempt(attempt({ questionId: "q1", at: now - 2 * dayMs }));
    await store.recordAttempt(attempt({ questionId: "q2", at: now - dayMs }));

    const streak = await store.getStreak();
    expect(streak.current).toBe(2);
    expect(streak.lastDay).toBe(addDays(todayKey(), -1));
  });

  it("díra v řadě sérii ukončí, nejdelší si pamatuje", async () => {
    const now = Date.now();
    for (const offset of [10, 9, 8, 7, 3]) {
      await store.recordAttempt(attempt({ questionId: `q${offset}`, at: now - offset * dayMs }));
    }

    const streak = await store.getStreak();
    expect(streak.current).toBe(0);
    expect(streak.longest).toBe(4);
  });
});

describe("nastavení", () => {
  it("vrací výchozí hodnoty a ukládá změny", async () => {
    expect(await store.getPrefs()).toMatchObject({
      sessionSize: DEFAULT_PREFS.sessionSize,
      shuffleChoices: true,
    });

    const updated = await store.setPrefs({ sessionSize: 30, sound: true });
    expect(updated.sessionSize).toBe(30);
    expect(updated.sound).toBe(true);
    expect(updated.shuffleChoices).toBe(true);
    expect((await store.getPrefs()).sessionSize).toBe(30);
  });
});

describe("reset", () => {
  it("umí smazat jednu otázku, předmět i všechno", async () => {
    await store.recordAttempt(attempt({ questionId: "a" }));
    await store.recordAttempt(attempt({ questionId: "b" }));
    await store.recordAttempt(attempt({ questionId: "c", course: "izp" }));

    await store.reset({ questionId: "a" });
    expect(await store.getQuestionState("a")).toBeUndefined();

    await store.reset({ course: "izp" });
    expect(await store.getStatesForCourse("izp")).toHaveLength(0);

    await store.setPrefs({ sessionSize: 25 });
    await store.reset();
    expect(await store.getAllStates()).toHaveLength(0);
    expect(await store.getRecentAttempts(10)).toHaveLength(0);
    // Nastavení není pokrok – to zůstává.
    expect((await store.getPrefs()).sessionSize).toBe(25);
  });
});

describe("export a import", () => {
  it("přenese pokrok do jiného úložiště", async () => {
    await store.recordAttempt(attempt({ questionId: "a" }));
    await store.recordAttempt(attempt({ questionId: "b", outcome: "incorrect" }));
    await store.setPrefs({ sessionSize: 40 });

    const snapshot = await store.exportAll();
    expect(snapshot.version).toBe(1);
    expect(snapshot.states).toHaveLength(2);

    const second = new LocalProgressStore();
    const result = await second.importAll(snapshot);

    expect(result.merged).toBeGreaterThan(0);
    expect(await second.getAllStates()).toHaveLength(2);
    expect((await second.getPrefs()).sessionSize).toBe(40);

    // Druhý import už nemá co přidat.
    const again = await second.importAll(snapshot);
    expect(again.merged).toBe(0);
    expect(again.skipped).toBeGreaterThan(0);
  });

  it("novější stav vyhrává", async () => {
    const now = Date.now();
    await store.recordAttempt(attempt({ questionId: "a", at: now }));
    const snapshot = await store.exportAll();

    const target = new LocalProgressStore();
    await target.recordAttempt(attempt({ questionId: "a", at: now + 60_000 }));
    await target.importAll(snapshot);

    const state = await target.getQuestionState("a");
    expect(state?.updatedAt).toBe(now + 60_000);
  });
});
