/**
 * Odvození stupně zvládnutí – štítek, který uživatel vidí u otázky,
 * a čísla do dlaždice předmětu.
 *
 * Mastery se nikde neukládá ručně; vždycky se počítá z `QuestionState`,
 * aby se nemohlo rozejít se skutečnou historií.
 */
import type { CourseSummary, MasteryLevel, QuestionState } from "@/lib/progress/types";

/**
 * Práh „zralé karty" podle Anki. Pod 21 dní se znalost ještě běžně
 * zapomíná, takže otázku nehlásíme jako zvládnutou, i když jde série.
 */
export const MATURE_INTERVAL_DAYS = 21;

/** Kolik zaváhání (a čerstvá chyba) už dělá ze otázky slabinu. */
export const WEAK_LAPSES = 2;
/** Úspěšnost pod tímhle podílem (při dost pokusech) je taky slabina. */
export const WEAK_ACCURACY = 0.5;
/** Kolik pokusů musí padnout, než má smysl úspěšnost vůbec počítat. */
export const WEAK_MIN_ATTEMPTS = 3;

/** Série potřebná pro „skoro" a pro „zvládnutá". */
export const ALMOST_STREAK = 2;
export const MASTERED_STREAK = 3;

/**
 * Štítek otázky. Pořadí podmínek je záměrné: slabina přebíjí i dlouhou
 * sérii, protože právě tyhle otázky má trénink tlačit nejvíc.
 */
export function deriveMastery(state: QuestionState): MasteryLevel {
  if (state.attempts === 0) return "nova";

  const accuracy = state.attempts > 0 ? state.correct / state.attempts : 0;
  const repeatedlyForgotten = state.lapses >= WEAK_LAPSES && state.lastOutcome !== "correct";
  const lowAccuracy = state.attempts >= WEAK_MIN_ATTEMPTS && accuracy < WEAK_ACCURACY;
  if (repeatedlyForgotten || lowAccuracy) return "slabina";

  if (state.streak < ALMOST_STREAK) return "ucim-se";
  if (state.streak >= MASTERED_STREAK && state.intervalDays >= MATURE_INTERVAL_DAYS) {
    return "zvladnuta";
  }
  return "skoro";
}

/** Je otázka na řadě k opakování? */
export function isDue(state: QuestionState, now: number = Date.now()): boolean {
  return state.attempts > 0 && state.dueAt <= now;
}

/**
 * Souhrn pro dlaždici předmětu.
 * `totalQuestions` je počet otázek v obsahu – stavy ho neznají, protože
 * o nezodpovězených otázkách žádný stav neexistuje.
 */
export function summarizeCourse(
  states: QuestionState[],
  totalQuestions: number,
  options: { course?: string; now?: number } = {},
): CourseSummary {
  const now = options.now ?? Date.now();
  const relevant = options.course ? states.filter((s) => s.course === options.course) : states;

  let seen = 0;
  let zvladnuta = 0;
  let slabiny = 0;
  let dueNow = 0;

  for (const state of relevant) {
    if (state.attempts > 0) seen += 1;
    const level = deriveMastery(state);
    if (level === "zvladnuta") zvladnuta += 1;
    if (level === "slabina") slabiny += 1;
    if (isDue(state, now)) dueNow += 1;
  }

  const total = Math.max(totalQuestions, 0);
  return {
    course: options.course ?? relevant[0]?.course ?? "",
    total,
    seen,
    zvladnuta,
    slabiny,
    dueNow,
    progress: total > 0 ? Math.min(1, zvladnuta / total) : 0,
  };
}

const LABELS: Record<MasteryLevel, string> = {
  nova: "Nová",
  "ucim-se": "Učím se",
  skoro: "Skoro umím",
  zvladnuta: "Zvládnutá",
  slabina: "Slabina",
};

/** Český popisek štítku. */
export function masteryLabel(level: MasteryLevel): string {
  return LABELS[level];
}

const DESCRIPTIONS: Record<MasteryLevel, string> = {
  nova: "Tuhle otázku jsi ještě neviděl.",
  "ucim-se": "Zatím to není jisté, vrátí se brzy.",
  skoro: "Jde ti to, ještě pár opakování.",
  zvladnuta: "Umíš to i s odstupem. Objeví se jen občas.",
  slabina: "Tady se to láme. Trénink ti to bude nabízet přednostně.",
};

/** Delší vysvětlení do tooltipu nebo legendy. */
export function masteryDescription(level: MasteryLevel): string {
  return DESCRIPTIONS[level];
}

/**
 * Barevný token z globals.css, ke kterému štítek patří.
 * Vrací rodinu tokenu, ne hotovou třídu – konkrétní použití
 * (pozadí, text, rámeček) si složí komponenta.
 */
export type MasteryTone = "neutral" | "accent" | "warn" | "ok" | "bad";

const TONES: Record<MasteryLevel, MasteryTone> = {
  nova: "neutral",
  "ucim-se": "accent",
  skoro: "warn",
  zvladnuta: "ok",
  slabina: "bad",
};

export function masteryColor(level: MasteryLevel): MasteryTone {
  return TONES[level];
}

/** Hotové Tailwind třídy pro štítek (pozadí + text + rámeček). */
const CLASSES: Record<MasteryTone, string> = {
  neutral: "bg-bg-subtle text-text-muted border-border-base",
  accent: "bg-accent-soft text-accent-text border-border-base",
  warn: "bg-warn-soft text-warn border-warn-border",
  ok: "bg-ok-soft text-ok border-ok-border",
  bad: "bg-bad-soft text-bad border-bad-border",
};

export function masteryClasses(level: MasteryLevel): string {
  return CLASSES[masteryColor(level)];
}
