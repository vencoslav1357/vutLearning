/**
 * Kontrakt pro ukládání pokroku.
 *
 * Záměrně je tu jedno rozhraní se dvěma implementacemi:
 *   - LocalProgressStore  … IndexedDB v prohlížeči, funguje bez přihlášení
 *   - RemoteProgressStore … server + databáze, zapne se po přihlášení
 *
 * Nic v aplikaci nesmí sahat na IndexedDB ani na databázi přímo.
 * Všechno jde přes tohle rozhraní – jinak se synchronizace nikdy nedodělá.
 */

/** Jak dopadla jedna odpověď. */
export type AnswerOutcome = "correct" | "partial" | "incorrect" | "skipped";

/** Jeden zodpovězený pokus. Append-only log – nikdy se needituje. */
export interface AttemptRecord {
  /** Lokální autoinkrement, jen pro řazení a synchronizaci. */
  id?: number;
  questionId: string;
  setId: string;
  course: string;
  /** Unix ms. */
  at: number;
  outcome: AnswerOutcome;
  /** 0–1. U multi-choice s částečným kreditem mezihodnota. */
  score: number;
  /** Jak dlouho uživatel přemýšlel, v ms. Vstup do odhadu obtížnosti. */
  durationMs: number;
  /** Režim, ve kterém odpověď padla. */
  mode: StudyMode;
  /** Zda si uživatel vyžádal nápovědu (počítá se jako slabší znalost). */
  usedHint: boolean;
  /** Hash odpovědi-relevantních polí otázky v době odpovědi. */
  materialHash: string;
  /** false = ještě nenahráno na server. */
  synced?: boolean;
}

/** Režimy učení. */
export type StudyMode = "procvicovani" | "chyby" | "trenink";

/**
 * Stav učení jedné otázky. Právě tohle čte algoritmus, který rozhoduje,
 * co uživateli ukázat příště.
 */
export interface QuestionState {
  questionId: string;
  setId: string;
  course: string;
  /** Kolikrát po sobě správně. Chyba to shodí na 0. */
  streak: number;
  /** Celkový počet pokusů. */
  attempts: number;
  /** Počet správných pokusů. */
  correct: number;
  /** Kolikrát to uživatel uměl a pak zase zapomněl. Silný signál slabiny. */
  lapses: number;
  /** Koeficient snadnosti (SM-2), 1.3–3.0. Nižší = otázka dělá problémy. */
  ease: number;
  /** Aktuální odstup opakování ve dnech. */
  intervalDays: number;
  /** Unix ms, kdy má otázka znovu přijít na řadu. */
  dueAt: number;
  /** Unix ms poslední odpovědi. */
  lastSeenAt: number;
  lastOutcome: AnswerOutcome;
  /** Odvozený stupeň zvládnutí – to, co uživatel vidí jako štítek. */
  mastery: MasteryLevel;
  /** materialHash z doby poslední odpovědi; při změně se stav resetuje. */
  materialHash: string;
  updatedAt: number;
  synced?: boolean;
}

/**
 * Stupně zvládnutí. Pořadí je významné (index = úroveň).
 * Odvozuje se v srs/mastery.ts, neukládá se ručně.
 */
export const MASTERY_LEVELS = ["nova", "ucim-se", "skoro", "zvladnuta", "slabina"] as const;
export type MasteryLevel = (typeof MASTERY_LEVELS)[number];

/** Denní souhrn – zdroj pro streak a graf aktivity. */
export interface DayStats {
  /** "YYYY-MM-DD" v lokálním čase uživatele. */
  day: string;
  answered: number;
  correct: number;
  /** Strávený čas v ms. */
  timeMs: number;
  synced?: boolean;
}

/** Nastavení, které si uživatel mění v UI. */
export interface UserPrefs {
  /** Míchat pořadí možností. Výchozí true. */
  shuffleChoices: boolean;
  /** Míchat pořadí otázek. Výchozí true. */
  shuffleQuestions: boolean;
  /** Ukázat vysvětlení hned po odpovědi. Výchozí true. */
  instantFeedback: boolean;
  /** Kolik otázek v jedné session režimu trénink. */
  sessionSize: number;
  /** Zvuková odezva. Výchozí false. */
  sound: boolean;
  updatedAt: number;
}

export const DEFAULT_PREFS: UserPrefs = {
  shuffleChoices: true,
  shuffleQuestions: true,
  instantFeedback: true,
  sessionSize: 15,
  sound: false,
  updatedAt: 0,
};

/** Souhrn za předmět pro dlaždice na přehledu. */
export interface CourseSummary {
  course: string;
  total: number;
  seen: number;
  zvladnuta: number;
  slabiny: number;
  dueNow: number;
  /** 0–1, podíl zvládnutých z celkového počtu. */
  progress: number;
}

/** Rozhraní, které musí splnit každé úložiště pokroku. */
export interface ProgressStore {
  /** Zapíše pokus a rovnou přepočítá stav otázky. Vrací nový stav. */
  recordAttempt(
    attempt: Omit<AttemptRecord, "id" | "synced">,
  ): Promise<QuestionState>;

  getQuestionState(questionId: string): Promise<QuestionState | undefined>;
  getStatesForCourse(course: string): Promise<QuestionState[]>;
  getStatesForSet(setId: string): Promise<QuestionState[]>;
  getAllStates(): Promise<QuestionState[]>;

  /** Otázky, které jsou na řadě k opakování (dueAt <= now). */
  getDueQuestions(course?: string, limit?: number): Promise<QuestionState[]>;

  /** Otázky, u kterých byla poslední odpověď špatně – vstup do režimu "chyby". */
  getMistakes(course?: string, limit?: number): Promise<QuestionState[]>;

  getRecentAttempts(limit: number): Promise<AttemptRecord[]>;

  getDayStats(fromDay: string, toDay: string): Promise<DayStats[]>;
  /** Počet dní v řadě, kdy uživatel odpověděl aspoň na jednu otázku. */
  getStreak(): Promise<{ current: number; longest: number; lastDay: string | null }>;

  getPrefs(): Promise<UserPrefs>;
  setPrefs(prefs: Partial<UserPrefs>): Promise<UserPrefs>;

  /** Vynuluje stav jedné otázky, jednoho předmětu, nebo (bez argumentu) všeho. */
  reset(scope?: { questionId?: string; course?: string }): Promise<void>;

  /** Export všeho jako JSON – záloha i podklad pro synchronizaci. */
  exportAll(): Promise<ProgressSnapshot>;
  /** Sloučí cizí data do lokálních. Vyhrává novější updatedAt. */
  importAll(snapshot: ProgressSnapshot): Promise<{ merged: number; skipped: number }>;
}

/** Přenosový formát pro zálohu a synchronizaci. */
export interface ProgressSnapshot {
  version: 1;
  exportedAt: number;
  states: QuestionState[];
  attempts: AttemptRecord[];
  days: DayStats[];
  prefs: UserPrefs;
}
