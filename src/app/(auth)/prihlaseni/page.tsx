"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { Field, FormMessage } from "../_components/Field";

export default function PrihlaseniPage() {
  return (
    <Suspense fallback={null}>
      <PrihlaseniForm />
    </Suspense>
  );
}

function PrihlaseniForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Nepotvrzený e-mail není chyba uživatele – nabídneme poslat odkaz znovu. */
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resent, setResent] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNeedsVerification(false);
    setResent(false);

    const { error: signInError } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(authErrorMessage(signInError));
      setNeedsVerification(signInError.code === "EMAIL_NOT_VERIFIED");
      setPending(false);
      return;
    }

    // refresh() přenačte serverové komponenty, aby se hlavička hned
    // překreslila jako přihlášená.
    router.replace("/");
    router.refresh();
  }

  async function resendVerification() {
    setPending(true);
    await authClient.sendVerificationEmail({
      email: email.trim(),
      callbackURL: "/overeni?stav=hotovo",
    });
    setResent(true);
    setPending(false);
  }

  return (
    <Card className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold text-text">Přihlášení</h1>
        <p className="text-sm leading-relaxed text-text-muted">
          Účet je dobrovolný. Slouží jen k tomu, aby ti pokrok přeskočil
          mezi počítačem a mobilem.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label="Školní e-mail"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="xnovak00@stud.fit.vut.cz"
        />

        <Field
          label="Heslo"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? <FormMessage>{error}</FormMessage> : null}

        {needsVerification && !resent ? (
          <Button
            type="button"
            variant="secondary"
            size="md"
            block
            loading={pending}
            onClick={resendVerification}
          >
            Poslat ověřovací e-mail znovu
          </Button>
        ) : null}

        {resent ? (
          <FormMessage tone="ok">
            Ověřovací e-mail je na cestě. Mrkni do schránky.
          </FormMessage>
        ) : null}

        <Button type="submit" variant="primary" size="md" block loading={pending}>
          Přihlásit se
        </Button>
      </form>

      <div className="flex flex-wrap justify-between gap-3 border-t border-border-base pt-4 text-sm">
        <Link
          href="/registrace"
          className="text-accent underline underline-offset-4"
        >
          Založit účet
        </Link>
        <Link
          href="/overeni?stav=zapomenute-heslo"
          className="text-text-muted underline underline-offset-4 hover:text-text"
        >
          Zapomenuté heslo
        </Link>
      </div>
    </Card>
  );
}
