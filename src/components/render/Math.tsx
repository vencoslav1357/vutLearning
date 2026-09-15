/**
 * Jeden vzorec vykreslený KaTeXem.
 *
 * SERVER ONLY – KaTeX (76 kB gzip) zůstává na serveru, do prohlížeče jde
 * jen hotové HTML. CSS KaTeXu importuje RichText.
 */
import katex from "katex";

import { cn } from "@/lib/cn";

export type MathProps = {
  /** Zdrojový TeX bez oddělovačů `$`. */
  tex: string;
  /** Blokový (vycentrovaný) režim místo vloženého do řádku. */
  display?: boolean;
  className?: string;
};

export function Math({ tex, display = false, className }: MathProps) {
  const html = katex.renderToString(tex, {
    displayMode: display,
    // Překlep v jednom vzorci nesmí shodit celou stránku s kvízem.
    // KaTeX místo výjimky vykreslí vadné místo červeně.
    throwOnError: false,
    strict: false,
    trust: false,
    output: "html",
  });

  return (
    <span
      role="math"
      // KaTeX si vlastní výstup schovává před čtečkami (aria-hidden),
      // takže jediné, co se přečte, je tenhle popisek.
      aria-label={tex}
      className={cn(display ? "block" : "inline", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
