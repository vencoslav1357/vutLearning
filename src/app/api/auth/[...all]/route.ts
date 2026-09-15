/**
 * Všechny endpointy Better Authu pod /api/auth/*.
 *
 * Bez databáze přihlašování neexistuje – pak tu vracíme 503 s vysvětlením
 * místo toho, aby se build hroutil na `auth` rovném `null`.
 */

import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/server";

function disabled(): Response {
  return Response.json(
    {
      error: "AUTH_DISABLED",
      message:
        "Přihlašování zatím není zapnuté. Pokrok se ukládá jen v tomhle prohlížeči.",
    },
    { status: 503 },
  );
}

const handlers = auth
  ? toNextJsHandler(auth)
  : { GET: async () => disabled(), POST: async () => disabled() };

export const GET = handlers.GET;
export const POST = handlers.POST;
