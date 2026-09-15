/**
 * Veřejný vstup do modulu pokroku.
 *
 * Zbytek aplikace ať sahá jen sem a na `@/lib/progress/context`.
 * Přímé importy `local.ts` nebo Dexie mimo tenhle modul znamenají,
 * že se serverová varianta nikdy nedodělá.
 */
export * from "./types";
export {
  LocalProgressStore,
  isIndexedDbAvailable,
  DB_NAME,
  type AttemptHints,
  type ObservableProgressStore,
  type ProgressChangeListener,
  type StorageKind,
} from "./local";
export {
  MS_PER_DAY,
  addDays,
  dayDiff,
  dayKeyToMs,
  enumerateDays,
  isNextDay,
  isValidDayKey,
  startOfDay,
  toDayKey,
  todayKey,
  type DayKey,
} from "./day";

import { LocalProgressStore, type ObservableProgressStore } from "./local";

/**
 * Store je jeden na celou kartu prohlížeče – dvě instance nad stejnou
 * IndexedDB by si navzájem přepisovaly stav otázek.
 */
let instance: ObservableProgressStore | null = null;

/**
 * Vrátí úložiště pokroku.
 *
 * TODO(přihlášení): až bude hotové přihlášení, má se tady vracet
 * `RemoteProgressStore` (server + Neon) pro přihlášeného uživatele a
 * `LocalProgressStore` pro ostatní. Rozhodnutí patří sem, ne do komponent –
 * ty znají jen rozhraní `ProgressStore`.
 *
 * Počítá se s tím, že při přihlášení se lokální data nejdřív vyexportují
 * (`exportAll`) a nahrají na server (`importAll`), aby se pokrok
 * nasbíraný bez účtu neztratil.
 */
export function getProgressStore(): ObservableProgressStore {
  if (!instance) instance = new LocalProgressStore();
  return instance;
}

/** Jen pro testy a odhlášení – zahodí instanci, příště se vytvoří nová. */
export function resetProgressStore(): void {
  instance = null;
}
