# Rozjezd a nasazení

Projekt umí běžet ve dvou režimech:

| | **Bez databáze** (výchozí) | **S databází** |
|---|---|---|
| Přihlášení | vypnuté | e-mailem a heslem |
| Kde je pokrok | v prohlížeči (IndexedDB) | na serveru, synchronizuje se |
| Přenos mezi zařízeními | ručně, exportem souboru | automaticky |
| Co je potřeba nastavit | nic | Postgres, tajný klíč, odesílání e-mailů |

Začni prvním sloupcem. Databázi přidáš kdykoli později — nic se tím nerozbije.

---

## Část 1 — Bez databáze

### Co musíš mít

- **Node.js 20 nebo novější.** Ověříš `node --version`. Když ho nemáš,
  stáhni si LTS verzi z [nodejs.org](https://nodejs.org).
- **Git.**

### Lokální spuštění

```bash
git clone <adresa-repozitare>
cd vutLearning
npm install
npm run dev
```

Otevři <http://localhost:3000>. Hotovo.

Pokrok se ukládá do IndexedDB prohlížeče. Drží se tam, dokud nesmažeš data stránky —
ale je vázaný na jeden prohlížeč na jednom počítači. Na jiném zařízení začínáš od nuly.
V nastavení aplikace si můžeš pokrok vyexportovat do souboru a jinde ho naimportovat.

Přihlašovací stránky v tomhle režimu existují, ale místo formuláře vysvětlí,
že přihlašování není nastavené. Nechybí ti nic — všechny kvízy fungují.

### Nasazení na Vercel (bez databáze)

Vercel je hosting od autorů Next.js. Nasazení je zdarma a trvá pár minut.

1. Nahraj projekt na GitHub (soukromý repozitář stačí).
2. Založ si účet na [vercel.com](https://vercel.com) — nejjednodušeji tlačítkem
   **Continue with GitHub**.
3. V přehledu klikni na **Add New…** → **Project**.
4. Vercel ti ukáže seznam tvých GitHub repozitářů. U toho správného klikni **Import**.
   Když ho v seznamu nevidíš, klikni na **Adjust GitHub App Permissions** a povol
   Vercelu přístup k danému repozitáři.
5. Vercel sám pozná, že jde o Next.js. Framework Preset musí být **Next.js**,
   ostatní pole nech být.
6. Klikni **Deploy** a počkej. Za minutu nebo dvě dostaneš adresu
   `nazev-projektu.vercel.app`.

Od téhle chvíle se každý `git push` do hlavní větve sám nasadí. Pushnutí do jiné větve
vyrobí náhledovou (preview) adresu, kde si změnu můžeš prohlédnout dřív, než ji pustíš
do ostré verze.

> **Vercel Hobby plán je jen pro nekomerční osobní použití.** Žádné reklamy, žádné
> placené funkce, žádný projekt pro firmu — to už podle podmínek vyžaduje placený plán.
> Studentský kvízový web pod to spadá bez problému.

---

## Část 2 — S databází

Tohle přidává **přihlášení** a **pokrok uložený na serveru**. Nastavení zabere
tak půl hodiny a dá se kdykoli vrátit zpátky.

Autoritativní seznam proměnných prostředí je **`.env.example`** — je komentovaný
a když se rozchází s tímhle dokumentem, platí on.

> **Účet si smí založit jen někdo s e-mailem z VUT** (`…@vut.cz`, `…@vutbr.cz`
> a jejich subdomény, třeba `xnovak00@stud.fit.vut.cz`). Je to jediné pravidlo
> registrace — kdokoli jiný se nepřihlásí a uvidí vysvětlení proč.

### 2.1 Založení Postgres databáze (Neon přes Vercel)

Projekt používá [Neon](https://neon.tech) — Postgres, který se dá zapojit přímo
z Vercelu a má bezplatný plán.

1. Otevři svůj projekt na Vercelu.
2. Karta **Storage** → **Create Database**.
3. V nabídce Marketplace vyber **Neon** (Serverless Postgres).
4. Vyber **Free** plán, zadej jméno databáze a region — ber ten nejbližší
   (`Frankfurt, Germany (eu-central-1)`).
5. Potvrď propojení s projektem. Nech zaškrtnutá všechna prostředí
   (Production, Preview, Development).

Vercel do projektu sám doplní proměnnou **`DATABASE_URL`** (vedle ní může přibýt
několik dalších `POSTGRES_*` — ty projekt nepoužívá, nech je být).

> **Použij „pooled" connection string** — ten, co má v adrese `-pooler`.
> V Neonu ho přepneš volbou **Pooled connection**. Bez něj serverless funkce
> na Vercelu vyčerpají spojení k databázi dřív, než si toho kdokoli všimne.

Bezplatný plán Neonu **uspává databázi při nečinnosti**. První dotaz po delší pauze
proto trvá o vteřinu dvě déle. To je normální, ne chyba.

### 2.2 Tajný klíč a adresa

`BETTER_AUTH_SECRET` je náhodný řetězec, kterým se podepisují a šifrují přihlašovací
relace. Musí mít aspoň 32 znaků. Vygeneruj si ho:

```bash
openssl rand -base64 32
```

Na Vercelu ho přidej v **Settings → Environment Variables**:

| Name | Value | Kdy to potřebuješ |
|---|---|---|
| `BETTER_AUTH_SECRET` | vygenerovaný řetězec | Vždy, když je nastavená `DATABASE_URL` |
| `NEXT_PUBLIC_AUTH_ENABLED` | `true` | Aby prohlížeč vůbec nabídl odkaz na přihlášení |
| `BETTER_AUTH_URL` | `https://kvizy.example.cz` | Jen u vlastní domény |

`BETTER_AUTH_URL` je veřejná adresa webu, ze které se skládají odkazy v e-mailech.
Na Vercelu se bere z `VERCEL_URL`, takže na `*.vercel.app` ji nastavovat nemusíš.
U vlastní domény ji nastav natvrdo — jinak odkazy v e-mailech míří na adresu
konkrétního nasazení místo na doménu. Piš ji přesně: `https://`, bez lomítka na konci.

`NEXT_PUBLIC_AUTH_ENABLED` je jen kosmetika — schová nebo ukáže odkaz na přihlášení
v prohlížeči. `DATABASE_URL` je serverová proměnná a do klienta se nedostane,
takže o ní prohlížeč sám od sebe neví. Skutečnou obranu dělá server.

Když `DATABASE_URL` nastavíš a `BETTER_AUTH_SECRET` zapomeneš, **server při startu
spadne s vysvětlením**. Je to schválně — tiše rozbité relace by byly horší.

**Tajný klíč nikdy nedávej do gitu.** Soubor `.env*` je v `.gitignore`, ať to tak zůstane.
Kdyby ti klíč unikl, vygeneruj nový a starý přepiš — všichni se jen odhlásí.

### 2.3 Lokální `.env.local`

```bash
cp .env.example .env.local
```

Potom v něm odkomentuj a vyplň, co potřebuješ. Minimum pro běh s databází:

```bash
DATABASE_URL="postgresql://…-pooler….neon.tech/neondb?sslmode=require"
BETTER_AUTH_SECRET="…"            # klidně jiný než v produkci
NEXT_PUBLIC_AUTH_ENABLED="true"
EMAIL_TRANSPORT="console"         # ověřovací odkaz se vypíše do konzole serveru
```

Connection string zkopíruj z Vercelu (**Storage** → tvoje databáze → `.env.local`),
nebo si celé prostředí stáhni (vyžaduje `npm i -g vercel` a `vercel link`):

```bash
vercel env pull .env.local
```

### 2.4 Vytvoření tabulek

Schéma databáze je v kódu (`src/db/schema.ts`, Drizzle). Do databáze ho dostaneš takhle:

```bash
node --env-file=.env.local node_modules/.bin/drizzle-kit generate   # vyrobí SQL migraci
node --env-file=.env.local node_modules/.bin/drizzle-kit push       # aplikuje ji
```

Zkrácené `npm run db:generate` a `npm run db:push` dělají totéž, ale **samy si
`.env.local` nenačtou** — musíš mít `DATABASE_URL` už v prostředí. Proto ta delší
varianta výše; je spolehlivější.

Míří to na databázi z `DATABASE_URL`. Když chceš změnit produkční, nastav si
proměnnou na produkční hodnotu jen pro ten jeden příkaz — a nejdřív si rozmysli,
co to udělá s existujícími daty.

Pak spusť `npm run dev` znovu. Aplikace pozná, že `DATABASE_URL` existuje,
a zapne přihlašování.

### 2.5 Odesílání e-mailů

Registrace posílá **ověřovací odkaz na e-mail**. Bez ověření zůstane účet neaktivní —
jinak by si kdokoli napsal libovolnou adresu `@vut.cz` a pravidlo o školním e-mailu
by nic neznamenalo.

Transport se vybírá proměnnou `EMAIL_TRANSPORT`. Jsou tři:

| `EMAIL_TRANSPORT` | Co dělá | Kdy to použít |
|---|---|---|
| `console` (výchozí) | Odkaz vypíše do konzole serveru, neodesílá nic | Vývoj. Pohodlnější než jakákoli schránka |
| `resend` | HTTP API [Resendu](https://resend.com) | Produkce, když máš vlastní doménu |
| `smtp` | Jakýkoli SMTP server (třeba Gmail) | Produkce bez vlastní domény |

#### Varianta `resend`

1. Zaregistruj se na resend.com (free plán, 3 000 e-mailů měsíčně).
2. **API Keys** → **Create API Key**, oprávnění stačí *Sending access*.
   Klíč se ukáže **jen jednou** — zkopíruj si ho hned.
3. **Domains** → přidej vlastní doménu a doplň u svého registrátora DNS záznamy,
   které ti Resend ukáže (SPF, DKIM). Ověření trvá minuty až hodiny.
   Bez ověřené domény ti Resend pošle e-mail jen na tvoji vlastní registrační adresu.
4. Nastav proměnné:

```bash
EMAIL_TRANSPORT="resend"
RESEND_API_KEY="re_…"
EMAIL_FROM="Kvízy VUT <kvizy@tvoje-domena.cz>"
```

#### Varianta `smtp`

Funguje s Gmailem a **heslem aplikace** (ne heslem k účtu — to vygeneruješ
v nastavení Google účtu po zapnutí dvoufázového ověření). Limit je zhruba
500 zpráv denně, což na osobní projekt bohatě stačí.

```bash
EMAIL_TRANSPORT="smtp"
EMAIL_FROM="Kvízy VUT <tvuj@gmail.com>"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="tvuj@gmail.com"
SMTP_PASS="heslo-aplikace"
```

**Pozor:** `nodemailer` **záměrně není** v `package.json` — projekt ho ve výchozím
stavu nepotřebuje. Když zapneš `EMAIL_TRANSPORT=smtp`, transport ti při prvním použití
vypíše chybu s přesným návodem, co doinstalovat a co dopsat. Je to tak schválně:
závislost navíc jen kvůli variantě, kterou většina lidí nepoužije, se nevyplatí.

Celé odesílání je v jednom souboru — `src/lib/auth/email.ts`. Jiný poskytovatel
znamená sáhnout jen tam.

#### Nezapomeň na redeploy

Po přidání proměnných na Vercelu **musíš projekt znovu nasadit** — proměnné se načítají
při buildu. Karta **Deployments** → u posledního nasazení **⋯** → **Redeploy**.

### 2.6 Ověření, že to šlape

- [ ] `npm run dev` nastartuje bez chybových hlášek v konzoli
- [ ] Na webu je vidět odkaz na přihlášení
- [ ] Registrace školním e-mailem projde; s jiným ji web odmítne a vysvětlí proč
- [ ] Ověřovací odkaz dorazí (u `console` ho najdeš v konzoli serveru, jinak v e-mailu — zkontroluj i spam)
- [ ] Po ověření a přihlášení se pokrok drží i po tvrdém obnovení stránky
- [ ] Přihlášení na jiném zařízení ukáže stejný pokrok

---

## Když něco nejde

| Příznak | Co s tím |
|---|---|
| Build na Vercelu spadne na `content:check` | Build spouští validaci obsahu. Pusť si `npm run content:check` lokálně a oprav JSON — viz [`docs/AUTHORING.md`](AUTHORING.md) |
| Web říká, že přihlašování není nastavené | Chybí `DATABASE_URL`. Odkaz na přihlášení schovává `NEXT_PUBLIC_AUTH_ENABLED`. Po přidání proměnných je nutný nový deploy |
| Server při startu spadne kvůli sekretu | `DATABASE_URL` je nastavená, ale `BETTER_AUTH_SECRET` chybí nebo je kratší než 32 znaků |
| Registrace odmítne e-mail | Povolené jsou jen adresy z domén VUT (`vut.cz`, `vutbr.cz` a jejich subdomény) |
| Po přihlášení tě to vyhodí zpátky | `BETTER_AUTH_URL` nesedí s adresou, ze které web otevíráš (překlep, `http` místo `https`, lomítko na konci) |
| Ověřovací e-mail nedorazí | Při `EMAIL_TRANSPORT="console"` se nikam neposílá — odkaz je v konzoli serveru. U `resend` zkontroluj `RESEND_API_KEY`, `EMAIL_FROM` a ověření domény |
| `EMAIL_TRANSPORT=smtp` hlásí chybějící `nodemailer` | Ten balíček v projektu záměrně není. Hláška obsahuje návod, co doinstalovat |
| `drizzle-kit` nevidí databázi | `npm run db:push` si nenačte `.env.local` sám — pusť ho přes `node --env-file=.env.local node_modules/.bin/drizzle-kit push` |
| Příliš mnoho spojení k databázi | Nepoužíváš „pooled" connection string. Musí mít v adrese `-pooler` |
| První dotaz po pauze trvá dlouho | Neon na free plánu uspává databázi. Normální chování |
| Lokálně to jde, na Vercelu ne | Devět z deseti případů: proměnná prostředí chybí v produkčním prostředí, nebo je velikost písmen v názvu souboru jiná (Linux je case-sensitive, macOS a Windows ne) |

## Jak databázi zase vypnout

Smaž `DATABASE_URL` (a `NEXT_PUBLIC_AUTH_ENABLED`) z prostředí a nasaď znovu.
Aplikace se vrátí do lokálního režimu, data v databázi zůstanou nedotčená.
Až proměnné vrátíš, přihlášení je zpátky.
