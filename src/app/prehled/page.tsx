import type { Metadata } from "next";
import { loadCourses, loadSets } from "@/content/loader";
import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = { title: "Přehled" };

export default function OverviewPage() {
  const courses = loadCourses().map((c) => ({
    code: c.code,
    abbr: c.abbr,
    name: c.name,
    accent: c.accent,
    total: loadSets(c.code).reduce((n, s) => n + s.questions.length, 0),
  }));

  return <Dashboard courses={courses} />;
}
