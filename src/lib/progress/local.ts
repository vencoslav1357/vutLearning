/**
 * Lokální úložiště pokroku – IndexedDB přes Dexie.
 *
 * Funguje bez přihlášení a je to výchozí implementace `ProgressStore`.
 * Když prohlížeč IndexedDB nedá (privátní okno, zakázaná úložiště,
 * zablokované cookies třetích stran), spadne to na paměťovou variantu:
 * pokrok se ztratí po zavření karty, ale aplikace pojede dál.
 */
import Dexie, { type Table } from "dexie";

import {
  DEFAULT_PREFS,
  type AttemptRecord,
  type DayStats,
  type ProgressSnapshot,
  type ProgressStore,
  type QuestionState,
  type UserPrefs,
} from "./types";
import { addDays, toDayKey, todayKey } from "./day";
import {
  createQuestionState,
  gradeAnswer,
  resetOnMaterialChange,
  schedule,
} from "@/lib/srs/scheduler";
import type { GradeInput } from "@/lib/srs/scheduler";
import { deriveMastery } from "@/lib/srs/mastery";

export const DB_NAME = "vut-kviz";

/** Doplňující informace o otázce pro přesnější známkování. */
export type AttemptHints = Pick<GradeInput, "difficulty" | "promptLength" | "questionType">;

/** Kde pokrok reálně leží. `memory` = nouzový režim, po zavření karty je pryč. */
export type StorageKind = "indexeddb" | "memory";

/** Odběratel změn – kvůli překreslení UI v paměťovém režimu. */
export type ProgressChangeListener = () => void;

/** `ProgressStore`, o kterém jde poznat, že se změnil. */
export interface ObservableProgressStore extends ProgressStore {
  onChange(listener: ProgressChangeListener): () => void;
  storageKind(): Promise<StorageKind>;
}

interface PrefsRow extends UserPrefs {
  key: string;
}

const PREFS_KEY = "prefs";

/* ------------------------------------------------------------------ */
/* Backend – dvě implementace pod jedním rozhraním                     */
/* ------------------------------------------------------------------ */

interface StateFilter {
  course?: string;
  setId?: string;
}

interface ProgressBackend {
  readonly kind: StorageKind;
  /** Zabalí sadu operací tak, aby se nemohly prolnout s jinými. */
  tx<T>(fn: () => Promise<T>): Promise<T>;

  getState(questionId: string): Promise<QuestionState | undefined>;
  putState(state: QuestionState): Promise<void>;
  putStates(states: QuestionState[]): Promise<void>;
  listStates(filter?: StateFilter): Promise<QuestionState[]>;
  removeStates(ids: string[]): Promise<void>;

  addAttempt(attempt: AttemptRecord): Promise<void>;
  putAttempts(attempts: AttemptRecord[]): Promise<void>;
  listAttempts(): Promise<AttemptRecord[]>;
  latestAttempts(limit: number): Promise<AttemptRecord[]>;
  removeAttempts(match: { questionId?: string; course?: string }): Promise<void>;

  getDay(day: string): Promise<DayStats | undefined>;
  putDay(day: DayStats): Promise<void>;
  putDays(days: DayStats[]): Promise<void>;
  listDays(range?: { from: string; to: string }): Promise<DayStats[]>;

  getPrefs(): Promise<UserPrefs | undefined>;
  putPrefs(prefs: UserPrefs): Promise<void>;

  /** Smaže pokrok (stavy, pokusy, dny). Nastavení zůstává. */
  clearProgress(): Promise<void>;
}

class ProgressDb extends Dexie {
  attempts!: Table<AttemptRecord, number>;
  states!: Table<QuestionState, string>;
  days!: Table<DayStats, string>;
  prefs!: Table<PrefsRow, string>;

  constructor() {
    super(DB_NAME);
    // `synced` je v indexech schválně, i když je to boolean a IndexedDB
    // takové hodnoty do indexu nepustí – až bude synchronizace, přepne se
    // na 0/1 v nové verzi schématu a index bude připravený.
    this.version(1).stores({
      attempts: "++id, questionId, setId, course, at, synced",
      states: "questionId, setId, course, dueAt, mastery, updatedAt, synced",
      days: "day, synced",
      prefs: "key",
    });
  }
}

class DexieBackend implements ProgressBackend {
  readonly kind = "indexeddb" as const;

  constructor(private readonly db: ProgressDb) {}

  tx<T>(fn: () => Promise<T>): Promise<T> {
    return this.db.transaction(
      "rw",
      this.db.attempts,
      this.db.states,
      this.db.days,
      this.db.prefs,
      fn,
    );
  }

  getState(questionId: string) {
    return this.db.states.get(questionId);
  }

  async putState(state: QuestionState) {
    await this.db.states.put(state);
  }

  async putStates(states: QuestionState[]) {
    await this.db.states.bulkPut(states);
  }

  async listStates(filter?: StateFilter): Promise<QuestionState[]> {
    if (filter?.setId) return this.db.states.where("setId").equals(filter.setId).toArray();
    if (filter?.course) return this.db.states.where("course").equals(filter.course).toArray();
    return this.db.states.toArray();
  }

  async removeStates(ids: string[]) {
    await this.db.states.bulkDelete(ids);
  }

  async addAttempt(attempt: AttemptRecord) {
    await this.db.attempts.add(attempt);
  }

  async putAttempts(attempts: AttemptRecord[]) {
    await this.db.attempts.bulkPut(attempts);
  }

  listAttempts() {
    return this.db.attempts.orderBy("at").toArray();
  }

  async latestAttempts(limit: number) {
    return this.db.attempts.orderBy("at").reverse().limit(limit).toArray();
  }

  async removeAttempts(match: { questionId?: string; course?: string }) {
    if (match.questionId) {
      await this.db.attempts.where("questionId").equals(match.questionId).delete();
      return;
    }
    if (match.course) {
      await this.db.attempts.where("course").equals(match.course).delete();
    }
  }

  getDay(day: string) {
    return this.db.days.get(day);
  }

  async putDay(day: DayStats) {
    await this.db.days.put(day);
  }

  async putDays(days: DayStats[]) {
    await this.db.days.bulkPut(days);
  }

  async listDays(range?: { from: string; to: string }) {
    if (!range) return this.db.days.orderBy("day").toArray();
    return this.db.days.where("day").between(range.from, range.to, true, true).toArray();
  }

  async getPrefs() {
    const row = await this.db.prefs.get(PREFS_KEY);
    if (!row) return undefined;
    const { key: _key, ...prefs } = row;
    return prefs;
  }

  async putPrefs(prefs: UserPrefs) {
    await this.db.prefs.put({ key: PREFS_KEY, ...prefs });
  }

  async clearProgress() {
    await Promise.all([this.db.states.clear(), this.db.attempts.clear(), this.db.days.clear()]);
  }
}

/** Nouzová varianta bez perzistence. */
class MemoryBackend implements ProgressBackend {
  readonly kind = "memory" as const;

  private states = new Map<string, QuestionState>();
  private attempts: AttemptRecord[] = [];
  private days = new Map<string, DayStats>();
  private prefs: UserPrefs | undefined;
  private nextId = 1;
  /** Fronta místo transakcí: operace se řadí za sebe, aby se neprolnuly. */
  private queue: Promise<unknown> = Promise.resolve();

  tx<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async getState(questionId: string) {
    return this.states.get(questionId);
  }

  async putState(state: QuestionState) {
    this.states.set(state.questionId, { ...state });
  }

  async putStates(states: QuestionState[]) {
    for (const s of states) this.states.set(s.questionId, { ...s });
  }

  async listStates(filter?: StateFilter) {
    let out = [...this.states.values()];
    if (filter?.setId) out = out.filter((s) => s.setId === filter.setId);
    if (filter?.course) out = out.filter((s) => s.course === filter.course);
    return out;
  }

  async removeStates(ids: string[]) {
    for (const id of ids) this.states.delete(id);
  }

  async addAttempt(attempt: AttemptRecord) {
    this.attempts.push({ ...attempt, id: this.nextId });
    this.nextId += 1;
  }

  async putAttempts(attempts: AttemptRecord[]) {
    for (const a of attempts) {
      this.attempts.push({ ...a, id: a.id ?? this.nextId });
      this.nextId = Math.max(this.nextId, (a.id ?? this.nextId) + 1);
    }
  }

  async listAttempts() {
    return [...this.attempts].sort((a, b) => a.at - b.at);
  }

  async latestAttempts(limit: number) {
    return [...this.attempts].sort((a, b) => b.at - a.at).slice(0, limit);
  }

  async removeAttempts(match: { questionId?: string; course?: string }) {
    this.attempts = this.attempts.filter((a) => {
      if (match.questionId) return a.questionId !== match.questionId;
      if (match.course) return a.course !== match.course;
      return true;
    });
  }

  async getDay(day: string) {
    return this.days.get(day);
  }

  async putDay(day: DayStats) {
    this.days.set(day.day, { ...day });
  }

  async putDays(days: DayStats[]) {
    for (const d of days) this.days.set(d.day, { ...d });
  }

  async listDays(range?: { from: string; to: string }) {
    const all = [...this.days.values()].sort((a, b) => a.day.localeCompare(b.day));
    if (!range) return all;
    return all.filter((d) => d.day >= range.from && d.day <= range.to);
  }

  async getPrefs() {
    return this.prefs;
  }

  async putPrefs(prefs: UserPrefs) {
    this.prefs = { ...prefs };
  }

  async clearProgress() {
    this.states.clear();
    this.attempts = [];
    this.days.clear();
  }
}

/**
 * Je IndexedDB použitelná? Samotná existence objektu nestačí – ve Firefoxu
 * v privátním okně `open()` vyhodí výjimku, proto se to pozná až pokusem.
 */
export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export class LocalProgressStore implements ObservableProgressStore {
  private backend: Promise<ProgressBackend> | null = null;
  private listeners = new Set<ProgressChangeListener>();

  private ready(): Promise<ProgressBackend> {
    if (!this.backend) this.backend = openBackend();
    return this.backend;
  }

  async storageKind(): Promise<StorageKind> {
    return (await this.ready()).kind;
  }

  onChange(listener: ProgressChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  /**
   * Zapíše pokus a rovnou přepočítá stav otázky.
   *
   * `hints` jsou navíc oproti rozhraní: `AttemptRecord` nenese obtížnost ani
   * délku zadání, a bez nich je odhad „rychlá / pomalá odpověď" hrubší.
   * Kdo je má po ruce, ať je pošle.
   */
  async recordAttempt(
    attempt: Omit<AttemptRecord, "id" | "synced">,
    hints?: AttemptHints,
  ): Promise<QuestionState> {
    const backend = await this.ready();
    const result = await backend.tx(async () => {
      await backend.addAttempt({ ...attempt, synced: false });

      const existing = await backend.getState(attempt.questionId);
      const base =
        existing ??
        createQuestionState({
          questionId: attempt.questionId,
          setId: attempt.setId,
          course: attempt.course,
          materialHash: attempt.materialHash,
          now: attempt.at,
        });

      // Když se zadání mezitím změnilo, plán opakování už neplatí.
      const checked = resetOnMaterialChange(base, attempt.materialHash, attempt.at);

      const grade = gradeAnswer({
        outcome: attempt.outcome,
        durationMs: attempt.durationMs,
        usedHint: attempt.usedHint,
        ...hints,
      });
      const scheduled = schedule(checked, grade, attempt.at);

      const next: QuestionState = {
        ...scheduled,
        setId: attempt.setId,
        course: attempt.course,
        attempts: checked.attempts + 1,
        correct: checked.correct + (attempt.outcome === "correct" ? 1 : 0),
        lastSeenAt: attempt.at,
        lastOutcome: attempt.outcome,
        materialHash: attempt.materialHash,
        updatedAt: attempt.at,
        synced: false,
      };
      next.mastery = deriveMastery(next);
      await backend.putState(next);

      await bumpDay(backend, attempt);
      return next;
    });

    this.notify();
    return result;
  }

  async getQuestionState(questionId: string): Promise<QuestionState | undefined> {
    return (await this.ready()).getState(questionId);
  }

  async getStatesForCourse(course: string): Promise<QuestionState[]> {
    return (await this.ready()).listStates({ course });
  }

  async getStatesForSet(setId: string): Promise<QuestionState[]> {
    return (await this.ready()).listStates({ setId });
  }

  async getAllStates(): Promise<QuestionState[]> {
    return (await this.ready()).listStates();
  }

  async getDueQuestions(course?: string, limit?: number): Promise<QuestionState[]> {
    const now = Date.now();
    const states = await (await this.ready()).listStates(course ? { course } : undefined);
    const due = states
      .filter((s) => s.attempts > 0 && s.dueAt <= now)
      .sort((a, b) => a.dueAt - b.dueAt);
    return typeof limit === "number" ? due.slice(0, limit) : due;
  }

  async getMistakes(course?: string, limit?: number): Promise<QuestionState[]> {
    const states = await (await this.ready()).listStates(course ? { course } : undefined);
    const mistakes = states
      .filter((s) => s.attempts > 0 && s.lastOutcome !== "correct")
      .sort((a, b) => b.lapses - a.lapses || b.lastSeenAt - a.lastSeenAt);
    return typeof limit === "number" ? mistakes.slice(0, limit) : mistakes;
  }

  async getRecentAttempts(limit: number): Promise<AttemptRecord[]> {
    return (await this.ready()).latestAttempts(Math.max(0, limit));
  }

  async getDayStats(fromDay: string, toDay: string): Promise<DayStats[]> {
    return (await this.ready()).listDays({ from: fromDay, to: toDay });
  }

  /**
   * Série dnů po sobě, kdy padla aspoň jedna odpověď.
   *
   * Dnešek sérii netrhá: dokud je den před koncem, počítá se řetěz od
   * včerejška – jinak by uživateli každé ráno série zmizela a večer se
   * zase objevila.
   */
  async getStreak(): Promise<{ current: number; longest: number; lastDay: string | null }> {
    const days = (await (await this.ready()).listDays())
      .filter((d) => d.answered > 0)
      .map((d) => d.day)
      .sort();

    if (days.length === 0) return { current: 0, longest: 0, lastDay: null };

    const present = new Set(days);
    const lastDay = days[days.length - 1];

    let longest = 1;
    let run = 1;
    for (let i = 1; i < days.length; i += 1) {
      run = addDays(days[i - 1], 1) === days[i] ? run + 1 : 1;
      if (run > longest) longest = run;
    }

    const today = todayKey();
    const yesterday = addDays(today, -1);
    let cursor = present.has(today) ? today : present.has(yesterday) ? yesterday : null;

    let current = 0;
    while (cursor && present.has(cursor)) {
      current += 1;
      cursor = addDays(cursor, -1);
    }

    return { current, longest, lastDay };
  }

  async getPrefs(): Promise<UserPrefs> {
    const stored = await (await this.ready()).getPrefs();
    return { ...DEFAULT_PREFS, ...stored };
  }

  async setPrefs(prefs: Partial<UserPrefs>): Promise<UserPrefs> {
    const backend = await this.ready();
    const current = { ...DEFAULT_PREFS, ...(await backend.getPrefs()) };
    const next: UserPrefs = { ...current, ...prefs, updatedAt: Date.now() };
    await backend.putPrefs(next);
    this.notify();
    return next;
  }

  async reset(scope?: { questionId?: string; course?: string }): Promise<void> {
    const backend = await this.ready();
    await backend.tx(async () => {
      if (scope?.questionId) {
        await backend.removeStates([scope.questionId]);
        await backend.removeAttempts({ questionId: scope.questionId });
        return;
      }
      if (scope?.course) {
        const states = await backend.listStates({ course: scope.course });
        await backend.removeStates(states.map((s) => s.questionId));
        await backend.removeAttempts({ course: scope.course });
        return;
      }
      // Nastavení není pokrok, to uživateli necháváme.
      await backend.clearProgress();
    });
    this.notify();
  }

  async exportAll(): Promise<ProgressSnapshot> {
    const backend = await this.ready();
    const [states, attempts, days, prefs] = await Promise.all([
      backend.listStates(),
      backend.listAttempts(),
      backend.listDays(),
      this.getPrefs(),
    ]);
    return { version: 1, exportedAt: Date.now(), states, attempts, days, prefs };
  }

  /**
   * Sloučí cizí data do lokálních. U stavů vyhrává novější `updatedAt`,
   * pokusy se jen doplní (klíčem je dvojice otázka + čas), dny se berou
   * ty úplnější.
   */
  async importAll(snapshot: ProgressSnapshot): Promise<{ merged: number; skipped: number }> {
    const backend = await this.ready();
    const result = await backend.tx(async () => {
      let merged = 0;
      let skipped = 0;

      const existingStates = new Map(
        (await backend.listStates()).map((s) => [s.questionId, s] as const),
      );
      const statesToWrite: QuestionState[] = [];
      for (const incoming of snapshot.states ?? []) {
        const current = existingStates.get(incoming.questionId);
        if (current && current.updatedAt >= incoming.updatedAt) {
          skipped += 1;
          continue;
        }
        statesToWrite.push({ ...incoming, mastery: deriveMastery(incoming) });
        merged += 1;
      }
      if (statesToWrite.length) await backend.putStates(statesToWrite);

      const seen = new Set(
        (await backend.listAttempts()).map((a) => `${a.questionId}@${a.at}`),
      );
      const attemptsToWrite: AttemptRecord[] = [];
      for (const incoming of snapshot.attempts ?? []) {
        const key = `${incoming.questionId}@${incoming.at}`;
        if (seen.has(key)) {
          skipped += 1;
          continue;
        }
        seen.add(key);
        // `id` zahazujeme, je to lokální autoinkrement – cizí by kolidovalo.
        const { id: _id, ...rest } = incoming;
        attemptsToWrite.push(rest);
        merged += 1;
      }
      if (attemptsToWrite.length) await backend.putAttempts(attemptsToWrite);

      const existingDays = new Map((await backend.listDays()).map((d) => [d.day, d] as const));
      const daysToWrite: DayStats[] = [];
      for (const incoming of snapshot.days ?? []) {
        const current = existingDays.get(incoming.day);
        if (current && current.answered >= incoming.answered) {
          skipped += 1;
          continue;
        }
        daysToWrite.push(incoming);
        merged += 1;
      }
      if (daysToWrite.length) await backend.putDays(daysToWrite);

      if (snapshot.prefs) {
        const current = await backend.getPrefs();
        if (!current || current.updatedAt < snapshot.prefs.updatedAt) {
          await backend.putPrefs({ ...DEFAULT_PREFS, ...snapshot.prefs });
          merged += 1;
        } else {
          skipped += 1;
        }
      }

      return { merged, skipped };
    });

    this.notify();
    return result;
  }
}

/* ------------------------------------------------------------------ */
/* Pomocné                                                             */
/* ------------------------------------------------------------------ */

async function openBackend(): Promise<ProgressBackend> {
  if (isIndexedDbAvailable()) {
    try {
      const db = new ProgressDb();
      await db.open();
      return new DexieBackend(db);
    } catch (error) {
      console.warn(
        "[progress] IndexedDB se nepodařilo otevřít, pokrok se uloží jen do paměti " +
          "a po zavření karty zmizí.",
        error,
      );
    }
  } else {
    console.warn(
      "[progress] Prohlížeč nenabízí IndexedDB (privátní okno?). " +
        "Pokrok se uloží jen do paměti a po zavření karty zmizí.",
    );
  }
  return new MemoryBackend();
}

async function bumpDay(
  backend: ProgressBackend,
  attempt: Omit<AttemptRecord, "id" | "synced">,
): Promise<void> {
  const day = toDayKey(attempt.at);
  const current = await backend.getDay(day);
  // Přeskočená otázka není odpověď – jinak by šlo držet sérii přeskakováním.
  const answered = attempt.outcome === "skipped" ? 0 : 1;
  await backend.putDay({
    day,
    answered: (current?.answered ?? 0) + answered,
    correct: (current?.correct ?? 0) + (attempt.outcome === "correct" ? 1 : 0),
    timeMs: (current?.timeMs ?? 0) + Math.max(0, attempt.durationMs),
    synced: false,
  });
}
