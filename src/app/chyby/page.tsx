import type { Metadata } from "next";
import { loadAllSets, loadCourses } from "@/content/loader";
import { TrainingSession } from "@/components/quiz/TrainingSession";
import type { SessionQuestion } from "@/lib/session/types";
import { buildSessionQuestions } from "@/content/prerender";

export const metadata: Metadata = { title: "Chyby" };

export default async function MistakesPage() {
  const courses = loadCourses();
  // Markdown se překládá na serveru pro celou zásobu naráz – klient
  // pak jen vybere, co ukázat, bez čekání na další request.
  const pool: SessionQuestion[] = (
    await Promise.all(loadAllSets().map((set) => buildSessionQuestions(set)))
  ).flat();

  return (
    <TrainingSession
      mode="chyby"
      pool={pool}
      courses={courses.map((c) => ({ code: c.code, abbr: c.abbr, accent: c.accent }))}
    />
  );
}
