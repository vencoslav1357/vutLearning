"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useProgress } from "@/lib/progress/context";
import { ProgressBar } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Proužek pokroku u dlaždice předmětu. Data jsou lokální, takže až na klientovi. */
export function CourseProgress({
  course,
  total,
  className,
}: {
  course: string;
  total: number;
  className?: string;
}) {
  const store = useProgress();
  const states = useLiveQuery(
    () => store?.getStatesForCourse(course) ?? Promise.resolve([]),
    [store, course],
  );

  if (total === 0) return null;

  const mastered = states?.filter((s) => s.mastery === "zvladnuta").length ?? 0;
  const seen = states?.length ?? 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      <ProgressBar value={total ? mastered / total : 0} size="sm" />
      <p className="text-xs text-text-faint">
        {seen === 0
          ? "Zatím nezačato"
          : `${mastered} z ${total} zvládnutých · ${seen} viděných`}
      </p>
    </div>
  );
}

/** Totéž pro jednu sadu otázek. */
export function SetProgress({
  setId,
  total,
  className,
}: {
  setId: string;
  total: number;
  className?: string;
}) {
  const store = useProgress();
  const states = useLiveQuery(
    () => store?.getStatesForSet(setId) ?? Promise.resolve([]),
    [store, setId],
  );

  const mastered = states?.filter((s) => s.mastery === "zvladnuta").length ?? 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ProgressBar className="flex-1" value={total ? mastered / total : 0} size="sm" />
      <span className="shrink-0 tabular-nums text-xs text-text-faint">
        {mastered}/{total}
      </span>
    </div>
  );
}
