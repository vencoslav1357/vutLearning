import { describe, expect, it } from "vitest";
import { Question } from "./schema";
import { contentHash, hashString, materialHash, normalizeText } from "./hash";

/**
 * Referenční FNV-1a 64 přes BigInt – pomalý, zato zjevně správný.
 * Konstanty jsou přes BigInt(), protože tsconfig cílí na ES2017,
 * kde literál `123n` ještě neexistuje.
 */
function fnv1a64Reference(input: string): string {
  const offset = BigInt("0xcbf29ce484222325");
  const prime = BigInt("0x100000001b3");
  const mask = BigInt("0xffffffffffffffff");

  const bytes = new TextEncoder().encode(input);
  let hash = offset;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

/** Otázka projde schématem, ať testujeme to, co reálně přijde z loaderu. */
function parse(input: unknown) {
  return Question.parse(input);
}

const single = {
  id: "idm-03-relace-tranzitivita",
  type: "single",
  prompt: "Která relace na množině $\\{1,2,3\\}$ je tranzitivní?",
  explanation: "Tranzitivita znamená, že z $aRb$ a $bRc$ plyne $aRc$.",
  hint: "Zkus najít protipříklad.",
  difficulty: 3,
  tags: ["relace"],
  status: "draft",
  choices: [
    { id: "a", text: "Identita", feedback: "Správně." },
    { id: "b", text: "Prázdná relace" },
    { id: "c", text: "Relace $\\{(1,2),(2,3)\\}$" },
  ],
  correct: "a",
};

describe("fnv1a64", () => {
  it("se shoduje s BigInt referencí", () => {
    for (const sample of ["", "a", "foobar", "příliš žluťoučký kůň", "x".repeat(1000)]) {
      expect(hashString(sample)).toBe(fnv1a64Reference(sample));
    }
  });

  it("vrací 16 hex znaků", () => {
    expect(hashString("cokoliv")).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("normalizeText", () => {
  it("sjednotí bílé znaky a velikost písmen", () => {
    expect(normalizeText("  Ahoj\n\tSVĚTE  ")).toBe(normalizeText("ahoj světe"));
  });
});

describe("materialHash – co ho NESMÍ změnit", () => {
  it("přeházené pořadí možností", () => {
    const original = parse(single);
    const shuffled = parse({
      ...single,
      choices: [single.choices[2], single.choices[0], single.choices[1]],
    });
    expect(materialHash(shuffled)).toBe(materialHash(original));
  });

  it("přepsaná id možností (pořadí i pojmenování)", () => {
    const original = parse(single);
    const renamed = parse({
      ...single,
      choices: [
        { id: "x3", text: "Relace $\\{(1,2),(2,3)\\}$" },
        { id: "x1", text: "Identita" },
        { id: "x2", text: "Prázdná relace" },
      ],
      correct: "x1",
    });
    expect(materialHash(renamed)).toBe(materialHash(original));
  });

  it("přepsané vysvětlení, nápověda, feedback, štítky, obtížnost a status", () => {
    const original = parse(single);
    const edited = parse({
      ...single,
      explanation: "Úplně jiné vysvětlení, opravený překlep.",
      hint: "Jiná nápověda.",
      difficulty: 5,
      tags: ["relace", "tranzitivita"],
      status: "reviewed",
      choices: single.choices.map((choice) => ({ ...choice, feedback: "jiná zpětná vazba" })),
    });
    expect(materialHash(edited)).toBe(materialHash(original));
  });

  it("přidaný obrázek k zadání", () => {
    const original = parse(single);
    const withFigure = parse({
      ...single,
      figure: { src: "/content/img/idm/relace.png", alt: "Hasseův diagram relace" },
    });
    expect(materialHash(withFigure)).toBe(materialHash(original));
  });

  it("jiné formátování mezer v zadání", () => {
    const original = parse(single);
    const respaced = parse({ ...single, prompt: `  ${single.prompt.replace(/ /g, "\n")}  ` });
    expect(materialHash(respaced)).toBe(materialHash(original));
  });
});

describe("materialHash – co ho MUSÍ změnit", () => {
  it("jiná správná odpověď", () => {
    const original = parse(single);
    const changed = parse({ ...single, correct: "b" });
    expect(materialHash(changed)).not.toBe(materialHash(original));
  });

  it("přepsaný text správné možnosti", () => {
    const original = parse(single);
    const changed = parse({
      ...single,
      choices: [{ ...single.choices[0], text: "Univerzální relace" }, single.choices[1], single.choices[2]],
    });
    expect(materialHash(changed)).not.toBe(materialHash(original));
  });

  it("jiné zadání", () => {
    const original = parse(single);
    const changed = parse({ ...single, prompt: "Která relace je symetrická?" });
    expect(materialHash(changed)).not.toBe(materialHash(original));
  });

  it("přidaný distraktor", () => {
    const original = parse(single);
    const changed = parse({
      ...single,
      choices: [...single.choices, { id: "d", text: "Univerzální relace" }],
    });
    expect(materialHash(changed)).not.toBe(materialHash(original));
  });
});

describe("materialHash u ostatních typů", () => {
  const base = {
    id: "izp-02-poradi",
    prompt: "Seřaď kroky překladu.",
    type: "ordering",
    items: [
      { id: "p", text: "Preprocesor" },
      { id: "c", text: "Kompilace" },
      { id: "l", text: "Linkování" },
    ],
    correctOrder: ["p", "c", "l"],
  };

  it("ordering: přeházené `items` nevadí, přeházené `correctOrder` ano", () => {
    const original = parse(base);
    const reorderedItems = parse({ ...base, items: [base.items[2], base.items[0], base.items[1]] });
    const reorderedAnswer = parse({ ...base, correctOrder: ["c", "p", "l"] });

    expect(materialHash(reorderedItems)).toBe(materialHash(original));
    expect(materialHash(reorderedAnswer)).not.toBe(materialHash(original));
  });

  it("numeric: změna tolerance i jednotky se projeví", () => {
    const numeric = {
      id: "iel-01-napeti",
      type: "numeric",
      prompt: "Jaké je napětí?",
      answer: 12,
      unit: "V",
    };
    const original = parse(numeric);
    expect(materialHash(parse({ ...numeric, answer: 24 }))).not.toBe(materialHash(original));
    expect(materialHash(parse({ ...numeric, unit: "mV" }))).not.toBe(materialHash(original));
    expect(
      materialHash(parse({ ...numeric, tolerance: { kind: "relative", value: 0.05 } })),
    ).not.toBe(materialHash(original));
  });

  it("shortText: pořadí uznávaných odpovědí nevadí, přidaná odpověď ano", () => {
    const shortText = {
      id: "idm-01-hodnost",
      type: "shortText",
      prompt: "Jak se jmenuje počet lineárně nezávislých řádků matice?",
      accept: ["hodnost", "rank"],
    };
    const original = parse(shortText);
    expect(materialHash(parse({ ...shortText, accept: ["rank", "hodnost"] }))).toBe(
      materialHash(original),
    );
    expect(materialHash(parse({ ...shortText, accept: ["hodnost"] }))).not.toBe(
      materialHash(original),
    );
  });

  it("codeOutput: velikost písmen ve zdrojáku se NEZAHAZUJE", () => {
    const code = {
      id: "izp-04-vystup",
      type: "codeOutput",
      prompt: "Co program vypíše?",
      language: "c",
      source: 'printf("a");',
      expected: "a",
    };
    const original = parse(code);
    expect(materialHash(parse({ ...code, source: 'PRINTF("a");' }))).not.toBe(
      materialHash(original),
    );
    expect(materialHash(parse({ ...code, expected: "A" }))).not.toBe(materialHash(original));
  });
});

describe("contentHash", () => {
  it("se na rozdíl od materialHash změní i po opravě vysvětlení", () => {
    const original = parse(single);
    const edited = parse({ ...single, explanation: "Opravený překlep ve vysvětlení." });

    expect(materialHash(edited)).toBe(materialHash(original));
    expect(contentHash(edited)).not.toBe(contentHash(original));
  });

  it("nezávisí na pořadí klíčů v souboru", () => {
    const original = parse(single);
    const reordered = parse(Object.fromEntries(Object.entries(single).reverse()));
    expect(contentHash(reordered)).toBe(contentHash(original));
  });
});
