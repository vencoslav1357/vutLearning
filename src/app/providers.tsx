"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Klientské obaly kolem celé aplikace.
 *
 * `disableTransitionOnChange` je tu schválně: bez toho next-themes přepne
 * třídu na <html> a všechny CSS transitions na stránce se rozjedou naráz,
 * takže přepnutí motivu vypadá jako záblesk přes celou plochu.
 *
 * `reducedMotion="user"` řeší motion; CSS a view transitions si hlídá
 * globals.css zvlášť – jsou to tři nezávislé systémy.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeProvider>
  );
}
