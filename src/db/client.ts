/**
 * Připojení k databázi (Neon Postgres) přes Drizzle.
 *
 * Databáze je volitelná. Když `DATABASE_URL` chybí, `db` je `null`
 * a celý web jede v lokálním režimu – progress zůstává v IndexedDB.
 * Nikde se proto nesmí předpokládat, že `db` existuje; nejdřív
 * `isDbConfigured()`, pak teprve práce s daty.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { schema } from "./schema";

const url = process.env.DATABASE_URL?.trim();

/**
 * Neon má dva connection stringy. Serverless funkce se škálují po jedné
 * instanci na požadavek, takže přímé (non-pooled) připojení vyčerpá limit
 * spojení dřív, než si toho kdokoli všimne. Pooled host má v sobě `-pooler`.
 */
function warnIfNotPooled(connectionString: string): void {
  if (process.env.NODE_ENV === "production") return;
  if (connectionString.includes("-pooler.")) return;
  console.warn(
    "[db] DATABASE_URL nevypadá jako pooled connection string (chybí '-pooler'). " +
      "Na Vercelu tím dojdou spojení. V Neon konzoli přepni přepínač na 'Pooled connection'.",
  );
}

function createDb() {
  if (!url) return null;
  warnIfNotPooled(url);
  // neon-http jede přes HTTP, jedno kolo na dotaz – přesně to, co
  // serverless funkce potřebuje. Interaktivní transakce neumí, proto
  // je adaptér Better Authu má vypnuté (transaction: false).
  return drizzle(neon(url), { schema });
}

export const db = createDb();

/** Je databáze nakonfigurovaná? Když ne, běžíme v lokálním režimu. */
export function isDbConfigured(): boolean {
  return db !== null;
}

export type Db = NonNullable<typeof db>;
