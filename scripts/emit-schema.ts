/**
 * Vygeneruje JSON Schema ze Zod schémat v src/content/schema.ts.
 *
 * Díky tomu editor napovídá přímo v content/**.json – což je pro agenty
 * i pro člověka mnohem rychlejší zpětná vazba než spouštět content:check.
 *
 * Spouštět po každé změně schématu:  npm run content:schema
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Course, QuestionSet } from "../src/content/schema";

const root = process.cwd();
const schemasDir = path.join(root, "schemas");

interface Emitted {
  file: string;
  bytes: number;
}

function emit(name: string, schema: z.ZodType, title: string): Emitted {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<
    string,
    unknown
  >;

  const document = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title,
    ...json,
  };

  const target = path.join(schemasDir, name);
  const body = `${JSON.stringify(document, null, 2)}\n`;
  fs.writeFileSync(target, body, "utf8");
  return { file: path.relative(root, target), bytes: Buffer.byteLength(body) };
}

/** Zapíše mapování schémat do .vscode/settings.json, ale nepřepíše cizí nastavení. */
function updateVsCodeSettings(): string {
  const dir = path.join(root, ".vscode");
  const file = path.join(dir, "settings.json");
  fs.mkdirSync(dir, { recursive: true });

  let settings: Record<string, unknown> = {};
  if (fs.existsSync(file)) {
    try {
      // JSON s komentáři tolerovat neumíme; radši nic nerozbít než "opravit".
      settings = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    } catch {
      console.warn("  ! .vscode/settings.json nejde přečíst jako JSON, nechávám ho být");
      return path.relative(root, file);
    }
  }

  settings["json.schemas"] = [
    {
      fileMatch: ["content/*/*.questions.json"],
      url: "./schemas/question-set.schema.json",
    },
    {
      fileMatch: ["content/*/course.json"],
      url: "./schemas/course.schema.json",
    },
  ];

  fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return path.relative(root, file);
}

function main(): void {
  fs.mkdirSync(schemasDir, { recursive: true });

  const outputs = [
    emit("question-set.schema.json", QuestionSet, "Sada otázek"),
    emit("course.schema.json", Course, "Předmět"),
  ];

  console.log("Vygenerováno:");
  for (const output of outputs) {
    console.log(`  ${output.file}  (${(output.bytes / 1024).toFixed(1)} kB)`);
  }
  console.log(`  ${updateVsCodeSettings()}  (mapování schémat pro editor)`);
}

main();
