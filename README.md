# Kvízy VUT

Web na procvičování předmětů prvního ročníku BIT na FIT VUT v Brně —
**IZP, ILG, IDM, IEL, IUS**.

Otázky jsou obyčejné JSON soubory v `content/`, generované z přednáškových materiálů.
Pokrok se ukládá v prohlížeči, takže aplikace funguje bez přihlášení i bez serveru.
Kdo chce mít pokrok na víc zařízeních, zapne si databázi a přihlášení.

<!-- TODO: screenshot -->
<!-- ![Přehled předmětů](docs/img/screenshot.png) -->

## Spuštění

```bash
npm install
npm run dev
```

Otevři <http://localhost:3000>. Nic dalšího není potřeba nastavovat.

## Kontrola

```bash
npm run check          # typecheck + lint + validace obsahu + testy
npm run content:check  # jen obsah kvízů
```

## Dokumentace

| Dokument | O čem je |
|---|---|
| [`docs/AUTHORING.md`](docs/AUTHORING.md) | **Jak psát kvízy.** Formát, devět typů otázek, pravidla kvality. Čti, než sáhneš na `content/` |
| [`docs/SETUP.md`](docs/SETUP.md) | Rozjezd lokálně a nasazení na Vercel — s databází i bez ní |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Proč je obsah v gitu, jak teče datový tok, jak funguje opakování |
| [`CLAUDE.md`](CLAUDE.md) | Pravidla pro agenty pracující v repu — stack, konvence, kontrakty |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Zod ·
Dexie (IndexedDB) · Drizzle + Neon Postgres · better-auth · KaTeX · Shiki

## Licence

Osobní studijní projekt. Obsah kvízů vychází z veřejně dostupných přednáškových
materiálů a slouží výhradně k vlastnímu studiu.
