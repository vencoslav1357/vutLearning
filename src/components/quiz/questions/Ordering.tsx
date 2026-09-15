"use client";

import { Reorder, useDragControls } from "motion/react";
import { GripVertical } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

import type { QuestionInput } from "./types";

export function Ordering({
  question,
  value,
  onChange,
  evaluation,
  disabled,
  html,
}: QuestionInput<"ordering">) {
  // Texty položek vyrenderoval server; tady se jen dohledávají podle id.
  const byId = useMemo(
    () => new Map(question.items.map((item) => [item.id, html.items?.[item.id] ?? item.text])),
    [question.items, html.items],
  );
  const evaluated = evaluation !== null;

  const handles = useRef(new Map<string, HTMLButtonElement | null>());
  const [announcement, setAnnouncement] = useState("");
  // Položka, na kterou se má po přeskládání vrátit zaměření. Je to ref, ne
  // stav – hodnota nic nevykresluje a nemá kvůli ní vznikat další render.
  const focusAfterMove = useRef<string | null>(null);

  // Po přesunu se řádek v DOM přeskládá a zaměření by spadlo na <body>;
  // tohle ho vrátí na stejnou položku, ať se dá posouvat dál bez sáhnutí na myš.
  useEffect(() => {
    const id = focusAfterMove.current;
    focusAfterMove.current = null;
    if (!id || !value.order.includes(id)) return;
    handles.current.get(id)?.focus();
  }, [value.order]);

  const move = useCallback(
    (id: string, delta: number) => {
      if (disabled) return;
      const index = value.order.indexOf(id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= value.order.length) return;

      const next = value.order.slice();
      next.splice(index, 1);
      next.splice(target, 0, id);

      onChange({ type: "ordering", order: next });
      setAnnouncement(`Přesunuto na pozici ${target + 1} z ${next.length}.`);
      focusAfterMove.current = id;
    },
    [disabled, onChange, value.order],
  );

  return (
    <div>
      <p className="mb-2 text-sm text-text-muted">
        Seřaď položky odshora dolů. Táhni je myší, nebo je přesouvej šipkami.
      </p>

      <Reorder.Group
        axis="y"
        values={value.order}
        onReorder={(order: string[]) => {
          if (!disabled) onChange({ type: "ordering", order });
        }}
        className="flex list-none flex-col gap-2"
      >
        {value.order.map((id, index) => (
          <OrderingRow
            key={id}
            id={id}
            index={index}
            total={value.order.length}
            html={byId.get(id) ?? id}
            disabled={disabled}
            placedRight={evaluated ? (evaluation.detail?.[id] ?? false) : null}
            onMove={move}
            registerHandle={(element) => handles.current.set(id, element)}
          />
        ))}
      </Reorder.Group>

      {/* Přesun myší vidí každý, přesun klávesnicí musí někdo oznámit. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {evaluated && evaluation.outcome !== "correct" ? (
        <div className="mt-3 rounded-control border border-ok-border bg-ok-soft px-3 py-2 text-sm">
          <p className="mb-1 text-text-muted">Správné pořadí:</p>
          <ol className="list-inside list-decimal space-y-0.5">
            {question.correctOrder.map((id) => (
              <li key={id} className="marker:text-text-faint marker:tabular-nums">
                <span className="inline-block align-top">
                  {byId.get(id) ?? id}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {!evaluated ? (
        <p className="mt-3 text-xs text-text-faint" aria-hidden>
          Klávesnicí: Tab na úchyt, pak šipka nahoru/dolů (nebo Alt + šipka odkudkoliv z řádku).
        </p>
      ) : null}
    </div>
  );
}

function OrderingRow({
  id,
  index,
  total,
  html,
  disabled,
  placedRight,
  onMove,
  registerHandle,
}: {
  id: string;
  index: number;
  total: number;
  /** Vyrenderovaný text položky. */
  html: ReactNode;
  disabled: boolean;
  /** null = ještě nevyhodnoceno. */
  placedRight: boolean | null;
  onMove: (id: string, delta: number) => void;
  registerHandle: (element: HTMLButtonElement | null) => void;
}) {
  // Táhnout jde jen za úchyt – kdyby byl citlivý celý řádek,
  // na dotykovém displeji by se nedala odrolovat stránka.
  const controls = useDragControls();

  function onHandleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onMove(id, -1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      onMove(id, 1);
    }
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!event.altKey) return;
    onHandleKeyDown(event);
  }

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      onKeyDown={onRowKeyDown}
      className={cn(
        "flex touch-none items-center gap-2 rounded-control border px-2 py-2.5",
        "transition-[background-color,border-color] duration-150 ease-out-soft",
        placedRight === null && "border-border-base bg-surface",
        placedRight === true && "border-ok-border bg-ok-soft",
        placedRight === false && "border-bad-border bg-bad-soft",
      )}
    >
      <span className="w-5 shrink-0 text-center text-xs tabular-nums text-text-faint" aria-hidden>
        {index + 1}
      </span>

      <button
        ref={registerHandle}
        type="button"
        disabled={disabled}
        onPointerDown={(event) => {
          if (!disabled) controls.start(event);
        }}
        onKeyDown={onHandleKeyDown}
        aria-label={`Přesunout položku, pozice ${index + 1} z ${total}`}
        className={cn(
          "grid size-8 shrink-0 cursor-grab place-items-center rounded-chip text-text-faint",
          "hover:bg-bg-subtle hover:text-text-muted active:cursor-grabbing",
          "disabled:cursor-default disabled:opacity-0",
        )}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      <span className="min-w-0 flex-1 text-[0.9375rem] leading-relaxed">
        {html}
      </span>
    </Reorder.Item>
  );
}
