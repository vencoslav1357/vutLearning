"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { isVutEmail, vutEmailError } from "@/lib/auth/vut";
import { Field, FormMessage } from "../_components/Field";

const MIN_PASSWORD = 10;

/**
 * Jedna stránka pro všechno, co přijde z e-mailu.
 *
 * Better Auth přesměrovává zpátky s `?token=` (reset hesla),
 * `?error=` (propadlý nebo rozbitý odkaz) nebo na `callbackURL`
 * po úspěšném ověření adresy. Rozdělovat to na čtyři routy by
 * znamenalo čtyři stránky s jedním odstavcem.
 */
export default function OvereniPage() {
  return (
    <Suspense fallback={null}>
      <OvereniObsah />
    </Suspense>
  );
}

function OvereniObsah() {
  const params = useSearchParams();
  const token = params.get("token");
  const chyba = params.get("error");
  const stav = params.get("stav");

  if (token) return <NoveHeslo token={token} />;
  if (chyba) return <NeplatnyOdkaz code={chyba} />;
  if (stav === "hotovo") return <Hotovo />;
  if (stav === "zapomenute-heslo") return <ZapomenuteHeslo />;
  return <PoslanoDoSchranky />;
}

/* ------------------------------------------------------------------ */

function PoslanoDoSchranky() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    // Odpověď schválně neřešíme: server neprozrazuje, jestli adresa
    // existuje, a my to prozradit nesmíme taky.
    await authClient.sendVerificationEmail({
      email: email.trim(),
      callbackURL: "/overeni?stav=hotovo",
    });
    setSent(true);
    setPending(false);
  }

  return (
    <Card className="space-y-4">
      <h1 className="text-lg font-semibold text-text">Poslali jsme ti e-mail</h1>
      <p className="text-sm leading-relaxed text-text-muted">
        Ve schránce najdeš odkaz, kterým adresu potvrdíš. Platí hodinu.
        Než ho klikneš, přihlásit se nepůjde.
      </p>
      <p className="text-sm leading-relaxed text-text-muted">
        Nic nepřišlo? Podívej se do spamu — a pak si ho nech poslat znovu.
      </p>

      {sent ? (
        <FormMessage tone="ok">
          Pokud ta adresa u nás existuje, odkaz je na cestě.
        </FormMessage>
      ) : (
        <form onSubmit={resend} className="space-y-3">
          <Field
            label="Tvůj školní e-mail"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="xnovak00@stud.fit.vut.cz"
          />
          <Button type="submit" variant="secondary" size="md" block loading={pending}>
            Poslat odkaz znovu
          </Button>
        </form>
      )}
    </Card>
  );
}

function Hotovo() {
  return (
    <Card className="space-y-4">
      <h1 className="text-lg font-semibold text-text">E-mail je potvrzený</h1>
      <p className="text-sm leading-relaxed text-text-muted">
        Hotovo. Od teď se pokrok ukládá i na server, takže ti přeskočí
        na každé zařízení, kde se přihlásíš.
      </p>
      <ButtonLink href="/" variant="primary" size="md" block>
        Jdeme na kvízy
      </ButtonLink>
    </Card>
  );
}

function NeplatnyOdkaz({ code }: { code: string }) {
  const propadlo = code === "TOKEN_EXPIRED";

  return (
    <Card className="space-y-4">
      <h1 className="text-lg font-semibold text-text">
        {propadlo ? "Odkazu vypršela platnost" : "Odkaz nefunguje"}
      </h1>
      <p className="text-sm leading-relaxed text-text-muted">
        {propadlo
          ? "Odkazy z e-mailu platí hodinu. Nech si poslat nový."
          : "Odkaz je poškozený nebo už byl použitý. Nech si poslat nový."}
      </p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/overeni" variant="primary" size="md">
          Poslat nový odkaz
        </ButtonLink>
        <ButtonLink href="/prihlaseni" variant="secondary" size="md">
          Zpátky na přihlášení
        </ButtonLink>
      </div>
    </Card>
  );
}

function ZapomenuteHeslo() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = email.trim();
  const emailError =
    submitted && trimmed.length > 0 && !isVutEmail(trimmed)
      ? vutEmailError()
      : null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError(null);
    if (!isVutEmail(trimmed)) return;

    setPending(true);
    const { error: resetError } = await authClient.requestPasswordReset({
      email: trimmed,
      redirectTo: "/overeni",
    });
    setPending(false);

    if (resetError) {
      setError(authErrorMessage(resetError));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Card className="space-y-4">
        <h1 className="text-lg font-semibold text-text">Odkaz je na cestě</h1>
        <p className="text-sm leading-relaxed text-text-muted">
          Pokud ta adresa u nás existuje, přišel na ni odkaz na nastavení
          nového hesla. Platí hodinu.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <h1 className="text-lg font-semibold text-text">Zapomenuté heslo</h1>
      <p className="text-sm leading-relaxed text-text-muted">
        Napiš svůj školní e-mail a pošleme ti odkaz na nastavení nového hesla.
      </p>

      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <Field
          label="Školní e-mail"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="xnovak00@stud.fit.vut.cz"
          error={emailError}
        />
        {error ? <FormMessage>{error}</FormMessage> : null}
        <Button type="submit" variant="primary" size="md" block loading={pending}>
          Poslat odkaz
        </Button>
      </form>

      <p className="border-t border-border-base pt-4 text-sm text-text-muted">
        <Link
          href="/prihlaseni"
          className="underline underline-offset-4 hover:text-text"
        >
          Zpátky na přihlášení
        </Link>
      </p>
    </Card>
  );
}

function NoveHeslo({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordError =
    password.length > 0 && password.length < MIN_PASSWORD
      ? `Heslo musí mít aspoň ${MIN_PASSWORD} znaků.`
      : null;
  const confirmError =
    confirm.length > 0 && confirm !== password ? "Hesla se neshodují." : null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD || confirm !== password) return;

    setPending(true);
    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setPending(false);

    if (resetError) {
      setError(authErrorMessage(resetError));
      return;
    }
    router.replace("/prihlaseni");
  }

  return (
    <Card className="space-y-4">
      <h1 className="text-lg font-semibold text-text">Nové heslo</h1>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label="Nové heslo"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={`Aspoň ${MIN_PASSWORD} znaků.`}
          error={passwordError}
        />
        <Field
          label="Nové heslo znovu"
          type="password"
          name="passwordConfirm"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={confirmError}
        />
        {error ? <FormMessage>{error}</FormMessage> : null}
        <Button type="submit" variant="primary" size="md" block loading={pending}>
          Nastavit heslo
        </Button>
      </form>
    </Card>
  );
}
