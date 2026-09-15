"use client";

import { Check, X } from "lucide-react";

import { cn } from "@/lib/cn";

import { KeyboardHint, useNumberKeys, useRovingList } from "./shared";
import type { QuestionInput } from "./types";

const CHOICES = [
  { value: true, label: "Pravda", Icon: Check },
  { value: false, label: "Nepravda", Icon: X },
] as const;

export function TrueFalse({
  question,
  value,
  onChange,
  evaluation,
  disabled,
}: QuestionInput<"trueFalse">) {
  const { active, setActive, onKeyDown, register } = useRovingList(CHOICES.length);
  const evaluated = evaluation !== null;

  function pick(index: number) {
    const choice = CHOICES[index];
    if (!choice || disabled) return;
    setActive(index);
    onChange({ type: "trueFalse", value: choice.value });
  }

  useNumberKeys(CHOICES.length, !disabled, pick);

  return (
    <div>
      <div role="radiogroup" aria-label="Pravda nebo nepravda" className="grid grid-cols-2 gap-3">
        {CHOICES.map((choice, index) => {
          const selected = value.value === choice.value;
          const isCorrect = choice.value === question.answer;

          return (
            <button
              key={choice.label}
              ref={register(index)}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              tabIndex={index === active ? 0 : -1}
              onClick={() => pick(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-control border px-4 py-4",
                "text-base font-medium",
                "transition-[background-color,border-color,opacity] duration-150 ease-out-soft",
                "disabled:cursor-default",
                !evaluated && !selected && "border-border-base bg-surface hover:bg-surface-hover",
                !evaluated && selected && "border-accent bg-accent-soft",
                evaluated && isCorrect && "border-ok-border bg-ok-soft text-ok",
                evaluated && !isCorrect && selected && "border-bad-border bg-bad-soft text-bad",
                evaluated && !isCorrect && !selected && "border-border-base bg-surface opacity-55",
              )}
            >
              <choice.Icon className="size-5" aria-hidden />
              {choice.label}
              <span className="ml-1 text-xs tabular-nums text-text-faint" aria-hidden>
                {index + 1}
              </span>
            </button>
          );
        })}
      </div>

      {!evaluated ? <KeyboardHint>1 = pravda, 2 = nepravda.</KeyboardHint> : null}
    </div>
  );
}
