/**
 * Serverová instance Better Authu.
 *
 * Záměrně BEZ třetích stran – žádné „přihlásit přes Google". Jen e-mail
 * a heslo, a jen e-mail z domény VUT.
 *
 * Přihlášení je volitelný doplněk: zapíná synchronizaci pokroku mezi
 * zařízeními. Bez `DATABASE_URL` je `auth` rovno `null` a web běží dál
 * v lokálním režimu – build ani runtime to nesmí shodit.
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { db } from "@/db/client";
import { schema } from "@/db/schema";
import {
  passwordResetEmail,
  sendMail,
  verificationEmail,
} from "./email";
import { isVutEmail, vutEmailError } from "./vut";

/**
 * Sekret je povinný jen tehdy, když databáze vůbec existuje. Bez databáze
 * se přihlašování nezapíná, takže by povinná proměnná jen bránila tomu,
 * aby si někdo web spustil bez konfigurace.
 */
function requireSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "Je nastavená DATABASE_URL, ale chybí BETTER_AUTH_SECRET. " +
        "Vygeneruj ho: openssl rand -base64 32",
    );
  }
  if (secret.length < 32) {
    throw new Error(
      "BETTER_AUTH_SECRET je příliš krátký (< 32 znaků). Vygeneruj nový: openssl rand -base64 32",
    );
  }
  return secret;
}

function resolveBaseURL(): string | undefined {
  const explicit = process.env.BETTER_AUTH_URL?.trim();
  if (explicit) return explicit;
  // Na Vercelu je URL preview nasazení známá až za běhu.
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return undefined;
}

function createAuth() {
  if (!db) return null;

  return betterAuth({
    appName: "Kvízy FIT VUT",
    secret: requireSecret(),
    baseURL: resolveBaseURL(),

    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
      // neon-http posílá každý dotaz zvlášť přes HTTP a interaktivní
      // transakce neumí. Adaptér musí operace pouštět sekvenčně.
      transaction: false,
    }),

    emailAndPassword: {
      enabled: true,
      // Bez ověření adresy by pravidlo o VUT e-mailu nic neznamenalo:
      // kdokoli napíše kdokoli@vut.cz a je uvnitř.
      requireEmailVerification: true,
      // Deset znaků. U hesla, které si lidi stejně recyklují, je délka
      // jediná obrana, co v praxi funguje; pravidla na velká písmena
      // a znaky navíc jen vedou k Heslo123!.
      minPasswordLength: 10,
      sendResetPassword: async ({ user, url }) => {
        await sendMail({ to: user.email, ...passwordResetEmail(url) });
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendMail({ to: user.email, ...verificationEmail(url) });
      },
    },

    /**
     * Tohle je ta skutečná obrana pravidla o VUT e-mailu.
     *
     * Hook na endpointu by hlídal jen formulář; `databaseHooks` sedí
     * na zápisu do databáze, takže jím projde KAŽDÁ cesta, která by
     * uživatele založila – včetně přímého volání API.
     *
     * Vyhozený APIError se uživateli vrátí jako čitelná hláška;
     * vrácení `false` by účet jen tiše nezaložilo.
     */
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!isVutEmail(user.email)) {
              throw new APIError("BAD_REQUEST", {
                code: "EMAIL_NOT_VUT",
                message: vutEmailError(),
              });
            }
            // Adresu ukládáme znormalizovanou, ať se `x@VUT.cz`
            // a `x@vut.cz` nestanou dvěma účty.
            return {
              data: { ...user, email: user.email.trim().toLowerCase() },
            };
          },
        },
      },
    },

    /**
     * Ve výchozím stavu je rate limit zapnutý jen v produkci a v paměti.
     * Paměť na serverless funkcích znamená limit per instance – proto
     * `storage: "database"`, ať platí globálně.
     */
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 3600, max: 5 },
        "/request-password-reset": { window: 3600, max: 3 },
        "/send-verification-email": { window: 3600, max: 5 },
        "/reset-password": { window: 3600, max: 10 },
      },
    },

    // Musí být poslední plugin: nastavuje cookies přes next/headers.
    plugins: [nextCookies()],
  });
}

/** `null`, když není nastavená databáze. Vždy si to ověř, než sáhneš na `auth`. */
export const auth = createAuth();

export type Auth = NonNullable<typeof auth>;
export type Session = Auth["$Infer"]["Session"];
