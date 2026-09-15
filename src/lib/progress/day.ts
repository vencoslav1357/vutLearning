/**
 * Práce s dny pro streak a graf aktivity.
 *
 * Všechno je v LOKÁLNÍM čase uživatele, ne v UTC. Kdyby se den lámal
 * podle UTC, studentovi v Brně by se půlnoc posouvala podle ročního období
 * a série by se trhala uprostřed večerního učení.
 */

export const MS_PER_DAY = 86_400_000;

/** Klíč dne ve tvaru "YYYY-MM-DD" (lokální čas). */
export type DayKey = string;

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Převede unix ms nebo Date na klíč dne v lokálním čase. */
export function toDayKey(at: number | Date = Date.now()): DayKey {
  const d = at instanceof Date ? at : new Date(at);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Dnešek jako klíč dne. */
export function todayKey(now: number = Date.now()): DayKey {
  return toDayKey(now);
}

export function isValidDayKey(day: string): boolean {
  if (!DAY_KEY_RE.test(day)) return false;
  const d = dayKeyToDate(day);
  return !Number.isNaN(d.getTime()) && toDayKey(d) === day;
}

/**
 * Klíč dne na Date v lokálním poledni.
 * Poledne, ne půlnoc: při přechodu na letní čas se půlnoc v některých
 * zemích přeskakuje a datum by se posunulo o den.
 */
function dayKeyToDate(day: DayKey): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

/** Lokální půlnoc daného dne jako unix ms. */
export function dayKeyToMs(day: DayKey): number {
  const d = dayKeyToDate(day);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Začátek dne, do kterého spadá daný okamžik (lokální půlnoc, unix ms). */
export function startOfDay(at: number = Date.now()): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Posun o `delta` dní (může být záporný). */
export function addDays(day: DayKey, delta: number): DayKey {
  const d = dayKeyToDate(day);
  d.setDate(d.getDate() + delta);
  return toDayKey(d);
}

/** Rozdíl `a - b` ve dnech. Kladné číslo = `a` je později. */
export function dayDiff(a: DayKey, b: DayKey): number {
  return Math.round((dayKeyToDate(a).getTime() - dayKeyToDate(b).getTime()) / MS_PER_DAY);
}

/** Souvislá řada dnů od `from` do `to` včetně. */
export function enumerateDays(from: DayKey, to: DayKey): DayKey[] {
  const span = dayDiff(to, from);
  if (span < 0) return [];
  const out: DayKey[] = [];
  for (let i = 0; i <= span; i += 1) out.push(addDays(from, i));
  return out;
}

/** Jsou to dva po sobě jdoucí dny? (`later` je den po `earlier`) */
export function isNextDay(earlier: DayKey, later: DayKey): boolean {
  return dayDiff(later, earlier) === 1;
}
