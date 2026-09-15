"use client";

import { cn } from "@/lib/cn";

import type { QuestionInput } from "./types";

export function Cloze({
  question,
  value,
  onChange,
  evaluation,
  disabled,
  html,
}: QuestionInput<"cloze">) {
  // Šablonu rozsekal a přeložil server; tady se jen prokládá vstupními políčky.
  const segments = html.clozeParts ?? [];
  const evaluated = evaluation !== null;

  function setBlank(key: string, text: string) {
    onChange({ type: "cloze", blanks: { ...value.blanks, [key]: text } });
  }

  return (
    <div>
      {/* [&_p]:inline srovná odstavce z Markdownu do jednoho toku textu –
          jinak by každý úsek mezi mezerami začínal na novém řádku. */}
      <div className="text-[0.9375rem] leading-loose [&_p]:inline [&_p]:m-0">
        {segments.map((segment, index) => {
          if (segment.kind === "node") {
            return (
              <span key={`t${index}`}>
                {segment.value}
              </span>
            );
          }

          const blank = question.blanks[segment.key];
          if (!blank) return null;

          const ok = evaluated ? (evaluation.detail?.[segment.key] ?? false) : null;
          // Šířka podle nejdelší uznávané odpovědi – aby políčko neprozradilo
          // délku slova, ale ani ho neuřízlo.
          const width = Math.min(24, Math.max(5, longest(blank.accept) + 2));

          return (
            <span key={`b${index}-${segment.key}`} className="inline-flex flex-col align-baseline">
              <input
                type="text"
                value={value.blanks[segment.key] ?? ""}
                onChange={(event) => setBlank(segment.key, event.target.value)}
                disabled={disabled}
                placeholder={blank.placeholder ?? `${segment.key}.`}
                aria-label={`Mezera ${segment.key}`}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                style={{ width: `${width}ch` }}
                className={cn(
                  "mx-1 h-8 rounded-chip border bg-surface px-2 text-center text-sm outline-none",
                  "transition-colors duration-150 ease-out-soft",
                  "placeholder:text-text-faint disabled:text-text",
                  ok === null && "border-border-strong focus:border-accent",
                  ok === true && "border-ok-border bg-ok-soft",
                  ok === false && "border-bad-border bg-bad-soft",
                )}
              />
              {ok === false ? (
                <span className="mx-1 text-center text-xs leading-tight text-ok">
                  {blank.accept[0]}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>

      {!evaluated ? (
        <p className="mt-4 text-xs text-text-faint" aria-hidden>
          Mezi políčky přeskakuj tabulátorem. Enterem odešleš.
        </p>
      ) : null}
    </div>
  );
}

function longest(accept: readonly string[]): number {
  return accept.reduce((max, item) => Math.max(max, item.length), 0);
}
