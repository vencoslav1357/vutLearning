import Link from "next/link";
import { BookOpen, Repeat, AlertCircle, ArrowRight } from "lucide-react";
import { loadCourses, loadSets } from "@/content/loader";
import { Card, Badge } from "@/components/ui";
import { StreakBanner } from "@/components/StreakBanner";
import { CourseProgress } from "@/components/CourseProgress";

export default function HomePage() {
  const courses = loadCourses();
  const counts = new Map(
    courses.map((c) => [
      c.code,
      loadSets(c.code).reduce((n, s) => n + s.questions.length, 0),
    ]),
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-20">
      <section className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Procvičuj, co tě čeká u zkoušky.
        </h1>
        <p className="mt-4 text-lg text-text-muted">
          Kvízy z předmětů prvního ročníku na FIT VUT. Odpovídáš, hned vidíš proč,
          a web si pamatuje, co ti nejde.
        </p>
      </section>

      <StreakBanner className="mt-10" />

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <ModeCard
          href="/trenink"
          icon={<Repeat className="size-5" aria-hidden />}
          title="Trénink"
          description="Namíchá otázky podle toho, co ti dělá problémy."
        />
        <ModeCard
          href="/chyby"
          icon={<AlertCircle className="size-5" aria-hidden />}
          title="Chyby"
          description="Jen to, co jsi naposledy zkazil."
        />
        <ModeCard
          href="/predmety"
          icon={<BookOpen className="size-5" aria-hidden />}
          title="Předměty"
          description="Projdi si konkrétní téma od začátku."
        />
      </section>

      <section className="mt-14">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Předměty</h2>
          <Link
            href="/prehled"
            className="text-sm text-text-muted transition-colors hover:text-text"
          >
            Přehled pokroku
          </Link>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {courses.map((course) => (
            <li key={course.code}>
              <Link href={`/predmety/${course.code}`} className="block">
                <Card interactive className="h-full p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge accent={course.accent}>{course.abbr}</Badge>
                        <span className="text-xs text-text-faint">
                          {counts.get(course.code) ?? 0} otázek
                        </span>
                      </div>
                      <h3 className="mt-2 truncate font-medium">{course.name}</h3>
                      {course.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-text-muted">
                          {course.description}
                        </p>
                      )}
                    </div>
                    <ArrowRight
                      className="mt-1 size-4 shrink-0 text-text-faint"
                      aria-hidden
                    />
                  </div>
                  <CourseProgress
                    className="mt-4"
                    course={course.code}
                    total={counts.get(course.code) ?? 0}
                  />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ModeCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="block h-full">
      <Card interactive className="h-full p-5">
        <div className="flex size-10 items-center justify-center rounded-control bg-accent-soft text-accent">
          {icon}
        </div>
        <h3 className="mt-3 font-medium">{title}</h3>
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      </Card>
    </Link>
  );
}
