import type { StudyMode } from "@/lib/progress/types";
import type { Question } from "@/content/schema";
import type { RenderedQuestion } from "@/content/prerender";

/** Otázka připravená pro běh session – včetně textů přeložených na serveru. */
export interface SessionQuestion {
  question: Question;
  setId: string;
  setTitle: string;
  course: string;
  materialHash: string;
  /** Markdown přeložený na HTML. Vyrábí server, viz `prerenderQuestion`. */
  html: RenderedQuestion;
}

export interface SessionConfig {
  mode: StudyMode;
  /** Popisek session zobrazený v hlavičce, např. "IDM · Množiny". */
  title: string;
  /** Kam odkazuje tlačítko zpět. */
  backHref: string;
  questions: SessionQuestion[];
  shuffleQuestions: boolean;
}

/** Výsledek jedné otázky v rámci session – jen pro shrnutí na konci. */
export interface SessionResult {
  questionId: string;
  outcome: import("@/lib/progress/types").AnswerOutcome;
  score: number;
  durationMs: number;
}
