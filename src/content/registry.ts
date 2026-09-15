/**
 * Lehký index obsahu pro klienta.
 *
 * Klient občas potřebuje jen vědět, kam otázka patří a jaký má materialHash –
 * třeba když z IndexedDB vytáhne stav učení a chce zjistit, jestli se otázka
 * mezitím nezměnila. Tahat kvůli tomu celý obsah by bylo o dva řády víc dat.
 *
 * Tenhle soubor schválně NEIMPORTUJE nic z `node:fs` (typy z loaderu jdou
 * přes `import type`, které se při buildu zahodí), takže se dá bez obav
 * importovat i v klientské komponentě. Data se staví na serveru a předají
 * přes props – proto jsou to prosté objekty, ne `Map`.
 */
import type { CourseCode } from "./schema";
import type { LoadedQuestion, LoadedSet } from "./loader";

/** Co si o otázce pamatuje index. */
export interface RegistryEntry {
  setId: string;
  course: CourseCode;
  materialHash: string;
}

export interface ContentRegistry {
  /** questionId → kam patří a jaký má materiální otisk. */
  questions: Record<string, RegistryEntry>;
  /** Dřívější id → aktuální id. Díky tomu přežije historie přejmenování otázky. */
  formerIds: Record<string, string>;
}

/** Prázdný index – použitelný jako výchozí hodnota, než se data načtou. */
export const EMPTY_REGISTRY: ContentRegistry = { questions: {}, formerIds: {} };

/**
 * Postaví index z načtených sad (typicky `loadAllSets()` na serveru).
 * Bere sady i holé otázky, ať to jde použít i pro jeden předmět.
 */
export function buildRegistry(
  data: readonly LoadedSet[] | readonly LoadedQuestion[],
): ContentRegistry {
  const questions: Record<string, RegistryEntry> = {};
  const formerIds: Record<string, string> = {};

  const all: LoadedQuestion[] = data.flatMap((item) =>
    "questions" in item ? item.questions : [item],
  );

  for (const question of all) {
    questions[question.id] = {
      setId: question.setId,
      course: question.course,
      materialHash: question.materialHash,
    };
    for (const formerId of question.formerIds) {
      // Živé id vyhrává – kdyby se někdo přepsal, radši ukážeme existující otázku.
      if (!(formerId in questions) && !(formerId in formerIds)) {
        formerIds[formerId] = question.id;
      }
    }
  }

  return { questions, formerIds };
}

/** Přeloží libovolné (i dřívější) id na aktuální. Vrací `undefined`, když otázka zmizela. */
export function resolveQuestionId(
  registry: ContentRegistry,
  questionId: string,
): string | undefined {
  if (questionId in registry.questions) return questionId;
  return registry.formerIds[questionId];
}

/** Záznam o otázce, i když přijde pod starým id. */
export function lookupQuestion(
  registry: ContentRegistry,
  questionId: string,
): RegistryEntry | undefined {
  const id = resolveQuestionId(registry, questionId);
  return id === undefined ? undefined : registry.questions[id];
}

/**
 * Změnil se význam otázky od poslední odpovědi?
 * `true` znamená, že uložený stav učení je k zahození.
 */
export function isStale(
  registry: ContentRegistry,
  questionId: string,
  knownMaterialHash: string,
): boolean {
  const entry = lookupQuestion(registry, questionId);
  return entry === undefined ? false : entry.materialHash !== knownMaterialHash;
}

/** Počty pro rychlý přehled – hodí se do logu při buildu. */
export function registrySize(registry: ContentRegistry): { questions: number; formerIds: number } {
  return {
    questions: Object.keys(registry.questions).length,
    formerIds: Object.keys(registry.formerIds).length,
  };
}
