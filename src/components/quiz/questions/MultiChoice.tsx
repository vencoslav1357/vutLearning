"use client";

import { useMemo } from "react";

import { shuffleChoices } from "@/lib/quiz/shuffle";

import { KeyboardHint, OptionButton, optionState, useNumberKeys, useRovingList } from "./shared";
import type { QuestionInput } from "./types";

export function MultiChoice({
  question,
  value,
  onChange,
  evaluation,
  disabled,
  seed,
  allowShuffle,
  html,
}: QuestionInput<"multi">) {
  const choices = useMemo(
    () =>
      question.shuffleChoices && allowShuffle
        ? shuffleChoices(question.choices, seed)
        : question.choices,
    [question.choices, question.shuffleChoices, allowShuffle, seed],
  );

  const { active, setActive, onKeyDown, register } = useRovingList(choices.length);
  const evaluated = evaluation !== null;
  const correct = useMemo(() => new Set(question.correct), [question.correct]);

  function toggle(index: number) {
    const choice = choices[index];
    if (!choice || disabled) return;
    setActive(index);

    const next = value.choiceIds.includes(choice.id)
      ? value.choiceIds.filter((id) => id !== choice.id)
      : [...value.choiceIds, choice.id];
    onChange({ type: "multi", choiceIds: next });
  }

  useNumberKeys(choices.length, !disabled, toggle);

  return (
    <div>
      <p className="mb-2 text-sm text-text-muted">
        {question.partialCredit
          ? "Vyber všechny správné možnosti. Počítá se i částečná odpověď."
          : "Vyber všechny správné možnosti. Uznává se jen úplně přesný výběr."}
      </p>

      <ul role="group" aria-label="Možnosti" className="flex flex-col gap-2">
        {choices.map((choice, index) => {
          const selected = value.choiceIds.includes(choice.id);
          const isCorrect = correct.has(choice.id);
          const state = optionState(selected, isCorrect, evaluated);

          return (
            <OptionButton
              key={choice.id}
              index={index}
              state={state}
              selected={selected}
              disabled={disabled}
              role="checkbox"
              tabIndex={index === active ? 0 : -1}
              ref={register(index)}
              onSelect={() => toggle(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              feedback={
                choice.feedback && (selected || isCorrect) ? (
                  html.feedback?.[choice.id]
                ) : undefined
              }
            >
              {html.choices?.[choice.id]}
            </OptionButton>
          );
        })}
      </ul>

      {!evaluated ? (
        <KeyboardHint>Přepínej číslem 1–{choices.length}, mezerníkem nebo šipkami.</KeyboardHint>
      ) : null}
    </div>
  );
}
