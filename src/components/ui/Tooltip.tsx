"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  Children,
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

type TriggerProps = {
  "aria-describedby"?: string;
};

export type TooltipSide = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  /** Text bubliny. Krátký – delší vysvětlení patří do textu stránky. */
  content: ReactNode;
  /** Jediný prvek, na kterém bublina visí. Musí umět přijmout `ref`-free props. */
  children: ReactElement<TriggerProps>;
  side?: TooltipSide;
  /** Prodleva v ms, než se bublina ukáže při najetí myší. Focus ji ukáže hned. */
  delay?: number;
  className?: string;
}

const SIDES: Record<TooltipSide, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const OFFSET: Record<TooltipSide, { x: number; y: number }> = {
  top: { x: 0, y: 4 },
  bottom: { x: 0, y: -4 },
  left: { x: 4, y: 0 },
  right: { x: -4, y: 0 },
};

export function Tooltip({
  content,
  children,
  side = "top",
  delay = 400,
  className,
}: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function show(immediate: boolean) {
    clearTimeout(timerRef.current);
    if (immediate) {
      setOpen(true);
      return;
    }
    timerRef.current = setTimeout(() => setOpen(true), delay);
  }

  function hide() {
    clearTimeout(timerRef.current);
    setOpen(false);
  }

  // Escape musí bublinu zavřít i bez myši, jinak překrývá obsah pod ní.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Do prvku se dopisuje jen `aria-describedby`; posluchače nese obal.
  // Předat do `cloneElement()` funkci, která sahá na ref, React zakazuje –
  // z pohledu pravidel by se ref mohl číst během renderu.
  const trigger = cloneElement(Children.only(children), {
    "aria-describedby": open ? id : undefined,
  });

  return (
    // Obal těsně obepíná spouštěč, takže citlivá plocha zůstává stejná.
    // `onFocus` probublává a `onPointerEnter`/`onPointerLeave` React hlásí
    // i pro předky – vlastní posluchače na spouštěči tím nejsou dotčené.
    <span
      className="relative inline-flex"
      onPointerEnter={(event: PointerEvent<HTMLElement>) => {
        // Dotykové zařízení hover nemá – tam by bublina jen blikla přes prst.
        if (event.pointerType !== "touch") show(false);
      }}
      onPointerLeave={hide}
      onFocus={() => show(true)}
      onBlur={hide}
    >
      {trigger}
      <AnimatePresence>
        {open ? (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, ...OFFSET[side] }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, ...OFFSET[side] }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "pointer-events-none absolute z-50 w-max max-w-56 rounded-control",
              "border border-border-base bg-surface px-2.5 py-1.5 shadow-lift",
              "text-xs leading-snug text-text text-pretty",
              SIDES[side],
              className,
            )}
          >
            {content}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
