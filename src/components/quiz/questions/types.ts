import type { Question } from "@/content/schema";
import type { Answer, Evaluation } from "@/lib/quiz/evaluate";
import type { RenderedQuestion } from "@/content/prerender";

/** Otázka právě jednoho typu, vytažená ze sjednocení ve schématu. */
export type QuestionOf<T extends Question["type"]> = Extract<Question, { type: T }>;

/** Odpověď právě jednoho typu. */
export type AnswerOf<T extends Answer["type"]> = Extract<Answer, { type: T }>;

/**
 * Společné rozhraní všech vstupních komponent.
 *
 * Komponenta je řízená zvenčí: vlastní stav nedrží (kromě čistě vizuálního,
 * jako je poloha zaměření), takže QuizRunner může odpověď kdykoliv přepsat.
 */
export interface QuestionInputProps<Q, A> {
  question: Q;
  value: A;
  onChange: (a: A) => void;
  /** Po vyhodnocení se vstup zamkne a ukáže se, co bylo správně. */
  evaluation: Evaluation | null;
  disabled: boolean;
  /** Seed pro míchání možností v této session. */
  seed: number;
  /**
   * Smí se pořadí možností míchat? Otázka to může zakázat sama
   * (`shuffleChoices: false` v obsahu), tohle je navíc přání uživatele
   * z Nastavení. Míchá se jen když souhlasí obojí.
   */
  allowShuffle: boolean;
  /**
   * Markdown přeložený na HTML už na serveru. Komponenta je klientská,
   * takže si KaTeX ani Shiki spustit nemůže – dostane hotový výsledek.
   */
  html: RenderedQuestion;
}

/** Zkratka pro komponentu jednoho typu otázky. */
export type QuestionInput<T extends Question["type"] & Answer["type"]> = QuestionInputProps<
  QuestionOf<T>,
  AnswerOf<T>
>;
