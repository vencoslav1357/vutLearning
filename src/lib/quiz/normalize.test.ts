import { describe, expect, it } from "vitest";
import { matchesAccepted, normalizeText } from "./normalize";

describe("normalizeText", () => {
  it("ve výchozím nastavení sjednotí velikost písmen, diakritiku i mezery", () => {
    expect(normalizeText("  Hodnost   MATICE ")).toBe("hodnost matice");
    expect(normalizeText("Přímý součin")).toBe("primy soucin");
  });

  it("nechá interpunkci na pokoji, dokud si o to autor neřekne", () => {
    expect(normalizeText("O(n log n)")).toBe("o(n log n)");
    expect(normalizeText("a[i]")).toBe("a[i]");
    expect(normalizeText("O(n log n)", { stripPunctuation: true })).toBe("on log n");
  });

  it("respektuje vypnutí jednotlivých pravidel", () => {
    expect(normalizeText("Čára", { caseInsensitive: false, stripDiacritics: false })).toBe("Čára");
    expect(normalizeText("  x  ", { trim: false, collapseWhitespace: false })).toBe("  x  ");
    expect(normalizeText("a   b", { collapseWhitespace: false })).toBe("a   b");
  });

  it("srovná i nedělitelnou a nulovou mezeru (copy-paste z PDF)", () => {
    expect(normalizeText("a\u00A0b")).toBe("a b");
    expect(normalizeText("a\u200Bb")).toBe("a b");
    expect(normalizeText("a\u2009\u202Fb")).toBe("a b");
  });

  it("zvládne prázdný vstup", () => {
    expect(normalizeText("")).toBe("");
    expect(normalizeText("   ")).toBe("");
  });

  it("odstraní i diakritiku navíc, kterou uživatel napsal omylem", () => {
    // "hodnóst" se po odstranění diakritiky shoduje s "hodnost".
    expect(normalizeText("hodnóst")).toBe(normalizeText("hodnost"));
  });
});

describe("matchesAccepted", () => {
  it("normalizuje obě strany porovnání", () => {
    expect(matchesAccepted(" HODNOST ", ["hodnost", "rank"])).toBe(true);
    expect(matchesAccepted("Rank", ["hodnost", "rank"])).toBe(true);
    expect(matchesAccepted("determinant", ["hodnost", "rank"])).toBe(false);
  });

  it("prázdná odpověď neprojde nikdy", () => {
    expect(matchesAccepted("", [""])).toBe(false);
    expect(matchesAccepted("   ", ["hodnost"])).toBe(false);
  });

  it("umí i varianty s diakritikou v předloze", () => {
    expect(matchesAccepted("prevodnik", ["převodník"])).toBe(true);
  });
});
