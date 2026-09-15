/**
 * Jediné pravidlo, které rozhoduje, kdo si smí založit účet:
 * e-mail musí patřit do domény VUT.
 *
 * Schválně je to samostatný soubor bez závislostí – pravidlo běží
 * na klientovi (rychlá zpětná vazba u políčka), na serveru v hooku
 * Better Auth (skutečná obrana) a v testech. Všude stejná funkce,
 * aby se tři různé implementace nemohly rozejít.
 */

/** Základní domény VUT. Povolené jsou i jejich libovolné subdomény. */
export const VUT_DOMAINS = ["vut.cz", "vutbr.cz"] as const;

/**
 * Patří adresa do domény VUT?
 *
 * Porovnává se doména za POSLEDNÍM zavináčem – jinak by `a@evil.com@vut.cz`
 * nebo naopak `x@vut.cz.evil.com` prošly. Shoda musí být buď přesná,
 * nebo oddělená tečkou (`stud.fit.vut.cz`), takže `notvut.cz` neprojde.
 */
export function isVutEmail(email: string): boolean {
  if (typeof email !== "string") return false;

  const trimmed = email.trim();
  if (trimmed.length === 0) return false;

  // Víc zavináčů = neplatná adresa. Nechceme hádat, který z nich je ten pravý.
  const atCount = trimmed.split("@").length - 1;
  if (atCount !== 1) return false;

  const at = trimmed.lastIndexOf("@");
  const local = trimmed.slice(0, at);
  if (local.length === 0) return false;

  // Bílé znaky uvnitř adresy neřešíme jako "skoro platné" – prostě neprojdou.
  if (/\s/.test(trimmed)) return false;

  const domain = trimmed.slice(at + 1).toLowerCase();
  if (domain.length === 0) return false;

  return VUT_DOMAINS.some(
    (base) => domain === base || domain.endsWith(`.${base}`),
  );
}

/** Česká hláška vysvětlující pravidlo. Stejný text u políčka i v chybě. */
export function vutEmailError(): string {
  return "Zaregistrovat se dá jen školním e-mailem z domény vut.cz nebo vutbr.cz — například xnovak00@stud.fit.vut.cz.";
}
