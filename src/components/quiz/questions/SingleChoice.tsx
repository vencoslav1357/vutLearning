"use client";

import { useMemo } from "react";

import { shuffleChoices } from "@/lib/quiz/shuffle";

import { KeyboardHint, OptionButton, optionState, useNumberKeys, useRovingList } from "./shared";
import type { QuestionInput } from "./types";

export function SingleChoice({
  question,
  value,
  onChange,
  evaluation,
  disabled,
  seed,
  html,
}: QuestionInput<"single">) {
  // Pořadí se počítá jen ze seedu, takže překreslení možnostmi nezamává.
  const choices = useMemo(
    () => (question.shuffleChoices ? shuffleChoices(question.choices, seed) : question.choices),
    [question.choices, question.shuffleChoices, seed],
  );

  const { active, setActive, onKeyDown, register } = useRovingList(choices.length);
  const evaluated = evaluation !== null;

  function pick(index: number) {
    const choice = choices[index];
    if (!choice || disabled) return;
    setActive(index);
    onChange({ type: "single", choiceId: choice.id });
  }

  useNumberKeys(choices.length, !disabled, pick);

  return (
    <div>
      <ul role="radiogroup" aria-label="Možnosti" className="flex flex-col gap-2">
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
              // Zpětná vazba dává smysl jen u toho, co uživatel vybral,
              // a u správné možnosti – zbytek by byl jen zeď textu.
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

      {!evaluated ? <KeyboardHint>Vyber číslem 1–{choices.length} nebo šipkami.</KeyboardHint> : null}
    </div>
  );
}
