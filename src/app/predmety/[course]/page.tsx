import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Play } from "lucide-react";
import { loadCourse, loadCourses, loadSets } from "@/content/loader";
import { COURSE_CODES, type CourseCode } from "@/content/schema";
import { Card, Badge, ButtonLink } from "@/components/ui";
import { SetProgress } from "@/components/CourseProgress";

export function generateStaticParams() {
  return loadCourses().map((c) => ({ course: c.code }));
}

export async function generateMetadata({
  params,
}: PageProps<"/predmety/[course]">): Promise<Metadata> {
  const { course } = await params;
  const found = isCourseCode(course) ? loadCourse(course) : undefined;
  return { title: found ? `${found.abbr} – ${found.name}` : "Předmět" };
}

function isCourseCode(v: string): v is CourseCode {
  return (COURSE_CODES as readonly string[]).includes(v);
}

export default async function CoursePage({ params }: PageProps<"/predmety/[course]">) {
  const { course: code } = await params;
  if (!isCourseCode(code)) notFound();

  const course = loadCourse(code);
  if (!course) notFound();

  const sets = loadSets(code);
  const total = sets.reduce((n, s) => n + s.questions.length, 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link
        href="/predmety"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Předměty
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge accent={course.accent}>{course.abbr}</Badge>
          <span className="text-xs text-text-faint">
            {course.semester === "zimni" ? "zimní semestr" : "letní semestr"}
            {course.credits ? ` · ${course.credits} kreditů` : ""}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{course.name}</h1>
        {course.description && (
          <p className="mt-2 max-w-prose text-text-muted">{course.description}</p>
        )}
      </header>

      {total > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={`/trenink?predmet=${code}`} variant="primary">
            <Play className="size-4" aria-hidden />
            Trénovat celý předmět
          </ButtonLink>
          <ButtonLink href={`/chyby?predmet=${code}`} variant="secondary">
            Opakovat chyby
          </ButtonLink>
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Témata</h2>

        {sets.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-text-muted">
              K tomuhle předmětu zatím nejsou žádné otázky.
            </p>
            <p className="mt-2 text-sm text-text-faint">
              Přidávají se do <code className="font-mono">content/{code}/</code> – návod
              je v <code className="font-mono">docs/AUTHORING.md</code>.
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {sets.map((set) => (
              <li key={set.id}>
                <Link href={`/kviz/${code}/${set.id}`} className="block">
                  <Card interactive className="flex items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        {set.lecture !== undefined && (
                          <span className="tabular-nums text-xs text-text-faint">
                            {String(set.lecture).padStart(2, "0")}
                          </span>
                        )}
                        <h3 className="truncate font-medium">{set.title}</h3>
                      </div>
                      {set.description && (
                        <p className="mt-1 line-clamp-1 text-sm text-text-muted">
                          {set.description}
                        </p>
                      )}
                      <SetProgress
                        className="mt-3"
                        setId={set.id}
                        total={set.questions.length}
                      />
                    </div>
                    <Play className="size-4 shrink-0 text-text-faint" aria-hidden />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
