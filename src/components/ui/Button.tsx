import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE = [
  "relative inline-flex items-center justify-center gap-2",
  "rounded-control font-medium whitespace-nowrap select-none",
  "border border-transparent",
  // Hover a stisk zvládne obyčejná CSS transition – motion by tu jen
  // přidal runtime navíc za efekt, který nikdo nepozná.
  "transition-[background-color,border-color,color,box-shadow,translate] duration-150 ease-out-soft",
  // Stisk je posun o pixel, ne zmenšení: u prvků v mřížce vypadá
  // škálování lacině a text při něm rozmaže.
  "active:translate-y-px",
  "disabled:pointer-events-none disabled:opacity-50",
  "aria-disabled:pointer-events-none aria-disabled:opacity-50",
].join(" ");

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-text hover:bg-accent-hover shadow-card",
  secondary:
    "border-border-strong bg-surface text-text hover:bg-surface-hover hover:border-text-faint",
  ghost: "text-text-muted hover:bg-bg-subtle hover:text-text",
  danger: "border-bad-border bg-bad-soft text-bad hover:border-bad",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export function buttonStyles(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Zobrazí spinner a zablokuje kliknutí. Popisek zůstává kvůli stabilní šířce. */
  loading?: boolean;
  /** Roztáhne tlačítko na šířku rodiče (typicky na mobilu). */
  block?: boolean;
  /** Když je zadané, vyrenderuje se odkaz (`next/link`) místo tlačítka. */
  href?: string;
  /**
   * `span` pro případy, kdy tlačítko jen vypadá jako tlačítko a klikání
   * řeší rodič – typicky `<label>` nad skrytým `<input type="file">`.
   */
  as?: "button" | "span";
  children?: ReactNode;
}

export type ButtonProps = ButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps>;

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  block = false,
  href,
  as = "button",
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = buttonStyles(variant, size, cn(block && "w-full", className));

  const content = (
    <>
      {/* Obsah se jen zprůhlední, aby se šířka tlačítka během načítání nehnula. */}
      <span
        className={cn(
          "inline-flex items-center gap-2 transition-opacity duration-150",
          loading && "opacity-0",
        )}
      >
        {children}
      </span>
      {loading ? (
        <span className="absolute inset-0 grid place-items-center">
          <LoaderCircle
            aria-hidden
            className="size-4 animate-spin motion-reduce:animate-none"
          />
        </span>
      ) : null}
    </>
  );

  if (href && !disabled) {
    // `rest` jsou atributy tlačítka; na odkazu z nich dávají smysl jen
    // obecné (aria-*, data-*, onClick), proto ten převod typu.
    const linkProps = rest as unknown as Omit<
      ComponentProps<typeof Link>,
      "href" | "className"
    >;
    return (
      <Link href={href} className={classes} {...linkProps}>
        {content}
      </Link>
    );
  }

  if (as === "span" || (href && disabled)) {
    return (
      <span
        aria-disabled={disabled || loading || undefined}
        className={classes}
        {...(rest as unknown as ComponentProps<"span">)}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...rest}
    >
      {content}
    </button>
  );
}

interface ButtonLinkOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export type ButtonLinkProps = ButtonLinkOwnProps &
  Omit<ComponentProps<typeof Link>, keyof ButtonLinkOwnProps>;

/** Odkaz, který vypadá jako tlačítko. Zůstává `<a>`, takže funguje i prostřední tlačítko myši. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  block = false,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonStyles(variant, size, cn(block && "w-full", className))}
      {...rest}
    >
      {children}
    </Link>
  );
}
