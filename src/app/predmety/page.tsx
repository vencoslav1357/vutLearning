import Link from "next/link";
import type { Metadata } from "next";
import { loadCourses, loadSets } from "@/content/loader";
import { Card, Badge } from "@/components/ui";
import { CourseProgress } from "@/components/CourseProgress";

export const metadata: Metadata = { title: "Předměty" };

export default function CoursesPage() {
  const courses = loadCourses();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Předměty</h1>
      <p className="mt-2 text-text-muted">Vyber si předmět a téma, které chceš procvičit.</p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {courses.map((course) => {
          const sets = loadSets(course.code);
          const total = sets.reduce((n, s) => n + s.questions.length, 0);
          return (
            <li key={course.code}>
              <Link href={`/predmety/${course.code}`} className="block h-full">
                <Card interactive className="h-full p-5">
                  <div className="flex items-center gap-2">
                    <Badge accent={course.accent}>{course.abbr}</Badge>
                    <span className="text-xs text-text-faint">
                      {sets.length} témat · {total} otázek
                    </span>
                  </div>
                  <h2 className="mt-2 font-medium">{course.name}</h2>
                  {course.description && (
                    <p className="mt-1 text-sm text-text-muted">{course.description}</p>
                  )}
                  <CourseProgress className="mt-4" course={course.code} total={total} />
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
