"use client";

import { cn } from "@/lib/cn";

import { CorrectAnswerNote, inputTone } from "./shared";
import type { QuestionInput } from "./types";

const czNumber = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 10 });

export function Numeric({
  question,
  value,
  onChange,
  evaluation,
  disabled,
}: QuestionInput<"numeric">) {
  const evaluated = evaluation !== null;
  const correct = evaluation?.outcome === "correct";

  return (
    <div>
      <div
        className={cn(
          "flex items-center rounded-control border bg-surface px-3",
          "transition-colors duration-150 ease-out-soft",
          inputTone(evaluated, correct),
        )}
      >
        <input
          type="text"
          // inputMode místo type="number": na mobilu vyjede číselná klávesnice,
          // ale políčko nepolyká čárku ani vědecký zápis a nemá šipečky.
          inputMode="decimal"
          value={value.text}
          onChange={(event) => onChange({ type: "numeric", text: event.target.value })}
          disabled={disabled}
          placeholder="0"
          aria-label="Číselná odpověď"
          autoComplete="off"
          className="h-12 w-full bg-transparent text-base tabular-nums outline-none placeholder:text-text-faint disabled:text-text-muted"
        />
        {question.unit ? (
          <span className="shrink-0 pl-2 text-sm text-text-muted">{question.unit}</span>
        ) : null}
      </div>

      {evaluated && !correct ? (
        <CorrectAnswerNote>
          <span className="text-text-muted">Správně je </span>
          <strong className="font-medium tabular-nums">
            {czNumber.format(question.answer)}
            {question.unit ? ` ${question.unit}` : ""}
          </strong>
          <ToleranceNote tolerance={question.tolerance} />
        </CorrectAnswerNote>
      ) : null}

      {!evaluated ? (
        <p className="mt-2 text-xs text-text-faint" aria-hidden>
          Desetinné číslo zapiš čárkou i tečkou, jak ti to sedne. Enterem odešleš.
        </p>
      ) : null}
    </div>
  );
}

function ToleranceNote({
  tolerance,
}: {
  tolerance: QuestionInput<"numeric">["question"]["tolerance"];
}) {
  if (tolerance.kind === "absolute" && tolerance.value === 0) return null;

  const text =
    tolerance.kind === "absolute"
      ? `s tolerancí ±${czNumber.format(tolerance.value)}`
      : tolerance.kind === "relative"
        ? `s tolerancí ±${czNumber.format(tolerance.value * 100)} %`
        : `zaokrouhleno na ${tolerance.value} desetinných míst`;

  return <span className="text-text-muted"> ({text})</span>;
}
