import type { Config } from "drizzle-kit";

/**
 * Konfigurace drizzle-kit (migrace a `db:push`).
 *
 * Spouští se jen ručně z příkazové řádky, ne za běhu aplikace, takže
 * tady `DATABASE_URL` chybět nesmí – na rozdíl od zbytku webu, který
 * bez databáze funguje dál.
 *
 * Proměnnou načti ze souboru `.env.local`:
 *   node --env-file=.env.local node_modules/.bin/drizzle-kit push
 */
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // Cizí klíče a indexy jsou v schema.ts; verbose ukáže, co se chystá spustit.
  verbose: true,
  strict: true,
} satisfies Config;
