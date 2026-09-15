/**
 * Renderování zadání, možností a vysvětlení.
 *
 * Vstup je Markdown (viz `Markdown` v src/content/schema.ts): GFM tabulky,
 * odrážky, kód, obrázky a LaTeX mezi `$…$` / `$$…$$`.
 *
 * SERVER ONLY. KaTeX i Shiki běží tady na serveru a do prohlížeče posílají
 * jen hotové HTML – ušetří to uživateli přes megabajt JS.
 *
 * Postup je trojfázový:
 *   1. `maskMath()` projde zdroj a nahradí vzorce netisknutelnými značkami.
 *      Dělá se to PŘED markdownem, protože markdown by ve vzorci sežral
 *      zpětná lomítka (`\\` v matici, `\{`) a rozbil ho.
 *      Ten samý průchod si všímá bloků kódu a inline kódu, takže `$` uvnitř
 *      kódu zůstane dolarem, a rovnou sesbírá zdrojáky k obarvení.
 *   2. Bloky kódu se obarví Shikim (asynchronně, všechny naráz).
 *   3. `react-markdown` vykreslí zbytek; malý remark plugin promění značky
 *      zpátky na `<Math>`.
 */
import "katex/dist/katex.min.css";

import type { Element as HastElement } from "hast";
import type { Root as MdastRoot } from "mdast";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/cn";

import { Figure } from "./Figure";
import { highlight, normalizeLang } from "./highlight";
// Pod vlastním jménem, ať v tomhle souboru zůstane dostupný globální `Math`.
import { Math as TeX } from "./Math";

export type RichTextProps = {
  /** Markdown ze souboru s otázkami. */
  children?: string;
  /** Totéž jako `children` – pro zápis `<RichText source={otazka.prompt} />`. */
  source?: string;
  className?: string;
  /** Sevřená varianta pro texty možností – bez odstavcových mezer. */
  compact?: boolean;
};

export async function RichText({ children, source, className, compact = false }: RichTextProps) {
  const markdown = children ?? source ?? "";
  if (!markdown.trim()) return null;

  const { masked, math, code } = maskMath(markdown);

  // Obarvení je asynchronní, ale komponenty react-markdownu jsou synchronní,
  // takže se všechno obarví dopředu a v komponentě se jen sáhne do mapy.
  const highlighted = new Map<string, string>();
  await Promise.all(
    code.map(async (block) => {
      highlighted.set(codeKey(block.lang, block.code), await highlight(block.code, block.lang));
    }),
  );

  const components = buildComponents({ math, highlighted, compact });

  return (
    <div
      className={cn(
        "text-text text-[1rem] leading-[1.65] break-words",
        // Vzorec ani tabulka nesmí roztáhnout stránku do šířky.
        "[&_.katex-display]:max-w-full",
        className,
      )}
    >
      <Markdown remarkPlugins={[remarkGfm, mathPlaceholders]} components={components}>
        {masked}
      </Markdown>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Značky pro vzorce                                                   */
/* ------------------------------------------------------------------ */

/* Znaky ze soukromé oblasti Unicode. Markdown je bere jako obyčejné
   písmeno – neescapují se, nerozdělí odstavec ani zvýraznění. */
const PH_OPEN = "\uE000";
const PH_CLOSE = "\uE001";

function placeholderPattern(): RegExp {
  return new RegExp(`${PH_OPEN}(\\d+)${PH_CLOSE}`, "g");
}

type MathToken = { tex: string; display: boolean };
type CodeHit = { lang: string; code: string };

function codeKey(lang: string, code: string): string {
  return `${lang}\u0000${code}`;
}

/** Vrátí zpět původní zápis vzorce – pro místa, kam `<Math>` nepatří (kód). */
function restore(text: string, math: MathToken[]): string {
  return text.replace(placeholderPattern(), (whole, index: string) => {
    const token = math[Number(index)];
    if (!token) return whole;
    return token.display ? `$$${token.tex}$$` : `$${token.tex}$`;
  });
}

/* ------------------------------------------------------------------ */
/* Průchod zdrojem: vzorce ven, kód stranou                            */
/* ------------------------------------------------------------------ */

function maskMath(src: string): { masked: string; math: MathToken[]; code: CodeHit[] } {
  const math: MathToken[] = [];
  const code: CodeHit[] = [];
  let out = "";
  let i = 0;
  let lineStart = true;

  while (i < src.length) {
    if (lineStart) {
      const fence = matchFence(src, i);
      if (fence) {
        code.push({ lang: fence.lang, code: fence.code });
        out += src.slice(i, fence.end);
        i = fence.end;
        lineStart = true;
        continue;
      }
    }

    const ch = src[i];

    // Escapované `\$` je doslovný dolar, ne začátek vzorce.
    if (ch === "\\" && i + 1 < src.length) {
      out += src.slice(i, i + 2);
      i += 2;
      lineStart = false;
      continue;
    }

    if (ch === "`") {
      const span = matchCodeSpan(src, i);
      if (span !== null) {
        out += src.slice(i, span);
        i = span;
        lineStart = false;
        continue;
      }
    }

    if (ch === "$") {
      const found = matchMath(src, i);
      if (found) {
        math.push({ tex: found.tex, display: found.display });
        out += `${PH_OPEN}${math.length - 1}${PH_CLOSE}`;
        i = found.end;
        lineStart = false;
        continue;
      }
    }

    out += ch;
    lineStart = ch === "\n";
    i += 1;
  }

  return { masked: out, math, code };
}

function lineEndAt(src: string, from: number): number {
  const nl = src.indexOf("\n", from);
  return nl === -1 ? src.length : nl;
}

/**
 * Oplocený blok kódu. Odsazení připouštíme i větší než tři mezery –
 * uvnitř odrážky je blok odsazený podle položky seznamu.
 */
function matchFence(
  src: string,
  start: number,
): { end: number; lang: string; code: string } | null {
  const end = lineEndAt(src, start);
  const opener = /^( {0,11})(`{3,}|~{3,})[ \t]*([^\n]*)$/.exec(src.slice(start, end));
  if (!opener) return null;

  const [, indent, marker, info] = opener;
  // U backtickového plotu nesmí být v popisku další backtick.
  if (marker.startsWith("`") && info.includes("`")) return null;

  const lang = normalizeLang(info.trim().split(/[\s,{]/)[0]);
  const closer = new RegExp(`^ {0,${indent.length + 3}}${marker[0]}{${marker.length},}[ \\t]*$`);

  const lines: string[] = [];
  let i = end + 1;
  while (i <= src.length) {
    const lineEnd = lineEndAt(src, i);
    const line = src.slice(i, lineEnd);
    if (closer.test(line)) {
      return { end: Math.min(lineEnd + 1, src.length), lang, code: lines.join("\n") };
    }
    // Markdown u odsazeného plotu odřízne stejné odsazení i obsahu.
    lines.push(line.slice(0, indent.length).trim() === "" ? line.slice(indent.length) : line);
    if (lineEnd >= src.length) break;
    i = lineEnd + 1;
  }

  // Neuzavřený plot sahá do konce textu.
  return { end: src.length, lang, code: lines.join("\n") };
}

/** Vrátí index za koncem inline kódu (`…`), nebo null, když se neuzavře. */
function matchCodeSpan(src: string, start: number): number | null {
  let fence = 0;
  while (src[start + fence] === "`") fence += 1;

  let i = start + fence;
  while (i < src.length) {
    if (src[i] === "`") {
      let run = 0;
      while (src[i + run] === "`") run += 1;
      if (run === fence) return i + run;
      i += run;
      continue;
    }
    // Přes prázdný řádek inline kód nepřejde.
    if (src[i] === "\n" && /^[ \t]*\n/.test(src.slice(i + 1))) return null;
    i += 1;
  }
  return null;
}

function matchMath(
  src: string,
  start: number,
): { tex: string; display: boolean; end: number } | null {
  if (src.startsWith("$$", start)) {
    const close = findDollars(src, start + 2, 2);
    if (close === -1) return null;
    const tex = src.slice(start + 2, close).trim();
    return tex ? { tex, display: true, end: close + 2 } : null;
  }

  const next = src[start + 1];
  if (next === undefined || next === "$" || /\s/.test(next)) return null;

  let i = start + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    // Prázdný řádek ukončuje odstavec, dovnitř vzorce nepatří.
    if (ch === "\n" && /^[ \t]*\n/.test(src.slice(i + 1))) return null;
    if (ch === "$") {
      const before = src[i - 1];
      const after = src[i + 1];
      // "stálo to $5 a $10" není vzorec: dolar se drží u mezery a čísla.
      if (/\s/.test(before) || (after !== undefined && /\d/.test(after))) return null;
      const tex = src.slice(start + 1, i);
      return tex.trim() ? { tex, display: false, end: i + 1 } : null;
    }
    i += 1;
  }
  return null;
}

/** Najde neescapovaný běh `count` dolarů od pozice `from`. */
function findDollars(src: string, from: number, count: number): number {
  let i = from;
  while (i < src.length) {
    if (src[i] === "\\") {
      i += 2;
      continue;
    }
    if (src[i] === "$" && src.startsWith("$".repeat(count), i)) return i;
    i += 1;
  }
  return -1;
}

/* ------------------------------------------------------------------ */
/* Remark plugin: značka → prázdný <span data-katex="…">               */
/* ------------------------------------------------------------------ */

type MdNode = {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, string> };
};

function mathPlaceholders() {
  return (tree: MdastRoot): undefined => {
    replaceInChildren(tree as unknown as MdNode);
    return undefined;
  };
}

function replaceInChildren(node: MdNode): void {
  const children = node.children;
  if (!children) return;

  const out: MdNode[] = [];
  let changed = false;

  for (const child of children) {
    const value = child.value;
    if (child.type !== "text" || typeof value !== "string" || !value.includes(PH_OPEN)) {
      replaceInChildren(child);
      out.push(child);
      continue;
    }

    const pattern = placeholderPattern();
    let last = 0;
    let match = pattern.exec(value);
    while (match) {
      if (match.index > last) out.push({ type: "text", value: value.slice(last, match.index) });
      out.push({
        type: "mathPlaceholder",
        // mdast-util-to-hast respektuje hName/hProperties i u neznámých uzlů.
        data: { hName: "span", hProperties: { "data-katex": match[1] } },
        children: [],
      });
      last = match.index + match[0].length;
      match = pattern.exec(value);
    }
    if (last < value.length) out.push({ type: "text", value: value.slice(last) });
    changed = true;
  }

  if (changed) node.children = out;
}

/* ------------------------------------------------------------------ */
/* Komponenty pro jednotlivé značky                                    */
/* ------------------------------------------------------------------ */

function hastText(node: HastElement | undefined): string {
  if (!node) return "";
  let out = "";
  for (const child of node.children) {
    if (child.type === "text") out += child.value;
    else if (child.type === "element") out += hastText(child);
  }
  return out;
}

/** Buňka s 0/1 (pravdivostní tabulka, K-mapa) se čte líp monospace a na střed. */
function isBitCell(node: HastElement | undefined): boolean {
  const text = hastText(node).trim();
  return text.length > 0 && /^(?:[01]+|[xX*×–—-])$/.test(text);
}

function isImageOnly(node: HastElement | undefined): boolean {
  if (!node) return false;
  const meaningful = node.children.filter(
    (child) => !(child.type === "text" && child.value.trim() === ""),
  );
  return (
    meaningful.length === 1 &&
    meaningful[0].type === "element" &&
    meaningful[0].tagName === "img"
  );
}

function buildComponents(ctx: {
  math: MathToken[];
  highlighted: Map<string, string>;
  compact: boolean;
}): Components {
  const { math, highlighted, compact } = ctx;
  const prose = "max-w-[68ch]";
  const block = compact ? "mt-2 first:mt-0" : "mt-0 mb-4 last:mb-0";

  return {
    span(props) {
      const { node, children, ...rest } = props;
      void node;
      const index = (rest as Record<string, unknown>)["data-katex"];
      if (typeof index === "string") {
        const token = math[Number(index)];
        if (token) return <TeX tex={token.tex} display={token.display} />;
      }
      return <span {...rest}>{children}</span>;
    },

    p({ node, children }) {
      // <figure> je blokový prvek – v odstavci by prohlížeč odstavec ukončil.
      if (isImageOnly(node)) return <>{children}</>;
      return <p className={cn(block, prose)}>{children}</p>;
    },

    h1: ({ children }) => (
      <h2 className={cn("mt-5 mb-2 text-xl font-semibold first:mt-0", prose)}>{children}</h2>
    ),
    h2: ({ children }) => (
      <h3 className={cn("mt-5 mb-2 text-lg font-semibold first:mt-0", prose)}>{children}</h3>
    ),
    h3: ({ children }) => (
      <h4 className={cn("mt-4 mb-2 text-base font-semibold first:mt-0", prose)}>{children}</h4>
    ),
    h4: ({ children }) => (
      <h5 className={cn("text-text-muted mt-4 mb-1 text-sm font-semibold first:mt-0", prose)}>
        {children}
      </h5>
    ),

    ul: ({ children }) => (
      <ul className={cn(block, prose, "list-disc space-y-1 pl-5")}>{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className={cn(block, prose, "list-decimal space-y-1 pl-5")}>{children}</ol>
    ),
    li: ({ children }) => <li className="marker:text-text-faint">{children}</li>,

    blockquote: ({ children }) => (
      <blockquote
        className={cn(block, prose, "border-border-strong text-text-muted border-l-2 pl-4")}
      >
        {children}
      </blockquote>
    ),

    hr: () => <hr className="border-border-base my-6" />,

    a({ href, children }) {
      // V adrese ani v popisku obrázku značka vzorce nedává smysl – vrátíme dolary.
      const target = typeof href === "string" ? restore(href, math) : href;
      const external = typeof target === "string" && /^https?:/i.test(target);
      return (
        <a
          href={target}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="text-accent decoration-border-strong hover:decoration-accent underline underline-offset-2"
        >
          {children}
        </a>
      );
    },

    img({ src, alt, title }) {
      if (typeof src !== "string") return null;
      const caption = typeof title === "string" && title ? restore(title, math) : undefined;
      return (
        <Figure
          src={restore(src, math)}
          alt={restore(alt ?? "", math)}
          caption={caption}
          className={compact ? "my-2" : "my-4"}
        />
      );
    },

    // Shiki vrací celé <pre>, takže původní <pre> jen propustíme dál.
    pre: ({ children }) => <>{children}</>,

    code({ node, className: cls }) {
      const raw = hastText(node);
      const text = restore(raw, math);
      const lang = /language-([\w+#-]+)/.exec(cls ?? "")?.[1];
      const isBlock = lang !== undefined || raw.endsWith("\n");

      if (!isBlock) {
        return (
          <code className="border-border-base bg-bg-subtle rounded-chip border px-1 py-0.5 font-mono text-[0.85em]">
            {text}
          </code>
        );
      }

      const source = text.replace(/\s+$/, "");
      const html = highlighted.get(codeKey(normalizeLang(lang), source));

      // Když se blok nepodařilo spárovat s předem obarveným, ukáže se aspoň
      // čitelně naformátovaný. Lepší než nic a nikdy to nespadne.
      if (!html) {
        return (
          <pre className="shiki my-4 font-mono">
            <code>{source}</code>
          </pre>
        );
      }
      return <div className="my-4" dangerouslySetInnerHTML={{ __html: html }} />;
    },

    table: ({ children }) => (
      <div className={cn("overflow-x-auto", compact ? "my-2" : "my-4")}>
        <table className="border-border-base w-max min-w-full border-collapse text-left text-sm">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-bg-subtle">{children}</thead>,
    tr: ({ children }) => (
      <tr className="border-border-base border-b last:border-b-0 even:bg-[color-mix(in_oklab,var(--bg-subtle)_60%,transparent)]">
        {children}
      </tr>
    ),
    th: ({ node, children }) => (
      <th
        className={cn(
          "border-border-base text-text border px-3 py-1.5 font-semibold",
          isBitCell(node) && "text-center font-mono",
        )}
      >
        {children}
      </th>
    ),
    td: ({ node, children }) => (
      <td
        className={cn(
          "border-border-base border px-3 py-1.5 align-top",
          isBitCell(node) && "text-center font-mono tabular-nums",
        )}
      >
        {children}
      </td>
    ),
  };
}
