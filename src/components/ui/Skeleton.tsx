import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Tvar placeholderu. `text` má výšku řádku, `circle` je kolečko (avatar, ikona). */
  shape?: "block" | "text" | "circle";
}

export function Skeleton({
  shape = "block",
  className,
  ...rest
}: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse bg-bg-subtle motion-reduce:animate-none",
        shape === "circle" && "rounded-full",
        shape === "text" && "h-4 rounded-md",
        shape === "block" && "rounded-control",
        className,
      )}
      {...rest}
    />
  );
}

/** Několik řádků textu za sebou; poslední je kratší, ať to vypadá jako odstavec. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          shape="text"
          className={index === lines - 1 ? "w-3/5" : "w-full"}
        />
      ))}
    </div>
  );
}
