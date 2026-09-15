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
