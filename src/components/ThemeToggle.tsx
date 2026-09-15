"use client";

import { AnimatePresence, motion } from "motion/react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { IconButton } from "@/components/ui/IconButton";

type Mode = "system" | "light" | "dark";

/**
 * Store, který na serveru a při hydrataci hlásí „nepřipojeno" a hned po
 * připojení „připojeno". Odběr nic neposlouchá, jen si řekne o jedno
 * překreslení – proto se obejde bez `setState` v efektu.
 */
const MOUNTED = {
  subscribe(onChange: () => void) {
    onChange();
    return () => {};
  },
  onClient: () => true,
  onServer: () => false,
};

/** Pořadí cyklu. Systém je první, protože je výchozí. */
const ORDER: readonly Mode[] = ["system", "light", "dark"];

const MODES: Record<Mode, { icon: typeof Sun; name: string }> = {
  system: { icon: Monitor, name: "podle systému" },
  light: { icon: Sun, name: "světlý" },
  dark: { icon: Moon, name: "tmavý" },
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  // next-themes zná uloženou volbu až v prohlížeči. Kdyby se podle ní
  // renderovalo hned, server a klient by se rozešly a React by hlásil chybu.
  const mounted = useSyncExternalStore(MOUNTED.subscribe, MOUNTED.onClient, MOUNTED.onServer);

  if (!mounted) {
    return (
      <div
        aria-hidden
        className={className}
        // Stejná velikost jako tlačítko, aby lišta při připojení neposkočila.
        style={{ width: "2.5rem", height: "2.5rem" }}
      />
    );
  }

  const current: Mode = ORDER.includes(theme as Mode) ? (theme as Mode) : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = MODES[current].icon;

  return (
    <IconButton
      aria-label={`Motiv ${MODES[current].name}. Přepnout na ${MODES[next].name}.`}
      title={`Motiv ${MODES[current].name}`}
      onClick={() => setTheme(next)}
      className={className}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={current}
          initial={{ opacity: 0, rotate: -35, scale: 0.85 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 35, scale: 0.85 }}
          transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="grid place-items-center"
        >
          <Icon aria-hidden />
        </motion.span>
      </AnimatePresence>
    </IconButton>
  );
}
