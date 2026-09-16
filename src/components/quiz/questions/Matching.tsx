"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/cn";
import { shuffleChoices } from "@/lib/quiz/shuffle";

import type { QuestionInput } from "./types";

export function Matching({
  question,
  value,
  onChange,
  evaluation,
  disabled,
  seed,
  allowShuffle,
  html,
}: QuestionInput<"matching">) {
  // Pravý sloupec se míchá vždycky – v souboru je skoro jistě zapsaný
  // ve stejném pořadí jako ten levý a bez zamíchání by šlo jen "první k prvnímu".
  const right = useMemo(
    () => (allowShuffle ? shuffleChoices(question.right, seed) : question.right),
    [question.right, allowShuffle, seed],
  );
  const rightText = useMemo(() => new Map(right.map((item) => [item.id, item.text])), [right]);

  const assigned = useMemo(() => new Map(value.pairs), [value.pairs]);
  const correctRight = useMemo(() => new Map(question.pairs), [question.pairs]);
  const evaluated = evaluation !== null;

  function assign(leftId: string, rightId: string) {
    const pairs = question.left
      .map((item) => {
        const picked = item.id === leftId ? rightId : (assigned.get(item.id) ?? "");
        return [item.id, picked] as [string, string];
      })
      .filter(([, picked]) => picked !== "");
    onChange({ type: "matching", pairs });
  }

  return (
    <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] md:gap-6">
      <ul className="flex flex-col gap-2">
        {question.left.map((item) => {
          const picked = assigned.get(item.id) ?? "";
          const ok = evaluated ? (evaluation.detail?.[item.id] ?? false) : null;
          const expected = correctRight.get(item.id);

          return (
            <li
              key={item.id}
              className={cn(
                "rounded-control border px-3 py-2.5",
                "transition-[background-color,border-color] duration-150 ease-out-soft",
                ok === null && "border-border-base bg-surface",
                ok === true && "border-ok-border bg-ok-soft",
                ok === false && "border-bad-border bg-bad-soft",
              )}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="min-w-0 flex-1 text-[0.9375rem] leading-relaxed">
                  {html.left?.[item.id]}
                </span>

                {/* Nativní <select> místo přetahování mezi sloupci: na dotykovém
                    displeji je drag-and-drop utrpení a čtečky ho neumí vůbec. */}
                <div className="relative shrink-0 sm:w-56">
                  <select
                    value={picked}
                    disabled={disabled}
                    onChange={(event) => assign(item.id, event.target.value)}
                    aria-label={`Přiřazení k položce ${plainText(item.text)}`}
                    className={cn(
                      "h-10 w-full appearance-none rounded-control border border-border-strong",
                      "bg-surface pl-3 pr-9 text-sm text-text outline-none",
                      "transition-colors duration-150 ease-out-soft",
                      "hover:border-text-faint disabled:text-text-muted",
                      picked === "" && "text-text-faint",
                    )}
                  >
                    <option value="">– vyber –</option>
                    {right.map((option) => (
                      <option key={option.id} value={option.id}>
                        {plainText(option.text)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-faint"
                    aria-hidden
                  />
                </div>

                {ok !== null ? (
                  <span className="shrink-0" aria-hidden>
                    {ok ? (
                      <Check className="size-5 text-ok" />
                    ) : (
                      <X className="size-5 text-bad" />
                    )}
                  </span>
                ) : null}
              </div>

              {ok === false && expected ? (
                <p className="mt-1.5 text-sm text-text-muted">
                  Správně patří: {plainText(rightText.get(expected) ?? expected)}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Přehled pravého sloupce – na mobilu by jen zabíral místo,
          tam ho plně nahradí rozbalovač u každé položky. */}
      <aside className="mt-4 hidden md:mt-0 md:block">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-faint">
          Nabídka
        </p>
        <ul className="flex flex-col gap-1.5">
          {right.map((option) => {
            const used = value.pairs.some(([, rightId]) => rightId === option.id);
            return (
              <li
                key={option.id}
                className={cn(
                  "rounded-chip border border-border-base bg-bg-subtle px-2.5 py-1.5 text-sm",
                  "transition-opacity duration-150 ease-out-soft",
                  used && "opacity-45",
                )}
              >
                {html.right?.[option.id]}
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}

/**
 * Do <option> ani do aria-label se HTML nedostane, takže se z Markdownu
 * musí vytáhnout holý text. Stačí odstranit značky, které autoři reálně píšou.
 */
function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\$\$?([^$]*)\$?\$/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
