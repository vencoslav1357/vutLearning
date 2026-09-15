"use client";

import { motion } from "motion/react";
import {
  BookOpen,
  ChartColumn,
  CircleAlert,
  Dumbbell,
  GraduationCap,
  LogIn,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ITEMS: readonly NavItem[] = [
  { href: "/predmety", label: "Předměty", icon: BookOpen },
  { href: "/trenink", label: "Trénink", icon: Dumbbell },
  { href: "/chyby", label: "Chyby", icon: CircleAlert },
  { href: "/prehled", label: "Přehled", icon: ChartColumn },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface NavProps {
  /**
   * Místo pro přihlášeného uživatele. Když nic nepřijde, je tu odkaz
   * na `/prihlaseni` – přihlašování řeší jiná část aplikace.
   */
  authSlot?: ReactNode;
}

export function Nav({ authSlot }: NavProps) {
  const pathname = usePathname() ?? "/";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border-base bg-bg/80 backdrop-blur-md">
        <nav
          aria-label="Hlavní navigace"
          className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4"
        >
          <Link
            href="/"
            className="flex items-center gap-2 rounded-control text-sm font-semibold text-text transition-colors duration-150 hover:text-accent"
          >
            <GraduationCap aria-hidden className="size-5 text-accent" />
            <span>VUT Kvízy</span>
          </Link>

          {/* Na mobilu je tahle část dole v liště u palce – nahoře by jen
              ubírala místo a při kvízu překážela. */}
          <ul className="ml-2 hidden items-center gap-1 md:flex">
            {ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative inline-flex h-9 items-center rounded-control px-3 text-sm font-medium",
                      "transition-colors duration-150 ease-out-soft",
                      active
                        ? "text-text"
                        : "text-text-muted hover:bg-bg-subtle hover:text-text",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="nav-active-underline"
                        aria-hidden
                        className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent"
                        transition={{ type: "spring", stiffness: 420, damping: 36 }}
                      />
                    ) : null}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            {authSlot ?? (
              <Link
                href="/prihlaseni"
                className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border-base px-3 text-sm font-medium text-text-muted transition-colors duration-150 hover:border-border-strong hover:text-text"
              >
                <LogIn aria-hidden className="size-4" />
                <span className="hidden sm:inline">Přihlásit</span>
              </Link>
            )}
          </div>
        </nav>
      </header>

      {/* Spodní lišta na mobilu: palec ji dosáhne bez přehmatu a na rozdíl
          od hamburgeru nic nepřekrývá. Obsah stránky pod ni nesmí zapadnout –
          `<main>` potřebuje `pb-20 md:pb-0`. */}
      <nav
        aria-label="Hlavní navigace"
        data-mobile-nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-base bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="mx-auto flex max-w-md items-stretch">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
                    "transition-colors duration-150 ease-out-soft",
                    active ? "text-accent" : "text-text-muted",
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
