import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadCourse, loadSet, loadSets, loadCourses } from "@/content/loader";
import { COURSE_CODES, type CourseCode } from "@/content/schema";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import type { SessionConfig } from "@/lib/session/types";
import { buildSessionQuestions } from "@/content/prerender";

export function generateStaticParams() {
  return loadCourses().flatMap((c) =>
    loadSets(c.code).map((s) => ({ course: c.code, set: s.id })),
  );
}

function isCourseCode(v: string): v is CourseCode {
  return (COURSE_CODES as readonly string[]).includes(v);
}

export async function generateMetadata({
  params,
}: PageProps<"/kviz/[course]/[set]">): Promise<Metadata> {
  const { course, set } = await params;
  const s = isCourseCode(course) ? loadSet(course, set) : undefined;
  return { title: s ? s.title : "Kvíz" };
}

export default async function QuizPage({ params }: PageProps<"/kviz/[course]/[set]">) {
  const { course: code, set: setId } = await params;
  if (!isCourseCode(code)) notFound();

  const course = loadCourse(code);
  const set = loadSet(code, setId);
  if (!course || !set) notFound();

  const config: SessionConfig = {
    mode: "procvicovani",
    title: `${course.abbr} · ${set.title}`,
    backHref: `/predmety/${code}`,
    shuffleQuestions: true,
    questions: await buildSessionQuestions(set),
  };

  return <QuizRunner config={config} />;
}
