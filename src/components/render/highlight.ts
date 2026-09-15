/**
 * Zvýrazňování syntaxe přes Shiki.
 *
 * SERVER ONLY. Shiki i s gramatikami má přes megabajt – do prohlížeče nesmí.
 * Volej to jen ze Server Components (CodePanel, RichText), nikdy z `"use client"`.
 */
import { createHighlighter, type BundledLanguage, type Highlighter } from "shiki";

import { CodeLanguage } from "@/content/schema";

export type CodeLang = (typeof CodeLanguage)["options"][number];

/** Motivy se generují oba naráz, přepínají se CSS proměnnými (viz globals.css). */
const THEMES = { light: "github-light", dark: "github-dark" } as const;

/** `text` je u Shiki speciální „jazyk“ bez gramatiky, do `langs` se nepředává. */
const LOADED_LANGS = CodeLanguage.options.filter(
  (lang): lang is Exclude<CodeLang, "text"> => lang !== "text",
);

const SUPPORTED = new Set<string>(CodeLanguage.options);

/**
 * Jedna instance na celý proces. Bez toho by se gramatiky načítaly znovu
 * při každém volání a build s pár stovkami otázek by běžel minuty.
 */
let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [THEMES.light, THEMES.dark],
    langs: LOADED_LANGS as BundledLanguage[],
  });
  return highlighterPromise;
}

/** Stejný blok kódu se často opakuje v zadání i ve vysvětlení – ať se nedělá dvakrát. */
const CACHE_LIMIT = 500;
const cache = new Map<string, string>();

/**
 * Převede zdroják na HTML se zvýrazněnou syntaxí.
 * Neznámý jazyk nespadne, jen se vykreslí bez barev.
 */
export async function highlight(code: string, lang: string): Promise<string> {
  const language = normalizeLang(lang);
  const source = code.replace(/\s+$/, "");
  const key = `${language}\u0000${source}`;

  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const highlighter = await getHighlighter();
  const html = highlighter.codeToHtml(source, { lang: language, themes: THEMES });

  if (cache.size >= CACHE_LIMIT) {
    // Nejstarší záznam ven – Map si drží pořadí vkládání.
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, html);
  return html;
}

/** Jazyk, který Shiki nezná (nebo chybí), skončí jako prostý text. */
export function normalizeLang(lang: string | undefined | null): CodeLang {
  if (!lang) return "text";
  const lower = lang.toLowerCase();
  if (SUPPORTED.has(lower)) return lower as CodeLang;
  return ALIASES[lower] ?? "text";
}

/** Co píšou autoři obsahu v markdownu, ale ve schématu to tak nejmenujeme. */
const ALIASES: Record<string, CodeLang> = {
  "c++": "cpp",
  "c#": "text",
  h: "c",
  hpp: "cpp",
  cc: "cpp",
  js: "javascript",
  ts: "typescript",
  py: "python",
  sh: "bash",
  zsh: "bash",
  console: "shell",
  tex: "latex",
  plaintext: "text",
  plain: "text",
  txt: "text",
  yml: "yaml",
  html: "xml",
  svg: "xml",
  make: "makefile",
  s: "asm",
  nasm: "asm",
  x86asm: "asm",
  sv: "verilog",
  vhd: "vhdl",
};

/** Popisek jazyka do hlavičky panelu s kódem. */
export const LANG_LABEL: Record<CodeLang, string> = {
  c: "C",
  cpp: "C++",
  asm: "Assembler",
  bash: "Bash",
  shell: "Shell",
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  sql: "SQL",
  vhdl: "VHDL",
  verilog: "Verilog",
  latex: "LaTeX",
  json: "JSON",
  yaml: "YAML",
  xml: "XML",
  makefile: "Makefile",
  diff: "Diff",
  text: "Text",
};
