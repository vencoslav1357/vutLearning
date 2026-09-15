/**
 * Tvrdá kontrola obsahu. Co neprojde tímhle, se nesmí dostat do buildu.
 *
 * Kontroluje tři vrstvy:
 *   1. Zod schéma (tvar souboru)
 *   2. Křížová pravidla uvnitř otázky, na která Zod nestačí
 *      (odkaz na neexistující id možnosti, mezery v cloze bez odpovědi, …)
 *   3. Pravidla přes celý repozitář (globálně unikátní id otázek)
 *
 * Spouští se z `npm run build`, takže při chybě končí kódem 1.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { COURSE_CODES, Course, Question, QuestionSet } from "../src/content/schema";

/* ------------------------------------------------------------------ */
/* Výstup                                                              */
/* ------------------------------------------------------------------ */

const colorful = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code: string) => (text: string) => (colorful ? `\u001b[${code}m${text}\u001b[0m` : text);
const red = paint("31");
const green = paint("32");
const yellow = paint("33");
const dim = paint("2");
const bold = paint("1");

interface Problem {
  /** Cesta k poli, např. `questions[3].choices[1].id`. */
  field?: string;
  message: string;
}

const problems = new Map<string, Problem[]>();

function report(file: string, message: string, field?: string): void {
  const list = problems.get(file) ?? [];
  list.push({ field, message });
  problems.set(file, list);
}

/* ------------------------------------------------------------------ */
/* Čísla řádků                                                         */
/* ------------------------------------------------------------------ */

/**
 * Projde JSON znak po znaku a zapamatuje si, na kterém řádku začíná
 * hodnota na které cestě. `JSON.parse` tuhle informaci zahazuje a bez ní
 * je hláška "chyba v questions[37].choices[2]" k ničemu.
 *
 * Volá se až na textu, který `JSON.parse` přijal, takže nemusí řešit chyby.
 */
function buildLineIndex(source: string): Map<string, number> {
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") lineStarts.push(i + 1);
  }

  const lineAt = (position: number): number => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (lineStarts[mid]! <= position) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  };

  const index = new Map<string, number>();
  let i = 0;

  const skipSpace = (): void => {
    while (i < source.length && (source[i] === " " || source[i] === "\t" || source[i] === "\n" || source[i] === "\r")) {
      i++;
    }
  };

  const readString = (): string => {
    i++; // úvodní uvozovka
    let raw = "";
    while (i < source.length) {
      const char = source[i]!;
      if (char === "\\") {
        raw += char + (source[i + 1] ?? "");
        i += 2;
        continue;
      }
      i++;
      if (char === '"') break;
      raw += char;
    }
    try {
      return JSON.parse(`"${raw}"`) as string;
    } catch {
      return raw;
    }
  };

  const readValue = (prefix: string): void => {
    skipSpace();
    index.set(prefix, lineAt(i));

    const char = source[i];
    if (char === "{") {
      i++;
      skipSpace();
      if (source[i] === "}") {
        i++;
        return;
      }
      for (;;) {
        skipSpace();
        const key = readString();
        skipSpace();
        i++; // dvojtečka
        readValue(prefix ? `${prefix}.${key}` : key);
        skipSpace();
        if (source[i] === ",") {
          i++;
          continue;
        }
        i++; // zavírací závorka
        return;
      }
    }

    if (char === "[") {
      i++;
      skipSpace();
      if (source[i] === "]") {
        i++;
        return;
      }
      let position = 0;
      for (;;) {
        readValue(`${prefix}[${position}]`);
        position++;
        skipSpace();
        if (source[i] === ",") {
          i++;
          continue;
        }
        i++;
        return;
      }
    }

    if (char === '"') {
      readString();
      return;
    }

    while (i < source.length && !/[\s,\]}]/u.test(source[i]!)) i++;
  };

  readValue("");
  return index;
}

const lineIndexes = new Map<string, Map<string, number>>();

function lineOf(file: string, field?: string): number | undefined {
  if (field === undefined) return undefined;
  const index = lineIndexes.get(file);
  if (!index) return undefined;

  // Když přesná cesta chybí (třeba chybějící pole), zkusíme nejbližší rodiče.
  let probe = field;
  for (;;) {
    const line = index.get(probe);
    if (line !== undefined) return line;
    const cut = Math.max(probe.lastIndexOf("."), probe.lastIndexOf("["));
    if (cut <= 0) return index.get("");
    probe = probe.slice(0, cut);
  }
}

/* ------------------------------------------------------------------ */
/* Pomocné                                                             */
/* ------------------------------------------------------------------ */

const root = process.cwd();
const contentDir = path.join(root, "content");
const publicDir = path.join(root, "public");

function rel(file: string): string {
  return path.relative(root, file);
}

function fieldPath(segments: readonly PropertyKey[]): string {
  let out = "";
  for (const segment of segments) {
    if (typeof segment === "number") out += `[${segment}]`;
    else out += out ? `.${String(segment)}` : String(segment);
  }
  return out;
}

/** Vrátí data, nebo null a rovnou nahlásí, proč to nešlo. */
function readJsonFile(file: string): unknown | null {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (error) {
    report(file, `Soubor nejde přečíst: ${(error as Error).message}`);
    return null;
  }
  try {
    const data: unknown = JSON.parse(raw);
    lineIndexes.set(file, buildLineIndex(raw));
    return data;
  } catch (error) {
    report(file, `Neplatný JSON: ${(error as Error).message}`);
    return null;
  }
}

function parseWithSchema<T>(schema: z.ZodType<T>, data: unknown, file: string): T | null {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    report(file, issue.message, fieldPath(issue.path));
  }
  return null;
}

/** Česká čísla: 1 chyba, 2–4 chyby, 5 chyb. */
function plural(count: number, one: string, few: string, many: string): string {
  const word = count === 1 ? one : count >= 2 && count <= 4 ? few : many;
  return `${count} ${word}`;
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const found = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) found.add(value);
    seen.add(value);
  }
  return [...found];
}

/* ------------------------------------------------------------------ */
/* Obrázky                                                             */
/* ------------------------------------------------------------------ */

const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*(\/[^)\s]+)/gu;

/** Posbírá všechny odkazy na obrázky v otázce – z `figure`, `image` i z markdownu. */
function collectImages(question: unknown, base: string): Array<{ src: string; field: string }> {
  const found: Array<{ src: string; field: string }> = [];

  const walk = (value: unknown, field: string): void => {
    if (typeof value === "string") {
      for (const match of value.matchAll(MARKDOWN_IMAGE)) {
        found.push({ src: match[1]!, field });
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${field}[${index}]`));
      return;
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      for (const [key, child] of Object.entries(record)) {
        const childField = field ? `${field}.${key}` : key;
        // ImageRef: src je cesta, ne markdown.
        if (key === "src" && typeof child === "string") found.push({ src: child, field: childField });
        else walk(child, childField);
      }
    }
  };

  walk(question, base);
  return found;
}

function checkImages(file: string, question: unknown, base: string): void {
  for (const image of collectImages(question, base)) {
    const onDisk = path.join(publicDir, image.src.replace(/^\//u, ""));
    if (!fs.existsSync(onDisk)) {
      report(file, `Obrázek "${image.src}" neexistuje – čekal jsem ho v ${rel(onDisk)}`, image.field);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Křížová pravidla uvnitř otázky                                      */
/* ------------------------------------------------------------------ */

function checkQuestion(file: string, question: Question, base: string): void {
  const say = (message: string, field = base): void => report(file, message, field);

  switch (question.type) {
    case "single": {
      const ids = question.choices.map((choice) => choice.id);
      for (const duplicate of duplicates(ids)) {
        say(`Dvě možnosti mají stejné id "${duplicate}".`, `${base}.choices`);
      }
      if (!ids.includes(question.correct)) {
        say(
          `correct: "${question.correct}" není id žádné možnosti (jsou tu: ${ids.join(", ")}).`,
          `${base}.correct`,
        );
      }
      break;
    }

    case "multi": {
      const ids = question.choices.map((choice) => choice.id);
      for (const duplicate of duplicates(ids)) {
        say(`Dvě možnosti mají stejné id "${duplicate}".`, `${base}.choices`);
      }
      for (const duplicate of duplicates(question.correct)) {
        say(`Id "${duplicate}" je v correct dvakrát.`, `${base}.correct`);
      }
      for (const correct of question.correct) {
        if (!ids.includes(correct)) {
          say(`correct obsahuje "${correct}", což není id žádné možnosti.`, `${base}.correct`);
        }
      }
      if (new Set(question.correct).size >= question.choices.length) {
        say(
          "Správné jsou všechny možnosti – taková otázka nic nezjistí. Přidej distraktor.",
          `${base}.correct`,
        );
      }
      break;
    }

    case "ordering": {
      const ids = question.items.map((item) => item.id);
      for (const duplicate of duplicates(ids)) {
        say(`Dvě položky mají stejné id "${duplicate}".`, `${base}.items`);
      }
      const ordered = [...question.correctOrder].sort();
      const expected = [...ids].sort();
      if (ordered.length !== expected.length || ordered.some((id, index) => id !== expected[index])) {
        say(
          `correctOrder musí obsahovat každé id z items právě jednou. items: [${ids.join(", ")}], correctOrder: [${question.correctOrder.join(", ")}]`,
          `${base}.correctOrder`,
        );
      }
      break;
    }

    case "matching": {
      const leftIds = question.left.map((item) => item.id);
      const rightIds = question.right.map((item) => item.id);
      for (const duplicate of duplicates(leftIds)) {
        say(`Dvě položky vlevo mají stejné id "${duplicate}".`, `${base}.left`);
      }
      for (const duplicate of duplicates(rightIds)) {
        say(`Dvě položky vpravo mají stejné id "${duplicate}".`, `${base}.right`);
      }

      const usedLeft = new Set<string>();
      question.pairs.forEach(([leftId, rightId], index) => {
        const field = `${base}.pairs[${index}]`;
        if (!leftIds.includes(leftId)) say(`"${leftId}" není id žádné položky vlevo.`, field);
        else if (usedLeft.has(leftId)) say(`Položka vlevo "${leftId}" je přiřazená dvakrát.`, field);
        usedLeft.add(leftId);
        if (!rightIds.includes(rightId)) say(`"${rightId}" není id žádné položky vpravo.`, field);
      });

      for (const leftId of leftIds) {
        if (!usedLeft.has(leftId)) {
          say(`Položka vlevo "${leftId}" nemá v pairs protějšek.`, `${base}.pairs`);
        }
      }
      break;
    }

    case "cloze": {
      const inTemplate = new Set(
        [...question.template.matchAll(/\{\{(\d+)\}\}/gu)].map((match) => match[1]!),
      );
      const inBlanks = new Set(Object.keys(question.blanks));

      for (const slot of inTemplate) {
        if (!inBlanks.has(slot)) {
          say(`Mezera {{${slot}}} v template nemá odpovídající klíč v blanks.`, `${base}.blanks`);
        }
      }
      for (const slot of inBlanks) {
        if (!inTemplate.has(slot)) {
          say(`blanks obsahuje klíč "${slot}", ale {{${slot}}} v template není.`, `${base}.blanks.${slot}`);
        }
      }
      break;
    }

    case "codeOutput": {
      if (question.mode === "exact") {
        if (question.expected === undefined || question.expected.length === 0) {
          say('mode: "exact" vyžaduje neprázdné pole expected.', `${base}.expected`);
        }
        if (question.choices) {
          say('mode: "exact" a zároveň choices – jedno z toho je navíc.', `${base}.choices`);
        }
      } else {
        if (!question.choices) {
          say('mode: "choice" vyžaduje pole choices.', `${base}.choices`);
        }
        if (question.correct === undefined) {
          say('mode: "choice" vyžaduje pole correct.', `${base}.correct`);
        }
        if (question.choices && question.correct !== undefined) {
          const ids = question.choices.map((choice) => choice.id);
          for (const duplicate of duplicates(ids)) {
            say(`Dvě možnosti mají stejné id "${duplicate}".`, `${base}.choices`);
          }
          if (!ids.includes(question.correct)) {
            say(`correct: "${question.correct}" není id žádné možnosti.`, `${base}.correct`);
          }
        }
      }
      break;
    }

    default:
      // trueFalse, shortText a numeric nemají co křížově kontrolovat.
      break;
  }

  if (question.formerIds.includes(question.id)) {
    say("formerIds obsahuje vlastní id otázky.", `${base}.formerIds`);
  }
  for (const duplicate of duplicates(question.formerIds)) {
    say(`formerIds obsahuje "${duplicate}" dvakrát.`, `${base}.formerIds`);
  }
}

/* ------------------------------------------------------------------ */
/* Průchod repozitářem                                                 */
/* ------------------------------------------------------------------ */

interface QuestionRef {
  file: string;
  field: string;
  setId: string;
}

const liveIds = new Map<string, QuestionRef>();
const formerIdOwners = new Map<string, QuestionRef>();

let fileCount = 0;
let setCount = 0;
let questionCount = 0;

function checkCourseDir(code: string): void {
  const dir = path.join(contentDir, code);
  const courseFile = path.join(dir, "course.json");

  if (!fs.existsSync(courseFile)) {
    report(courseFile, `Předmět "${code}" nemá course.json.`);
  } else {
    fileCount++;
    const data = readJsonFile(courseFile);
    if (data !== null) {
      const course = parseWithSchema(Course, data, courseFile);
      if (course && course.code !== code) {
        report(courseFile, `Pole code je "${course.code}", ale soubor leží v content/${code}/.`, "code");
      }
    }
  }

  const setFiles = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".questions.json"))
    .sort();

  for (const name of fs.readdirSync(dir)) {
    if (name === "course.json" || name.endsWith(".questions.json")) continue;
    if (name.startsWith(".")) continue;
    report(path.join(dir, name), "Soubor sem nepatří – čekám jen course.json a *.questions.json.");
  }

  for (const name of setFiles) {
    checkSetFile(path.join(dir, name), code, name.replace(/\.questions\.json$/u, ""));
  }
}

function checkSetFile(file: string, course: string, expectedId: string): void {
  fileCount++;
  const data = readJsonFile(file);
  if (data === null) return;

  const set = parseWithSchema(QuestionSet, data, file);
  if (!set) return;
  setCount++;

  if (set.course !== course) {
    report(file, `Pole course je "${set.course}", ale soubor leží v content/${course}/.`, "course");
  }
  if (set.id !== expectedId) {
    report(
      file,
      `Pole id je "${set.id}", ale podle názvu souboru má být "${expectedId}".`,
      "id",
    );
  }

  set.questions.forEach((question, index) => {
    questionCount++;
    const base = `questions[${index}]`;
    const ref: QuestionRef = { file, field: base, setId: set.id };

    const existing = liveIds.get(question.id);
    if (existing) {
      report(
        file,
        `Id otázky "${question.id}" už existuje v ${rel(existing.file)} (${existing.field}). Id musí být unikátní v celém repu.`,
        `${base}.id`,
      );
    } else {
      liveIds.set(question.id, ref);
    }

    for (const formerId of question.formerIds) {
      const owner = formerIdOwners.get(formerId);
      if (owner) {
        report(
          file,
          `formerId "${formerId}" si nárokuje i otázka v ${rel(owner.file)} (${owner.field}).`,
          `${base}.formerIds`,
        );
      } else {
        formerIdOwners.set(formerId, ref);
      }
    }

    checkQuestion(file, question, base);
    checkImages(file, question, base);
  });
}

/** Až když jsou načtená všechna živá id, má smysl hledat kolize s formerIds. */
function checkFormerIdCollisions(): void {
  for (const [formerId, owner] of formerIdOwners) {
    const live = liveIds.get(formerId);
    if (!live) continue;
    if (live.file === owner.file && live.field === owner.field) continue;
    report(
      owner.file,
      `formerId "${formerId}" je zároveň živé id otázky v ${rel(live.file)} (${live.field}). Historie učení by se slila dohromady.`,
      `${owner.field}.formerIds`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Běh                                                                 */
/* ------------------------------------------------------------------ */

function main(): void {
  if (!fs.existsSync(contentDir)) {
    console.error(red(`Adresář ${rel(contentDir)} neexistuje.`));
    process.exit(1);
  }

  const known = new Set<string>(COURSE_CODES);
  const dirs = fs
    .readdirSync(contentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const dir of dirs) {
    if (!known.has(dir)) {
      report(
        path.join(contentDir, dir),
        `Adresář "${dir}" neodpovídá žádnému kódu předmětu. Znám: ${[...known].join(", ")}. Nový předmět patří i do COURSE_CODES v src/content/schema.ts.`,
      );
      continue;
    }
    checkCourseDir(dir);
  }

  for (const code of COURSE_CODES) {
    if (!dirs.includes(code)) {
      report(path.join(contentDir, code), `Předmět "${code}" ze schématu nemá adresář v content/.`);
    }
  }

  checkFormerIdCollisions();

  /* ---------------- výpis ---------------- */

  let errorCount = 0;
  for (const [file, list] of [...problems].sort(([a], [b]) => a.localeCompare(b))) {
    errorCount += list.length;
    console.log(`\n${bold(rel(file))}`);

    const rows = list
      .map((problem) => ({ ...problem, line: lineOf(file, problem.field) }))
      .sort((a, b) => (a.line ?? 0) - (b.line ?? 0));

    for (const row of rows) {
      const where = row.line === undefined ? "" : dim(`:${row.line}`);
      const field = row.field ? ` ${dim(row.field)}` : "";
      console.log(`  ${red("×")}${where}${field}  ${row.message}`);
    }
  }

  const summary = [
    plural(fileCount, "soubor", "soubory", "souborů"),
    plural(setCount, "sada", "sady", "sad"),
    plural(questionCount, "otázka", "otázky", "otázek"),
  ].join(" · ");
  console.log("");
  if (errorCount === 0) {
    console.log(green(`✓ Obsah je v pořádku  ${dim(summary)}`));
    if (questionCount === 0) {
      console.log(yellow("  (zatím tu ale nejsou žádné otázky)"));
    }
    return;
  }

  const where = plural(problems.size, "souboru", "souborech", "souborech");
  console.log(red(`✗ ${plural(errorCount, "chyba", "chyby", "chyb")} v ${where}  ${dim(summary)}`));
  process.exit(1);
}

main();
