"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, SkipForward } from "lucide-react";
import { QuestionCard } from "./QuestionCard";
import { SessionSummary } from "./SessionSummary";
import { evaluate, emptyAnswer, type Answer, type Evaluation } from "@/lib/quiz/evaluate";
import { makeSeed, seededShuffle } from "@/lib/quiz/shuffle";
import { useProgress, usePrefs } from "@/lib/progress/context";
import type { SessionConfig, SessionResult } from "@/lib/session/types";
import { Button, ButtonLink, ProgressBar, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/useNow";

/**
 * Běh jedné série otázek.
 *
 * Stejná komponenta obsluhuje všechny tři režimy (procvičování, chyby, trénink) –
 * liší se jen tím, jaké otázky dostane a co se stane na konci.
 */
export function QuizRunner({ config }: { config: SessionConfig }) {
  const store = useProgress();
  const prefs = usePrefs();

  // Seed míchání se odvozuje z času připojení: v prohlížeči je konstantní po
  // celou session, takže možnosti nepřeskakují, a při dalším spuštění kvízu
  // vyjde jiný. `Math.random()` ani `Date.now()` v těle komponenty být nesmí –
  // na serveru by vyšly jinak a hydratace by přeskládala možnosti pod rukama.
  // Než seed dorazí (`null`), se karta s otázkou nevykresluje vůbec.
  const now = useNow();
  const seed = now === null ? null : makeSeed(now);

  const questions = useMemo(() => {
    const shouldShuffle = config.shuffleQuestions && (prefs?.shuffleQuestions ?? true);
    return shouldShuffle && seed !== null
      ? seededShuffle(config.questions, seed)
      : config.questions;
  }, [config.questions, config.shuffleQuestions, prefs?.shuffleQuestions, seed]);

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [finished, setFinished] = useState(false);

  // 0 je jen výplň do prvního efektu níž, který čas nastaví ještě před tím,
  // než se uživatel stihne dostat k odeslání odpovědi.
  const startedAt = useRef<number>(0);
  const usedHint = useRef(false);

  const current = questions[index];
  const isLast = index === questions.length - 1;
  const questionSeed = current && seed !== null ? makeSeed(current.question.id, seed) : null;

  // Nová otázka = čistý stav. Podle doporučení Reactu pro „úpravu stavu při
  // změně props" se to dělá během renderu, ne v efektu – jinak by se jeden
  // snímek ukazovala odpověď z předchozí otázky.
  const [shownQuestionId, setShownQuestionId] = useState<string | null>(null);
  if (current && questionSeed !== null && current.question.id !== shownQuestionId) {
    setShownQuestionId(current.question.id);
    setAnswer(emptyAnswer(current.question, questionSeed));
    setEvaluation(null);
  }

  // Měření času a příznak nápovědy jsou refy – patří až za render.
  useEffect(() => {
    if (!current) return;
    usedHint.current = false;
    startedAt.current = Date.now();
  }, [current]);

  const submit = useCallback(async () => {
    if (!current || !answer || evaluation) return;

    const result = evaluate(current.question, answer);
    setEvaluation(result);

    const durationMs = Date.now() - startedAt.current;
    setResults((prev) => [
      ...prev,
      {
        questionId: current.question.id,
        outcome: result.outcome,
        score: result.score,
        durationMs,
      },
    ]);

    // Zápis do úložiště je záměrně po vyhodnocení a bez await v UI cestě –
    // uživatel nemá čekat na IndexedDB, aby viděl, jestli odpověděl správně.
    void store?.recordAttempt({
      questionId: current.question.id,
      setId: current.setId,
      course: current.course,
      at: Date.now(),
      outcome: result.outcome,
      score: result.score,
      durationMs,
      mode: config.mode,
      usedHint: usedHint.current,
      materialHash: current.materialHash,
    });
  }, [answer, config.mode, current, evaluation, store]);

  const skip = useCallback(async () => {
    if (!current || evaluation) return;
    const durationMs = Date.now() - startedAt.current;
    setEvaluation({
      outcome: "skipped",
      score: 0,
      message: "Přeskočeno. Odpověď je níž.",
    });
    setResults((prev) => [
      ...prev,
      { questionId: current.question.id, outcome: "skipped", score: 0, durationMs },
    ]);
    void store?.recordAttempt({
      questionId: current.question.id,
      setId: current.setId,
      course: current.course,
      at: Date.now(),
      outcome: "skipped",
      score: 0,
      durationMs,
      mode: config.mode,
      usedHint: usedHint.current,
      materialHash: current.materialHash,
    });
  }, [config.mode, current, evaluation, store]);

  const next = useCallback(() => {
    if (isLast) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
  }, [isLast]);

  // Enter posouvá dopředu: nejdřív odešle, podruhé přejde na další otázku.
  // Bez tohohle se u dlouhé série musí pořád sahat po myši.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.shiftKey) return;
      const el = document.activeElement;
      // V <textarea> je Enter konec řádku, ne odeslání.
      if (el instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      if (evaluation) next();
      else void submit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [evaluation, next, submit]);

  if (!questions.length) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-text-muted">V téhle sadě zatím nejsou žádné otázky.</p>
        <ButtonLink className="mt-6" href={config.backHref} variant="secondary">
          Zpět
        </ButtonLink>
      </div>
    );
  }

  if (finished) {
    return (
      <SessionSummary
        config={config}
        questions={questions}
        results={results}
        onRestart={() => {
          setIndex(0);
          setResults([]);
          setFinished(false);
        }}
      />
    );
  }

  const progress = index / questions.length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:pt-10">
      <header className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-4">
          <Link
            href={config.backHref}
            className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {config.title}
          </Link>
          <span className="tabular-nums text-sm text-text-faint">
            {index + 1} / {questions.length}
          </span>
        </div>
        <ProgressBar value={progress} size="sm" />
      </header>

      {/* Bez seedu není známé pořadí možností. Placeholder je lepší než
          vykreslit nezamíchanou kartu a hned ji uživateli přeskládat. */}
      {questionSeed === null ? (
        <Skeleton className="h-80 rounded-card sm:h-96" />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.question.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.21, ease: [0.22, 1, 0.36, 1] }}
          >
            <QuestionCard
              question={current.question}
              value={answer}
              onChange={setAnswer}
              evaluation={evaluation}
              disabled={evaluation !== null}
              seed={questionSeed}
              html={current.html}
              onHintUsed={() => {
                usedHint.current = true;
              }}
            />
          </motion.div>
        </AnimatePresence>
      )}

      {/* Ovládací lišta je ukotvená dole – při dlouhé otázce se k ní nemusí rolovat. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-base bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div
            className={cn(
              "min-w-0 flex-1 text-sm",
              evaluation?.outcome === "correct" && "text-ok",
              evaluation?.outcome === "partial" && "text-warn",
              (evaluation?.outcome === "incorrect" || evaluation?.outcome === "skipped") &&
                "text-bad",
            )}
          >
            <AnimatePresence mode="wait">
              {evaluation ? (
                <motion.span
                  key="msg"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="line-clamp-2"
                >
                  {evaluation.message}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>

          {evaluation ? (
            <Button onClick={next} variant="primary">
              {isLast ? "Dokončit" : "Další"}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            // Než je otázka vykreslená, není co odesílat ani přeskakovat.
            <div className="flex items-center gap-2">
              <Button
                onClick={skip}
                variant="ghost"
                size="sm"
                disabled={questionSeed === null}
              >
                <SkipForward className="size-4" aria-hidden />
                Přeskočit
              </Button>
              <Button onClick={submit} variant="primary" disabled={questionSeed === null}>
                <Check className="size-4" aria-hidden />
                Zkontrolovat
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
