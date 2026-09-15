"use client";

import { AnimatePresence, motion } from "motion/react";
import { Lightbulb } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Figure } from "@/components/render";
import { cn } from "@/lib/cn";
import { emptyAnswer, type Answer, type Evaluation } from "@/lib/quiz/evaluate";
import type { Question } from "@/content/schema";
import type { RenderedQuestion } from "@/content/prerender";

import {
  Cloze,
  CodeOutput,
  Matching,
  MultiChoice,
  Numeric,
  Ordering,
  ShortText,
  SingleChoice,
  TrueFalse,
} from "./questions";

const MOTION = { duration: 0.21, ease: [0.22, 1, 0.36, 1] } as const;

export interface QuestionCardProps {
  question: Question;
  /** null = QuizRunner ještě nestihl založit odpověď; doplní se výchozí. */
  value: Answer | null;
  onChange: (answer: Answer) => void;
  evaluation: Evaluation | null;
  disabled: boolean;
  seed: number;
  /** Markdown přeložený na HTML už na serveru. */
  html: RenderedQuestion;
  /** Nápověda se počítá jako slabší znalost – runner si to zapíše k pokusu. */
  onHintUsed?: () => void;
}

export function QuestionCard({
  question,
  value,
  onChange,
  evaluation,
  disabled,
  seed,
  html,
  onHintUsed,
}: QuestionCardProps) {
  // Nová otázka = zavřená nápověda. Resetovat stav tady netřeba: QuizRunner
  // vykresluje kartu pod `key={question.id}`, takže při změně otázky vznikne
  // nová komponenta a `hintOpen` začíná od `false`.
  const [hintOpen, setHintOpen] = useState(false);

  const fallback = useMemo(() => emptyAnswer(question, seed), [question, seed]);
  const answer = value ?? fallback;

  return (
    <article className="rounded-card border border-border-base bg-surface p-4 shadow-card sm:p-6">
      <header>
        <div className="text-[1.0625rem] leading-relaxed text-text">
          {html.prompt}
        </div>

        {question.figure ? <Figure {...question.figure} className="mt-4" /> : null}

        {/* codeOutput si kód vykresluje sám – tady by byl dvakrát. */}
        {question.code && question.type !== "codeOutput" ? (
          html.code
        ) : null}
      </header>

      <div className="mt-5">
        <QuestionInputSwitch
          question={question}
          answer={answer}
          onChange={onChange}
          evaluation={evaluation}
          disabled={disabled}
          seed={seed}
          html={html}
        />
      </div>

      {question.hint && !evaluation ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => {
              setHintOpen((open) => !open);
              if (!hintOpen) onHintUsed?.();
            }}
            aria-expanded={hintOpen}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-sm",
              "text-text-muted transition-colors duration-150 ease-out-soft",
              "hover:bg-bg-subtle hover:text-text",
            )}
          >
            <Lightbulb className={cn("size-4", hintOpen && "text-warn")} aria-hidden />
            {hintOpen ? "Skrýt nápovědu" : "Nápověda"}
          </button>

          <Collapsible open={hintOpen}>
            <div className="mt-2 rounded-control border border-warn-border bg-warn-soft px-3 py-2 text-sm text-text">
              {html.hint}
            </div>
          </Collapsible>
        </div>
      ) : null}

      <Collapsible open={Boolean(evaluation && question.explanation)}>
        <section className="mt-5 border-t border-border-base pt-4">
          <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-text-faint">
            Vysvětlení
          </h3>
          <div className="text-sm leading-relaxed text-text-muted">
            {html.explanation}
          </div>
        </section>
      </Collapsible>
    </article>
  );
}

/**
 * Přepínač podle typu otázky.
 *
 * `switch` je vyčerpávající a návratový typ je `never` ve výchozí větvi –
 * až se do schématu přidá desátý typ, TypeScript to tady zastaví
 * dřív, než někdo v kvízu narazí na prázdné místo.
 */
function QuestionInputSwitch({
  question,
  answer,
  onChange,
  evaluation,
  disabled,
  seed,
  html,
}: {
  question: Question;
  answer: Answer;
  onChange: (answer: Answer) => void;
  evaluation: Evaluation | null;
  disabled: boolean;
  seed: number;
  html: RenderedQuestion;
}) {
  const shared = { evaluation, disabled, seed, html, onChange };

  switch (question.type) {
    case "single":
      return answer.type === "single" ? (
        <SingleChoice question={question} value={answer} {...shared} />
      ) : null;
    case "multi":
      return answer.type === "multi" ? (
        <MultiChoice question={question} value={answer} {...shared} />
      ) : null;
    case "trueFalse":
      return answer.type === "trueFalse" ? (
        <TrueFalse question={question} value={answer} {...shared} />
      ) : null;
    case "shortText":
      return answer.type === "shortText" ? (
        <ShortText question={question} value={answer} {...shared} />
      ) : null;
    case "numeric":
      return answer.type === "numeric" ? (
        <Numeric question={question} value={answer} {...shared} />
      ) : null;
    case "ordering":
      return answer.type === "ordering" ? (
        <Ordering question={question} value={answer} {...shared} />
      ) : null;
    case "matching":
      return answer.type === "matching" ? (
        <Matching question={question} value={answer} {...shared} />
      ) : null;
    case "cloze":
      return answer.type === "cloze" ? (
        <Cloze question={question} value={answer} {...shared} />
      ) : null;
    case "codeOutput":
      return answer.type === "codeOutput" ? (
        <CodeOutput question={question} value={answer} {...shared} />
      ) : null;
    default:
      return assertNever(question);
  }
}

function assertNever(value: never): never {
  throw new Error(`Neznámý typ otázky: ${JSON.stringify(value)}`);
}

/** Rozbalení s animovanou výškou – layout pod tím nepodskočí. */
function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={MOTION}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
