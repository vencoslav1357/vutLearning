/**
 * Drizzle schéma pro Postgres (Neon).
 *
 * Dvě části:
 *   1. tabulky, které vyžaduje Better Auth (`user`, `session`, `account`,
 *      `verification`) – názvy sloupců musí přesně odpovídat polím, která
 *      Better Auth zná, jinak je adaptér nenajde;
 *   2. naše tabulky pro synchronizaci pokroku, zrcadlící typy
 *      z `src/lib/progress/types.ts`.
 *
 * Databáze je VOLITELNÁ. Bez ní web běží v lokálním režimu (IndexedDB)
 * a nic z tohohle souboru se nepoužije.
 */

import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/* ==================================================================
   Better Auth – jádro

   Klíče objektů (`emailVerified`, `expiresAt`, …) jsou to, co adaptér
   hledá; snake_case názvy v závorce jsou jen jména sloupců v Postgresu.
   Ověřeno proti `@better-auth/core/dist/db/get-tables.mjs` (v 1.7.5).
   ================================================================== */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Sloupce pro OAuth tu jsou jen proto, že je Better Auth očekává.
    // Přihlášení přes třetí strany je záměrně vypnuté – viz auth/server.ts.
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/**
 * Rate limit Better Authu.
 *
 * Musí být v databázi, ne v paměti: na Vercelu běží každý požadavek
 * klidně v jiné instanci, takže paměťový limit by se dal obejít prostým
 * opakováním, dokud netrefíš studenou funkci.
 */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/* ==================================================================
   Synchronizace pokroku

   Časy jsou `bigint` v milisekundách (Unix ms), ne `timestamp` – tak je
   drží i IndexedDB a slučování „vyhrává novější updatedAt" pak nemusí
   nic převádět. Drizzle mapuje bigint na string, což je pro aritmetiku
   nepohodlné, takže používáme `doublePrecision`: 2^53 ms vydrží do roku
   287396, takže o přesnost nepřijdeme.
   ================================================================== */

export const questionState = pgTable(
  "question_state",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    setId: text("set_id").notNull(),
    course: text("course").notNull(),
    streak: integer("streak").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    correct: integer("correct").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    ease: real("ease").notNull().default(2.5),
    intervalDays: real("interval_days").notNull().default(0),
    dueAt: doublePrecision("due_at").notNull(),
    lastSeenAt: doublePrecision("last_seen_at").notNull(),
    lastOutcome: text("last_outcome").notNull(),
    mastery: text("mastery").notNull(),
    materialHash: text("material_hash").notNull(),
    updatedAt: doublePrecision("updated_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.questionId] }),
    index("question_state_user_idx").on(t.userId),
    // Režim „co je na řadě" se ptá přesně na tuhle dvojici.
    index("question_state_due_idx").on(t.userId, t.dueAt),
    index("question_state_course_idx").on(t.userId, t.course),
  ],
);

/**
 * Log pokusů. Append-only – nikdy se needituje ani nemaže (kromě smazání účtu).
 * `clientId` je identita řádku z prohlížeče; díky němu se stejný pokus
 * neuloží dvakrát, když se synchronizace zopakuje.
 */
export const attempt = pgTable(
  "attempt",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    questionId: text("question_id").notNull(),
    setId: text("set_id").notNull(),
    course: text("course").notNull(),
    at: doublePrecision("at").notNull(),
    outcome: text("outcome").notNull(),
    score: real("score").notNull(),
    durationMs: integer("duration_ms").notNull(),
    mode: text("mode").notNull(),
    usedHint: boolean("used_hint").notNull().default(false),
    materialHash: text("material_hash").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.clientId] }),
    index("attempt_user_idx").on(t.userId),
    index("attempt_user_at_idx").on(t.userId, t.at),
    index("attempt_user_question_idx").on(t.userId, t.questionId),
  ],
);

export const dayStat = pgTable(
  "day_stat",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** "YYYY-MM-DD" v lokálním čase uživatele. */
    day: text("day").notNull(),
    answered: integer("answered").notNull().default(0),
    correct: integer("correct").notNull().default(0),
    timeMs: doublePrecision("time_ms").notNull().default(0),
    updatedAt: doublePrecision("updated_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.day] }),
    index("day_stat_user_idx").on(t.userId),
  ],
);

/**
 * Nastavení jako JSON. Schválně netvoříme sloupec na každý přepínač –
 * přibývají a měnit kvůli nim schéma je zbytečná práce.
 */
export const userPrefs = pgTable("user_prefs", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  prefs: jsonb("prefs").notNull(),
  updatedAt: doublePrecision("updated_at").notNull(),
});

export const schema = {
  user,
  session,
  account,
  verification,
  questionState,
  attempt,
  dayStat,
  rateLimit,
  userPrefs,
};

export type DbSchema = typeof schema;
