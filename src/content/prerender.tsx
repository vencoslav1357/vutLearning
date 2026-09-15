import type { ReactNode } from "react";
import { RichText } from "@/components/render/RichText";
import { CodePanel } from "@/components/render/CodePanel";
import type { Question } from "./schema";

/**
 * Proč tohle existuje:
 *
 * Zadání otázek je Markdown s LaTeXem a kódem. KaTeX i Shiki běží jen na
 * serveru – do prohlížeče by jinak šlo přes megabajt JS navíc. Jenže
 * komponenty, které otázku obsluhují, musí být klientské, protože drží
 * rozepsanou odpověď.
 *
 * Řešení: serverová komponenta si texty vyrenderuje dopředu a klientské
 * komponentě je předá jako `ReactNode` v props. React Server Components
 * to umí – hotový strom projde RSC payloadem a klient ho jen vloží
 * na své místo. Knihovny zůstanou na serveru.
 *
 * Proto se tenhle modul nikdy nevolá z klienta.
 */

/** Vyrenderované části jedné otázky, připravené k předání klientovi. */
export interface RenderedQuestion {
  prompt: ReactNode;
  explanation?: ReactNode;
  hint?: ReactNode;
  /** id možnosti → vyrenderovaný text */
  choices?: Record<string, ReactNode>;
  /** id možnosti → vyrenderovaná zpětná vazba */
  feedback?: Record<string, ReactNode>;
  /** id položky → text (ordering) */
  items?: Record<string, ReactNode>;
  /** id položky → text (matching, levý sloupec) */
  left?: Record<string, ReactNode>;
  /** id položky → text (matching, pravý sloupec) */
  right?: Record<string, ReactNode>;
  /** Šablona rozsekaná na úseky textu a mezery (cloze). */
  clozeParts?: ClozePart[];
  /** Panel s kódem ze zadání. */
  code?: ReactNode;
  /** Panel s kódem u otázek typu codeOutput. */
  source?: ReactNode;
}

export type ClozePart =
  | { kind: "node"; value: ReactNode }
  | { kind: "blank"; key: string };

/**
 * Připraví všechny textové části otázky.
 *
 * Funkce je synchronní – jen skládá elementy. O to, že uvnitř `RichText`
 * a `CodePanel` běží asynchronní práce, se postará React při renderu.
 */
export function prerenderQuestion(q: Question): RenderedQuestion {
  const out: RenderedQuestion = {
    prompt: <RichText>{q.prompt}</RichText>,
  };

  if (q.explanation) out.explanation = <RichText>{q.explanation}</RichText>;
  if (q.hint) out.hint = <RichText compact>{q.hint}</RichText>;

  if (q.code) {
    out.code = (
      <CodePanel
        language={q.code.language}
        source={q.code.source}
        filename={q.code.filename}
      />
    );
  }

  if ("choices" in q && q.choices) {
    const choices: Record<string, ReactNode> = {};
    const feedback: Record<string, ReactNode> = {};
    for (const c of q.choices) {
      choices[c.id] = <RichText compact>{c.text}</RichText>;
      if (c.feedback) feedback[c.id] = <RichText compact>{c.feedback}</RichText>;
    }
    out.choices = choices;
    if (Object.keys(feedback).length > 0) out.feedback = feedback;
  }

  if (q.type === "ordering") {
    out.items = Object.fromEntries(
      q.items.map((i) => [i.id, <RichText compact key={i.id}>{i.text}</RichText>]),
    );
  }

  if (q.type === "matching") {
    out.left = Object.fromEntries(
      q.left.map((i) => [i.id, <RichText compact key={i.id}>{i.text}</RichText>]),
    );
    out.right = Object.fromEntries(
      q.right.map((i) => [i.id, <RichText compact key={i.id}>{i.text}</RichText>]),
    );
  }

  if (q.type === "cloze") out.clozeParts = splitCloze(q.template);

  if (q.type === "codeOutput") {
    out.source = (
      <CodePanel
        language={q.language}
        source={q.source}
        filename={q.filename}
        className="mt-0"
      />
    );
  }

  return out;
}

/**
 * Rozseká šablonu na úseky textu a mezery `{{1}}`, `{{2}}`…
 *
 * Každý úsek se renderuje zvlášť, aby se vstupní políčka daly vsadit
 * přímo mezi ně a text kolem nich plynul jako jedna věta.
 */
function splitCloze(template: string): ClozePart[] {
  const parts: ClozePart[] = [];
  const pattern = /\{\{(\d+)\}\}/g;
  let last = 0;

  for (let m = pattern.exec(template); m; m = pattern.exec(template)) {
    if (m.index > last) {
      const text = template.slice(last, m.index);
      parts.push({ kind: "node", value: <RichText compact>{text}</RichText> });
    }
    parts.push({ kind: "blank", key: m[1] });
    last = m.index + m[0].length;
  }
  if (last < template.length) {
    const text = template.slice(last);
    parts.push({ kind: "node", value: <RichText compact>{text}</RichText> });
  }

  return parts;
}

/** Připraví otázky jedné sady pro běh kvízu. Volá se ze serverových stránek. */
export function buildSessionQuestions(set: {
  id: string;
  title: string;
  course: string;
  questions: Array<Question & { materialHash: string }>;
}) {
  return set.questions.map((q) => ({
    question: q as Question,
    setId: set.id,
    setTitle: set.title,
    course: set.course,
    materialHash: q.materialHash,
    html: prerenderQuestion(q),
  }));
}
