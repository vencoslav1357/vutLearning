"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { BarChart3 } from "lucide-react";
import { useProgress } from "@/lib/progress/context";
import { MASTERY_LEVELS, type MasteryLevel, type QuestionState } from "@/lib/progress/types";
import { masteryLabel } from "@/lib/srs/mastery";
import { Card, Badge, EmptyState, ButtonLink, Skeleton } from "@/components/ui";
import { StreakBanner } from "./StreakBanner";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/useNow";

interface CourseInfo {
  code: string;
  abbr: string;
  name: string;
  accent: "slate" | "indigo" | "violet" | "teal" | "amber" | "rose";
  total: number;
}

export function Dashboard({ courses }: { courses: CourseInfo[] }) {
  const store = useProgress();
  const states = useLiveQuery(() => store?.getAllStates() ?? Promise.resolve([]), [store]);
  // Splatnost se počítá proti času; ten je znám až v prohlížeči.
  const now = useNow();

  const totalQuestions = courses.reduce((n, c) => n + c.total, 0);

  if (!states) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (states.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-20">
        <EmptyState
          icon={<BarChart3 className="size-6" aria-hidden />}
          title="Zatím není co ukázat"
          description="Odpověz na pár otázek a uvidíš tady, co ti jde a co ne."
          action={<ButtonLink href="/predmety" variant="primary">Začít</ButtonLink>}
        />
      </div>
    );
  }

  const answered = states.reduce((n, s) => n + s.attempts, 0);
  const correct = states.reduce((n, s) => n + s.correct, 0);
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  // Dokud není čas známý, dlaždice ukáže pomlčku. Držet místo prázdné
  // by ji nechalo poskočit ve chvíli, kdy číslo dorazí.
  const dueNow = now === null ? null : states.filter((s) => s.dueAt <= now).length;

  const weakest = [...states]
    .filter((s) => s.mastery === "slabina")
    .sort((a, b) => b.lapses - a.lapses || a.ease - b.ease)
    .slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Přehled</h1>

      <StreakBanner className="mt-6" />

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Zodpovězeno" value={answered} />
        <StatCard label="Úspěšnost" value={`${accuracy} %`} />
        <StatCard label="Viděných otázek" value={`${states.length}/${totalQuestions}`} />
        <StatCard
          label="K opakování"
          value={dueNow ?? "–"}
          href={dueNow !== null && dueNow > 0 ? "/trenink" : undefined}
        />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Podle předmětů</h2>
        <ul className="space-y-3">
          {courses.map((c) => {
            const own = states.filter((s) => s.course === c.code);
            return (
              <li key={c.code}>
                <Link href={`/predmety/${c.code}`} className="block">
                  <Card interactive className="p-4">
                    <div className="flex items-center gap-3">
                      <Badge accent={c.accent}>{c.abbr}</Badge>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {c.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-xs text-text-faint">
                        {own.filter((s) => s.mastery === "zvladnuta").length}/{c.total}
                      </span>
                    </div>
                    <MasteryBar states={own} total={c.total} className="mt-3" />
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {weakest.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-1 text-sm font-medium text-text-muted">Slabá místa</h2>
          <p className="mb-3 text-sm text-text-faint">
            Otázky, které jsi už uměl a zase zapomněl, nebo je trvale trefuješ špatně.
          </p>
          <Card className="divide-y divide-border-base">
            {weakest.map((s) => (
              <div key={s.questionId} className="flex items-center gap-3 px-4 py-3">
                <Badge variant="bad">{s.lapses}×</Badge>
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-text-muted">
                  {s.questionId}
                </code>
                <span className="shrink-0 tabular-nums text-xs text-text-faint">
                  {s.attempts ? Math.round((s.correct / s.attempts) * 100) : 0} %
                </span>
              </div>
            ))}
          </Card>
          <ButtonLink className="mt-4" href="/chyby" variant="secondary">
            Procvičit slabá místa
          </ButtonLink>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const body = (
    <Card interactive={!!href} className="p-4">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-text-muted">{label}</div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** Rozpad otázek podle stupně zvládnutí jako jeden vodorovný pruh. */
function MasteryBar({
  states,
  total,
  className,
}: {
  states: QuestionState[];
  total: number;
  className?: string;
}) {
  if (total === 0) return null;

  const counts = new Map<MasteryLevel, number>();
  for (const s of states) counts.set(s.mastery, (counts.get(s.mastery) ?? 0) + 1);
  const untouched = Math.max(0, total - states.length);

  const tone: Record<MasteryLevel, string> = {
    nova: "bg-border-strong",
    "ucim-se": "bg-warn",
    skoro: "bg-accent",
    zvladnuta: "bg-ok",
    slabina: "bg-bad",
  };

  return (
    <div className={className}>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-bg-subtle">
        {MASTERY_LEVELS.map((level) => {
          const n = counts.get(level) ?? 0;
          if (n === 0) return null;
          return (
            <motion.div
              key={level}
              className={cn(tone[level])}
              initial={{ width: 0 }}
              animate={{ width: `${(n / total) * 100}%` }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              title={`${masteryLabel(level)}: ${n}`}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-faint">
        {MASTERY_LEVELS.map((level) => {
          const n = counts.get(level) ?? 0;
          if (n === 0) return null;
          return (
            <span key={level} className="inline-flex items-center gap-1">
              <span className={cn("size-2 rounded-full", tone[level])} aria-hidden />
              {masteryLabel(level)} {n}
            </span>
          );
        })}
        {untouched > 0 && <span>nezačato {untouched}</span>}
      </div>
    </div>
  );
}
