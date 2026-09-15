import type { LucideIcon } from "lucide-react";
import { isValidElement, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  /** Buď komponenta ikony (`Inbox`), nebo hotový prvek (`<Inbox />`). */
  icon: LucideIcon | ReactNode;
  title: string;
  /** Jedna vlídná věta – co se stalo a co s tím. Ne výčitka. */
  description?: ReactNode;
  /** Typicky `<ButtonLink>` nebo `<Button>`. */
  action?: ReactNode;
  /** `card` přidá rámeček a povrch; `bare` se hodí dovnitř už existující karty. */
  variant?: "card" | "bare";
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "card",
  className,
}: EmptyStateProps) {
  // Volající předává jednou komponentu, jindy hotový prvek – obojí je
  // legitimní a rozlišit se to dá jen za běhu.
  const Icon = typeof icon === "function" ? (icon as LucideIcon) : null;
  const glyph = Icon ? (
    <Icon aria-hidden className="size-5" />
  ) : isValidElement(icon) ? (
    icon
  ) : null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        variant === "card" &&
          "rounded-card border border-dashed border-border-base bg-bg-subtle/60",
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-surface text-text-faint shadow-card [&_svg]:size-5">
        {glyph}
      </span>
      <div className="flex max-w-prose flex-col gap-1">
        <p className="text-sm font-semibold text-text text-balance">{title}</p>
        {description ? (
          <p className="text-sm leading-relaxed text-text-muted text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
