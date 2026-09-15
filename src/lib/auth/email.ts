/**
 * Odesílání e-mailů.
 *
 * Ověření adresy je u nás jediné, co drží pravidlo „jen VUT e-mail" –
 * bez něj si kdokoli napíše `kdokoli@vut.cz` a pravidlo nic neznamená.
 * Proto se e-maily posílat MUSÍ, ale poskytovatel není vybraný.
 *
 * Transport se proto vybírá proměnnou `EMAIL_TRANSPORT`:
 *   console (výchozí) – odkaz se vypíše do konzole, nic se neodesílá
 *   resend            – HTTP API Resendu, bez SDK, stačí fetch
 *   smtp              – nodemailer; závislost schválně NENÍ v package.json
 *
 * Přepnutí provozu na jinou službu je pak změna jedné proměnné,
 * ne přepisování volajícího kódu.
 */

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type EmailTransport = "console" | "resend" | "smtp";

function selectedTransport(): EmailTransport {
  const raw = process.env.EMAIL_TRANSPORT?.trim().toLowerCase();
  if (raw === "resend" || raw === "smtp" || raw === "console") return raw;
  if (raw) {
    throw new Error(
      `Neznámý EMAIL_TRANSPORT "${raw}". Povolené hodnoty: console, resend, smtp.`,
    );
  }
  return "console";
}

function requireEnv(name: string, transport: EmailTransport): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Chybí proměnná ${name}, bez ní EMAIL_TRANSPORT="${transport}" nemůže odesílat.`,
    );
  }
  return value;
}

/* ------------------------------------------------------------------ */

async function sendViaConsole(message: MailMessage): Promise<void> {
  // Ve vývoji je tohle rychlejší než jakákoli schránka: odkaz se dá
  // rovnou zkopírovat z terminálu.
  console.info(
    [
      "",
      "──────────── E-MAIL (transport: console, nic se neodeslalo) ────────────",
      `Komu:    ${message.to}`,
      `Předmět: ${message.subject}`,
      "",
      message.text,
      "────────────────────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}

async function sendViaResend(message: MailMessage): Promise<void> {
  const apiKey = requireEnv("RESEND_API_KEY", "resend");
  const from = requireEnv("EMAIL_FROM", "resend");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    // Tělo chyby se nesmí dostat k uživateli – může v něm být kus klíče.
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Resend odmítl e-mail (HTTP ${response.status}): ${detail.slice(0, 500)}`,
    );
  }
}

/**
 * SMTP přes nodemailer.
 *
 * Balíček schválně NENÍ v závislostech – dokud není jasné, jestli se
 * SMTP vůbec použije, nemá smysl tahat do buildu další knihovnu.
 *
 * Pro pár set uživatelů bez vlastní domény je funkční free varianta
 * Gmail SMTP s "app password" (Google účet → Zabezpečení → dvoufázové
 * ověření → Hesla aplikací): SMTP_HOST=smtp.gmail.com, SMTP_PORT=465,
 * SMTP_SECURE=true, SMTP_USER=tvůj@gmail.com, SMTP_PASS=vygenerované
 * heslo aplikace (ne heslo k účtu). Limit je řádově 500 zpráv denně,
 * což na ověřovací e-maily pro školní kvízy bohatě stačí. Nevýhoda:
 * odesílatel je vidět jako gmail.com, takže to působí míň důvěryhodně
 * než vlastní doména přes Resend.
 */
async function sendViaSmtp(_message: MailMessage): Promise<never> {
  throw new Error(
    [
      "EMAIL_TRANSPORT=smtp vyžaduje nodemailer, který v projektu není nainstalovaný.",
      "",
      "Doinstaluj:  npm install nodemailer && npm install -D @types/nodemailer",
      "",
      "Pak v src/lib/auth/email.ts nahraď tělo sendViaSmtp() tímhle:",
      "",
      '  const { createTransport } = await import("nodemailer");',
      "  const transporter = createTransport({",
      '    host: requireEnv("SMTP_HOST", "smtp"),',
      '    port: Number(process.env.SMTP_PORT ?? 465),',
      '    secure: process.env.SMTP_SECURE !== "false",',
      "    auth: {",
      '      user: requireEnv("SMTP_USER", "smtp"),',
      '      pass: requireEnv("SMTP_PASS", "smtp"),',
      "    },",
      "  });",
      "  await transporter.sendMail({",
      '    from: requireEnv("EMAIL_FROM", "smtp"),',
      "    to: _message.to,",
      "    subject: _message.subject,",
      "    text: _message.text,",
      "    html: _message.html,",
      "  });",
      "",
      "Bez vlastní domény funguje zdarma Gmail SMTP s heslem aplikace",
      "(smtp.gmail.com:465, ~500 zpráv denně).",
    ].join("\n"),
  );
}

/** Pošle e-mail zvoleným transportem. */
export async function sendMail(message: MailMessage): Promise<void> {
  const transport = selectedTransport();
  switch (transport) {
    case "resend":
      return sendViaResend(message);
    case "smtp":
      return sendViaSmtp(message);
    case "console":
      return sendViaConsole(message);
  }
}

/* ==================================================================
   Šablony

   Prostý, čitelný HTML bez obrázků a bez tabulkové layoutové akrobacie.
   Ověřovací e-mail, který vypadá jako reklama, končí ve spamu.
   ================================================================== */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="cs">
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1c1f26;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e6eb;border-radius:14px;padding:28px;">
    <h1 style="margin:0 0 16px;font-size:18px;line-height:1.4;">${escapeHtml(heading)}</h1>
    ${bodyHtml}
    <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e4e6eb;font-size:12px;color:#6b7280;">
      Kvízy pro studium na FIT VUT
    </p>
  </div>
</body>
</html>`;
}

function buttonHtml(url: string, label: string): string {
  const safe = escapeHtml(url);
  return `<p style="margin:0 0 20px;">
    <a href="${safe}" style="display:inline-block;padding:11px 18px;border-radius:10px;background:#3b5bdb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(label)}</a>
  </p>
  <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Kdyby tlačítko nefungovalo, zkopíruj si odkaz:</p>
  <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${safe}" style="color:#3b5bdb;">${safe}</a></p>`;
}

/** E-mail s odkazem na ověření adresy. */
export function verificationEmail(url: string): Omit<MailMessage, "to"> {
  return {
    subject: "Potvrď svůj e-mail",
    html: layout(
      "Potvrď svůj e-mail",
      `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;">
         Ještě jedno kliknutí a účet je hotový. Odkaz platí hodinu.
       </p>
       ${buttonHtml(url, "Potvrdit e-mail")}
       <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
         Pokud sis účet nezakládal, tenhle e-mail klidně smaž — bez potvrzení se nic nestane.
       </p>`,
    ),
    text: [
      "Potvrď svůj e-mail",
      "",
      "Ještě jedno kliknutí a účet je hotový. Odkaz platí hodinu:",
      url,
      "",
      "Pokud sis účet nezakládal, tenhle e-mail klidně smaž — bez potvrzení se nic nestane.",
    ].join("\n"),
  };
}

/** E-mail s odkazem na nastavení nového hesla. */
export function passwordResetEmail(url: string): Omit<MailMessage, "to"> {
  return {
    subject: "Nastavení nového hesla",
    html: layout(
      "Nastavení nového hesla",
      `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;">
         Požádal jsi o nové heslo. Odkaz platí hodinu.
       </p>
       ${buttonHtml(url, "Nastavit nové heslo")}
       <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
         Pokud jsi o nic nežádal, nic nedělej — staré heslo platí dál.
       </p>`,
    ),
    text: [
      "Nastavení nového hesla",
      "",
      "Požádal jsi o nové heslo. Odkaz platí hodinu:",
      url,
      "",
      "Pokud jsi o nic nežádal, nic nedělej — staré heslo platí dál.",
    ].join("\n"),
  };
}
