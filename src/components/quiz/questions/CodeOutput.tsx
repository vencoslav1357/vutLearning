"use client";

import { useId, useMemo } from "react";

import { cn } from "@/lib/cn";
import { normalizeOutput } from "@/lib/quiz/evaluate";
import { shuffleChoices } from "@/lib/quiz/shuffle";

import { KeyboardHint, OptionButton, optionState, useNumberKeys, useRovingList } from "./shared";
import type { QuestionInput } from "./types";

export function CodeOutput(props: QuestionInput<"codeOutput">) {
  const { question, html } = props;

  return (
    <div>
      {html.source}
      {question.mode === "choice" ? <OutputChoice {...props} /> : <OutputExact {...props} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* mode: "exact"                                                       */
/* ------------------------------------------------------------------ */

function OutputExact({ question, value, onChange, evaluation, disabled }: QuestionInput<"codeOutput">) {
  const fieldId = useId();
  const evaluated = evaluation !== null;
  const correct = evaluation?.outcome === "correct";
  const text = value.text ?? "";

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm text-text-muted">
        Co program vypíše?
      </label>
      <textarea
        id={fieldId}
        value={text}
        onChange={(event) => onChange({ type: "codeOutput", text: event.target.value })}
        disabled={disabled}
        rows={Math.min(10, Math.max(3, text.split("\n").length + 1))}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        placeholder="Výstup programu…"
        className={cn(
          "w-full resize-y rounded-control border bg-surface px-3 py-2.5",
          "font-mono text-sm leading-relaxed outline-none",
          "transition-colors duration-150 ease-out-soft",
          "placeholder:text-text-faint disabled:text-text-muted",
          !evaluated && "border-border-strong focus:border-accent",
          evaluated && correct && "border-ok-border bg-ok-soft",
          evaluated && !correct && "border-bad-border bg-bad-soft",
        )}
      />

      {!evaluated ? (
        <p className="mt-2 text-xs text-text-faint" aria-hidden>
          Mezery na koncích řádků ani chybějící poslední odřádkování se nepočítají.
        </p>
      ) : null}

      {evaluated && !correct ? (
        <OutputDiff expected={question.expected ?? ""} actual={text} />
      ) : null}
    </div>
  );
}

/** Očekávaný a zadaný výstup vedle sebe, rozdílné řádky zvýrazněné. */
function OutputDiff({ expected, actual }: { expected: string; actual: string }) {
  const rows = useMemo(() => {
    const left = normalizeOutput(expected).split("\n");
    const right = normalizeOutput(actual).split("\n");
    const count = Math.max(left.length, right.length);

    return Array.from({ length: count }, (_, i) => ({
      expected: left[i],
      actual: right[i],
      same: left[i] === right[i],
    }));
  }, [expected, actual]);

  return (
    <div className="mt-3 overflow-hidden rounded-control border border-border-base">
      <div className="grid grid-cols-2 border-b border-border-base bg-bg-subtle text-xs font-medium">
        <span className="px-3 py-1.5 text-text-muted">Očekávaný výstup</span>
        <span className="border-l border-border-base px-3 py-1.5 text-text-muted">Tvůj výstup</span>
      </div>
      <div className="grid grid-cols-2 overflow-x-auto font-mono text-xs leading-relaxed">
        <ol className="min-w-0">
          {rows.map((row, i) => (
            <DiffCell key={`e${i}`} text={row.expected} same={row.same} side="expected" />
          ))}
        </ol>
        <ol className="min-w-0 border-l border-border-base">
          {rows.map((row, i) => (
            <DiffCell key={`a${i}`} text={row.actual} same={row.same} side="actual" />
          ))}
        </ol>
      </div>
    </div>
  );
}

function DiffCell({
  text,
  same,
  side,
}: {
  text: string | undefined;
  same: boolean;
  side: "expected" | "actual";
}) {
  return (
    <li
      className={cn(
        "whitespace-pre px-3 py-0.5",
        !same && (side === "expected" ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"),
      )}
    >
      {text === undefined ? (
        <span className="text-text-faint italic">(chybí)</span>
      ) : text === "" ? (
        " "
      ) : (
        text
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* mode: "choice"                                                      */
/* ------------------------------------------------------------------ */

function OutputChoice({
  question,
  value,
  onChange,
  evaluation,
  disabled,
  seed,
  html,
}: QuestionInput<"codeOutput">) {
  const choices = useMemo(() => {
    const all = question.choices ?? [];
    return question.shuffleChoices ? shuffleChoices(all, seed) : all;
  }, [question.choices, question.shuffleChoices, seed]);

  const { active, setActive, onKeyDown, register } = useRovingList(choices.length);
  const evaluated = evaluation !== null;

  function pick(index: number) {
    const choice = choices[index];
    if (!choice || disabled) return;
    setActive(index);
    onChange({ type: "codeOutput", choiceId: choice.id });
  }

  useNumberKeys(choices.length, !disabled, pick);

  return (
    <div>
      <p className="mb-2 text-sm text-text-muted">Co program vypíše?</p>

      <ul role="radiogroup" aria-label="Možnosti výstupu" className="flex flex-col gap-2">
        {choices.map((choice, index) => {
          const selected = value.choiceId === choice.id;
          const isCorrect = choice.id === question.correct;
          const state = optionState(selected, isCorrect, evaluated);

          return (
            <OptionButton
              key={choice.id}
              index={index}
              state={state}
              selected={selected}
              disabled={disabled}
              role="radio"
              tabIndex={index === active ? 0 : -1}
              ref={register(index)}
              onSelect={() => pick(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              feedback={
                choice.feedback && (selected || isCorrect) ? (
                  html.feedback?.[choice.id]
                ) : undefined
              }
            >
              <span className="font-mono">
                {html.choices?.[choice.id]}
              </span>
            </OptionButton>
          );
        })}
      </ul>

      {!evaluated ? <KeyboardHint>Vyber číslem 1–{choices.length} nebo šipkami.</KeyboardHint> : null}
    </div>
  );
}
