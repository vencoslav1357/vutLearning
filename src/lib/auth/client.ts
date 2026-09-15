"use client";

/**
 * Klient Better Authu pro prohlížeč.
 *
 * Vyrábí se vždycky (i když server přihlašování nemá zapnuté) – jinak by
 * se komponenty musely zabývat tím, jestli klient vůbec existuje.
 * Když databáze chybí, endpointy vracejí 503 a stránky to řeší
 * přes `AUTH_ENABLED` níž.
 */

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Prázdné = stejný původ. Na Vercelu ani lokálně není co nastavovat.
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || undefined,
});

export const { signIn, signUp, signOut, useSession } = authClient;

/**
 * Ví prohlížeč, že je přihlašování zapnuté?
 *
 * `DATABASE_URL` je serverová proměnná a do klienta se nedostane, proto
 * ji zrcadlí veřejný přepínač. Je to jen kosmetika (podle ní se schová
 * formulář); skutečnou obranu dělá server.
 */
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";

/**
 * Chyba z Better Authu přeložená do věty, kterou má smysl ukázat.
 * Cizí anglické hlášky ze serveru nechceme pouštět na obrazovku,
 * ale vlastní `message` z našeho hooku (pravidlo o VUT e-mailu) ano.
 */
export function authErrorMessage(
  error: { code?: string; message?: string; status?: number } | null | undefined,
): string {
  if (!error) return "Něco se nepovedlo. Zkus to prosím znovu.";

  switch (error.code) {
    case "EMAIL_NOT_VUT":
      return error.message ?? "Tenhle e-mail není z domény VUT.";
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Nesedí e-mail nebo heslo.";
    case "EMAIL_NOT_VERIFIED":
      return "E-mail ještě není potvrzený. Mrkni do schránky na ověřovací odkaz.";
    case "USER_ALREADY_EXISTS":
      return "Účet s tímhle e-mailem už existuje. Zkus se přihlásit.";
    case "PASSWORD_TOO_SHORT":
      return "Heslo musí mít aspoň 10 znaků.";
    case "INVALID_TOKEN":
      return "Odkaz je neplatný. Nech si poslat nový.";
    case "TOKEN_EXPIRED":
      return "Odkazu vypršela platnost. Nech si poslat nový.";
  }

  if (error.status === 429) {
    return "Moc pokusů za sebou. Dej tomu chvilku a zkus to znovu.";
  }
  if (error.status === 503) {
    return "Přihlašování zatím není zapnuté. Pokrok se ukládá jen v tomhle prohlížeči.";
  }

  return "Něco se nepovedlo. Zkus to prosím znovu.";
}
