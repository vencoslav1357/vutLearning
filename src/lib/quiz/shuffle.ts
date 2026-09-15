/**
 * Deterministické míchání pořadí.
 *
 * Proč ne `Math.random()`: React komponentu překreslí kdykoliv se mu zachce
 * a možnosti by uživateli poskakovaly pod rukama. Seed se odvozuje
 * z `questionId + sessionId`, takže v rámci jedné session je pořadí stabilní,
 * ale při dalším spuštění kvízu vyjde jiné.
 */

/** Cokoliv, co umí být připnuté na kraj seznamu. */
export interface Pinnable {
  pin?: "first" | "last" | undefined;
}

/**
 * Stabilní 32bitový hash vstupů (FNV-1a).
 * Stejné vstupy → stejné číslo, i mezi serverem a prohlížečem.
 */
export function makeSeed(...parts: (string | number)[]): number {
  const input = parts.join("");
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // FNV prime 16777619, násobení po částech kvůli přesnosti 32bitového int.
    hash = Math.imul(hash, 0x01000193);
  }
  // >>> 0 udělá z výsledku nezáporné číslo – seed se nikdy nesmí lišit znaménkem.
  return hash >>> 0;
}

/** mulberry32 – malý, rychlý a plně deterministický generátor. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher–Yates se seedovaným generátorem. Vstupní pole nemění.
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  if (out.length < 2) return out;

  const rnd = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * Zamíchá možnosti, ale respektuje `pin`.
 *
 * Bez tohohle by „žádná z předchozích" skončila uprostřed seznamu
 * a otázka by ztratila smysl. Připnuté možnosti si mezi sebou drží
 * pořadí z předlohy, míchá se jen zbytek.
 */
export function shuffleChoices<T>(choices: readonly T[], seed: number): T[] {
  const first: T[] = [];
  const middle: T[] = [];
  const last: T[] = [];

  for (const choice of choices) {
    // Generikum je schválně bez omezení: `Pinnable` má samá nepovinná pole,
    // takže by ho TypeScript bral jako "weak type" a odmítl položky bez `pin`
    // (levý/pravý sloupec u přiřazování).
    const pin = (choice as Pinnable | null)?.pin;
    if (pin === "first") first.push(choice);
    else if (pin === "last") last.push(choice);
    else middle.push(choice);
  }

  return [...first, ...seededShuffle(middle, seed), ...last];
}

/** Zamíchá pořadí otázek v session. */
export function shuffleQuestions(ids: readonly string[], seed: number): string[] {
  return seededShuffle(ids, seed);
}

/**
 * Zamíchá položky tak, aby výsledek nebyl rovnou správné řešení.
 * Používá se pro výchozí stav otázky typu `ordering` – dostat úlohu
 * už seřazenou je spíš bug než štěstí.
 */
export function shuffleAwayFrom(
  items: readonly string[],
  correctOrder: readonly string[],
  seed: number,
): string[] {
  if (items.length < 2) return items.slice();

  let out = seededShuffle(items, seed);
  // Pár pokusů s posunutým seedem stačí; u 3+ položek je shoda vzácná.
  for (let attempt = 1; attempt <= 4 && sameOrder(out, correctOrder); attempt++) {
    out = seededShuffle(items, (seed + attempt * 0x9e3779b1) >>> 0);
  }
  if (sameOrder(out, correctOrder)) {
    // Poslední záchrana: prohození prvních dvou položek pořadí zaručeně rozbije.
    const swapped = out.slice();
    const tmp = swapped[0]!;
    swapped[0] = swapped[1]!;
    swapped[1] = tmp;
    return swapped;
  }
  return out;
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
