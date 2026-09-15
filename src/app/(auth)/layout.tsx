import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { isDbConfigured } from "@/db/client";

/**
 * Rám pro přihlašovací stránky.
 *
 * Když není nastavená databáze, přihlašování neexistuje. Místo formuláře,
 * který by po odeslání jen spadl na 503, tu stojí klidné vysvětlení –
 * web je použitelný i bez účtu, tohle není chybový stav.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
      {isDbConfigured() ? children : <AuthDisabled />}

      <p className="text-center text-sm text-text-muted">
        <Link href="/" className="underline underline-offset-4 hover:text-text">
          Zpátky na kvízy
        </Link>
      </p>
    </main>
  );
}

function AuthDisabled() {
  return (
    <Card className="space-y-3">
      <h1 className="text-lg font-semibold text-text">
        Přihlašování zatím není zapnuté
      </h1>
      <p className="text-sm leading-relaxed text-text-muted">
        Pokrok se ukládá jen v tomhle prohlížeči. Nic se neztratí — jen se
        nepřenese na jiné zařízení.
      </p>
      <p className="text-sm leading-relaxed text-text-muted">
        Účet slouží výhradně k synchronizaci pokroku. Všechny kvízy fungují
        i bez něj.
      </p>
    </Card>
  );
}
