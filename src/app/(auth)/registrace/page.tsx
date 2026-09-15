"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { isVutEmail, vutEmailError } from "@/lib/auth/vut";
import { Field, FormMessage } from "../_components/Field";

const MIN_PASSWORD = 10;

export default function RegistracePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  /** Chyby ukazujeme až po prvním odeslání – jinak svítí červená hned při psaní. */
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedEmail = email.trim();
  const emailError =
    trimmedEmail.length > 0 && !isVutEmail(trimmedEmail) ? vutEmailError() : null;
  const passwordError =
    password.length > 0 && password.length < MIN_PASSWORD
      ? `Heslo musí mít aspoň ${MIN_PASSWORD} znaků.`
      : null;
  const confirmError =
    confirm.length > 0 && confirm !== password ? "Hesla se neshodují." : null;

  const canSubmit =
    isVutEmail(trimmedEmail) &&
    password.length >= MIN_PASSWORD &&
    confirm === password;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError(null);

    // Klientská kontrola je jen rychlá zpětná vazba. Skutečnou obranu
    // dělá hook na serveru – ten platí i pro přímé volání API.
    if (!canSubmit) return;

    setPending(true);
    const { error: signUpError } = await authClient.signUp.email({
      email: trimmedEmail,
      password,
      // Better Auth jméno vyžaduje, my ho k ničemu nepotřebujeme.
      // Než otravovat dalším políčkem, vezmeme část před zavináčem.
      name: trimmedEmail.split("@")[0],
      callbackURL: "/overeni?stav=hotovo",
    });

    if (signUpError) {
      setError(authErrorMessage(signUpError));
      setPending(false);
      return;
    }

    router.push("/overeni?stav=odeslano");
  }

  return (
    <Card className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold text-text">Založení účtu</h1>
        <p className="text-sm leading-relaxed text-text-muted">
          Účet je dobrovolný. Kvízy fungují i bez něj — přihlášení jen zapne
          synchronizaci pokroku mezi zařízeními.
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
          hint="Jen adresa z domény vut.cz nebo vutbr.cz — včetně fakultních, třeba stud.fit.vut.cz nebo fekt.vut.cz."
          error={submitted || emailError ? emailError : null}
        />

        <Field
          label="Heslo"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={`Aspoň ${MIN_PASSWORD} znaků. Klidně tři slova za sebou — délka je tu důležitější než klikyháky.`}
          error={passwordError}
        />

        <Field
          label="Heslo znovu"
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
          Založit účet
        </Button>
      </form>

      <p className="border-t border-border-base pt-4 text-sm text-text-muted">
        Už účet máš?{" "}
        <Link
          href="/prihlaseni"
          className="text-accent underline underline-offset-4"
        >
          Přihlas se
        </Link>
      </p>
    </Card>
  );
}
