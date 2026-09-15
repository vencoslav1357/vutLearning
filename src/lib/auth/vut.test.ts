import { describe, expect, it } from "vitest";
import { isVutEmail, vutEmailError, VUT_DOMAINS } from "./vut";

describe("isVutEmail – co má projít", () => {
  it.each([
    "x@vut.cz",
    "x@vutbr.cz",
    "x@stud.fit.vut.cz",
    "x@fit.vut.cz",
    "x@fekt.vut.cz",
    "xnovak00@stud.fit.vut.cz",
    "jmeno.prijmeni@stud.fekt.vutbr.cz",
    "a.b+c@vut.cz",
  ])("povolí %s", (email) => {
    expect(isVutEmail(email)).toBe(true);
  });

  it("nerozlišuje velikost písmen", () => {
    expect(isVutEmail("x@VUT.CZ")).toBe(true);
    expect(isVutEmail("X@Stud.FIT.VutBr.Cz")).toBe(true);
  });

  it("toleruje mezery okolo adresy", () => {
    expect(isVutEmail("x@vut.cz ")).toBe(true);
    expect(isVutEmail("  x@vut.cz")).toBe(true);
    expect(isVutEmail("\tx@stud.fit.vut.cz\n")).toBe(true);
  });
});

describe("isVutEmail – co musí spadnout", () => {
  it("odmítne doménu, která se jen podobá", () => {
    // Tohle je ten nejpravděpodobnější pokus o obejití: útočník si
    // zaregistruje vut.cz.evil.com a pošle adresu, která "končí na vut.cz".
    expect(isVutEmail("x@vut.cz.evil.com")).toBe(false);
    expect(isVutEmail("x@vutbr.cz.evil.com")).toBe(false);
    expect(isVutEmail("x@evil.com")).toBe(false);
  });

  it("vyžaduje hranici na tečce, ne jen sufix", () => {
    expect(isVutEmail("x@notvut.cz")).toBe(false);
    expect(isVutEmail("x@nevut.cz")).toBe(false);
    expect(isVutEmail("x@myvutbr.cz")).toBe(false);
  });

  it("odmítne víc zavináčů", () => {
    expect(isVutEmail("a@evil.com@vut.cz")).toBe(false);
    expect(isVutEmail("a@vut.cz@evil.com")).toBe(false);
    expect(isVutEmail("@@vut.cz")).toBe(false);
  });

  it("odmítne prázdné a neúplné vstupy", () => {
    expect(isVutEmail("")).toBe(false);
    expect(isVutEmail("   ")).toBe(false);
    expect(isVutEmail("vut.cz")).toBe(false);
    expect(isVutEmail("@vut.cz")).toBe(false);
    expect(isVutEmail("x@")).toBe(false);
  });

  it("odmítne mezery uvnitř adresy", () => {
    expect(isVutEmail("x y@vut.cz")).toBe(false);
    expect(isVutEmail("x@vut .cz")).toBe(false);
  });

  it("nespadne na jiném než řetězcovém vstupu", () => {
    // Na server chodí JSON – `email` klidně přijde jako číslo nebo null.
    expect(isVutEmail(undefined as unknown as string)).toBe(false);
    expect(isVutEmail(null as unknown as string)).toBe(false);
    expect(isVutEmail(42 as unknown as string)).toBe(false);
  });
});

describe("vutEmailError", () => {
  it("vysvětlí obě povolené domény a ukáže příklad", () => {
    const text = vutEmailError();
    for (const domain of VUT_DOMAINS) {
      expect(text).toContain(domain);
    }
    expect(text).toContain("@stud.fit.vut.cz");
  });
});
