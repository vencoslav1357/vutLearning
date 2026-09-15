/**
 * Normalizace volně psaných odpovědí.
 *
 * Pravidla přesně kopírují `TextNormalization` ze `src/content/schema.ts`.
 * Rozhraní je tu schválně vlastní (a s nepovinnými poli), aby se dalo volat
 * i s částečnou konfigurací a aby lib nemusela za běhu tahat zod.
 */

export interface NormalizeOptions {
  /** Ignorovat velikost písmen. Výchozí: true. */
  caseInsensitive?: boolean;
  /** Ignorovat diakritiku. Výchozí: true. */
  stripDiacritics?: boolean;
  /** Oříznout mezery na krajích. Výchozí: true. */
  trim?: boolean;
  /** Více mezer uvnitř brát jako jednu. Výchozí: true. */
  collapseWhitespace?: boolean;
  /**
   * Zahodit veškerou interpunkci. Výchozí: FALSE.
   * Zapínej jen vědomě – rozbije odpovědi jako `O(n log n)` nebo `a[i]`.
   */
  stripPunctuation?: boolean;
}

export const DEFAULT_NORMALIZATION: Required<NormalizeOptions> = {
  caseInsensitive: true,
  stripDiacritics: true,
  trim: true,
  collapseWhitespace: true,
  stripPunctuation: false,
};

/** Všechny mezerovité znaky včetně nedělitelných – ty se z klávesnice snadno připletou. */
const WHITESPACE = /[\s\u200B\uFEFF]+/g;

/**
 * Převede text do tvaru, ve kterém se porovnává se seznamem `accept`.
 * Stejnou funkcí musí projít odpověď uživatele i každá uznávaná varianta,
 * jinak by porovnání bylo asymetrické.
 */
export function normalizeText(input: string, opts: NormalizeOptions = {}): string {
  const o = { ...DEFAULT_NORMALIZATION, ...opts };
  let s = input;

  if (o.caseInsensitive) s = s.toLowerCase();

  if (o.stripDiacritics) {
    // NFD rozloží "č" na "c" + háček, pak se háček zahodí jako kombinační znak.
    s = s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  }

  if (o.stripPunctuation) s = s.replace(/\p{P}/gu, "");

  // Sjednocení mezer až po interpunkci – jinak by po jejím odstranění
  // zůstaly ve slově dvojité mezery.
  if (o.collapseWhitespace) s = s.replace(WHITESPACE, " ");

  if (o.trim) s = s.trim();

  return s;
}

/**
 * Sedí odpověď na některou z uznávaných variant?
 * Normalizuje obě strany stejnými pravidly.
 */
export function matchesAccepted(
  input: string,
  accept: readonly string[],
  opts: NormalizeOptions = {},
): boolean {
  const needle = normalizeText(input, opts);
  if (needle === "") return false;
  return accept.some((candidate) => normalizeText(candidate, opts) === needle);
}
