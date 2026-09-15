/**
 * Kontrola KVALITY obsahu. Na rozdíl od check-content.ts tu nejde o to,
 * jestli je soubor platný, ale jestli je otázka k něčemu dobrá.
 *
 * Většina pravidel míří na typické chyby agentů, kteří kvízy generují:
 * dvakrát totéž zadání jinými slovy, "všechny výše uvedené" jako možnost,
 * podezřele dlouhá správná odpověď, správná odpověď skoro vždycky za A.
 *
 * Závažnost se řídí polem `status`:
 *   draft    → varování (otázka ještě čeká na člověka)
 *   reviewed → chyba (tohle už mělo být zkontrolované)
 *
 * S přepínačem --strict je chybou i varování.
 */
import fs from "node:fs";
import path from "node:path";
import { COURSE_CODES, Question, QuestionSet } from "../src/content/schema";

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

const strict = process.argv.includes("--strict");

type Severity = "chyba" | "varování";

type RuleName =
  | "meta-moznost"
  | "duplicitni-zadani"
  | "duplicitni-moznost"
  | "prozrazujici-delka"
  | "pozicni-vychylka"
  | "chybi-vysvetleni"
  | "slabe-distraktory"
  | "zaporne-zadani"
  | "prilis-dlouhe-zadani"
  | "chybi-alt";

interface Finding {
  rule: RuleName;
  file: string;
  question: string;
  detail: string;
  severity: Severity;
}

const findings: Finding[] = [];

function add(
  rule: RuleName,
  file: string,
  question: string,
  detail: string,
  status: "draft" | "reviewed",
): void {
  findings.push({
    rule,
    file,
    question,
    detail,
    severity: status === "reviewed" || strict ? "chyba" : "varování",
  });
}

/* ------------------------------------------------------------------ */
/* Normalizace pro porovnávání                                         */
/* ------------------------------------------------------------------ */

/** Česká čísla: 1 chyba, 2–4 chyby, 5 chyb. */
function plural(count: number, one: string, few: string, many: string): string {
  const word = count === 1 ? one : count >= 2 && count <= 4 ? few : many;
  return `${count} ${word}`;
}

/**
 * Otisk textu pro hledání duplicit: bez diakritiky, bez mezer, bez markdown
 * zvýraznění a bez koncové interpunkce.
 *
 * Operátory a závorky se SCHVÁLNĚ nechávají. Kdyby se zahodilo všechno
 * nealfanumerické, splynulo by "$h(A) < h(B)$" s "$h(A) = h(B)$" a linter
 * by hlásil duplicitní možnosti přesně tam, kde je rozdíl celá pointa otázky.
 */
function fingerprint(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[*_`~$]/gu, "")
    .replace(/\s+/gu, "")
    .replace(/[.,;:!?]+$/u, "");
}

/**
 * Klíč pro hledání dvou otázek se stejným zadáním.
 *
 * Kromě promptu bere i to, na co se prompt odkazuje – u otázek typu
 * codeOutput je totiž úplně běžné (a správné) mít u deseti otázek stejné
 * "Co program vypíše?" a lišit se jenom zdrojákem.
 */
function promptKey(question: Question): string {
  const parts = [fingerprint(question.prompt)];
  // Kód se nelowercasuje – rozdíl mezi otázkami může být jen ve velikosti písmen.
  if (question.code) parts.push(question.code.source.replace(/\s+/gu, ""));
  if (question.type === "codeOutput") parts.push(question.source.replace(/\s+/gu, ""));
  if (question.type === "cloze") parts.push(fingerprint(question.template));
  if (question.figure) parts.push(question.figure.src);
  return parts.join("|");
}

/** Totéž, ale se zachovanými mezerami – na hledání frází. */
function loose(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

/** Délka textu bez markdown obalu – aby ** a $ nenafukovaly statistiku. */
function visibleLength(value: string): number {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, "")
    .replace(/[*_`$\\]/gu, "")
    .trim().length;
}

/* ------------------------------------------------------------------ */
/* Pravidla                                                            */
/* ------------------------------------------------------------------ */

/** "Všechny výše uvedené" a spol. – bez `pin` je taková možnost po zamíchání nesmysl. */
const META_PATTERNS: RegExp[] = [
  /\bvsechny (vyse )?uvedene\b/u,
  /\bvse (z )?(vyse )?uvedene\w*\b/u,
  /\bvsechny (predchozi|odpovedi|moznosti)\b/u,
  /\bvsechny z (vyse )?uvedenych\b/u,
  /\bzadna z (predchozich|uvedenych|vyse|techto|nabizenych)\b/u,
  /\bzadna (z )?odpovedi\b/u,
  /\bnic z (vyse )?uvedeneho\b/u,
  /\bobe (moznosti )?(a i b|a a b|jsou spravne)\b/u,
  /\ba i b\b/u,
  /\ball of the above\b/u,
  /\bnone of the above\b/u,
  /\bboth a and b\b/u,
];

function choicesOf(question: Question) {
  if (question.type === "single" || question.type === "multi") return question.choices;
  if (question.type === "codeOutput") return question.choices ?? [];
  return [];
}

function correctIdsOf(question: Question): string[] {
  if (question.type === "single") return [question.correct];
  if (question.type === "multi") return question.correct;
  if (question.type === "codeOutput" && question.correct !== undefined) return [question.correct];
  return [];
}

function lintQuestion(file: string, question: Question): void {
  const id = question.id;
  const status = question.status;
  const choices = choicesOf(question);

  /* --- meta-moznost --- */
  for (const choice of choices) {
    if (choice.pin) continue;
    const text = loose(choice.text);
    if (META_PATTERNS.some((pattern) => pattern.test(text))) {
      add(
        "meta-moznost",
        file,
        id,
        `Možnost "${choice.id}" je meta-odpověď ("${choice.text.slice(0, 40)}"). Buď ji zruš, nebo jí dej pin: "last".`,
        status,
      );
    }
  }

  /* --- duplicitni-moznost --- */
  const seenChoiceTexts = new Map<string, string>();
  for (const choice of choices) {
    const key = fingerprint(choice.text);
    const first = seenChoiceTexts.get(key);
    if (first) {
      add(
        "duplicitni-moznost",
        file,
        id,
        `Možnosti "${first}" a "${choice.id}" říkají po normalizaci totéž.`,
        status,
      );
    } else {
      seenChoiceTexts.set(key, choice.id);
    }
  }

  /* --- prozrazujici-delka --- */
  const correctIds = new Set(correctIdsOf(question));
  if (correctIds.size === 1 && choices.length >= 2) {
    const correct = choices.find((choice) => correctIds.has(choice.id));
    const distractors = choices.filter((choice) => !correctIds.has(choice.id));
    if (correct && distractors.length > 0) {
      const correctLength = visibleLength(correct.text);
      const longestDistractor = Math.max(...distractors.map((choice) => visibleLength(choice.text)));
      if (correctLength > longestDistractor * 1.5 && correctLength - longestDistractor > 15) {
        add(
          "prozrazujici-delka",
          file,
          id,
          `Správná možnost má ${correctLength} znaků, nejdelší distraktor ${longestDistractor}. Uživatel ji trefí bez přemýšlení.`,
          status,
        );
      }
    }
  }

  /* --- slabe-distraktory --- */
  if (question.type === "single" && question.choices.length < 3) {
    add(
      "slabe-distraktory",
      file,
      id,
      `Jen ${question.choices.length} možnosti – to je hádání s 50% úspěšností. Přidej distraktory nebo použij type: "trueFalse".`,
      status,
    );
  }

  /* --- chybi-vysvetleni --- */
  if (status === "reviewed" && !question.explanation) {
    add("chybi-vysvetleni", file, id, "Otázka je reviewed, ale nemá explanation.", status);
  }

  /* --- zaporne-zadani --- */
  const emphasized = [...question.prompt.matchAll(/\*\*([\s\S]+?)\*\*/gu)]
    .map((match) => match[1]!)
    .join(" ");
  const negatives: Array<{ label: string; pattern: RegExp }> = [
    { label: "NE", pattern: /(?<![A-Za-zÁ-Žá-ž])NE(?![A-Za-zÁ-Žá-ž])/u },
    { label: "kromě", pattern: /krom[ěe]/iu },
    { label: "nesprávn", pattern: /nespr[aá]vn/iu },
  ];
  for (const negative of negatives) {
    if (negative.pattern.test(question.prompt) && !negative.pattern.test(emphasized)) {
      add(
        "zaporne-zadani",
        file,
        id,
        `Zadání je záporné ("${negative.label}"), ale zápor není zvýrazněný tučně. Uživatel ho přehlédne.`,
        status,
      );
    }
  }

  /* --- prilis-dlouhe-zadani --- */
  if (question.prompt.length > 600) {
    add(
      "prilis-dlouhe-zadani",
      file,
      id,
      `Zadání má ${question.prompt.length} znaků. Zkrať ho, nebo dlouhou část přesuň do code/figure.`,
      status,
    );
  }

  /* --- chybi-alt --- */
  const images: Array<{ where: string; alt: string }> = [];
  if (question.figure) images.push({ where: "figure", alt: question.figure.alt });
  for (const choice of choices) {
    if (choice.image) images.push({ where: `choices.${choice.id}`, alt: choice.image.alt });
  }
  const markdownSources = [question.prompt, question.explanation ?? "", ...choices.map((c) => c.text)];
  for (const source of markdownSources) {
    for (const match of source.matchAll(/!\[([^\]]*)\]\(/gu)) {
      images.push({ where: "markdown", alt: match[1] ?? "" });
    }
  }
  for (const image of images) {
    if (image.alt.trim().length < 10) {
      add(
        "chybi-alt",
        file,
        id,
        `Obrázek (${image.where}) má alt "${image.alt}" – popiš, co je na něm vidět, ne jen "schéma".`,
        status,
      );
    }
  }
}

/** Pozice správné odpovědi napříč sadou. Modely mají silnou preferenci pro A a B. */
function lintPositions(file: string, set: QuestionSet): void {
  const singles = set.questions.filter((question) => question.type === "single");
  if (singles.length < 8) return;

  const observed = new Map<number, number>();
  const expected = new Map<number, number>();

  for (const question of singles) {
    if (question.type !== "single") continue;
    const index = question.choices.findIndex((choice) => choice.id === question.correct);
    if (index < 0) continue;
    observed.set(index, (observed.get(index) ?? 0) + 1);
    // Kdyby byla správná odpověď náhodná, na každou pozici by padl podíl 1/počet možností.
    for (let position = 0; position < question.choices.length; position++) {
      expected.set(position, (expected.get(position) ?? 0) + 1 / question.choices.length);
    }
  }

  const allReviewed = singles.every((question) => question.status === "reviewed");

  for (const [position, count] of [...observed].sort(([a], [b]) => a - b)) {
    const want = expected.get(position) ?? 0;
    if (want > 0 && count > want * 1.8) {
      add(
        "pozicni-vychylka",
        file,
        `${set.id} (${singles.length} otázek typu single)`,
        `Správná odpověď je ${count}× na pozici ${String.fromCharCode(65 + position)}, čekalo by se ~${want.toFixed(1)}×. Zamíchej správné odpovědi po sadě.`,
        allReviewed ? "reviewed" : "draft",
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* Běh                                                                 */
/* ------------------------------------------------------------------ */

const root = process.cwd();
const contentDir = path.join(root, "content");

function rel(file: string): string {
  return path.relative(root, file);
}

interface PromptSeen {
  file: string;
  questionId: string;
}

function main(): void {
  if (!fs.existsSync(contentDir)) {
    console.error(red(`Adresář ${rel(contentDir)} neexistuje.`));
    process.exit(1);
  }

  /** Duplicitní zadání se hledají v rámci předmětu, ne globálně. */
  const promptsByCourse = new Map<string, Map<string, PromptSeen>>();
  let setCount = 0;
  let questionCount = 0;

  for (const code of COURSE_CODES) {
    const dir = path.join(contentDir, code);
    if (!fs.existsSync(dir)) continue;

    const prompts = new Map<string, PromptSeen>();
    promptsByCourse.set(code, prompts);

    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".questions.json")).sort()) {
      const file = path.join(dir, name);

      let data: unknown;
      try {
        data = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        console.log(yellow(`  ! ${rel(file)} není platný JSON – přeskakuji, spusť npm run content:check`));
        continue;
      }

      const parsed = QuestionSet.safeParse(data);
      if (!parsed.success) {
        // Neplatný soubor je práce pro content:check, tady by z toho byl jen šum.
        console.log(yellow(`  ! ${rel(file)} neodpovídá schématu – přeskakuji, spusť npm run content:check`));
        continue;
      }

      const set = parsed.data;
      setCount++;

      for (const question of set.questions) {
        questionCount++;
        lintQuestion(rel(file), question);

        const key = promptKey(question);
        const first = prompts.get(key);
        if (first) {
          add(
            "duplicitni-zadani",
            rel(file),
            question.id,
            `Stejné zadání už má otázka "${first.questionId}" v ${first.file}.`,
            question.status,
          );
        } else {
          prompts.set(key, { file: rel(file), questionId: question.id });
        }
      }

      lintPositions(rel(file), set);
    }
  }

  /* ---------------- výpis ---------------- */

  if (findings.length > 0) {
    const width = (pick: (finding: Finding) => string, min: number) =>
      Math.max(min, ...findings.map((finding) => pick(finding).length));
    const ruleWidth = width((f) => f.rule, 6);
    const fileWidth = width((f) => f.file, 6);
    const questionWidth = Math.min(38, width((f) => f.question, 7));

    // Dva znaky vlevo patří značce závažnosti, proto je hlavička odsazená.
    const head = `  ${"pravidlo".padEnd(ruleWidth)}  ${"soubor".padEnd(fileWidth)}  ${"otázka".padEnd(questionWidth)}  detail`;
    console.log(bold(head));
    console.log(dim("─".repeat(head.length)));

    const order: Record<Severity, number> = { chyba: 0, "varování": 1 };
    for (const finding of [...findings].sort(
      (a, b) =>
        order[a.severity] - order[b.severity] ||
        a.rule.localeCompare(b.rule) ||
        a.file.localeCompare(b.file),
    )) {
      const mark = finding.severity === "chyba" ? red("×") : yellow("!");
      const question =
        finding.question.length > questionWidth
          ? `${finding.question.slice(0, questionWidth - 1)}…`
          : finding.question.padEnd(questionWidth);
      console.log(
        `${mark} ${finding.rule.padEnd(ruleWidth)}  ${finding.file.padEnd(fileWidth)}  ${question}  ${finding.detail}`,
      );
    }
    console.log("");
  }

  const errors = findings.filter((finding) => finding.severity === "chyba").length;
  const warnings = findings.length - errors;

  const counts = new Map<RuleName, number>();
  for (const finding of findings) counts.set(finding.rule, (counts.get(finding.rule) ?? 0) + 1);
  for (const [rule, count] of [...counts].sort(([, a], [, b]) => b - a)) {
    console.log(`  ${dim(String(count).padStart(4))}  ${rule}`);
  }

  const summary = `${plural(setCount, "sada", "sady", "sad")} · ${plural(questionCount, "otázka", "otázky", "otázek")}`;
  console.log("");
  if (errors === 0 && warnings === 0) {
    console.log(green(`✓ Obsah vypadá dobře  ${dim(summary)}`));
    return;
  }
  const errorText = plural(errors, "chyba", "chyby", "chyb");
  const warningText = plural(warnings, "varování", "varování", "varování");
  console.log(`${errors > 0 ? red(errorText) : green(errorText)} · ${yellow(warningText)}  ${dim(summary)}`);
  if (warnings > 0 && !strict) {
    console.log(dim("  (spusť s --strict, ať jsou varování taky chyby)"));
  }
  if (errors > 0) process.exit(1);
}

main();
