/**
 * Výběr otázek do jedné session.
 *
 * Trénink není náhodný výběr: míchá otázky po splatnosti, slabiny, nové
 * a kontrolní vzorek už zvládnutých. Poměry jsou konstanty níž, ať se dají
 * ladit na jednom místě.
 */
import type { QuestionState } from "@/lib/progress/types";
import { deriveMastery } from "./mastery";

/* ------------------------------------------------------------------ */
/* Poměry v session                                                    */
/* ------------------------------------------------------------------ */

/** Po splatnosti – páteř opakování. */
export const SHARE_DUE = 0.5;
/** Slabiny, i když ještě nejsou po splatnosti. */
export const SHARE_WEAK = 0.2;
/** Nové, nikdy neviděné – bez nich se člověk nikam neposune. */
export const SHARE_FRESH = 0.25;
/** Kontrolní vzorek zvládnutých, ať nezmizí z dohledu. */
export const SHARE_MASTERED = 0.05;

/** Pořadí, ve kterém se dobírá, když některá skupina nemá dost položek. */
const FILL_PRIORITY = ["due", "weak", "fresh", "mastered"] as const;
type Bucket = (typeof FILL_PRIORITY)[number];

export interface TrainingSelectionInput {
  /** Stavy otázek (klidně napříč předměty – filtruje se přes `course`). */
  states: QuestionState[];
  /** Všechna id otázek, ze kterých se smí vybírat (z obsahu). */
  allQuestionIds: string[];
  /** Kolik otázek session má. */
  size: number;
  now: number;
  course?: string;
  /** Seed míchání. Stejný seed = stejné pořadí i po re-renderu. */
  seed?: number | string;
}

/**
 * Sestaví session pro režim trénink. Vrací id otázek v pořadí, v jakém
 * se mají ptát – bez duplicit, nejvýš `size` položek.
 */
export function selectForTraining(input: TrainingSelectionInput): string[] {
  const size = Math.max(0, Math.floor(input.size));
  if (size === 0 || input.allQuestionIds.length === 0) return [];

  const allowed = new Set(input.allQuestionIds);
  // Známé stavy si držíme i mimo vybraný předmět – jinak by otázka z jiného
  // předmětu vypadala jako nikdy neviděná a propadla mezi nové.
  const known = new Map(
    input.states.filter((s) => allowed.has(s.questionId)).map((s) => [s.questionId, s] as const),
  );
  const states = [...known.values()].filter((s) => !input.course || s.course === input.course);
  const random = makeRandom(input.seed ?? 0);

  // Po splatnosti: nejdřív ta nejpřetaženější (nejnižší dueAt).
  const due = states
    .filter((s) => s.attempts > 0 && s.dueAt <= input.now)
    .sort((a, b) => a.dueAt - b.dueAt)
    .map((s) => s.questionId);

  // Slabiny: podle závažnosti, ať se nejdřív řeší to nejhorší.
  const weak = states
    .filter((s) => s.attempts > 0 && deriveMastery(s) === "slabina")
    .sort(compareBySeverity)
    .map((s) => s.questionId);

  // Nové: buď o nich není stav, nebo na ně ještě nikdo neodpověděl.
  const fresh = shuffle(
    input.allQuestionIds.filter((id) => {
      const state = known.get(id);
      if (!state) return true;
      if (input.course && state.course !== input.course) return false;
      return state.attempts === 0;
    }),
    random,
  );

  const mastered = shuffle(
    states.filter((s) => deriveMastery(s) === "zvladnuta").map((s) => s.questionId),
    random,
  );

  const pools: Record<Bucket, string[]> = { due, weak, fresh, mastered };
  const quotas: Record<Bucket, number> = {
    due: Math.round(size * SHARE_DUE),
    weak: Math.round(size * SHARE_WEAK),
    fresh: Math.round(size * SHARE_FRESH),
    mastered: Math.round(size * SHARE_MASTERED),
  };

  const picked = new Set<string>();
  const cursors: Record<Bucket, number> = { due: 0, weak: 0, fresh: 0, mastered: 0 };

  const takeFrom = (bucket: Bucket, count: number): void => {
    const pool = pools[bucket];
    let taken = 0;
    while (taken < count && cursors[bucket] < pool.length && picked.size < size) {
      const id = pool[cursors[bucket]];
      cursors[bucket] += 1;
      // Otázka může být zároveň po splatnosti i slabina – bereme ji jednou.
      if (!picked.has(id)) {
        picked.add(id);
        taken += 1;
      }
    }
  };

  for (const bucket of FILL_PRIORITY) takeFrom(bucket, quotas[bucket]);
  // Nedobrané kvóty doplníme z ostatních skupin podle priority.
  for (const bucket of FILL_PRIORITY) takeFrom(bucket, size - picked.size);

  return shuffle([...picked], random);
}

export interface MistakeSelectionInput {
  states: QuestionState[];
  limit: number;
  course?: string;
}

/**
 * Režim „chyby": otázky, kde poslední odpověď nebyla správně.
 * Řadí podle závažnosti – nejvíc zaváhání nahoře, při shodě čerstvější chyba.
 *
 * Vrací celé stavy (ne jen id) – stejně jako `ProgressStore.getMistakes`,
 * protože obrazovka chyb u nich rovnou ukazuje, kolikrát se to nepovedlo.
 */
export function selectMistakes(input: MistakeSelectionInput): QuestionState[] {
  const limit = Math.max(0, Math.floor(input.limit));
  if (limit === 0) return [];

  return input.states
    .filter(
      (s) =>
        s.attempts > 0 &&
        s.lastOutcome !== "correct" &&
        (!input.course || s.course === input.course),
    )
    .sort(compareBySeverity)
    .slice(0, limit);
}

/** Nejvíc zaváhání nahoře; při shodě ta otázka, kde se to pokazilo naposled. */
function compareBySeverity(a: QuestionState, b: QuestionState): number {
  if (b.lapses !== a.lapses) return b.lapses - a.lapses;
  return b.lastSeenAt - a.lastSeenAt;
}

/* ------------------------------------------------------------------ */
/* Seedované míchání                                                   */
/* ------------------------------------------------------------------ */

/**
 * Míchání musí být seedované, jinak by se session přeházela při každém
 * překreslení a uživatel by uprostřed odpovídání dostal jiné otázky.
 */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** mulberry32 – malý deterministický generátor. */
export function makeRandom(seed: number | string): () => number {
  let state = (typeof seed === "number" ? Math.floor(seed) : hashSeed(seed)) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
