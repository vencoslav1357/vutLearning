import { describe, expect, it } from "vitest";
import { Question } from "../../content/schema";
import {
  emptyAnswer,
  evaluate,
  isAnswered,
  normalizeOutput,
  parseNumber,
  type Answer,
} from "./evaluate";

/**
 * Fixtures jdou schválně přes `Question.parse` – tím se doplní výchozí hodnoty
 * a zároveň se ověří, že testy nepracují s otázkou, která by ve skutečném
 * obsahu neprošla validací.
 */
const q = (raw: unknown): Question => Question.parse(raw);

const base = { id: "test-otazka-jedna", prompt: "Zadání." };

/* ------------------------------------------------------------------ */

describe("evaluate – single", () => {
  const question = q({
    ...base,
    type: "single",
    choices: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }],
    correct: "b",
  });

  it("přesná shoda id je správně", () => {
    const res = evaluate(question, { type: "single", choiceId: "b" });
    expect(res.outcome).toBe("correct");
    expect(res.score).toBe(1);
    expect(res.correctIds).toEqual(["b"]);
  });

  it("jiné id je špatně, ale správnou možnost stejně vrátí", () => {
    const res = evaluate(question, { type: "single", choiceId: "a" });
    expect(res.outcome).toBe("incorrect");
    expect(res.score).toBe(0);
    expect(res.correctIds).toEqual(["b"]);
  });

  it("bez odpovědi je skipped", () => {
    const res = evaluate(question, { type: "single", choiceId: null });
    expect(res.outcome).toBe("skipped");
    expect(res.score).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

describe("evaluate – multi", () => {
  const withPartial = q({
    ...base,
    type: "multi",
    choices: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
      { id: "c", text: "C" },
      { id: "d", text: "D" },
    ],
    correct: ["a", "b", "c"],
  });

  const exactOnly = q({ ...withPartial, partialCredit: false });

  it("úplný výběr je správně", () => {
    const res = evaluate(withPartial, { type: "multi", choiceIds: ["c", "a", "b"] });
    expect(res.outcome).toBe("correct");
    expect(res.score).toBe(1);
  });

  it("částečný výběr dá částečný kredit", () => {
    const res = evaluate(withPartial, { type: "multi", choiceIds: ["a", "b"] });
    expect(res.outcome).toBe("partial");
    expect(res.score).toBeCloseTo(2 / 3);
    expect(res.detail).toEqual({ a: true, b: true, c: false, d: true });
  });

  it("chybně zaškrtnuté se odečítají", () => {
    // 2 trefené − 1 chybná = 1 ze 3.
    const res = evaluate(withPartial, { type: "multi", choiceIds: ["a", "b", "d"] });
    expect(res.score).toBeCloseTo(1 / 3);
    expect(res.outcome).toBe("partial");
    expect(res.message).toContain("chybně");
  });

  it("skóre nikdy neklesne pod nulu", () => {
    const res = evaluate(withPartial, { type: "multi", choiceIds: ["d"] });
    expect(res.score).toBe(0);
    expect(res.outcome).toBe("incorrect");
  });

  it("zaškrtnutí všeho není trik, jak projít", () => {
    const res = evaluate(withPartial, { type: "multi", choiceIds: ["a", "b", "c", "d"] });
    expect(res.score).toBeCloseTo(2 / 3);
    expect(res.outcome).toBe("partial");
  });

  it("bez partialCredit platí jen přesná shoda", () => {
    expect(evaluate(exactOnly, { type: "multi", choiceIds: ["a", "b"] }).outcome).toBe("incorrect");
    expect(evaluate(exactOnly, { type: "multi", choiceIds: ["a", "b"] }).score).toBe(0);
    expect(evaluate(exactOnly, { type: "multi", choiceIds: ["a", "b", "c"] }).outcome).toBe(
      "correct",
    );
  });

  it("prázdný výběr je skipped", () => {
    expect(evaluate(withPartial, { type: "multi", choiceIds: [] }).outcome).toBe("skipped");
  });
});

/* ------------------------------------------------------------------ */

describe("evaluate – trueFalse", () => {
  const question = q({ ...base, type: "trueFalse", answer: true });

  it("shoda je správně", () => {
    expect(evaluate(question, { type: "trueFalse", value: true }).outcome).toBe("correct");
  });

  it("neshoda je špatně a zpráva řekne, jak to je", () => {
    const res = evaluate(question, { type: "trueFalse", value: false });
    expect(res.outcome).toBe("incorrect");
    expect(res.message).toContain("platí");
  });

  it("null je skipped, ne špatně", () => {
    expect(evaluate(question, { type: "trueFalse", value: null }).outcome).toBe("skipped");
  });
});

/* ------------------------------------------------------------------ */

describe("evaluate – shortText", () => {
  const question = q({
    ...base,
    type: "shortText",
    accept: ["hodnost", "rank", "hodnost matice"],
  });

  it("uzná variantu bez diakritiky a s jinou velikostí písmen", () => {
    expect(evaluate(question, { type: "shortText", text: "  HODNOST  " }).outcome).toBe("correct");
    expect(evaluate(question, { type: "shortText", text: "Rank" }).outcome).toBe("correct");
  });

  it("uzná i odpověď s diakritikou navíc", () => {
    expect(evaluate(question, { type: "shortText", text: "hódnost" }).outcome).toBe("correct");
  });

  it("srovná víc mezer uvnitř", () => {
    expect(evaluate(question, { type: "shortText", text: "hodnost   matice" }).outcome).toBe(
      "correct",
    );
  });

  it("nesprávná odpověď prozradí správnou", () => {
    const res = evaluate(question, { type: "shortText", text: "determinant" });
    expect(res.outcome).toBe("incorrect");
    expect(res.message).toContain("hodnost");
  });

  it("interpunkce se ve výchozím nastavení nemaže", () => {
    const slozitost = q({ ...base, type: "shortText", accept: ["O(n log n)"] });
    expect(evaluate(slozitost, { type: "shortText", text: "o(n log n)" }).outcome).toBe("correct");
    expect(evaluate(slozitost, { type: "shortText", text: "on log n" }).outcome).toBe("incorrect");
  });

  it("prázdná odpověď je skipped", () => {
    expect(evaluate(question, { type: "shortText", text: "   " }).outcome).toBe("skipped");
  });
});

/* ------------------------------------------------------------------ */

describe("parseNumber", () => {
  it("bere tečku i čárku jako desetinný oddělovač", () => {
    expect(parseNumber("3.14")).toBe(3.14);
    expect(parseNumber("3,14")).toBe(3.14);
    expect(parseNumber("-2,5")).toBe(-2.5);
    expect(parseNumber("+7")).toBe(7);
  });

  it("zvládne oddělovače tisíců včetně nedělitelné mezery", () => {
    expect(parseNumber("1 234,5")).toBe(1234.5);
    expect(parseNumber("1\u00A0234,5")).toBe(1234.5);
    expect(parseNumber("1\u202F234.5")).toBe(1234.5);
    expect(parseNumber("1.234,5")).toBe(1234.5);
    expect(parseNumber("1,234.5")).toBe(1234.5);
    expect(parseNumber("1,234,567")).toBe(1234567);
  });

  it("zvládne vědecký zápis", () => {
    expect(parseNumber("1e-3")).toBe(0.001);
    expect(parseNumber("2.5E3")).toBe(2500);
    expect(parseNumber("1,5e2")).toBe(150);
  });

  it("srovná typografické minus", () => {
    expect(parseNumber("−2")).toBe(-2);
  });

  it("vrátí null na tom, co číslo není", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("   ")).toBeNull();
    expect(parseNumber("asi pět")).toBeNull();
    expect(parseNumber("12abc")).toBeNull();
    expect(parseNumber("1,2,3.4.5")).toBeNull();
    expect(parseNumber("--3")).toBeNull();
  });
});

describe("evaluate – numeric", () => {
  const exact = q({ ...base, type: "numeric", answer: 42 });

  it("přesná shoda", () => {
    expect(evaluate(exact, { type: "numeric", text: "42" }).outcome).toBe("correct");
    expect(evaluate(exact, { type: "numeric", text: "42,0" }).outcome).toBe("correct");
    expect(evaluate(exact, { type: "numeric", text: "41,9" }).outcome).toBe("incorrect");
  });

  it("absolutní tolerance", () => {
    const question = q({
      ...base,
      type: "numeric",
      answer: 10,
      tolerance: { kind: "absolute", value: 0.5 },
    });
    expect(evaluate(question, { type: "numeric", text: "10,5" }).outcome).toBe("correct");
    expect(evaluate(question, { type: "numeric", text: "9,5" }).outcome).toBe("correct");
    expect(evaluate(question, { type: "numeric", text: "10,6" }).outcome).toBe("incorrect");
  });

  it("relativní tolerance", () => {
    const question = q({
      ...base,
      type: "numeric",
      answer: 200,
      tolerance: { kind: "relative", value: 0.05 },
    });
    expect(evaluate(question, { type: "numeric", text: "210" }).outcome).toBe("correct");
    expect(evaluate(question, { type: "numeric", text: "211" }).outcome).toBe("incorrect");
  });

  it("tolerance na desetinná místa", () => {
    const question = q({
      ...base,
      type: "numeric",
      answer: 3.14159,
      tolerance: { kind: "decimals", value: 2 },
    });
    expect(evaluate(question, { type: "numeric", text: "3,14" }).outcome).toBe("correct");
    expect(evaluate(question, { type: "numeric", text: "3,142" }).outcome).toBe("correct");
    expect(evaluate(question, { type: "numeric", text: "3,15" }).outcome).toBe("incorrect");
  });

  it("neparsovatelný vstup má vlastní zprávu", () => {
    const res = evaluate(exact, { type: "numeric", text: "čtyřicet dva" });
    expect(res.outcome).toBe("incorrect");
    expect(res.message).toBe("Nerozumím zadanému číslu.");
  });

  it("prázdné políčko je skipped", () => {
    expect(evaluate(exact, { type: "numeric", text: "" }).outcome).toBe("skipped");
  });

  it("chybná odpověď ukáže správnou i s jednotkou", () => {
    const question = q({ ...base, type: "numeric", answer: 5, unit: "V" });
    expect(evaluate(question, { type: "numeric", text: "3" }).message).toContain("5 V");
  });
});

/* ------------------------------------------------------------------ */

describe("evaluate – ordering", () => {
  const question = q({
    ...base,
    type: "ordering",
    items: [
      { id: "a", text: "Prvni" },
      { id: "b", text: "Druhy" },
      { id: "c", text: "Treti" },
      { id: "d", text: "Ctvrty" },
    ],
    correctOrder: ["a", "b", "c", "d"],
  });

  it("přesné pořadí je 1", () => {
    const res = evaluate(question, { type: "ordering", order: ["a", "b", "c", "d"] });
    expect(res.outcome).toBe("correct");
    expect(res.score).toBe(1);
  });

  it("částečný kredit podle počtu položek na správném místě", () => {
    const res = evaluate(question, { type: "ordering", order: ["a", "b", "d", "c"] });
    expect(res.score).toBeCloseTo(0.5);
    expect(res.outcome).toBe("partial");
    expect(res.detail).toEqual({ a: true, b: true, d: false, c: false });
  });

  it("úplně obrácené pořadí je incorrect", () => {
    const res = evaluate(question, { type: "ordering", order: ["d", "c", "b", "a"] });
    expect(res.score).toBe(0);
    expect(res.outcome).toBe("incorrect");
  });

  it("outcome je correct jen při 100 %", () => {
    const res = evaluate(question, { type: "ordering", order: ["b", "a", "c", "d"] });
    expect(res.score).toBeCloseTo(0.5);
    expect(res.outcome).not.toBe("correct");
  });

  it("prázdné pořadí je skipped a vrátí správné řešení", () => {
    const res = evaluate(question, { type: "ordering", order: [] });
    expect(res.outcome).toBe("skipped");
    expect(res.correctIds).toEqual(["a", "b", "c", "d"]);
  });
});

/* ------------------------------------------------------------------ */

describe("evaluate – matching", () => {
  const question = q({
    ...base,
    type: "matching",
    left: [
      { id: "l1", text: "Jedna" },
      { id: "l2", text: "Dva" },
      { id: "l3", text: "Tri" },
    ],
    right: [
      { id: "r1", text: "One" },
      { id: "r2", text: "Two" },
      { id: "r3", text: "Three" },
      { id: "r4", text: "Navic" },
    ],
    pairs: [
      ["l1", "r1"],
      ["l2", "r2"],
      ["l3", "r3"],
    ],
  });

  it("všechny dvojice sedí", () => {
    const res = evaluate(question, {
      type: "matching",
      pairs: [
        ["l1", "r1"],
        ["l2", "r2"],
        ["l3", "r3"],
      ],
    });
    expect(res.outcome).toBe("correct");
    expect(res.score).toBe(1);
  });

  it("částečně správně dá podíl a detail po dvojicích", () => {
    const res = evaluate(question, {
      type: "matching",
      pairs: [
        ["l1", "r1"],
        ["l2", "r4"],
        ["l3", "r3"],
      ],
    });
    expect(res.score).toBeCloseTo(2 / 3);
    expect(res.outcome).toBe("partial");
    expect(res.detail).toEqual({ l1: true, l2: false, l3: true });
    expect(res.message).toContain("2 z 3 dvojic");
  });

  it("nepřiřazená položka se počítá jako chyba, ne jako pád", () => {
    const res = evaluate(question, { type: "matching", pairs: [["l1", "r1"]] });
    expect(res.score).toBeCloseTo(1 / 3);
    expect(res.detail).toEqual({ l1: true, l2: false, l3: false });
  });

  it("nic nepřiřazeno je skipped", () => {
    expect(evaluate(question, { type: "matching", pairs: [] }).outcome).toBe("skipped");
    expect(
      evaluate(question, {
        type: "matching",
        pairs: [
          ["l1", ""],
          ["l2", ""],
        ],
      }).outcome,
    ).toBe("skipped");
  });
});

/* ------------------------------------------------------------------ */

describe("evaluate – cloze", () => {
  const question = q({
    ...base,
    type: "cloze",
    template: "Matice má {{1}} řádků a {{2}} sloupců, její {{3}} je nejvýše min(m, n).",
    blanks: {
      "1": { accept: ["m"] },
      "2": { accept: ["n"] },
      "3": { accept: ["hodnost", "rank"] },
    },
  });

  it("všechny mezery správně", () => {
    const res = evaluate(question, {
      type: "cloze",
      blanks: { "1": "m", "2": "n", "3": "Hodnost" },
    });
    expect(res.outcome).toBe("correct");
    expect(res.score).toBe(1);
  });

  it("každá mezera se normalizuje zvlášť", () => {
    const res = evaluate(question, {
      type: "cloze",
      blanks: { "1": " M ", "2": "x", "3": "hódnost" },
    });
    expect(res.score).toBeCloseTo(2 / 3);
    expect(res.detail).toEqual({ "1": true, "2": false, "3": true });
    expect(res.outcome).toBe("partial");
  });

  it("chybějící klíč není pád, jen chybná mezera", () => {
    const res = evaluate(question, { type: "cloze", blanks: { "1": "m" } });
    expect(res.score).toBeCloseTo(1 / 3);
    expect(res.detail).toEqual({ "1": true, "2": false, "3": false });
  });

  it("nic nevyplněno je skipped", () => {
    expect(evaluate(question, { type: "cloze", blanks: {} }).outcome).toBe("skipped");
    expect(
      evaluate(question, { type: "cloze", blanks: { "1": " ", "2": "", "3": "" } }).outcome,
    ).toBe("skipped");
  });
});

/* ------------------------------------------------------------------ */

describe("normalizeOutput", () => {
  it("ořeže bílé znaky na koncích řádků", () => {
    expect(normalizeOutput("a   \nb\t\n")).toBe("a\nb");
  });

  it("zahodí prázdné řádky na konci, ne uvnitř", () => {
    expect(normalizeOutput("a\n\nb\n\n\n")).toBe("a\n\nb");
  });

  it("sjednotí CRLF", () => {
    expect(normalizeOutput("a\r\nb\r\n")).toBe("a\nb");
  });
});

describe("evaluate – codeOutput (exact)", () => {
  const question = q({
    ...base,
    type: "codeOutput",
    language: "c",
    source: 'printf("1\\n2\\n");',
    mode: "exact",
    expected: "1\n2\n",
  });

  it("chybějící koncový newline se netrestá", () => {
    expect(evaluate(question, { type: "codeOutput", text: "1\n2" }).outcome).toBe("correct");
    expect(evaluate(question, { type: "codeOutput", text: "1\n2\n" }).outcome).toBe("correct");
    expect(evaluate(question, { type: "codeOutput", text: "1\n2\n\n\n" }).outcome).toBe("correct");
  });

  it("mezery na konci řádku se ignorují", () => {
    expect(evaluate(question, { type: "codeOutput", text: "1   \n2\t" }).outcome).toBe("correct");
  });

  it("jiný obsah je špatně", () => {
    expect(evaluate(question, { type: "codeOutput", text: "2\n1" }).outcome).toBe("incorrect");
    expect(evaluate(question, { type: "codeOutput", text: "1 2" }).outcome).toBe("incorrect");
  });

  it("velikost písmen se u výstupu programu NEignoruje", () => {
    const hello = q({
      ...base,
      type: "codeOutput",
      language: "c",
      source: 'puts("Ahoj");',
      mode: "exact",
      expected: "Ahoj",
    });
    expect(evaluate(hello, { type: "codeOutput", text: "ahoj" }).outcome).toBe("incorrect");
  });

  it("prázdný vstup je skipped", () => {
    expect(evaluate(question, { type: "codeOutput", text: "" }).outcome).toBe("skipped");
  });
});

describe("evaluate – codeOutput (choice)", () => {
  const question = q({
    ...base,
    type: "codeOutput",
    language: "c",
    source: "int i = 0;",
    mode: "choice",
    choices: [{ id: "a", text: "0" }, { id: "b", text: "1" }],
    correct: "b",
  });

  it("chová se jako single", () => {
    expect(evaluate(question, { type: "codeOutput", choiceId: "b" }).outcome).toBe("correct");
    expect(evaluate(question, { type: "codeOutput", choiceId: "a" }).outcome).toBe("incorrect");
    expect(evaluate(question, { type: "codeOutput", choiceId: null }).outcome).toBe("skipped");
  });
});

/* ------------------------------------------------------------------ */

describe("evaluate – nesouhlas typů", () => {
  it("nespadne, jen odmítne vyhodnotit", () => {
    const question = q({ ...base, type: "trueFalse", answer: true });
    const res = evaluate(question, { type: "single", choiceId: "a" } satisfies Answer);
    expect(res.outcome).toBe("skipped");
  });
});

/* ------------------------------------------------------------------ */

describe("emptyAnswer / isAnswered", () => {
  const questions: Question[] = [
    q({ ...base, type: "single", choices: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: "a" }),
    q({
      ...base,
      type: "multi",
      choices: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }],
      correct: ["a"],
    }),
    q({ ...base, type: "trueFalse", answer: false }),
    q({ ...base, type: "shortText", accept: ["x"] }),
    q({ ...base, type: "numeric", answer: 1 }),
    q({
      ...base,
      type: "ordering",
      items: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }],
      correctOrder: ["a", "b", "c"],
    }),
    q({
      ...base,
      type: "matching",
      left: [{ id: "l1", text: "A" }, { id: "l2", text: "B" }],
      right: [{ id: "r1", text: "1" }, { id: "r2", text: "2" }],
      pairs: [
        ["l1", "r1"],
        ["l2", "r2"],
      ],
    }),
    q({ ...base, type: "cloze", template: "a {{1}} b", blanks: { "1": { accept: ["x"] } } }),
    q({ ...base, type: "codeOutput", language: "c", source: "x", mode: "exact", expected: "1" }),
    q({
      ...base,
      type: "codeOutput",
      language: "c",
      source: "x",
      mode: "choice",
      choices: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
      correct: "a",
    }),
  ];

  it("pro každý typ vrátí odpovídající prázdnou odpověď", () => {
    for (const question of questions) {
      const answer = emptyAnswer(question, 123);
      expect(answer.type).toBe(question.type);
    }
  });

  it("prázdná odpověď se vyhodnotí jako skipped (kromě seřazení, které je předvyplněné)", () => {
    for (const question of questions) {
      const res = evaluate(question, emptyAnswer(question, 123));
      if (question.type === "ordering") continue;
      expect(res.outcome, question.type).toBe("skipped");
    }
  });

  it("ordering dostane zamíchané pořadí, ne rovnou správné řešení", () => {
    const ordering = questions.find((question) => question.type === "ordering")!;
    for (let seed = 0; seed < 50; seed++) {
      const answer = emptyAnswer(ordering, seed) as Extract<Answer, { type: "ordering" }>;
      expect(answer.order.slice().sort()).toEqual(["a", "b", "c"]);
      expect(answer.order.join("")).not.toBe("abc");
    }
  });

  it("isAnswered pozná, že uživatel ještě nesáhl na odpověď", () => {
    for (const question of questions) {
      if (question.type === "ordering") continue;
      expect(isAnswered(emptyAnswer(question)), question.type).toBe(false);
    }
    expect(isAnswered({ type: "shortText", text: " " })).toBe(false);
    expect(isAnswered({ type: "shortText", text: "x" })).toBe(true);
    expect(isAnswered({ type: "cloze", blanks: { "1": "" } })).toBe(false);
    expect(isAnswered({ type: "cloze", blanks: { "1": "x" } })).toBe(true);
    expect(isAnswered({ type: "codeOutput", choiceId: "a" })).toBe(true);
  });
});
