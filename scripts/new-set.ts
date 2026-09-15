/**
 * Kostra nové sady otázek.
 *
 *   npm run content:new -- --course idm --lecture 3 --title "Relace"
 *
 * Vznikne content/idm/03-relace.questions.json s ukázkovou otázkou,
 * odkazem na JSON Schema (aby editor napovídal) a správně vyplněnou
 * hlavičkou. Existující soubor skript nikdy nepřepíše.
 */
import fs from "node:fs";
import path from "node:path";
import { COURSE_CODES, QuestionSet } from "../src/content/schema";

const colorful = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code: string) => (text: string) => (colorful ? `\u001b[${code}m${text}\u001b[0m` : text);
const red = paint("31");
const green = paint("32");
const dim = paint("2");

const USAGE = `Použití:
  npm run content:new -- --course <kod> --title "Název" [--lecture <číslo>] [--description "..."]

  --course       jeden z: ${COURSE_CODES.join(", ")}
  --title        název sady česky, bez čísla přednášky
  --lecture      číslo přednášky 0–40 (dostane se do názvu souboru)
  --description  jedna až dvě věty, co si tím člověk procvičí`;

function fail(message: string): never {
  console.error(red(message));
  console.error(`\n${USAGE}`);
  process.exit(1);
}

/** Argumenty ve tvaru --klic hodnota i --klic=hodnota. */
function parseArgs(argv: readonly string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith("--")) continue;
    const equals = token.indexOf("=");
    if (equals > 0) {
      args.set(token.slice(2, equals), token.slice(equals + 1));
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) fail(`Přepínač ${token} nemá hodnotu.`);
    args.set(token.slice(2), next);
    i++;
  }
  return args;
}

/** Název → kebab-case bez diakritiky, použitelný jako id i jako název souboru. */
function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  const course = args.get("course");
  if (!course) fail("Chybí --course.");
  if (!(COURSE_CODES as readonly string[]).includes(course)) {
    fail(`Předmět "${course}" neznám. Znám: ${COURSE_CODES.join(", ")}.`);
  }

  const title = args.get("title");
  if (!title || title.trim().length < 2) fail("Chybí --title (aspoň 2 znaky).");

  const rawLecture = args.get("lecture");
  let lecture: number | undefined;
  if (rawLecture !== undefined) {
    lecture = Number(rawLecture);
    if (!Number.isInteger(lecture) || lecture < 0 || lecture > 40) {
      fail(`--lecture musí být celé číslo 0–40, dostal jsem "${rawLecture}".`);
    }
  }

  const titleSlug = slugify(title);
  if (titleSlug.length === 0) fail(`Z názvu "${title}" nejde udělat slug. Použij aspoň jedno písmeno nebo číslici.`);

  const prefix = lecture === undefined ? "" : `${String(lecture).padStart(2, "0")}-`;
  const setId = `${prefix}${titleSlug}`;
  const fileName = `${setId}.questions.json`;

  const dir = path.join(process.cwd(), "content", course);
  const file = path.join(dir, fileName);
  if (fs.existsSync(file)) {
    fail(`Soubor ${path.relative(process.cwd(), file)} už existuje. Buď ho edituj, nebo zvol jiný název.`);
  }

  const set = {
    $schema: "../../schemas/question-set.schema.json",
    id: setId,
    title: title.trim(),
    course,
    ...(lecture === undefined ? {} : { lecture }),
    description: args.get("description") ?? `Otázky k tématu ${title.trim()}.`,
    schemaVersion: 1,
    questions: [
      {
        id: `${course}-${prefix}${titleSlug}-ukazka`.replace(/-+/gu, "-"),
        type: "single",
        prompt: `Ukázková otázka k tématu ${title.trim()}. Nahraď ji skutečnou a smaž tenhle komentář ze zadání.`,
        choices: [
          { id: "a", text: "Správná odpověď", feedback: "Přesně tak." },
          { id: "b", text: "Lákavý, ale chybný distraktor", feedback: "Vysvětli, proč to láká a v čem je chyba." },
          { id: "c", text: "Další chybná možnost" },
        ],
        correct: "a",
        explanation: "Proč je správně a). Tohle je nejcennější část otázky, nešiď to.",
        difficulty: 3,
        tags: [titleSlug],
        status: "draft",
      },
    ],
  };

  // Vlastní kontrola dřív, než to půjde na disk – ať skript nevyrobí nevalidní soubor.
  const parsed = QuestionSet.safeParse(set);
  if (!parsed.success) {
    console.error(red("Kostra neprošla schématem – tohle je chyba ve skriptu:"));
    for (const issue of parsed.error.issues) {
      console.error(`  • ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(set, null, 2)}\n`, "utf8");

  const relative = path.relative(process.cwd(), file);
  console.log(green(`✓ Vytvořeno ${relative}`));
  console.log(dim("  Dál: nahraď ukázkovou otázku, pak spusť npm run content:check && npm run content:lint"));
}

main();
