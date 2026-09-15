"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";

/** Musí sedět s dobou odchodové transition níž, jinak modál zmizí skokem. */
const EXIT_MS = 150;

export interface DialogProps {
  open: boolean;
  /** Voláno při Escape, kliknutí vedle i křížku. Rodič má nastavit `open` na false. */
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Řádek s tlačítky dole. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Skryje křížek – použij jen tam, kde je zavření dostupné jinak. */
  hideCloseButton?: boolean;
  className?: string;
}

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  hideCloseButton = false,
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = `${titleId}-desc`;
  // `entered` se zapíná až o snímek po otevření – jinak je modál "otevřený"
  // hned při prvním vykreslení a příchodová transition nemá odkud jet.
  const [entered, setEntered] = useState(false);

  // Zavření není stav navíc: jakmile je `open` false, je fáze "closed".
  // Příznak se přitom musí vynulovat, aby další otevření zase animovalo.
  if (!open && entered) setEntered(false);
  const phase = open && entered ? "open" : "closed";

  // Nativní <dialog> + showModal() dá zadarmo správné chování: past na focus,
  // Escape, inertní pozadí a vykreslení v top layer nad vším ostatním.
  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;

    if (open) {
      if (!element.open) element.showModal();
      const frame = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(frame);
    }

    if (element.open) {
      // Zavření se odloží o délku odchodové transition, ať se stihne dojet.
      const timer = setTimeout(() => element.close(), EXIT_MS);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Modál překrývá celou plochu, takže rolování pod ním jen mate.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Escape by dialog zavřel okamžitě a odchodová animace by se nestihla.
    event.preventDefault();
    onClose();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (surfaceRef.current?.contains(event.target as Node)) return;
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      data-state={phase}
      className={cn(
        // Samotný <dialog> je průhledné plátno přes celé okno; tmavne
        // až ::backdrop, který se dá animovat nezávisle na obsahu.
        "group m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 text-text",
        "backdrop:bg-black/40 backdrop:backdrop-blur-[2px]",
        "backdrop:opacity-0 backdrop:transition-opacity backdrop:duration-150 backdrop:ease-out-soft",
        "data-[state=open]:backdrop:opacity-100",
      )}
    >
      <div className="flex min-h-full items-end justify-center sm:items-center sm:p-6">
        <div
          ref={surfaceRef}
          className={cn(
            "w-full rounded-t-card border border-border-base bg-surface p-5 shadow-lift sm:rounded-card",
            SIZES[size],
            // Příchod 210 ms, odchod 150 ms – odcházet má věc rychleji,
            // než přichází, jinak to působí zdlouhavě.
            "translate-y-3 opacity-0 transition-[opacity,translate] duration-150 ease-out-soft",
            "group-data-[state=open]:translate-y-0 group-data-[state=open]:opacity-100",
            "group-data-[state=open]:duration-[210ms]",
            "motion-reduce:transition-none",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2
                id={titleId}
                className="text-lg font-semibold text-text text-balance"
              >
                {title}
              </h2>
              {description ? (
                <p
                  id={descriptionId}
                  className="text-sm leading-relaxed text-text-muted text-pretty"
                >
                  {description}
                </p>
              ) : null}
            </div>
            {hideCloseButton ? null : (
              <IconButton
                aria-label="Zavřít"
                size="sm"
                onClick={onClose}
                className="-mt-1 -mr-1"
              >
                <X aria-hidden />
              </IconButton>
            )}
          </div>

          {children ? (
            <div className="mt-4 text-sm text-text">{children}</div>
          ) : null}

          {footer ? (
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
