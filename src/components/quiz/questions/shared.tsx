"use client";

/**
 * Stavební kameny sdílené mezi typy otázek.
 *
 * Záměrně nejsou v `@/components/ui` – jsou šité na míru možnostem v kvízu
 * (stav po vyhodnocení, číslo pro klávesnici, zpětná vazba pod možností)
 * a nikde jinde by je nikdo nepoužil.
 */

import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Klávesnice                                                          */
/* ------------------------------------------------------------------ */

/**
 * Výběr možnosti číslem 1–9.
 *
 * Posluchač visí na okně, ne na kontejneru – jinak by čísla fungovala
 * jen když má uživatel zaměřenou zrovna některou možnost, což nikdo netrefí.
 */
export function useNumberKeys(count: number, enabled: boolean, onPick: (index: number) => void) {
  const pick = useRef(onPick);

  // Ref drží poslední `onPick`, aby se posluchač nemusel odepisovat a znovu
  // zapisovat při každém renderu. Zapisuje se až po renderu – refy se během
  // něj nesmí měnit.
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!enabled || count === 0) return;

    function onKey(event: KeyboardEvent<Element> | globalThis.KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const digit = Number(event.key);
      if (!Number.isInteger(digit) || digit < 1 || digit > Math.min(9, count)) return;

      event.preventDefault();
      pick.current(digit - 1);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, enabled]);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Procházení seznamu šipkami (roving tabindex).
 * V seznamu je vždy právě jedna položka v tab pořadí – Tab z něj vyskočí,
 * šipky se pohybují uvnitř. Tak to čekají čtečky obrazovky.
 */
export function useRovingList(count: number) {
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);

  const focusAt = useCallback(
    (index: number) => {
      if (count === 0) return;
      const next = ((index % count) + count) % count;
      setActive(next);
      items.current[next]?.focus();
    },
    [count],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, index: number) => {
      switch (event.key) {
        case "ArrowDown":
        case "ArrowRight":
          event.preventDefault();
          focusAt(index + 1);
          break;
        case "ArrowUp":
        case "ArrowLeft":
          event.preventDefault();
          focusAt(index - 1);
          break;
        case "Home":
          event.preventDefault();
          focusAt(0);
          break;
        case "End":
          event.preventDefault();
          focusAt(count - 1);
          break;
        case "Enter":
          // Enter patří tlačítku „Zkontrolovat" v liště – tady nesmí
          // překlopit výběr, jinak by odeslání měnilo odpověď.
          event.preventDefault();
          break;
      }
    },
    [count, focusAt],
  );

  const register = useCallback(
    (index: number) => (element: HTMLButtonElement | null) => {
      items.current[index] = element;
    },
    [],
  );

  return { active, setActive, onKeyDown, register };
}

/* ------------------------------------------------------------------ */
/* Možnost                                                             */
/* ------------------------------------------------------------------ */

export type OptionState = "idle" | "selected" | "correct" | "wrong" | "muted";

const OPTION_STATE: Record<OptionState, string> = {
  idle: "border-border-base bg-surface hover:border-border-strong hover:bg-surface-hover",
  selected: "border-accent bg-accent-soft",
  correct: "border-ok-border bg-ok-soft",
  wrong: "border-bad-border bg-bad-soft",
  muted: "border-border-base bg-surface opacity-55",
};

/**
 * Odvodí vzhled možnosti. Po vyhodnocení se správná vždy rozsvítí zeleně,
 * i když ji uživatel nevybral – bez toho se z chyby nic nenaučí.
 */
export function optionState(
  selected: boolean,
  isCorrect: boolean,
  evaluated: boolean,
): OptionState {
  if (!evaluated) return selected ? "selected" : "idle";
  if (isCorrect) return "correct";
  if (selected) return "wrong";
  return "muted";
}

export interface OptionButtonProps {
  /** Pořadí od nuly – zobrazuje se jako 1–9 pro výběr klávesnicí. */
  index: number;
  state: OptionState;
  selected: boolean;
  disabled: boolean;
  /** "radio" u jedné správné, "checkbox" u více správných. */
  role: "radio" | "checkbox";
  tabIndex: number;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  ref: (element: HTMLButtonElement | null) => void;
  children: ReactNode;
  /** Vysvětlení k téhle možnosti; ukáže se až po vyhodnocení. */
  feedback?: ReactNode;
}

export function OptionButton({
  index,
  state,
  selected,
  disabled,
  role,
  tabIndex,
  onSelect,
  onKeyDown,
  ref,
  children,
  feedback,
}: OptionButtonProps) {
  const evaluated = state === "correct" || state === "wrong" || state === "muted";

  return (
    // role="none" – jinak by mezi radiogroup a radio stál listitem
    // a čtečka by přestala hlásit "možnost 2 ze 4".
    <li role="none">
      <button
        ref={ref}
        type="button"
        role={role}
        aria-checked={selected}
        disabled={disabled}
        tabIndex={tabIndex}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        className={cn(
          "group flex w-full items-start gap-3 rounded-control border px-3 py-3 text-left",
          "transition-[background-color,border-color,opacity] duration-150 ease-out-soft",
          "disabled:cursor-default",
          OPTION_STATE[state],
        )}
      >
        <Marker index={index} state={state} selected={selected} role={role} />
        <span className="min-w-0 flex-1 text-[0.9375rem] leading-relaxed">{children}</span>
      </button>

      {/* Zpětná vazba se roluje dovnitř – rezervovat místo dopředu by
          u čtyřřádkového vysvětlení znamenalo obří díru v layoutu. */}
      <AnimatePresence initial={false}>
        {evaluated && feedback ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.21, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "mx-3 mt-1.5 border-l-2 pl-3 text-sm text-text-muted",
                state === "correct" ? "border-ok-border" : "border-bad-border",
              )}
            >
              {feedback}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

function Marker({
  index,
  state,
  selected,
  role,
}: {
  index: number;
  state: OptionState;
  selected: boolean;
  role: "radio" | "checkbox";
}) {
  if (state === "correct") {
    return (
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-chip bg-ok text-white">
        <Check className="size-4" aria-hidden />
      </span>
    );
  }
  if (state === "wrong") {
    return (
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-chip bg-bad text-white">
        <X className="size-4" aria-hidden />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "mt-0.5 grid size-6 shrink-0 place-items-center border text-xs font-medium tabular-nums",
        role === "radio" ? "rounded-full" : "rounded-chip",
        selected
          ? "border-accent bg-accent text-accent-text"
          : "border-border-strong text-text-faint group-hover:text-text-muted",
      )}
      aria-hidden
    >
      {index < 9 ? index + 1 : ""}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Drobnosti                                                           */
/* ------------------------------------------------------------------ */

/** Nenápadná nápověda k ovládání klávesnicí pod seznamem možností. */
export function KeyboardHint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-xs text-text-faint" aria-hidden>
      {children}
    </p>
  );
}

/** Pruh se správným řešením u typů, kde není co zvýraznit v možnostech. */
export function CorrectAnswerNote({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.21, ease: [0.22, 1, 0.36, 1] }}
      className="mt-3 rounded-control border border-ok-border bg-ok-soft px-3 py-2 text-sm"
    >
      {children}
    </motion.div>
  );
}

/** Rámeček textového vstupu podle stavu vyhodnocení. */
export function inputTone(evaluated: boolean, correct: boolean): string {
  if (!evaluated) return "border-border-strong focus-within:border-accent";
  return correct ? "border-ok-border bg-ok-soft" : "border-bad-border bg-bad-soft";
}
