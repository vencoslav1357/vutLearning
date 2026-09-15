# Pravidla pro agenty v tomhle repu

Web s kvízy pro studium na FIT VUT. Předměty: IZP, ILG, IDM, IEL, IUS.
Hobby projekt jednoho studenta, nasazený na Vercelu.

**Píšeš obsah kvízů? Čti [`docs/AUTHORING.md`](docs/AUTHORING.md).** Je to samostatný,
úplný návod — tenhle soubor ho nezdvojuje.
Jak to celé funguje uvnitř: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
Rozjezd a nasazení: [`docs/SETUP.md`](docs/SETUP.md).

---

## Stack

Next.js 16.3.5 (App Router, Turbopack) · React 19.3.0 · TypeScript 5.9 (strict)
Tailwind CSS 4 · motion 13 · zod 4 · dexie 4 · better-auth 1.7 · drizzle-orm 0.45
katex · shiki · react-markdown + remark-gfm · next-themes · lucide-react · vitest 5

Verze jsou zamčené v `package.json`. **Nic dalšího neinstaluj**, dokud to opravdu
nepotřebuješ — a pak to napiš do výstupu.

## Tohle není Next.js, který znáš z paměti

Nejčastější zdroj chyb. Než začneš psát, přečti si to:

| Věc | Jak to je teď |
|---|---|
| `params`, `searchParams`, `cookies()`, `headers()` | **async**. Synchronní přístup byl odstraněn — `const { id } = await params` |
| `middleware.ts` | Jmenuje se **`proxy.ts`**, default export `proxy` |
| `tailwind.config.js` | **Neexistuje.** Konfigurace je v CSS: `@theme { --color-x: … }` |
| Tmavý režim | `@custom-variant dark (&:where(.dark, .dark *));` — už nastaveno v `globals.css` |
| `framer-motion` | Balíček se jmenuje **`motion`**, importuje se z `motion/react` |
| `<ViewTransition>` | Importuje se **přímo z `react`**, bez `unstable_` a bez flagu |
| Cachování App Routeru | Implicitní cache je pryč. Všechno je dynamické, opt-in přes `'use cache'` |
| `next lint` | Neexistuje. `next build` nelintuje. Spouští se `eslint` přímo |
| TypeScript 7 | **Nepoužívej ho.** Je venku, ale `typescript-eslint` ho zatím neumí (strop `<6.1.0`), takže by přestal fungovat lint. Držíme 5.9 |

Detaily k téhle verzi Next.js jsou v `node_modules/next/dist/docs/`.

## Konvence

- **Veškerý text pro uživatele je česky.** Včetně chybových hlášek a prázdných stavů.
- **Komentáře česky a vysvětlují PROČ, ne CO.** Střídmě — jen tam, kde by čtenář
  jinak nechápal záměr.
- **Žádné `any`.** TypeScript v strict režimu. Když typ nejde vyjádřit, napiš proč.
- **Server Components jsou výchozí.** `"use client"` jen kvůli stavu, event handlerům
  nebo browser API — a co nejníž ve stromu.
- **Barvy jen z tokenů** v `src/app/globals.css`. Žádné `bg-blue-500`.
  K dispozici: `bg-bg`, `bg-bg-subtle`, `bg-surface`, `text-text`, `text-text-muted`,
  `text-text-faint`, `border-border-base`, `border-border-strong`, `bg-accent`,
  `text-accent`, `bg-accent-soft`, `text-accent-text`, a trojice `ok` / `bad` / `warn`
  (`text-ok`, `bg-ok-soft`, `border-ok-border`, …).
  Zaoblení: `rounded-card`, `rounded-control`, `rounded-chip`. Stíny: `shadow-card`, `shadow-lift`.
- **Animace krátké a nevtíravé:** 150 ms odchod, 210 ms příchod, 400 ms posun.
  Vždy respektuj `prefers-reduced-motion` (`<MotionConfig reducedMotion="user">`).
- **Přístupnost:** všechno ovladatelné klávesnicí, `aria-*` kde je potřeba,
  focus ring nikdy nevypínej.
- Spojování tříd přes `cn()` z `src/lib/cn.ts`.

## Struktura

```
content/<predmet>/            kvízy a course.json — zdroj pravdy o obsahu, verzovaný v gitu
public/content/img/<predmet>/ obrázky k otázkám
schemas/                      vygenerované JSON Schema pro editory
scripts/                      kontroly obsahu (tsx, běží z npm skriptů)
src/app/                      App Router — stránky, layouty, API routes
src/components/               UI komponenty (ui/ · quiz/ · render/)
src/content/schema.ts         ZDROJ PRAVDY o formátu obsahu
src/content/loader.ts         čtení obsahu — server-only, sahá na node:fs
src/content/registry.ts       lehký index obsahu — smí se importovat i v klientovi
src/content/hash.ts           contentHash (cokoli) vs. materialHash (význam)
src/db/                       Drizzle schéma a klient
src/lib/auth/                 better-auth, pravidlo o školním e-mailu, odesílání e-mailů
src/lib/progress/             ukládání pokroku (IndexedDB) + React vrstva
src/lib/quiz/                 vyhodnocení odpovědí, normalizace, míchání
src/lib/srs/                  plánovač opakování, výběr session, mastery
docs/                         AUTHORING · SETUP · ARCHITECTURE
```

Testy leží vedle testovaného souboru jako `*.test.ts`.

## Kontrakty — nesahej na ně bez domluvy

`src/content/schema.ts` · `src/lib/progress/types.ts` · `src/app/globals.css` ·
`src/lib/cn.ts` · `package.json` · `tsconfig.json` · `next.config.ts` · `eslint.config.mjs`

Když potřebuješ změnu v některém z nich, napiš to do svého výstupu jako požadavek
a čekej. Rozbitý kontrakt rozbije práci ostatních.

## Ověřování

```bash
npm run check          # typecheck + lint + content:check + content:lint + test
```

Jednotlivě:

| Příkaz | Co dělá |
|---|---|
| `npm run dev` | Vývojový server na http://localhost:3000 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (jednorázově); `npm run test:watch` průběžně |
| `npm run content:check` | Validace `content/**` proti schématu |
| `npm run content:lint` | Pravidla kvality otázek (`-- --strict` udělá chybu i z varování) |
| `npm run content:schema` | Přegeneruje `schemas/` ze `src/content/schema.ts` |
| `npm run content:new` | Vytvoří kostru nové sady otázek |
| `npm run build` | Ověří obsah a sestaví produkční build |

Po dopsání práce **vždy spusť `npm run check`** a oprav chyby ve svých souborech.
Chyby v cizích, ještě nedopsaných souborech ignoruj a zmiň je ve výstupu.
