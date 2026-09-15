/**
 * Načítání obsahu z disku.
 *
 * POZOR: jen pro Server Components a skripty. Sahá na `node:fs`, takže
 * v klientské komponentě to spadne už při buildu. Klient dostává buď
 * hotová data z props, nebo lehký index z `registry.ts`.
 *
 * Všechno je zabalené v `React.cache`, aby se při jednom requestu
 * nečetly stejné soubory dvakrát. Mimo React (ve skriptech) se `cache`
 * chová jako průhledná obálka a prostě zavolá funkci.
 */
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { z } from "zod";
import { COURSE_CODES, Course, CourseCode, Question, QuestionSet } from "./schema";
import { contentHash, materialHash } from "./hash";

/* ------------------------------------------------------------------ */
/* Typy                                                                */
/* ------------------------------------------------------------------ */

/**
 * Otázka obohacená o to, co aplikace potřebuje při ukládání pokusu:
 * oba otisky a informaci, odkud otázka je.
 */
export type LoadedQuestion = Question & {
  /** Otisk polí, která rozhodují o správné odpovědi. Do `AttemptRecord`. */
  materialHash: string;
  /** Otisk celé otázky – invalidace cache renderu. */
  contentHash: string;
  setId: string;
  course: CourseCode;
};

/** Sada, jejíž otázky jsou `LoadedQuestion`. */
export type LoadedSet = Omit<QuestionSet, "questions"> & {
  questions: LoadedQuestion[];
};

/** Kde otázka bydlí. Návratová hodnota `findQuestion`. */
export interface QuestionLocation {
  question: LoadedQuestion;
  set: LoadedSet;
  course: Course;
}

/** Chyba v obsahu – vždy říká, ve kterém souboru a v jakém poli. */
export class ContentError extends Error {
  constructor(
    readonly file: string,
    message: string,
  ) {
    super(message);
    this.name = "ContentError";
  }
}

/* ------------------------------------------------------------------ */
/* Čtení souborů                                                       */
/* ------------------------------------------------------------------ */

function contentDir(): string {
  return path.join(process.cwd(), "content");
}

/** Zod cestu k poli přeložíme na něco, co se dá vyhledat v souboru. */
function formatIssuePath(issuePath: readonly PropertyKey[]): string {
  if (issuePath.length === 0) return "(kořen souboru)";
  return issuePath
    .map((segment) => (typeof segment === "number" ? `[${segment}]` : String(segment)))
    .join(".")
    .replace(/\.\[/g, "[");
}

function readJson(file: string): unknown {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (error) {
    throw new ContentError(file, `Soubor nejde přečíst: ${(error as Error).message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new ContentError(file, `Neplatný JSON: ${(error as Error).message}`);
  }
}

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, file: string): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const details = result.error.issues
    .map((issue) => `  • ${formatIssuePath(issue.path)}: ${issue.message}`)
    .join("\n");
  throw new ContentError(file, `Obsah neodpovídá schématu:\n${details}`);
}

/** Adresáře v content/, které odpovídají známému kódu předmětu. */
function courseDirs(): CourseCode[] {
  const root = contentDir();
  if (!fs.existsSync(root)) return [];

  const known = new Set<string>(COURSE_CODES);
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && known.has(entry.name))
    .map((entry) => entry.name as CourseCode);
}

/* ------------------------------------------------------------------ */
/* Předměty                                                            */
/* ------------------------------------------------------------------ */

const SEMESTER_ORDER = { zimni: 0, letni: 1 } as const;

/** Všechny předměty: nejdřív zimní, pak letní, uvnitř abecedně podle zkratky. */
export const loadCourses = cache((): Course[] => {
  const courses: Course[] = [];

  for (const code of courseDirs()) {
    const file = path.join(contentDir(), code, "course.json");
    if (!fs.existsSync(file)) continue;

    const course = parseOrThrow(Course, readJson(file), file);
    if (course.code !== code) {
      throw new ContentError(file, `Pole "code" je "${course.code}", ale soubor leží v content/${code}/.`);
    }
    courses.push(course);
  }

  return courses.sort(
    (a, b) =>
      SEMESTER_ORDER[a.semester] - SEMESTER_ORDER[b.semester] ||
      a.abbr.localeCompare(b.abbr, "cs"),
  );
});

export const loadCourse = cache((code: string): Course | undefined =>
  loadCourses().find((course) => course.code === code),
);

/* ------------------------------------------------------------------ */
/* Sady otázek                                                         */
/* ------------------------------------------------------------------ */

function enrich(set: QuestionSet): LoadedSet {
  return {
    ...set,
    questions: set.questions.map((question) => ({
      ...question,
      materialHash: materialHash(question),
      contentHash: contentHash(question),
      setId: set.id,
      course: set.course,
    })),
  };
}

/** Sady jednoho předmětu, seřazené podle čísla přednášky a pak podle id. */
export const loadSets = cache((course: string): LoadedSet[] => {
  const dir = path.join(contentDir(), course);
  if (!fs.existsSync(dir)) return [];

  const sets = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".questions.json"))
    .sort()
    .map((name) => {
      const file = path.join(dir, name);
      const parsed = parseOrThrow(QuestionSet, readJson(file), file);
      if (parsed.course !== course) {
        throw new ContentError(file, `Pole "course" je "${parsed.course}", ale soubor leží v content/${course}/.`);
      }
      return enrich(parsed);
    });

  // Sady bez čísla přednášky patří na konec, ne na začátek.
  return sets.sort((a, b) => {
    const lectureA = a.lecture ?? Number.MAX_SAFE_INTEGER;
    const lectureB = b.lecture ?? Number.MAX_SAFE_INTEGER;
    return lectureA - lectureB || a.id.localeCompare(b.id, "cs");
  });
});

export const loadSet = cache((course: string, setId: string): LoadedSet | undefined =>
  loadSets(course).find((set) => set.id === setId),
);

/** Všechny sady napříč předměty, v pořadí předmětů a pak sad. */
export const loadAllSets = cache((): LoadedSet[] =>
  loadCourses().flatMap((course) => loadSets(course.code)),
);

/* ------------------------------------------------------------------ */
/* Hledání otázek                                                      */
/* ------------------------------------------------------------------ */

/**
 * Index přes živá i dřívější id. Staví se jednou za request, protože
 * `findQuestion` volá typicky režim "chyby" pro desítky otázek naráz.
 */
const questionIndex = cache((): Map<string, QuestionLocation> => {
  const index = new Map<string, QuestionLocation>();

  for (const course of loadCourses()) {
    for (const set of loadSets(course.code)) {
      for (const question of set.questions) {
        const location: QuestionLocation = { question, set, course };
        index.set(question.id, location);
        // Živé id má vždy přednost před cizím formerId.
        for (const formerId of question.formerIds) {
          if (!index.has(formerId)) index.set(formerId, location);
        }
      }
    }
  }

  return index;
});

/** Najde otázku podle aktuálního id nebo podle některého z `formerIds`. */
export const findQuestion = cache((questionId: string): QuestionLocation | undefined =>
  questionIndex().get(questionId),
);

/**
 * Otázky podle seznamu id – pro režimy "chyby" a "trénink".
 * Zachovává pořadí vstupu, neznámá id přeskočí a duplicity zahodí
 * (dvě id mohou po přejmenování ukazovat na tutéž otázku).
 */
export const loadQuestionsByIds = cache((ids: readonly string[]): LoadedQuestion[] => {
  const index = questionIndex();
  const seen = new Set<string>();
  const questions: LoadedQuestion[] = [];

  for (const id of ids) {
    const found = index.get(id);
    if (!found || seen.has(found.question.id)) continue;
    seen.add(found.question.id);
    questions.push(found.question);
  }

  return questions;
});

/** Všechny otázky napříč repem – pro statistiky a skripty. */
export const loadAllQuestions = cache((): LoadedQuestion[] =>
  loadAllSets().flatMap((set) => set.questions),
);
