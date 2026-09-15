import Link from "next/link";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const SURFACE =
  "rounded-card border border-border-base bg-surface shadow-card";

/**
 * Posun o 2 px nahoru místo zvětšení: v mřížce karet zvětšování
 * překrývá sousedy a text při něm přeostřuje.
 */
const INTERACTIVE = [
  "block text-left",
  "transition-[translate,box-shadow,border-color] duration-150 ease-out-soft",
  "hover:-translate-y-0.5 hover:shadow-lift hover:border-border-strong",
  "active:translate-y-0 active:shadow-card",
].join(" ");

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Vnitřní odsazení. Vypni, když si obsah řídí padding sám (např. tabulka). */
  padded?: boolean;
  /**
   * Karta reaguje na najetí. Používej jen tehdy, když je uvnitř odkaz
   * nebo tlačítko – samotný hover efekt z ničeho klikatelný prvek neudělá.
   */
  interactive?: boolean;
  children?: ReactNode;
}

export function Card({
  padded = true,
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        SURFACE,
        interactive && INTERACTIVE,
        padded && "p-5",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export type CardLinkProps = ComponentProps<typeof Link> & { padded?: boolean };

/** Klikatelná karta jako odkaz – typicky dlaždice předmětu nebo sady. */
export function CardLink({
  padded = true,
  className,
  children,
  ...rest
}: CardLinkProps) {
  return (
    <Link
      className={cn(SURFACE, INTERACTIVE, padded && "p-5", className)}
      {...rest}
    >
      {children}
    </Link>
  );
}

export type CardButtonProps = HTMLAttributes<HTMLButtonElement> & {
  padded?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
};

/** Klikatelná karta jako tlačítko – pro volby, které nikam nenavigují. */
export function CardButton({
  padded = true,
  className,
  children,
  type = "button",
  ...rest
}: CardButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        SURFACE,
        INTERACTIVE,
        "w-full disabled:pointer-events-none disabled:opacity-50",
        padded && "p-5",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function CardHeader({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-start justify-between gap-3", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold text-text text-balance", className)}
      {...rest}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm leading-relaxed text-text-muted text-pretty", className)}
      {...rest}
    >
      {children}
    </p>
  );
}

export function CardFooter({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-4 flex items-center gap-3 border-t border-border-base pt-4",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
