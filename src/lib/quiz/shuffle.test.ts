import { describe, expect, it } from "vitest";
import {
  makeSeed,
  mulberry32,
  seededShuffle,
  shuffleAwayFrom,
  shuffleChoices,
  shuffleQuestions,
} from "./shuffle";

const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];

describe("makeSeed", () => {
  it("je stabilní pro stejné vstupy", () => {
    expect(makeSeed("idm-03-relace", "session-1")).toBe(makeSeed("idm-03-relace", "session-1"));
  });

  it("dá jiné číslo pro jinou session", () => {
    expect(makeSeed("q", "s1")).not.toBe(makeSeed("q", "s2"));
  });

  it("vrací nezáporné 32bitové číslo", () => {
    for (const part of ["a", "zzzz", "ěščřžýáíé", "123456789"]) {
      const seed = makeSeed(part);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
      expect(Number.isInteger(seed)).toBe(true);
    }
  });
});

describe("mulberry32", () => {
  it("dává čísla z intervalu <0, 1)", () => {
    const rnd = mulberry32(12345);
    for (let i = 0; i < 500; i++) {
      const value = rnd();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("je deterministický", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("seededShuffle", () => {
  it("stejný seed → stejné pořadí (i po mnoha voláních)", () => {
    const seed = makeSeed("q1", "s1");
    const first = seededShuffle(ids, seed);
    for (let i = 0; i < 20; i++) {
      expect(seededShuffle(ids, seed)).toEqual(first);
    }
  });

  it("jiný seed → skoro vždy jiné pořadí", () => {
    const variants = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      variants.add(seededShuffle(ids, seed).join(""));
    }
    // 8 prvků má 40320 permutací; 40 seedů se nesmí slít do pár variant.
    expect(variants.size).toBeGreaterThan(30);
  });

  it("zachová všechny prvky, žádný nepřidá ani neztratí", () => {
    const out = seededShuffle(ids, 99);
    expect(out.slice().sort()).toEqual(ids.slice().sort());
  });

  it("nemění vstupní pole", () => {
    const input = [...ids];
    seededShuffle(input, 5);
    expect(input).toEqual(ids);
  });

  it("nespadne na prázdném a jednoprvkovém poli", () => {
    expect(seededShuffle([], 1)).toEqual([]);
    expect(seededShuffle(["x"], 1)).toEqual(["x"]);
  });
});

describe("shuffleChoices", () => {
  const choices = [
    { id: "a" },
    { id: "b" },
    { id: "c" },
    { id: "d" },
    { id: "zadna", pin: "last" as const },
    { id: "vsechny", pin: "first" as const },
  ];

  it("připnuté možnosti zůstanou na kraji", () => {
    for (let seed = 0; seed < 50; seed++) {
      const out = shuffleChoices(choices, seed);
      expect(out[0]!.id).toBe("vsechny");
      expect(out[out.length - 1]!.id).toBe("zadna");
      expect(out).toHaveLength(choices.length);
    }
  });

  it("míchá jen nepřipnutý zbytek", () => {
    const variants = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      variants.add(
        shuffleChoices(choices, seed)
          .map((c) => c.id)
          .join(""),
      );
    }
    expect(variants.size).toBeGreaterThan(5);
  });

  it("je deterministický", () => {
    expect(shuffleChoices(choices, 42)).toEqual(shuffleChoices(choices, 42));
  });

  it("zvládne prázdný seznam i samé připnuté", () => {
    expect(shuffleChoices([], 1)).toEqual([]);
    const allPinned = [{ id: "a", pin: "first" as const }, { id: "b", pin: "last" as const }];
    expect(shuffleChoices(allPinned, 3).map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("shuffleQuestions", () => {
  it("je deterministický a nic neztratí", () => {
    const out = shuffleQuestions(ids, 11);
    expect(out).toEqual(shuffleQuestions(ids, 11));
    expect(out.slice().sort()).toEqual(ids.slice().sort());
  });
});

/**
 * Seed jednoho běhu vzniká jako `makeSeed(čas připojení, pořadí běhu)`.
 * Tohle je přesně ta vlastnost, která chyběla, když „Znovu" přehrálo
 * identickou sérii: druhý běh z téhož připojení musí zamíchat jinak.
 */
describe("seed běhu", () => {
  const START = 1_758_000_000_000;
  const runSeed = (now: number, run: number) => makeSeed(now, run);
  const six = ["a", "b", "c", "d", "e", "f"];

  it("stejný čas i pořadí běhu → stejné pořadí", () => {
    expect(seededShuffle(ids, runSeed(START, 2))).toEqual(seededShuffle(ids, runSeed(START, 2)));
  });

  it("každý další běh z téhož připojení zamíchá jinak", () => {
    let repeated = 0;
    let compared = 0;
    // Rozházené časy startu, ať se netestuje jeden šťastný případ.
    for (let t = 0; t < 200; t++) {
      const now = START + t * 7919;
      const orders = [0, 1, 2, 3].map((run) => seededShuffle(ids, runSeed(now, run)).join(""));
      for (let i = 1; i < orders.length; i++) {
        compared++;
        if (orders[i] === orders[i - 1]) repeated++;
      }
    }
    expect(compared).toBe(600);
    expect(repeated).toBe(0);
  });

  it("i u šesti prvků se sousední běhy liší", () => {
    let repeated = 0;
    for (let run = 0; run < 200; run++) {
      const a = seededShuffle(six, runSeed(START, run)).join("");
      const b = seededShuffle(six, runSeed(START, run + 1)).join("");
      if (a === b) repeated++;
    }
    // 6 prvků má 720 permutací – pár náhodných shod je v normě, série ne.
    expect(repeated).toBeLessThan(5);
  });

  it("dvě spuštění v sousedních milisekundách zamíchají jinak", () => {
    let repeated = 0;
    for (let t = 0; t < 200; t++) {
      const a = seededShuffle(ids, runSeed(START + t, 0)).join("");
      const b = seededShuffle(ids, runSeed(START + t + 1, 0)).join("");
      if (a === b) repeated++;
    }
    expect(repeated).toBe(0);
  });

  it("mezi běhy se přeskládají i možnosti jedné otázky", () => {
    const choices = six.map((id) => ({ id }));
    const variants = new Set<string>();
    for (let run = 0; run < 40; run++) {
      // Stejně jako v QuizRunneru: seed otázky = id otázky + seed běhu.
      const seed = makeSeed("idm-01-tautologie", runSeed(START, run));
      variants.add(
        shuffleChoices(choices, seed)
          .map((c) => c.id)
          .join(""),
      );
    }
    expect(variants.size).toBeGreaterThan(20);
  });

  it("připnuté možnosti drží kraj i při novém běhu", () => {
    const choices = [
      { id: "a" },
      { id: "b" },
      { id: "c" },
      { id: "d" },
      { id: "vsechny", pin: "first" as const },
      { id: "zadna", pin: "last" as const },
    ];
    for (let run = 0; run < 50; run++) {
      const seed = makeSeed("q", runSeed(START, run));
      const out = shuffleChoices(choices, seed).map((c) => c.id);
      expect(out[0]).toBe("vsechny");
      expect(out[out.length - 1]).toBe("zadna");
      expect(out).toHaveLength(choices.length);
    }
  });
});

describe("shuffleAwayFrom", () => {
  it("nikdy nevrátí rovnou správné pořadí", () => {
    const items = ["a", "b", "c"];
    for (let seed = 0; seed < 300; seed++) {
      expect(shuffleAwayFrom(items, items, seed).join("")).not.toBe("abc");
    }
  });

  it("je deterministický", () => {
    const items = ["a", "b", "c", "d"];
    expect(shuffleAwayFrom(items, ["d", "c", "b", "a"], 8)).toEqual(
      shuffleAwayFrom(items, ["d", "c", "b", "a"], 8),
    );
  });

  it("nespadne na jednoprvkovém poli", () => {
    expect(shuffleAwayFrom(["a"], ["a"], 1)).toEqual(["a"]);
    expect(shuffleAwayFrom([], [], 1)).toEqual([]);
  });
});
