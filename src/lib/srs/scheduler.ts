/**
 * Plánovač opakování – varianta SM-2 přizpůsobená kvízu.
 *
 * Klasické Anki se ptá uživatele, jak mu to šlo (Again / Hard / Good / Easy).
 * Tady se nikdo neptá – k dispozici je jen výsledek odpovědi a čas. Známku
 * 0–5, kterou SM-2 potřebuje, proto odvozujeme: správnost dá základ,
 * rychlost vzhledem k odhadu doby čtení ho posune nahoru nebo dolů
 * a nápověda ho srazí.
 */
import type { AnswerOutcome, QuestionState } from "@/lib/progress/types";
import { MS_PER_DAY } from "@/lib/progress/day";

/* ------------------------------------------------------------------ */
/* Konstanty                                                           */
/* ------------------------------------------------------------------ */

/** Výchozí koeficient snadnosti nové otázky (SM-2). */
export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;

/** Známka, od které se odpověď počítá jako úspěch. Pod ní se interval resetuje. */
export const PASS_GRADE = 3;

/** Odstup po prvním a druhém úspěšném opakování (dny). Dál se násobí ease. */
export const FIRST_INTERVAL_DAYS = 1;
export const SECOND_INTERVAL_DAYS = 6;

/** Maximální odstup. Přes rok už nemá smysl plánovat. */
export const MAX_INTERVAL_DAYS = 365;

/** Rozptyl termínu, ±10 %. */
export const JITTER_RATIO = 0.1;

/** Rychlost čtení v slovech za minutu. */
const WORDS_PER_MINUTE = 200;
/** Průměrná délka českého slova včetně mezery – na převod znaků na slova. */
const CHARS_PER_WORD = 6;

/** Kolik času navíc si typ otázky žádá na samotné rozmyšlení (ms). */
const TYPE_OVERHEAD_MS: Record<string, number> = {
  trueFalse: 3_000,
  single: 5_000,
  multi: 9_000,
  shortText: 7_000,
  numeric: 10_000,
  cloze: 10_000,
  ordering: 12_000,
  matching: 14_000,
  codeOutput: 18_000,
};
const DEFAULT_TYPE_OVERHEAD_MS = 7_000;

/** Nad tímhle násobkem odhadu se odpověď považuje za pomalou. */
export const SLOW_FACTOR = 2.5;

/* ------------------------------------------------------------------ */
/* Známkování odpovědi                                                 */
/* ------------------------------------------------------------------ */

export interface GradeInput {
  outcome: AnswerOutcome;
  /** Jak dlouho uživatel přemýšlel (ms). */
  durationMs: number;
  usedHint: boolean;
  /** Obtížnost otázky 1–5 ze schématu obsahu. Výchozí 3. */
  difficulty?: number;
  /** Délka zadání ve znacích – vstup do odhadu doby čtení. */
  promptLength?: number;
  /** Typ otázky ze schématu obsahu (`single`, `matching`, …). */
  questionType?: string;
}

/**
 * Odhad, jak dlouho poctivému člověku trvá otázku přečíst a rozmyslet.
 * Slouží jen jako měřítko pro „rychle / normálně / pomalu", ne jako limit.
 */
export function estimateReadingMs(input: {
  promptLength?: number;
  questionType?: string;
  difficulty?: number;
}): number {
  const chars = Math.max(0, input.promptLength ?? 0);
  const words = chars / CHARS_PER_WORD;
  const readMs = (words / WORDS_PER_MINUTE) * 60_000;
  const overhead = TYPE_OVERHEAD_MS[input.questionType ?? ""] ?? DEFAULT_TYPE_OVERHEAD_MS;
  const difficulty = clamp(input.difficulty ?? 3, 1, 5);
  // Těžší otázka si žádá delší rozmyšlení; 3 je neutrální.
  const difficultyFactor = 1 + (difficulty - 3) * 0.15;
  return Math.max(1_500, (readMs + overhead) * difficultyFactor);
}

/**
 * Známka 0–5 pro SM-2.
 *
 * skipped → 0, incorrect → 1, partial → 2 (pod prahem, takže selhání),
 * correct → 4 základ, 5 za rychlost, 3 za pomalost; nápověda −1, nejníž na 3.
 */
export function gradeAnswer(input: GradeInput): number {
  switch (input.outcome) {
    case "skipped":
      return 0;
    case "incorrect":
      return 1;
    case "partial":
      // Záměrně pod PASS_GRADE: půlka odpovědi znamená, že to uživatel neumí,
      // a interval se má resetovat. Od incorrect se liší jen o ease.
      return 2;
    case "correct":
      break;
  }

  const estimate = estimateReadingMs(input);
  let grade = 4;
  if (input.durationMs > 0 && input.durationMs <= estimate) grade = 5;
  else if (input.durationMs > estimate * SLOW_FACTOR) grade = 3;

  if (input.usedHint) grade = Math.max(PASS_GRADE, grade - 1);
  return grade;
}

/* ------------------------------------------------------------------ */
/* Plánování                                                           */
/* ------------------------------------------------------------------ */

/** Nový, nikdy neviděný stav otázky. */
export function createQuestionState(init: {
  questionId: string;
  setId: string;
  course: string;
  materialHash: string;
  now?: number;
}): QuestionState {
  const now = init.now ?? Date.now();
  return {
    questionId: init.questionId,
    setId: init.setId,
    course: init.course,
    streak: 0,
    attempts: 0,
    correct: 0,
    lapses: 0,
    ease: DEFAULT_EASE,
    intervalDays: 0,
    dueAt: now,
    lastSeenAt: 0,
    lastOutcome: "skipped",
    mastery: "nova",
    materialHash: init.materialHash,
    updatedAt: now,
    synced: false,
  };
}

/**
 * Deterministický rozptyl termínu v rozsahu 1 ± JITTER_RATIO.
 *
 * Náhoda by tady byla chyba: stav se přepočítává i při čtení a s
 * `Math.random()` by se termín měnil při každém pohledu. Hash id otázky
 * spolu s číslem opakování dá stabilní, ale mezi otázkami rozházené číslo –
 * o to jde, aby na jeden den nespadlo padesát otázek najednou.
 */
export function jitterFactor(questionId: string, repetition = 0): number {
  const h = hash32(`${questionId}#${repetition}`);
  const unit = (h % 10_000) / 10_000; // 0 … 0.9999
  return 1 - JITTER_RATIO + unit * (2 * JITTER_RATIO);
}

function hash32(input: string): number {
  // FNV-1a – krátký, stabilní a bez závislostí.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Jeden krok SM-2. Vrací nový stav – vstupní objekt nemění.
 *
 * `streak` hraje roli SM-2 „repetitions": počet úspěchů v řadě.
 * `intervalDays` se drží bez rozptylu, aby se rozptyl nenásobil přes
 * jednotlivá opakování; rozhazuje se až výsledné `dueAt`.
 */
export function schedule(state: QuestionState, grade: number, now: number): QuestionState {
  const g = clamp(Math.round(grade), 0, 5);

  // Ease se posouvá i při neúspěchu – opakovaně zapomínaná otázka se má
  // vracet čím dál častěji.
  const easeDelta = 0.1 - (5 - g) * (0.08 + (5 - g) * 0.02);
  const ease = clamp((state.ease || DEFAULT_EASE) + easeDelta, MIN_EASE, MAX_EASE);

  let streak: number;
  let intervalDays: number;
  let lapses = state.lapses;

  if (g < PASS_GRADE) {
    streak = 0;
    intervalDays = 0;
    lapses += 1;
  } else {
    streak = state.streak + 1;
    if (streak <= 1) intervalDays = FIRST_INTERVAL_DAYS;
    else if (streak === 2) intervalDays = SECOND_INTERVAL_DAYS;
    else {
      const previous = state.intervalDays > 0 ? state.intervalDays : SECOND_INTERVAL_DAYS;
      intervalDays = Math.round(previous * ease);
    }
    intervalDays = Math.min(intervalDays, MAX_INTERVAL_DAYS);
  }

  // Interval 0 = otázka se vrátí ještě v téhle session, ne až zítra.
  const dueAt =
    intervalDays === 0
      ? now
      : now + Math.round(intervalDays * jitterFactor(state.questionId, streak) * MS_PER_DAY);

  return {
    ...state,
    streak,
    intervalDays,
    lapses,
    ease: round2(ease),
    dueAt,
    updatedAt: now,
    synced: false,
  };
}

/**
 * Otázka se od poslední odpovědi změnila (jiný `materialHash`).
 *
 * Plán opakování ztratil platnost – uživatel odpovídal na něco jiného.
 * Historii problémovosti (`lapses`, `attempts`, `correct`) ale necháváme:
 * když se člověk na tomhle konceptu pletl třikrát, oprava překlepu v zadání
 * na tom nic nemění.
 */
export function resetOnMaterialChange(
  state: QuestionState,
  newHash: string,
  now: number = Date.now(),
): QuestionState {
  if (state.materialHash === newHash) return state;

  if (typeof console !== "undefined") {
    console.info(
      `[srs] Otázka ${state.questionId} se změnila, plán opakování se resetuje ` +
        `(lapses=${state.lapses}, attempts=${state.attempts} zůstávají).`,
    );
  }

  return {
    ...state,
    streak: 0,
    intervalDays: 0,
    ease: DEFAULT_EASE,
    dueAt: now,
    materialHash: newHash,
    updatedAt: now,
    synced: false,
  };
}

/* ------------------------------------------------------------------ */
/* Drobnosti                                                           */
/* ------------------------------------------------------------------ */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
