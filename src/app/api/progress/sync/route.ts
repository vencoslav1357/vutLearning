/**
 * Sloučení lokálního pokroku se serverovým.
 *
 * Klient pošle `ProgressSnapshot` ze svého IndexedDB, server ho slije
 * se svým a vrátí výsledek zpátky. Obě strany pak mají totéž.
 *
 * Strategie: po jednotlivých otázkách vyhrává novější `updatedAt`.
 * Žádné hádání, žádné slučování polí napůl – to by z dvou konzistentních
 * stavů udělalo jeden nesmyslný.
 */

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db/client";
import {
  attempt as attemptTable,
  dayStat as dayStatTable,
  questionState as questionStateTable,
  userPrefs as userPrefsTable,
} from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { DEFAULT_PREFS } from "@/lib/progress/types";
import type {
  AttemptRecord,
  DayStats,
  ProgressSnapshot,
  QuestionState,
  UserPrefs,
} from "@/lib/progress/types";

/** 4 MB. Roky poctivého klikání se do toho vejdou mnohonásobně. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

const outcome = z.enum(["correct", "partial", "incorrect", "skipped"]);
const mode = z.enum(["procvicovani", "chyby", "trenink"]);
const mastery = z.enum(["nova", "ucim-se", "skoro", "zvladnuta", "slabina"]);

const questionStateSchema = z.object({
  questionId: z.string().min(1).max(200),
  setId: z.string().min(1).max(200),
  course: z.string().min(1).max(50),
  streak: z.number().int().min(0),
  attempts: z.number().int().min(0),
  correct: z.number().int().min(0),
  lapses: z.number().int().min(0),
  ease: z.number(),
  intervalDays: z.number(),
  dueAt: z.number(),
  lastSeenAt: z.number(),
  lastOutcome: outcome,
  mastery,
  materialHash: z.string().max(200),
  updatedAt: z.number(),
});

const attemptSchema = z.object({
  id: z.number().optional(),
  questionId: z.string().min(1).max(200),
  setId: z.string().min(1).max(200),
  course: z.string().min(1).max(50),
  at: z.number(),
  outcome,
  score: z.number(),
  durationMs: z.number().int().min(0),
  mode,
  usedHint: z.boolean(),
  materialHash: z.string().max(200),
});

const dayStatsSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  answered: z.number().int().min(0),
  correct: z.number().int().min(0),
  timeMs: z.number().min(0),
});

const prefsSchema = z.object({
  shuffleChoices: z.boolean(),
  shuffleQuestions: z.boolean(),
  instantFeedback: z.boolean(),
  sessionSize: z.number().int().min(1).max(200),
  sound: z.boolean(),
  updatedAt: z.number(),
});

const snapshotSchema = z.object({
  version: z.literal(1),
  exportedAt: z.number(),
  states: z.array(questionStateSchema).max(20000),
  attempts: z.array(attemptSchema).max(50000),
  days: z.array(dayStatsSchema).max(3650),
  prefs: prefsSchema,
});

function fail(status: number, code: string, message: string): Response {
  return Response.json({ error: code, message }, { status });
}

/**
 * Přirozený klíč pokusu. Lokální `id` je jen autoinkrement v IndexedDB,
 * takže by se na jiném zařízení trefil do cizího řádku. Dvojice
 * otázka + čas na milisekundu je stabilní a jeden člověk dvě odpovědi
 * ve stejné milisekundě nepošle.
 */
function attemptKey(record: AttemptRecord): string {
  return `${record.questionId}@${record.at}`;
}

export async function POST(request: Request): Promise<Response> {
  if (!auth || !db) {
    return fail(
      503,
      "AUTH_DISABLED",
      "Synchronizace není zapnutá. Pokrok zůstává v tomhle prohlížeči.",
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return fail(401, "UNAUTHORIZED", "Nejsi přihlášený.");
  }
  const userId = session.user.id;

  // Hlavičce se nedá věřit, ale když si o velké tělo řekne rovnou,
  // ušetříme si jeho stahování.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return fail(413, "BODY_TOO_LARGE", "Data jsou příliš velká.");
  }

  const raw = await request.text();
  if (new Blob([raw]).size > MAX_BODY_BYTES) {
    return fail(413, "BODY_TOO_LARGE", "Data jsou příliš velká.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return fail(400, "INVALID_JSON", "Tělo požadavku není platný JSON.");
  }

  const parsed = snapshotSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return fail(400, "INVALID_SNAPSHOT", "Data pokroku nemají očekávaný tvar.");
  }
  const incoming = parsed.data;

  /* ---------------- stavy otázek: vyhrává novější updatedAt ------------- */

  const serverStateRows = await db
    .select()
    .from(questionStateTable)
    .where(eq(questionStateTable.userId, userId));

  const mergedStates = new Map<string, QuestionState>();
  for (const row of serverStateRows) {
    mergedStates.set(row.questionId, {
      questionId: row.questionId,
      setId: row.setId,
      course: row.course,
      streak: row.streak,
      attempts: row.attempts,
      correct: row.correct,
      lapses: row.lapses,
      ease: row.ease,
      intervalDays: row.intervalDays,
      dueAt: row.dueAt,
      lastSeenAt: row.lastSeenAt,
      lastOutcome: row.lastOutcome as QuestionState["lastOutcome"],
      mastery: row.mastery as QuestionState["mastery"],
      materialHash: row.materialHash,
      updatedAt: row.updatedAt,
    });
  }

  const statesToWrite: QuestionState[] = [];
  for (const state of incoming.states) {
    const existing = mergedStates.get(state.questionId);
    if (existing && existing.updatedAt >= state.updatedAt) continue;
    mergedStates.set(state.questionId, state);
    statesToWrite.push(state);
  }

  for (const state of statesToWrite) {
    await db
      .insert(questionStateTable)
      .values({ userId, ...state })
      .onConflictDoUpdate({
        target: [questionStateTable.userId, questionStateTable.questionId],
        set: {
          setId: state.setId,
          course: state.course,
          streak: state.streak,
          attempts: state.attempts,
          correct: state.correct,
          lapses: state.lapses,
          ease: state.ease,
          intervalDays: state.intervalDays,
          dueAt: state.dueAt,
          lastSeenAt: state.lastSeenAt,
          lastOutcome: state.lastOutcome,
          mastery: state.mastery,
          materialHash: state.materialHash,
          updatedAt: state.updatedAt,
        },
      });
  }

  /* ---------------- pokusy: append-only, bez duplicit ------------------- */

  const serverAttemptRows = await db
    .select()
    .from(attemptTable)
    .where(eq(attemptTable.userId, userId));

  const knownAttempts = new Set(serverAttemptRows.map((row) => row.clientId));
  const newAttempts = incoming.attempts.filter(
    (record) => !knownAttempts.has(attemptKey(record)),
  );

  if (newAttempts.length > 0) {
    await db
      .insert(attemptTable)
      .values(
        newAttempts.map((record) => ({
          userId,
          clientId: attemptKey(record),
          questionId: record.questionId,
          setId: record.setId,
          course: record.course,
          at: record.at,
          outcome: record.outcome,
          score: record.score,
          durationMs: record.durationMs,
          mode: record.mode,
          usedHint: record.usedHint,
          materialHash: record.materialHash,
        })),
      )
      // Dva souběžné requesty ze dvou záložek by jinak spadly na duplicitě.
      .onConflictDoNothing();
  }

  const mergedAttempts: AttemptRecord[] = [
    ...serverAttemptRows.map((row) => ({
      questionId: row.questionId,
      setId: row.setId,
      course: row.course,
      at: row.at,
      outcome: row.outcome as AttemptRecord["outcome"],
      score: row.score,
      durationMs: row.durationMs,
      mode: row.mode as AttemptRecord["mode"],
      usedHint: row.usedHint,
      materialHash: row.materialHash,
      synced: true as const,
    })),
    ...newAttempts.map((record) => ({ ...record, id: undefined, synced: true as const })),
  ].sort((a, b) => a.at - b.at);

  /* ---------------- denní statistiky ------------------------------------ */

  const serverDayRows = await db
    .select()
    .from(dayStatTable)
    .where(eq(dayStatTable.userId, userId));

  const mergedDays = new Map<string, DayStats>();
  for (const row of serverDayRows) {
    mergedDays.set(row.day, {
      day: row.day,
      answered: row.answered,
      correct: row.correct,
      timeMs: row.timeMs,
    });
  }

  const now = Date.now();
  for (const day of incoming.days) {
    const existing = mergedDays.get(day.day);
    // Maximum, ne součet. Synchronizace se běžně opakuje a součet
    // by z jednoho odpoledne udělal rekordní den.
    const merged: DayStats = existing
      ? {
          day: day.day,
          answered: Math.max(existing.answered, day.answered),
          correct: Math.max(existing.correct, day.correct),
          timeMs: Math.max(existing.timeMs, day.timeMs),
        }
      : day;

    const changed =
      !existing ||
      merged.answered !== existing.answered ||
      merged.correct !== existing.correct ||
      merged.timeMs !== existing.timeMs;

    mergedDays.set(day.day, merged);
    if (!changed) continue;

    await db
      .insert(dayStatTable)
      .values({ userId, ...merged, updatedAt: now })
      .onConflictDoUpdate({
        target: [dayStatTable.userId, dayStatTable.day],
        set: {
          answered: merged.answered,
          correct: merged.correct,
          timeMs: merged.timeMs,
          updatedAt: now,
        },
      });
  }

  /* ---------------- nastavení: novější updatedAt vyhrává ---------------- */

  const [serverPrefsRow] = await db
    .select()
    .from(userPrefsTable)
    .where(eq(userPrefsTable.userId, userId))
    .limit(1);

  const serverPrefs = serverPrefsRow
    ? { ...DEFAULT_PREFS, ...(serverPrefsRow.prefs as Partial<UserPrefs>) }
    : null;

  let mergedPrefs: UserPrefs;
  if (!serverPrefs || incoming.prefs.updatedAt > serverPrefs.updatedAt) {
    mergedPrefs = incoming.prefs;
    await db
      .insert(userPrefsTable)
      .values({ userId, prefs: mergedPrefs, updatedAt: mergedPrefs.updatedAt })
      .onConflictDoUpdate({
        target: userPrefsTable.userId,
        set: { prefs: mergedPrefs, updatedAt: mergedPrefs.updatedAt },
      });
  } else {
    mergedPrefs = serverPrefs;
  }

  const snapshot: ProgressSnapshot = {
    version: 1,
    exportedAt: now,
    states: [...mergedStates.values()],
    attempts: mergedAttempts,
    days: [...mergedDays.values()].sort((a, b) => a.day.localeCompare(b.day)),
    prefs: mergedPrefs,
  };

  return Response.json(snapshot);
}

/** Jiné metody tu nedávají smysl; GET by svedl prohlížeč k předběžnému načtení. */
export async function GET(): Promise<Response> {
  return fail(405, "METHOD_NOT_ALLOWED", "Použij POST.");
}
