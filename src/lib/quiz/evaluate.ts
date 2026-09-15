/**
 * Vyhodnocení odpovědi. Jedna funkce pro všechny typy otázek.
 *
 * Záměrně tu není nic o UI ani o ukládání – `evaluate()` je čistá funkce,
 * takže se dá otestovat bez prohlížeče a zavolat i na serveru.
 */
import type { Question } from "../../content/schema";
import type { AnswerOutcome } from "../progress/types";
import { matchesAccepted, normalizeText, type NormalizeOptions } from "./normalize";
import { shuffleAwayFrom } from "./shuffle";

/* ------------------------------------------------------------------ */
/* Odpověď uživatele                                                   */
/* ------------------------------------------------------------------ */

export type Answer =
  | { type: "single"; choiceId: string | null }
  | { type: "multi"; choiceIds: string[] }
  | { type: "trueFalse"; value: boolean | null }
  | { type: "shortText"; text: string }
  | { type: "numeric"; text: string }
  | { type: "ordering"; order: string[] }
  | { type: "matching"; pairs: [string, string][] }
  | { type: "cloze"; blanks: Record<string, string> }
  | { type: "codeOutput"; text?: string; choiceId?: string | null };

/** Odpověď právě toho typu, který odpovídá danému typu otázky. */
export type AnswerFor<T extends Question["type"]> = Extract<Answer, { type: T }>;

export interface Evaluation {
  outcome: AnswerOutcome;
  /** 0..1 */
  score: number;
  /** Co bylo správně – pro zvýraznění v UI. */
  correctIds?: string[];
  /** Které části uživatel trefil / netrefil (ordering, matching, cloze, multi). */
  detail?: Record<string, boolean>;
  /** Česká jednořádková zpráva, např. "Skoro – 2 z 3 dvojic sedí." */
  message: string;
}

/* ------------------------------------------------------------------ */
/* Prázdná (výchozí) odpověď                                           */
/* ------------------------------------------------------------------ */

/**
 * Výchozí stav odpovědi pro danou otázku.
 *
 * `seed` je nepovinný a používá se jen u `ordering`, kde je potřeba položky
 * rovnou zamíchat – kdyby přišly v pořadí ze souboru, byla by úloha hotová.
 */
export function emptyAnswer(question: Question, seed = 0): Answer {
  switch (question.type) {
    case "single":
      return { type: "single", choiceId: null };
    case "multi":
      return { type: "multi", choiceIds: [] };
    case "trueFalse":
      return { type: "trueFalse", value: null };
    case "shortText":
      return { type: "shortText", text: "" };
    case "numeric":
      return { type: "numeric", text: "" };
    case "ordering":
      return {
        type: "ordering",
        order: shuffleAwayFrom(
          question.items.map((item) => item.id),
          question.correctOrder,
          seed,
        ),
      };
    case "matching":
      return { type: "matching", pairs: [] };
    case "cloze":
      return { type: "cloze", blanks: {} };
    case "codeOutput":
      return question.mode === "choice"
        ? { type: "codeOutput", choiceId: null }
        : { type: "codeOutput", text: "" };
  }
}

/**
 * Sáhl uživatel na odpověď vůbec? Podle tohohle se povoluje tlačítko
 * „Vyhodnotit" – vyhodnotit jde i prázdnou odpověď, ale nemá to smysl nabízet.
 */
export function isAnswered(answer: Answer): boolean {
  switch (answer.type) {
    case "single":
      return answer.choiceId !== null;
    case "multi":
      return answer.choiceIds.length > 0;
    case "trueFalse":
      return answer.value !== null;
    case "shortText":
    case "numeric":
      return answer.text.trim() !== "";
    case "ordering":
      return answer.order.length > 0;
    case "matching":
      return answer.pairs.length > 0;
    case "cloze":
      return Object.values(answer.blanks).some((value) => value.trim() !== "");
    case "codeOutput":
      return (answer.text ?? "").trim() !== "" || (answer.choiceId ?? null) !== null;
  }
}

/* ------------------------------------------------------------------ */
/* Vyhodnocení                                                         */
/* ------------------------------------------------------------------ */

const SKIPPED = (message = "Bez odpovědi."): Evaluation => ({
  outcome: "skipped",
  score: 0,
  message,
});

export function evaluate(question: Question, answer: Answer): Evaluation {
  // Nesouhlas typů je chyba volajícího, ale spadnout kvůli tomu celý kvíz nesmí.
  if (question.type !== answer.type) {
    return {
      outcome: "skipped",
      score: 0,
      message: "Odpověď neodpovídá typu otázky.",
    };
  }

  switch (question.type) {
    case "single":
      return evalSingle(question.correct, (answer as AnswerFor<"single">).choiceId);
    case "multi":
      return evalMulti(question, answer as AnswerFor<"multi">);
    case "trueFalse":
      return evalTrueFalse(question.answer, (answer as AnswerFor<"trueFalse">).value);
    case "shortText":
      return evalShortText(question, answer as AnswerFor<"shortText">);
    case "numeric":
      return evalNumeric(question, answer as AnswerFor<"numeric">);
    case "ordering":
      return evalOrdering(question, answer as AnswerFor<"ordering">);
    case "matching":
      return evalMatching(question, answer as AnswerFor<"matching">);
    case "cloze":
      return evalCloze(question, answer as AnswerFor<"cloze">);
    case "codeOutput":
      return evalCodeOutput(question, answer as AnswerFor<"codeOutput">);
  }
}

/* --- single -------------------------------------------------------- */

function evalSingle(correct: string, choiceId: string | null): Evaluation {
  if (choiceId === null) return { ...SKIPPED(), correctIds: [correct] };

  const ok = choiceId === correct;
  return {
    outcome: ok ? "correct" : "incorrect",
    score: ok ? 1 : 0,
    correctIds: [correct],
    detail: { [choiceId]: ok },
    message: ok ? "Správně." : "Špatně.",
  };
}

/* --- multi --------------------------------------------------------- */

function evalMulti(
  question: Extract<Question, { type: "multi" }>,
  answer: AnswerFor<"multi">,
): Evaluation {
  const correct = new Set(question.correct);
  const selected = new Set(answer.choiceIds);
  const correctIds = [...question.correct];

  if (selected.size === 0) return { ...SKIPPED(), correctIds };

  let hits = 0;
  let wrong = 0;
  for (const id of selected) {
    if (correct.has(id)) hits++;
    else wrong++;
  }

  // detail = pro každou možnost, jestli se uživatel rozhodl správně
  // (zaškrtl správnou / nezaškrtl špatnou).
  const detail: Record<string, boolean> = {};
  for (const choice of question.choices) {
    detail[choice.id] = selected.has(choice.id) === correct.has(choice.id);
  }

  const total = correct.size;
  const exact = hits === total && wrong === 0;

  if (!question.partialCredit) {
    return {
      outcome: exact ? "correct" : "incorrect",
      score: exact ? 1 : 0,
      correctIds,
      detail,
      message: exact
        ? "Správně – všechny správné možnosti."
        : `Špatně – u téhle otázky se uznává jen úplně přesný výběr (správně ${total} z ${question.choices.length}).`,
    };
  }

  const score = Math.max(0, (hits - wrong) / total);
  const outcome: AnswerOutcome = score >= 1 ? "correct" : score > 0 ? "partial" : "incorrect";

  let message: string;
  if (outcome === "correct") {
    message = "Správně – všechny správné možnosti.";
  } else if (outcome === "partial") {
    message =
      wrong > 0
        ? `Skoro – ${hits} z ${total} správných, ale ${wrong} navíc chybně.`
        : `Skoro – ${hits} z ${total} správných možností.`;
  } else {
    message =
      wrong > 0
        ? `Špatně – ${wrong} chybně zaškrtnutých smazalo, co jsi trefil.`
        : "Špatně – ani jedna správná možnost.";
  }

  return { outcome, score, correctIds, detail, message };
}

/* --- trueFalse ----------------------------------------------------- */

function evalTrueFalse(correct: boolean, value: boolean | null): Evaluation {
  const correctIds = [correct ? "true" : "false"];
  if (value === null) return { ...SKIPPED(), correctIds };

  const ok = value === correct;
  return {
    outcome: ok ? "correct" : "incorrect",
    score: ok ? 1 : 0,
    correctIds,
    message: ok ? "Správně." : `Špatně – tvrzení ${correct ? "platí" : "neplatí"}.`,
  };
}

/* --- shortText ----------------------------------------------------- */

function evalShortText(
  question: Extract<Question, { type: "shortText" }>,
  answer: AnswerFor<"shortText">,
): Evaluation {
  if (answer.text.trim() === "") return SKIPPED();

  const ok = matchesAccepted(answer.text, question.accept, question.normalize);
  return {
    outcome: ok ? "correct" : "incorrect",
    score: ok ? 1 : 0,
    message: ok ? "Správně." : `Špatně – správně je „${question.accept[0]}".`,
  };
}

/* --- numeric ------------------------------------------------------- */

/**
 * Přečte číslo psané česky i anglicky.
 *
 * Zvládá: "3,14" · "3.14" · "1 234,5" · "1 234.5" (nedělitelná mezera)
 * · "1.234,5" · "-2" · "−2" (typografické minus) · "1e-3" · "+7".
 * Vrací `null`, když to číslo prostě není.
 */
export function parseNumber(input: string): number | null {
  let s = input.trim();
  if (s === "") return null;

  // Oddělovače tisíců a typografické znaky, které se do vstupu dostanou kopírováním.
  s = s.replace(/[\s\u200B\u2019']/g, "");
  s = s.replace(/[−–—]/g, "-");

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    // Oba oddělovače: ten poslední je desetinný, ten druhý odděluje tisíce.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // Víc čárek = tisíce ("1,234,567"), jedna čárka = desetinný oddělovač.
    s = s.split(",").length > 2 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (s.split(".").length > 2) {
    s = s.replace(/\./g, "");
  }

  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;

  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

const czNumber = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 10 });

function evalNumeric(
  question: Extract<Question, { type: "numeric" }>,
  answer: AnswerFor<"numeric">,
): Evaluation {
  const expected = czNumber.format(question.answer) + (question.unit ? ` ${question.unit}` : "");

  if (answer.text.trim() === "") return SKIPPED();

  const value = parseNumber(answer.text);
  if (value === null) {
    return {
      outcome: "incorrect",
      score: 0,
      message: "Nerozumím zadanému číslu.",
    };
  }

  const ok = withinTolerance(value, question.answer, question.tolerance);
  return {
    outcome: ok ? "correct" : "incorrect",
    score: ok ? 1 : 0,
    message: ok ? "Správně." : `Špatně – správně je ${expected}.`,
  };
}

type Tolerance = Extract<Question, { type: "numeric" }>["tolerance"];

function withinTolerance(value: number, correct: number, tolerance: Tolerance): boolean {
  switch (tolerance.kind) {
    case "absolute":
      return Math.abs(value - correct) <= tolerance.value;
    case "relative":
      return Math.abs(value - correct) <= Math.abs(correct) * tolerance.value;
    case "decimals":
      return roundTo(value, tolerance.value) === roundTo(correct, tolerance.value);
  }
}

function roundTo(value: number, decimals: number): number {
  // toFixed kolem 0 umí vrátit "-0.00"; +0 to srovná zpátky na nulu.
  return Number(value.toFixed(decimals)) + 0;
}

/* --- ordering ------------------------------------------------------ */

function evalOrdering(
  question: Extract<Question, { type: "ordering" }>,
  answer: AnswerFor<"ordering">,
): Evaluation {
  const correctOrder = [...question.correctOrder];
  if (answer.order.length === 0) return { ...SKIPPED(), correctIds: correctOrder };

  const detail: Record<string, boolean> = {};
  let hits = 0;
  for (let i = 0; i < correctOrder.length; i++) {
    const expected = correctOrder[i]!;
    const actual = answer.order[i];
    const ok = actual === expected;
    if (ok) hits++;
    // Klíč je id položky, kterou uživatel na tuhle pozici dal – UI podle toho
    // obarvuje řádky tak, jak je vidí, ne tak, jak by měly být.
    if (actual !== undefined) detail[actual] = ok;
  }

  const total = correctOrder.length;
  const score = total === 0 ? 0 : hits / total;
  const outcome: AnswerOutcome = score >= 1 ? "correct" : score > 0 ? "partial" : "incorrect";

  return {
    outcome,
    score,
    correctIds: correctOrder,
    detail,
    message:
      outcome === "correct"
        ? "Správně seřazeno."
        : outcome === "partial"
          ? `Skoro – ${hits} z ${total} položek na správném místě.`
          : "Špatně – žádná položka není na svém místě.",
  };
}

/* --- matching ------------------------------------------------------ */

function evalMatching(
  question: Extract<Question, { type: "matching" }>,
  answer: AnswerFor<"matching">,
): Evaluation {
  const assigned = new Map(answer.pairs);
  const correctIds = question.pairs.map(([left, right]) => `${left}:${right}`);

  // Prázdný řetězec vpravo znamená "nepřiřazeno" – UI ho posílá při zrušení výběru.
  if (answer.pairs.every(([, right]) => right === "")) {
    return { ...SKIPPED(), correctIds };
  }

  const detail: Record<string, boolean> = {};
  let hits = 0;
  for (const [left, right] of question.pairs) {
    const ok = assigned.get(left) === right;
    detail[left] = ok;
    if (ok) hits++;
  }

  const total = question.pairs.length;
  const score = total === 0 ? 0 : hits / total;
  const outcome: AnswerOutcome = score >= 1 ? "correct" : score > 0 ? "partial" : "incorrect";

  return {
    outcome,
    score,
    correctIds,
    detail,
    message:
      outcome === "correct"
        ? "Správně – všechny dvojice sedí."
        : outcome === "partial"
          ? `Skoro – ${hits} z ${total} dvojic sedí.`
          : "Špatně – ani jedna dvojice nesedí.",
  };
}

/* --- cloze --------------------------------------------------------- */

function evalCloze(
  question: Extract<Question, { type: "cloze" }>,
  answer: AnswerFor<"cloze">,
): Evaluation {
  const blanks = Object.entries(question.blanks) as [
    string,
    { accept: string[]; normalize: NormalizeOptions; placeholder?: string },
  ][];

  const filled = blanks.some(([key]) => (answer.blanks[key] ?? "").trim() !== "");
  if (!filled) return SKIPPED();

  const detail: Record<string, boolean> = {};
  let hits = 0;
  for (const [key, blank] of blanks) {
    const ok = matchesAccepted(answer.blanks[key] ?? "", blank.accept, blank.normalize);
    detail[key] = ok;
    if (ok) hits++;
  }

  const total = blanks.length;
  const score = total === 0 ? 0 : hits / total;
  const outcome: AnswerOutcome = score >= 1 ? "correct" : score > 0 ? "partial" : "incorrect";

  return {
    outcome,
    score,
    detail,
    message:
      outcome === "correct"
        ? "Správně – všechny mezery doplněné."
        : outcome === "partial"
          ? `Skoro – ${hits} z ${total} mezer správně.`
          : "Špatně – ani jedna mezera nesedí.",
  };
}

/* --- codeOutput ---------------------------------------------------- */

/**
 * Srovná výstup programu do tvaru, ve kterém se dá porovnávat:
 * ořízne bílé znaky na koncích řádků a prázdné řádky na konci.
 * Chybějící koncový newline není chyba uživatele, ale klávesnice.
 */
export function normalizeOutput(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((line) => line.replace(/\s+$/, ""));
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

function evalCodeOutput(
  question: Extract<Question, { type: "codeOutput" }>,
  answer: AnswerFor<"codeOutput">,
): Evaluation {
  if (question.mode === "choice") {
    // `correct` je ve schématu nepovinné (povinné je až při mode: "choice"),
    // ale obsah se kontroluje linterem – tady se jen nesmí spadnout.
    return evalSingle(question.correct ?? "", answer.choiceId ?? null);
  }

  const text = answer.text ?? "";
  if (text.trim() === "") return SKIPPED();

  const expected = normalizeOutput(question.expected ?? "");
  const actual = normalizeOutput(text);
  const ok = actual === expected;

  return {
    outcome: ok ? "correct" : "incorrect",
    score: ok ? 1 : 0,
    message: ok ? "Správně." : "Špatně – výstup nesedí.",
  };
}

/** Jen pro znovupoužití v UI (zvýraznění po řádcích). */
export { normalizeText };
