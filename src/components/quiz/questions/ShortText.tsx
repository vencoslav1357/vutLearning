"use client";

import { cn } from "@/lib/cn";

import { CorrectAnswerNote, inputTone } from "./shared";
import type { QuestionInput } from "./types";

export function ShortText({
  question,
  value,
  onChange,
  evaluation,
  disabled,
}: QuestionInput<"shortText">) {
  const evaluated = evaluation !== null;
  const correct = evaluation?.outcome === "correct";

  // Vedle té hlavní se vejde pár dalších uznávaných variant – pomůže to
  // uživateli pochopit, že "rank" i "hodnost" jsou totéž.
  const alternatives = question.accept.slice(1, 4);

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
          value={value.text}
          onChange={(event) => onChange({ type: "shortText", text: event.target.value })}
          disabled={disabled}
          placeholder={question.placeholder ?? "Napiš odpověď…"}
          aria-label="Odpověď"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          // Focus ring řeší rámeček obalu, ne samotné políčko –
          // jinak by se uvnitř kreslily dva obdélníky přes sebe.
          className="h-12 w-full bg-transparent text-base outline-none placeholder:text-text-faint disabled:text-text-muted"
        />
      </div>

      {evaluated && !correct ? (
        <CorrectAnswerNote>
          <span className="text-text-muted">Správně je </span>
          {/* Uznávané varianty jsou prostý text, ne Markdown – proto žádný RichText. */}
          <strong className="font-medium">{question.accept[0]}</strong>
          {alternatives.length > 0 ? (
            <span className="text-text-muted"> (uznává se i {alternatives.join(", ")})</span>
          ) : null}
        </CorrectAnswerNote>
      ) : null}

      {!evaluated ? (
        <p className="mt-2 text-xs text-text-faint" aria-hidden>
          {question.normalize.stripDiacritics && question.normalize.caseInsensitive
            ? "Na diakritice ani velikosti písmen nezáleží. Enterem odešleš."
            : "Enterem odešleš."}
        </p>
      ) : null}
    </div>
  );
}
