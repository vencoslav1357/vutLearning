"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { RotateCcw, ArrowLeft } from "lucide-react";
import type { SessionConfig, SessionQuestion, SessionResult } from "@/lib/session/types";
import { Button, ButtonLink, Card, Badge } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Shrnutí po dokončení série. */
export function SessionSummary({
  config,
  questions,
  results,
  onRestart,
  onExit,
}: {
  config: SessionConfig;
  questions: SessionQuestion[];
  results: SessionResult[];
  onRestart: () => void;
  /** Když běh nemá vlastní adresu, odchod řeší volající, ne odkaz. */
  onExit?: () => void;
}) {
  const total = results.length || 1;
  const correct = results.filter((r) => r.outcome === "correct").length;
  const partial = results.filter((r) => r.outcome === "partial").length;
  const wrong = results.filter(
    (r) => r.outcome === "incorrect" || r.outcome === "skipped",
  ).length;
  const pct = Math.round((correct / total) * 100);

  const byId = new Map(questions.map((q) => [q.question.id, q]));
  const missed = results.filter((r) => r.outcome !== "correct");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="p-8 text-center">
          <p className="text-sm text-text-muted">{config.title}</p>
          <div className="mt-4 flex items-baseline justify-center gap-1">
            <motion.span
              className="text-6xl font-semibold tabular-nums tracking-tight"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.35, ease: [0.34, 1.32, 0.64, 1] }}
            >
              {pct}
            </motion.span>
            <span className="text-2xl text-text-muted">%</span>
          </div>
          <p className="mt-3 text-text-muted">{verdict(pct)}</p>

          <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
            <Stat label="Správně" value={correct} tone="ok" />
            <Stat label="Částečně" value={partial} tone="warn" />
            <Stat label="Špatně" value={wrong} tone="bad" />
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button onClick={onRestart} variant="secondary">
              <RotateCcw className="size-4" aria-hidden />
              Znovu
            </Button>
            {onExit ? (
              <Button onClick={onExit} variant="primary">
                <ArrowLeft className="size-4" aria-hidden />
                Hotovo
              </Button>
            ) : (
              <ButtonLink href={config.backHref} variant="primary">
                <ArrowLeft className="size-4" aria-hidden />
                Hotovo
              </ButtonLink>
            )}
          </div>
        </Card>
      </motion.div>

      {missed.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-text-muted">
            Na tohle se ještě mrkni
          </h2>
          <ul className="space-y-2">
            {missed.map((r, i) => {
              const q = byId.get(r.questionId);
              if (!q) return null;
              return (
                <motion.li
                  key={r.questionId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.2 }}
                >
                  <Card className="flex items-start gap-3 p-4">
                    <Badge variant={r.outcome === "partial" ? "warn" : "bad"}>
                      {r.outcome === "partial" ? "částečně" : "chyba"}
                    </Badge>
                    <p className="min-w-0 flex-1 text-sm text-text-muted line-clamp-2">
                      {plainPrompt(q.question.prompt)}
                    </p>
                  </Card>
                </motion.li>
              );
            })}
          </ul>
          <p className="mt-4 text-sm text-text-faint">
            Tyhle otázky najdeš v režimu <Link href="/chyby" className="text-accent underline underline-offset-2">Chyby</Link>.
          </p>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "bad";
}) {
  return (
    <div
      className={cn(
        "rounded-control border px-3 py-3",
        tone === "ok" && "border-ok-border bg-ok-soft text-ok",
        tone === "warn" && "border-warn-border bg-warn-soft text-warn",
        tone === "bad" && "border-bad-border bg-bad-soft text-bad",
      )}
    >
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs opacity-80">{label}</div>
    </div>
  );
}

function verdict(pct: number): string {
  if (pct === 100) return "Všechno správně. Tohle umíš.";
  if (pct >= 80) return "Sedí to. Pár detailů doladit a je to.";
  if (pct >= 60) return "Základ držíš, chyby stojí za projití.";
  if (pct >= 40) return "Půlka sedí. Projdi si vysvětlení a zkus to znovu.";
  return "Zatím to drhne – ale od toho to tady je.";
}

/** Z markdownu udělá holý text pro náhled v seznamu. */
function plainPrompt(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$[^$\n]*\$/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[*_`#>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
