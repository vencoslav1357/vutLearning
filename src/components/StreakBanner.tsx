"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Flame } from "lucide-react";
import { useProgress } from "@/lib/progress/context";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Pruh se sérií dní a dnešní aktivitou. */
export function StreakBanner({ className }: { className?: string }) {
  const store = useProgress();
  const streak = useLiveQuery(
    () => store?.getStreak() ?? Promise.resolve(null),
    [store],
  );

  // Dokud se nic nenačetlo, nic neukazuj – prázdná karta s nulou působí
  // hůř než žádná karta.
  if (!streak || streak.current === 0) return null;

  return (
    <Card className={cn("flex items-center gap-4 p-4", className)}>
      <div className="flex size-11 shrink-0 items-center justify-center rounded-control bg-warn-soft text-warn">
        <Flame className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="font-medium">
          {streak.current} {dayWord(streak.current)} v řadě
        </p>
        <p className="text-sm text-text-muted">
          {streak.longest > streak.current
            ? `Tvoje nejdelší série byla ${streak.longest} ${dayWord(streak.longest)}.`
            : "Tohle je tvoje nejdelší série. Drž to."}
        </p>
      </div>
    </Card>
  );
}

function dayWord(n: number): string {
  if (n === 1) return "den";
  if (n >= 2 && n <= 4) return "dny";
  return "dní";
}
