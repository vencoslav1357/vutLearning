import type { Metadata } from "next";
import { loadAllSets, loadCourses } from "@/content/loader";
import { TrainingSession } from "@/components/quiz/TrainingSession";
import type { SessionQuestion } from "@/lib/session/types";
import { buildSessionQuestions } from "@/content/prerender";

export const metadata: Metadata = { title: "Trénink" };

/**
 * Trénink vybírá otázky podle pokroku, a ten žije v prohlížeči.
 * Server proto pošle celou zásobu otázek a výběr proběhne na klientovi.
 * Při řádech tisíců otázek by se to muselo přepsat na dotaz na server,
 * ale při současné velikosti obsahu je to zbytečná složitost navíc.
 */
export default async function TrainingPage() {
  const courses = loadCourses();
  // Markdown se překládá na serveru pro celou zásobu naráz – klient
  // pak jen vybere, co ukázat, bez čekání na další request.
  const pool: SessionQuestion[] = (
    await Promise.all(loadAllSets().map((set) => buildSessionQuestions(set)))
  ).flat();

  return (
    <TrainingSession
      mode="trenink"
      pool={pool}
      courses={courses.map((c) => ({ code: c.code, abbr: c.abbr, accent: c.accent }))}
    />
  );
}
