"use client";

import { useCallback, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles, AlertCircle } from "lucide-react";
import { QuizRunner } from "./QuizRunner";
import { useProgress, usePrefs } from "@/lib/progress/context";
import { makeSeed } from "@/lib/quiz/shuffle";
import { selectForTraining, selectMistakes } from "@/lib/srs/select";
import type { SessionConfig, SessionQuestion } from "@/lib/session/types";
import type { StudyMode } from "@/lib/progress/types";
import { Button, ButtonLink, Card, Chip, EmptyState, Skeleton } from "@/components/ui";
import { useNow } from "@/lib/useNow";

interface CourseChip {
  code: string;
  abbr: string;
  accent: "slate" | "indigo" | "violet" | "teal" | "amber" | "rose";
}

/**
 * Obrazovka před během série pro režimy, kde otázky vybírá algoritmus
 * podle pokroku uživatele – tedy až v prohlížeči.
 */
export function TrainingSession({
  mode,
  pool,
  courses,
}: {
  mode: Extract<StudyMode, "trenink" | "chyby">;
  pool: SessionQuestion[];
  courses: CourseChip[];
}) {
  const store = useProgress();
  const prefs = usePrefs();
  const [course, setCourse] = useState<string | null>(null);
  // Otázky běhu jsou schválně otisk k okamžiku spuštění: `states` se během
  // odpovídání živě mění a bez otisku by se session přeskládala pod rukama.
  const [running, setRunning] = useState<SessionQuestion[] | null>(null);
  const [attempt, setAttempt] = useState(0);

  const states = useLiveQuery(() => store?.getAllStates() ?? Promise.resolve([]), [store]);
  // Výběr podle splatnosti potřebuje čas; ten je znám až v prohlížeči.
  const now = useNow();

  const available = useMemo(
    () => (course ? pool.filter((q) => q.course === course) : pool),
    [pool, course],
  );

  const pick = useCallback(
    (seed: number): SessionQuestion[] | null => {
      // `null` = ještě nevíme (chybí stavy nebo čas) – karta drží načítání.
      if (!states || now === null) return null;
      const ids = available.map((q) => q.question.id);
      const size = prefs?.sessionSize ?? 15;

      const chosen =
        mode === "trenink"
          ? selectForTraining({
              states,
              allQuestionIds: ids,
              size,
              now,
              course: course ?? undefined,
              seed,
            })
          : selectMistakes({ states, limit: size, course: course ?? undefined }).map(
              (s) => s.questionId,
            );

      const byId = new Map(available.map((q) => [q.question.id, q]));
      return chosen.map((id) => byId.get(id)).filter((q): q is SessionQuestion => !!q);
    },
    [states, available, mode, course, prefs?.sessionSize, now],
  );

  // Seed se váže na čas otevření stránky a pořadí běhu – jinak by trénink
  // nabídl pokaždé tutéž patnáctku ve stejném pořadí.
  const seedFor = (nth: number) => (now === null ? null : makeSeed(now, nth));

  const previewSeed = seedFor(0);
  const picked = useMemo(
    () => (previewSeed === null ? null : pick(previewSeed)),
    [pick, previewSeed],
  );

  const label = mode === "trenink" ? "Trénink" : "Chyby";
  const courseAbbr = courses.find((c) => c.code === course)?.abbr;

  const restart = () => {
    const nth = attempt + 1;
    const seed = seedFor(nth);
    const next = seed === null ? null : pick(seed);
    setAttempt(nth);
    // Prázdný výběr znamená, že už není co opakovat – úvodní karta to umí říct
    // líp než běh bez otázek.
    setRunning(next && next.length > 0 ? next : null);
  };

  if (running) {
    const config: SessionConfig = {
      mode,
      title: courseAbbr ? `${label} · ${courseAbbr}` : label,
      backHref: mode === "trenink" ? "/trenink" : "/chyby",
      // Trénink má pořadí z výběru (kde se taky míchá); chyby chodí seřazené
      // podle závažnosti, takže je promíchá až runner.
      shuffleQuestions: mode === "chyby",
      questions: running,
    };
    // `key` vynutí nové připojení – runner tím dostane i nový seed možností.
    return <QuizRunner
        key={attempt}
        config={config}
        onRestart={restart}
        onExit={() => setRunning(null)}
      />;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{label}</h1>
        <p className="mt-2 text-text-muted">
          {mode === "trenink"
            ? "Namíchá otázky po splatnosti, tvoje slabiny a něco nového. Čím víc odpovídáš, tím líp trefí, co potřebuješ."
            : "Otázky, u kterých ti to naposledy nevyšlo."}
        </p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        <Chip selected={course === null} onClick={() => setCourse(null)}>
          Vše
        </Chip>
        {courses.map((c) => (
          <Chip
            key={c.code}
            selected={course === c.code}
            onClick={() => setCourse(c.code)}
            accent={c.accent}
          >
            {c.abbr}
          </Chip>
        ))}
      </div>

      <Card className="mt-6 p-6">
        {picked === null ? (
          <Skeleton className="h-24" />
        ) : picked.length === 0 ? (
          mode === "chyby" ? (
            <EmptyState
              icon={<AlertCircle className="size-6" aria-hidden />}
              title="Žádné chyby k opakování"
              description={
                courseAbbr
                  ? `V ${courseAbbr} zatím nemáš co opravovat. Buď ti to jde, nebo jsi ještě nezačal.`
                  : "Zatím nemáš co opravovat. Buď ti to jde, nebo jsi ještě nezačal."
              }
              action={<ButtonLink href="/predmety" variant="secondary">Projít předměty</ButtonLink>}
            />
          ) : (
            <EmptyState
              icon={<Sparkles className="size-6" aria-hidden />}
              title="Není z čeho vybírat"
              description="K tomuhle výběru zatím nejsou žádné otázky."
              action={<ButtonLink href="/predmety" variant="secondary">Projít předměty</ButtonLink>}
            />
          )
        ) : (
          <>
            <p className="text-sm text-text-muted">
              Připraveno <strong className="text-text">{picked.length}</strong>{" "}
              {pluralQuestions(picked.length)}
              {courseAbbr ? ` z ${courseAbbr}` : ""}.
            </p>
            <Button
              className="mt-5 w-full sm:w-auto"
              variant="primary"
              size="lg"
              onClick={() => {
                setAttempt(0);
                setRunning(picked);
              }}
            >
              Začít
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}

function pluralQuestions(n: number): string {
  if (n === 1) return "otázka";
  if (n >= 2 && n <= 4) return "otázky";
  return "otázek";
}
