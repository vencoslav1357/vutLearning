# Jak psát kvízy

**Tvůj úkol:** z přednáškových materiálů vyrobit jeden JSON soubor s otázkami, který projde
`npm run content:check` a `npm run content:lint`.

**Zdroj pravdy je `src/content/schema.ts`.** Tenhle dokument je návod, schéma je zákon.
Když se rozcházejí, platí schéma — a nahlas to zmiň ve svém výstupu, ať se dokument opraví.
Nikdy neměň `src/content/schema.ts`, abys prosadil svoje pole.

---

## 1. Rychlý start

1. Zjisti, o který předmět jde: `izp`, `ilg`, `idm`, `iel`, `ius`.
2. Zjisti číslo přednášky (`NN`, dvojciferně: `01`, `07`, `12`).
3. Vytvoř soubor `content/<predmet>/<NN>-<slug>.questions.json`.
4. Napiš otázky (viz katalog typů níže). Všechny se `"status": "draft"`.
5. Ověř:

```bash
npm run content:check   # validace proti schématu — MUSÍ projít
npm run content:lint    # pravidla kvality — projdi si i varování
```

6. Ve výstupu napiš, co jsi vytvořil, z čeho, a co je ti nejisté.

Soubor můžeš založit i skriptem — předvyplní hlavičku, odkaz na JSON Schema
a ukázkovou otázku. Existující soubor nikdy nepřepíše:

```bash
npm run content:new -- --course idm --title "Relace" --lecture 3 \
  --description "Vlastnosti binárních relací a jejich skládání."
```

Vznikne `content/idm/03-relace.questions.json`.

### Kompletní minimální soubor

Tohle zkopíruj a přepiš. Je to validní, funkční soubor — dá se rovnou spustit přes
`npm run content:check`.

```json
{
  "$schema": "../../schemas/question-set.schema.json",
  "id": "01-datove-typy",
  "title": "Datové typy a celočíselné dělení",
  "course": "izp",
  "lecture": 1,
  "description": "Rozsahy celočíselných typů v jazyce C a co se stane při dělení dvou intů.",
  "source": {
    "kind": "slides",
    "ref": "IZP-2025-prednaska-01.pdf",
    "pages": [12, 13]
  },
  "schemaVersion": 1,
  "questions": [
    {
      "id": "izp-01-deleni-dvou-intu",
      "type": "single",
      "prompt": "Jakou hodnotu má proměnná `x` po provedení `int x = 7 / 2;` v jazyce C?",
      "choices": [
        { "id": "a", "text": "`3`" },
        {
          "id": "b",
          "text": "`3.5`",
          "feedback": "Do `int` se desetinná část nevejde. Navíc `7 / 2` je dělení dvou celých čísel, takže `3.5` nikdy nevznikne – ani dočasně."
        },
        {
          "id": "c",
          "text": "`4`",
          "feedback": "Celočíselné dělení v C nezaokrouhluje, ale ořezává směrem k nule."
        },
        {
          "id": "d",
          "text": "Překladač ohlásí chybu.",
          "feedback": "Dělení dvou `int` je zcela legální výraz, překladač si ho ani nevšimne."
        }
      ],
      "correct": "a",
      "explanation": "Oba operandy jsou typu `int`, takže `/` je celočíselné dělení. Výsledek se ořízne směrem k nule: `7 / 2 == 3`. Zbytek dostaneš operátorem `%`: `7 % 2 == 1`. Když chceš `3.5`, musí být aspoň jeden operand reálný – `7 / 2.0`.",
      "difficulty": 2,
      "tags": ["izp", "operatory", "datove-typy"],
      "status": "draft"
    }
  ]
}
```

### Kolik otázek

Jedna přednáška ≈ **15–30 otázek**. Míň než 10 je málo na procvičování, víc než 40 už
znamená, že taháš i okrajové detaily. Schéma povoluje max. 200 na soubor.

---

## 2. Kde co leží

| Co | Kam |
|---|---|
| Sada otázek | `content/<predmet>/<NN>-<slug>.questions.json` |
| Metadata předmětu | `content/<predmet>/course.json` |
| Obrázky | `public/content/img/<predmet>/<nazev>.(svg\|png\|webp)` |
| Odkaz na obrázek v JSONu | `/content/img/<predmet>/<nazev>.svg` (bez `public`) |
| JSON Schema pro editor | `schemas/` (generuje `npm run content:schema`) |

Předměty: `izp` (Základy programování), `ilg` (Lineární algebra), `idm` (Diskrétní
matematika), `iel` (Elektronika pro IT), `ius` (Úvod do softwarového inženýrství).

### Pojmenování

**Soubor:** `<NN>-<slug>.questions.json` — `NN` je číslo přednášky, `slug` je krátké
kebab-case téma. Příklady: `content/idm/03-relace.questions.json`,
`content/izp/07-ukazatele.questions.json`, `content/iel/01-zakladni-veliciny.questions.json`.

**`id` sady** se musí **přesně shodovat s názvem souboru** bez přípony
`.questions.json`. Soubor `content/idm/03-relace.questions.json` → `"id": "03-relace"`.
Prefix předmětu tu nepatří — předmět je v poli `course` a v názvu adresáře.

**`id` otázky:** `<predmet>-<cislo-prednasky>-<koncept>`, kebab-case, **globálně unikátní
v celém repu**. Například `idm-03-relace-tranzitivita`. Nikdy do něj nedávej pořadové
číslo v souboru ani hash obsahu — viz sekce 7.

**`id` uvnitř otázky** (možnosti, položky) jsou lokální. Používej mluvící názvy
(`akter-neni-clovek`), ne `a`/`b`/`c`, u kterých se snadno splete pořadí. Bez diakritiky.

### `course.json`

Zakládá se jen jednou na předmět a nejspíš už existuje. Když ne:

```json
{
  "$schema": "../../schemas/course.schema.json",
  "code": "idm",
  "abbr": "IDM",
  "name": "Diskrétní matematika",
  "semester": "zimni",
  "year": 1,
  "credits": 5,
  "description": "Logika, množiny, relace, kombinatorika a základy teorie grafů.",
  "accent": "violet",
  "url": "https://www.fit.vut.cz/study/course/IDM/"
}
```

`accent` vybírej z nabídky `slate | indigo | violet | teal | amber | rose`. Nic jiného
neexistuje a web by se rozsypal.

---

## 3. Společná pole každé otázky

| Pole | Povinné | Význam |
|---|---|---|
| `id` | ano | Kebab-case, globálně unikátní, **navždy stejné** |
| `type` | ano | Jeden z devíti typů níže |
| `prompt` | ano | Zadání. Markdown + LaTeX + tabulky |
| `explanation` | prakticky ano | Proč je správná odpověď správná. Píšeš ji **vždy** |
| `difficulty` | ne (výchozí `3`) | 1 = triviální, 5 = chyták na zkoušku |
| `tags` | ne (výchozí `[]`) | Kebab-case, max 12. První dej kód předmětu |
| `status` | ne (výchozí `"draft"`) | Ty píšeš vždy `"draft"` |
| `hint` | ne | Nápověda na vyžádání. **Nesmí prozradit odpověď** |
| `figure` | ne | Velký obrázek pod zadáním |
| `code` | ne | Blok kódu pod zadáním (vlastní panel se zvýrazněním) |
| `formerIds` | ne | Stará `id` téhle otázky po přejmenování — viz sekce 7 |

`difficulty` odhaduj takhle: **1** = definice ze slidu, **2** = jeden krok výpočtu,
**3** = spojení dvou pojmů, **4** = vyžaduje pochopení, ne zapamatování, **5** = past,
na které se lidi pravidelně chytají. V jednom souboru měj rozptyl, ne pětkrát „3".

---

## 4. Katalog typů otázek

Devět typů. Každý příklad níže je **úplná, validní otázka** — dá se rovnou vložit do pole
`questions`.

Nepoužívej pořád `single`. Rozumný soubor má zhruba: polovinu `single` + `multi`, zbytek
namíchaný. Typy `ordering`, `matching`, `cloze` a `codeOutput` jsou na učení výrazně
účinnější, protože se u nich nedá tipovat.

---

### 4.1 `single` — výběr jedné správné

**Kdy:** existuje právě jedna správná odpověď a dokážeš vymyslet 3–4 věrohodné špatné.
**Kdy ne:** když jsou správné odpovědi dvě (použij `multi`) nebo když je odpověď
jedno slovo, které si má člověk vybavit (použij `shortText` — výběr ze seznamu je snazší).

```json
{
  "id": "ilg-04-hodnost-singularni-matice",
  "type": "single",
  "prompt": "Jaká je hodnost matice $A = \\begin{pmatrix} 1 & 2 \\\\ 2 & 4 \\end{pmatrix}$?",
  "choices": [
    {
      "id": "h0",
      "text": "$0$",
      "feedback": "Hodnost $0$ má jedině nulová matice. Tahle má nenulové prvky, takže aspoň $1$."
    },
    { "id": "h1", "text": "$1$" },
    {
      "id": "h2",
      "text": "$2$",
      "feedback": "Matice je sice typu $2 \\times 2$, ale hodnost není rozměr. Druhý řádek je dvojnásobek prvního, takže lineárně nezávislý řádek je jen jeden."
    },
    {
      "id": "nelze",
      "text": "Hodnost nelze určit.",
      "feedback": "Hodnost je definovaná pro každou matici.",
      "pin": "last"
    }
  ],
  "correct": "h1",
  "hint": "Zkus druhý řádek vydělit dvěma.",
  "explanation": "Druhý řádek je $2\\times$ první, takže Gaussovou eliminací zůstane jediný nenulový řádek: $\\begin{pmatrix} 1 & 2 \\\\ 0 & 0 \\end{pmatrix}$. Hodnost je počet nenulových řádků ve schodovitém tvaru, tedy $h(A) = 1$. Matice je singulární, $\\det A = 1\\cdot4 - 2\\cdot2 = 0$.",
  "difficulty": 2,
  "tags": ["ilg", "matice", "hodnost"],
  "status": "draft"
}
```

| Pole | Povinné | Poznámka |
|---|---|---|
| `choices` | ano | 2–8 možností. Každá má `id` a `text` (Markdown). Linter chce **aspoň 3** — se dvěma je to `trueFalse` |
| `correct` | ano | `id` správné možnosti — **ne** její text ani index |
| `choices[].feedback` | ne | Vysvětlení k **téhle** možnosti. U distraktorů to piš |
| `choices[].pin` | ne | `"first"` / `"last"` — zamkne pozici i při míchání |
| `shuffleChoices` | ne (výchozí `true`) | Vypni jen u možností, které mají přirozené pořadí (např. čísla vzestupně) |

`pin: "last"` použij u „nelze určit" / „žádná z předchozích". Míchání by takovou možnost
jinak strčilo doprostřed a otázka přestane dávat smysl.

---

### 4.2 `multi` — výběr více správných

**Kdy:** téma má několik nezávislých pravd, které se dají zaměnit (vlastnosti, výhody,
platná tvrzení).
**Kdy ne:** když je správná jen jedna možnost — to je `single`, i kdyby tě lákalo zamaskovat
to jako multi. Taky ne, když se možnosti vzájemně vylučují.

```json
{
  "id": "ius-06-use-case-diagram",
  "type": "multi",
  "prompt": "Které z uvedených tvrzení platí o diagramu případů užití (use case diagram) v UML?",
  "choices": [
    {
      "id": "co-ne-jak",
      "text": "Popisuje, **co** systém uživateli nabízí, ne **jak** je to uvnitř udělané."
    },
    {
      "id": "akter-neni-clovek",
      "text": "Aktér nemusí být člověk – může to být jiný systém nebo plánovač úloh."
    },
    {
      "id": "include-vzdy",
      "text": "Vztah `«include»` znamená, že zahrnutý případ užití proběhne vždy."
    },
    {
      "id": "poradi-kroku",
      "text": "Zachycuje pořadí kroků scénáře v čase.",
      "feedback": "Časovou posloupnost kreslí sekvenční diagram. Use case diagram ukazuje jen vztahy aktérů a případů užití, ne jejich pořadí."
    },
    {
      "id": "jedna-trida",
      "text": "Každému případu užití odpovídá právě jedna třída v návrhu.",
      "feedback": "Mezi případy užití a třídami není vztah 1:1 – jeden případ užití typicky zapojí několik tříd."
    }
  ],
  "correct": ["co-ne-jak", "akter-neni-clovek", "include-vzdy"],
  "partialCredit": true,
  "explanation": "Use case diagram je pohled na **funkcionalitu z vnějšku**: aktéři (lidé i systémy) a to, co od systému chtějí. Vnitřní strukturu řeší diagram tříd, časovou posloupnost sekvenční diagram. Rozdíl mezi rozšiřujícími vztahy: `«include»` = vždy, `«extend»` = jen za určité podmínky.",
  "difficulty": 3,
  "tags": ["ius", "uml", "pozadavky"],
  "status": "draft"
}
```

| Pole | Povinné | Poznámka |
|---|---|---|
| `choices` | ano | 3–10 možností |
| `correct` | ano | **Pole** `id`. Aspoň jedno, nikdy všechna |
| `partialCredit` | ne (výchozí `true`) | Nech zapnuté, jinak je to frustrující |
| `shuffleChoices` | ne (výchozí `true`) | |

Počet správných měň mezi otázkami (2 ze 4, 3 z 5, 1 ze 4). Když má každá `multi`
v souboru přesně dvě správné, lidi to odhalí a přestanou přemýšlet.

---

### 4.3 `trueFalse` — pravda, nebo lež

**Kdy:** ověřuješ jedno konkrétní tvrzení, u kterého je typická chyba právě obrácená
představa („tranzitivita vyžaduje reflexivitu").
**Kdy ne:** jako výplň. 50% šance na tip znamená, že samotná otázka učí málo — hodnotu
nese teprve `explanation`. Nedávej jich do souboru víc než čtvrtinu.

```json
{
  "id": "idm-03-tranzitivita-relace",
  "type": "trueFalse",
  "prompt": "Relace $R = \\{(1,2), (2,3), (1,3)\\}$ na množině $A = \\{1, 2, 3\\}$ je tranzitivní.",
  "answer": true,
  "explanation": "Tranzitivita vyžaduje: kdykoli $(a,b) \\in R$ a $(b,c) \\in R$, musí být i $(a,c) \\in R$. Jediná dvojice, která se řetězí, je $(1,2)$ a $(2,3)$ – a $(1,3)$ v relaci je. Žádné další zřetězení neexistuje, takže podmínka platí. Pozor: tranzitivita **nevyžaduje** reflexivitu ani symetrii, ta relace ani jednu nemá.",
  "difficulty": 3,
  "tags": ["idm", "relace", "vlastnosti-relaci"],
  "status": "draft"
}
```

| Pole | Povinné | Poznámka |
|---|---|---|
| `answer` | ano | `true` / `false` — JSON boolean, ne řetězec |

`prompt` piš jako **tvrzení**, ne jako otázku. Špatně: „Je relace tranzitivní?"
Dobře: „Relace *R* je tranzitivní." A hlídej si poměr — když je 90 % odpovědí `true`,
naučí se lidi mačkat „pravda".

---

### 4.4 `shortText` — krátká psaná odpověď

**Kdy:** odpověď je jedno slovo nebo pojem, který si má člověk **vybavit**, ne poznat.
Terminologie, název algoritmu, jednotka.
**Kdy ne:** když odpověď jde napsat deseti způsoby (pak nevyjmenuješ všechny varianty
a uznáš správnou odpověď jako chybnou). U vět a definic taky ne.

```json
{
  "id": "ilg-02-pojem-hodnost",
  "type": "shortText",
  "prompt": "Jak se nazývá počet lineárně nezávislých řádků matice?",
  "accept": ["hodnost", "hodnost matice", "rank"],
  "normalize": {
    "caseInsensitive": true,
    "stripDiacritics": true,
    "trim": true,
    "collapseWhitespace": true,
    "stripPunctuation": false
  },
  "placeholder": "jedno slovo",
  "explanation": "Jde o **hodnost** matice, značí se $h(A)$ nebo $\\operatorname{rank}(A)$. Počet lineárně nezávislých řádků se vždy rovná počtu lineárně nezávislých sloupců, takže na směru nezáleží.",
  "difficulty": 1,
  "tags": ["ilg", "matice", "hodnost"],
  "status": "draft"
}
```

| Pole | Povinné | Poznámka |
|---|---|---|
| `accept` | ano | 1–20 variant. **Vyjmenuj i synonyma, zkratky a anglické znění** |
| `normalize` | ne | Výchozí hodnoty jsou rozumné, celý objekt můžeš vynechat |
| `placeholder` | ne | Nápis v prázdném políčku, max 60 znaků |

Výchozí `normalize`: ignoruje velikost písmen, diakritiku, okrajové i zdvojené mezery.
Interpunkci **nechává** — jinak by se rozbily odpovědi jako `O(n log n)`.
`stripPunctuation: true` zapni jen tam, kde tečky a čárky opravdu nevadí.

Do `accept` dej vždy i variantu bez diakritiky, i když ji normalizace řeší. Je to levné
a chrání tě to, kdyby někdo normalizaci přenastavil.

---

### 4.5 `numeric` — číselná odpověď

**Kdy:** výsledek výpočtu. Obvod, kombinatorika, složitost s konkrétním číslem.
**Kdy ne:** když je odpověď vzorec, ne číslo. A ne když má výsledek víc správných
tvarů (`0.5` vs. `1/2`) — na to je `shortText`.

```json
{
  "id": "iel-05-napetovy-delic",
  "type": "numeric",
  "prompt": "Nezatížený odporový dělič je napájen napětím $U = 12\\,\\mathrm{V}$. Rezistory mají hodnoty $R_1 = 1\\,\\mathrm{k\\Omega}$ a $R_2 = 2\\,\\mathrm{k\\Omega}$. Jaké napětí naměříš na rezistoru $R_2$?",
  "answer": 8,
  "tolerance": { "kind": "absolute", "value": 0.1 },
  "unit": "V",
  "hint": "Oběma rezistory teče stejný proud.",
  "explanation": "Sériovým obvodem teče jeden proud $I = \\dfrac{U}{R_1 + R_2} = \\dfrac{12}{3000} = 4\\,\\mathrm{mA}$. Na $R_2$ pak je $U_2 = I \\cdot R_2 = 0{,}004 \\cdot 2000 = 8\\,\\mathrm{V}$. Zkráceně vzorec děliče: $U_2 = U \\cdot \\dfrac{R_2}{R_1 + R_2}$.",
  "difficulty": 2,
  "tags": ["iel", "delic-napeti", "ohmuv-zakon"],
  "status": "draft"
}
```

| Pole | Povinné | Poznámka |
|---|---|---|
| `answer` | ano | JSON číslo. Desetinná **tečka**, ne čárka |
| `tolerance` | ne (výchozí přesná shoda) | Viz níže |
| `unit` | ne (výchozí `null`) | Zobrazí se za políčkem — pak ji **nepiš** do zadání jako součást odpovědi |

Tolerance má tři tvary:

| `kind` | `value` | Uzná odpověď, když |
|---|---|---|
| `absolute` | `0.1` | liší se nejvýš o 0,1 |
| `relative` | `0.05` | liší se nejvýš o 5 % správné hodnoty |
| `decimals` | `2` | souhlasí po zaokrouhlení na 2 desetinná místa |

Toleranci nastav vždy, když výsledek není celé číslo. Jinak uživatel napíše `3.33`,
ty čekáš `3.3333333` a on se dozví, že to neumí. Když je výsledek celé číslo,
nech výchozí přesnou shodu.

Jednotku uveď buď v `unit`, nebo v zadání — ne obojí, a nikdy ji nečekej v odpovědi.

---

### 4.6 `ordering` — seřaď do správného pořadí

**Kdy:** kroky postupu, fáze procesu, posloupnost v čase, řazení podle velikosti.
**Kdy ne:** když je pořadí ve skutečnosti volné nebo sporné. Kroky, které jdou zaměnit
bez následku, tu nemají co dělat — uživatel bude mít pravdu a systém mu řekne, že ne.

```json
{
  "id": "izp-02-faze-prekladu",
  "type": "ordering",
  "prompt": "Seřaď fáze překladu programu v jazyce C tak, jak po sobě jdou.",
  "items": [
    { "id": "preprocesor", "text": "Preprocesor – vloží `#include` a rozvine makra" },
    { "id": "kompilace", "text": "Překladač – přeloží C do assembleru" },
    { "id": "assembler", "text": "Assembler – přeloží assembler do objektového souboru" },
    { "id": "linker", "text": "Linker – spojí objektové soubory a knihovny do spustitelného souboru" }
  ],
  "correctOrder": ["preprocesor", "kompilace", "assembler", "linker"],
  "explanation": "`gcc` ve skutečnosti spouští čtyři nástroje za sebou. Zastavit se dá na kterékoli fázi: `gcc -E` skončí po preprocesoru, `gcc -S` po překladu do assembleru, `gcc -c` po assembleru (vznikne `.o`). Chyba typu *undefined reference* přichází až od linkeru – proto je na ní vidět, že překlad sám proběhl v pořádku.",
  "difficulty": 2,
  "tags": ["izp", "preklad", "nastroje"],
  "status": "draft"
}
```

| Pole | Povinné | Poznámka |
|---|---|---|
| `items` | ano | 3–8 položek, každá `id` + `text` |
| `correctOrder` | ano | Pole `id` ve správném pořadí. **Každé `id` právě jednou** |

Pořadí v `items` nemá význam (stejně se míchá), ale **nepiš je rovnou ve správném
pořadí** — kdyby se míchání někdy vyplo, otázka by byla zadarmo.

---

### 4.7 `matching` — přiřaď dvojice

**Kdy:** pojem ↔ definice, veličina ↔ jednotka, značka ↔ součástka, algoritmus ↔ složitost.
**Kdy ne:** když jsou levé položky tak podobné, že jde o hádání, nebo když jedna levá
položka patří k víc pravým — schéma to nepodporuje.

```json
{
  "id": "iel-01-veliciny-jednotky",
  "type": "matching",
  "prompt": "Přiřaď elektrickým veličinám jejich jednotky v soustavě SI. Jedna jednotka zbude.",
  "left": [
    { "id": "napeti", "text": "Elektrické napětí $U$" },
    { "id": "proud", "text": "Elektrický proud $I$" },
    { "id": "odpor", "text": "Elektrický odpor $R$" },
    { "id": "kapacita", "text": "Kapacita $C$" }
  ],
  "right": [
    { "id": "volt", "text": "volt $[\\mathrm{V}]$" },
    { "id": "amper", "text": "ampér $[\\mathrm{A}]$" },
    { "id": "ohm", "text": "ohm $[\\Omega]$" },
    { "id": "farad", "text": "farad $[\\mathrm{F}]$" },
    { "id": "henry", "text": "henry $[\\mathrm{H}]$" }
  ],
  "pairs": [
    ["napeti", "volt"],
    ["proud", "amper"],
    ["odpor", "ohm"],
    ["kapacita", "farad"]
  ],
  "explanation": "Henry $[\\mathrm{H}]$ je jednotka **indukčnosti** $L$, ne kapacity – proto zbyl. Zbylé dvojice jsou základní: $U\\,[\\mathrm{V}]$, $I\\,[\\mathrm{A}]$, $R\\,[\\Omega]$, $C\\,[\\mathrm{F}]$.",
  "difficulty": 1,
  "tags": ["iel", "veliciny", "jednotky"],
  "status": "draft"
}
```

| Pole | Povinné | Poznámka |
|---|---|---|
| `left` | ano | 2–8 položek |
| `right` | ano | 2–10 položek — **může jich být víc** než vlevo |
| `pairs` | ano | Dvojice `["idVlevo", "idVpravo"]`. Každé levé `id` právě jednou |

Přidej do `right` jednu až dvě položky navíc, které nikam nepatří. Bez nich jde
poslední dvojice vyloučit i bez znalosti a otázka ztrácí půlku hodnoty. Když to uděláš,
napiš to do zadání („jedna jednotka zbude"), ať to není nefér překvapení.

---

### 4.8 `cloze` — doplň do mezer

**Kdy:** definice, znění věty, vzorec s vynechaným členem. Skvělé na terminologii,
protože se musí vybavit přesné slovo v kontextu.
**Kdy ne:** když by se dalo doplnit víc různých slov a všechna by dávala smysl.
A nevynechávej z jedné věty víc než tři slova — zbude hádanka, ne otázka.

```json
{
  "id": "idm-03-vlastnosti-relaci-doplnovani",
  "type": "cloze",
  "prompt": "Doplň názvy vlastností binární relace $R$ na množině $A$.",
  "template": "Relace $R$ je {{1}}, pokud pro každé $a \\in A$ platí $(a,a) \\in R$. Relace $R$ je {{2}}, pokud z $(a,b) \\in R$ vždy plyne $(b,a) \\in R$. Relace $R$ je {{3}}, pokud z $(a,b) \\in R$ a $(b,a) \\in R$ plyne $a = b$.",
  "blanks": {
    "1": {
      "accept": ["reflexivní", "reflexivni"],
      "placeholder": "vlastnost"
    },
    "2": {
      "accept": ["symetrická", "symetricka"]
    },
    "3": {
      "accept": ["antisymetrická", "antisymetricka"]
    }
  },
  "explanation": "Tyhle tři vlastnosti plus tranzitivita se kombinují do dvou důležitých pojmů: **ekvivalence** = reflexivní + symetrická + tranzitivní, **uspořádání** = reflexivní + antisymetrická + tranzitivní. Antisymetrie není opak symetrie – relace rovnosti je obojí.",
  "difficulty": 3,
  "tags": ["idm", "relace", "vlastnosti-relaci"],
  "status": "draft"
}
```

| Pole | Povinné | Poznámka |
|---|---|---|
| `template` | ano | Text s mezerami `{{1}}`, `{{2}}`, … Markdown funguje |
| `blanks` | ano | Klíč = **číslo mezery jako řetězec** (`"1"`), ne číslo |
| `blanks.N.accept` | ano | 1–15 variant, stejně jako u `shortText` |
| `blanks.N.normalize` | ne | Stejné výchozí hodnoty jako u `shortText` |
| `blanks.N.placeholder` | ne | Max 40 znaků |

Každá mezera v `template` musí mít záznam v `blanks` a naopak. `prompt` a `template` jsou
dvě různá pole: `prompt` je pokyn („Doplň…"), `template` je samotný text s mezerami.

---

### 4.9 `codeOutput` — co program vypíše

**Kdy:** IZP a všude, kde se dá postavit krátký program s jedním nezřejmým místem
(celočíselné dělení, inicializace pole, ukazatelová aritmetika, přetečení).
**Kdy ne:** když je program delší než ~20 řádků, nebo když výstup závisí na platformě
či nedefinovaném chování. Otázka s odpovědí „je to UB" se do `expected` nevejde —
udělej z toho `single`.

```json
{
  "id": "izp-04-pole-inicializace-vypis",
  "type": "codeOutput",
  "prompt": "Co program vypíše na standardní výstup?",
  "language": "c",
  "filename": "pole.c",
  "source": "#include <stdio.h>\n\nint main(void)\n{\n    int pole[5] = {1, 2, 3};\n    printf(\"%d %d\\n\", pole[2], pole[4]);\n    return 0;\n}\n",
  "mode": "exact",
  "expected": "3 0",
  "explanation": "Když inicializátor pole vyjmenuje méně hodnot, než je prvků, zbytek se **vynuluje**. Takže `pole` obsahuje `{1, 2, 3, 0, 0}`: `pole[2]` je `3` a `pole[4]` je `0`. Pozor, tohle platí jen když je inicializátor přítomen – `int pole[5];` jako lokální proměnná obsahuje smetí.",
  "difficulty": 3,
  "tags": ["izp", "pole", "inicializace"],
  "status": "draft"
}
```

| Pole | Povinné | Poznámka |
|---|---|---|
| `language` | ano | `c`, `cpp`, `asm`, `python`, `bash`, `sql`, `vhdl`, … (seznam ve schématu) |
| `source` | ano | Zdrojový kód. Konce řádků jako `\n` — viz sekce 5 |
| `filename` | ne | Zobrazí se v hlavičce panelu |
| `mode` | ne (výchozí `"exact"`) | `"exact"` = uživatel píše výstup, `"choice"` = vybírá |
| `expected` | při `"exact"` | Očekávaný výstup. Porovnává se po znacích (mezery na konci řádků se ořežou) |
| `choices` + `correct` | při `"choice"` | Jako u `single`, 2–6 možností |

Varianta `mode: "choice"` — použij ji, když je výstup nepříjemný na opisování nebo když
chceš nabídnout typické omyly jako možnosti:

```json
{
  "id": "izp-07-scanf-navratova-hodnota",
  "type": "codeOutput",
  "prompt": "Uživatel zadá na vstup `abc` a odentruje. Co program vypíše?",
  "language": "c",
  "source": "#include <stdio.h>\n\nint main(void)\n{\n    int n;\n    int r = scanf(\"%d\", &n);\n    printf(\"r=%d\\n\", r);\n    return 0;\n}\n",
  "mode": "choice",
  "choices": [
    { "id": "r0", "text": "`r=0`" },
    { "id": "r1", "text": "`r=1`", "feedback": "`1` by znamenalo, že se jedna položka úspěšně načetla. Na `abc` ale `%d` nesedne." },
    { "id": "rm1", "text": "`r=-1`", "feedback": "`EOF` (tedy `-1`) vrátí `scanf` až když na vstupu nic není. Tady znaky jsou, jen nejsou číslo." },
    { "id": "nic", "text": "Nic – program spadne.", "feedback": "`scanf` na neplatném vstupu nepadá, jen vrátí počet načtených položek." }
  ],
  "correct": "r0",
  "explanation": "`scanf` vrací **počet úspěšně načtených položek**. Řetězec `abc` nejde přečíst jako `%d`, takže se nenačte nic a návratová hodnota je `0`. Znaky navíc zůstanou ve vstupním bufferu – další `scanf(\"%d\")` by proto selhal znovu. Návratovou hodnotu `scanf` vždy kontroluj.",
  "difficulty": 3,
  "tags": ["izp", "vstup-vystup", "osetreni-chyb"],
  "status": "draft"
}
```

Kód **musí jít přeložit a spustit**. Než ho použiješ, projeď si ho v hlavě řádek po
řádku; u nejistých případů ho radši zkus přeložit (`gcc -Wall -Wextra`).
Špatný `expected` je nejhorší možná chyba — učí lidi nesmysly.

---

## 5. Formátování obsahu

Textová pole (`prompt`, `explanation`, `choices[].text`, `items[].text`, `template`)
se renderují jako **Markdown s GFM**. Podporované je:

| Co | Zápis v Markdownu |
|---|---|
| Tučně / kurzíva | `**tučně**`, `*kurzíva*` |
| Kód v textu | `` `printf()` `` |
| Blok kódu | ```` ```c … ``` ```` |
| Odrážky a seznamy | `- položka`, `1. položka` |
| Tabulka (GFM) | `\| a \| b \|` + oddělovač `\|---\|---\|` |
| Obrázek | `![popis](/content/img/idm/graf.svg)` |
| LaTeX inline | `$x \in A$` |
| LaTeX blokově | `$$\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$$` |

Markdown funguje i v `hint` a `choices[].feedback` — klidně v nich použij `kód`,
**tučné** i vzorec. Drž je ale krátké: nápověda je jedna věta, zpětná vazba
nanejvýš dvě.

### Escapování v JSONu — tady se chybuje nejčastěji

JSON má vlastní escapovací pravidla a ta platí **navrch** k Markdownu a LaTeXu.
Než něco zapíšeš, přelož si to takhle:

| Chceš zobrazit | Do JSONu napiš |
|---|---|
| `$x \in A$` | `"$x \\in A$"` |
| `$\frac{1}{2}$` | `"$\\frac{1}{2}$"` |
| `$\{1, 2, 3\}$` | `"$\\{1, 2, 3\\}$"` |
| Nový řádek v LaTeX matici (`\\`) | `\\\\` |
| Nový řádek v kódu | `\n` |
| Tabulátor | `\t` (radši ale mezery) |
| Uvozovku `"` | `\"` |
| Zpětné lomítko `\` samo o sobě | `\\` |
| Zpětné lomítko v C řetězci (`"\n"` v kódu) | `\\n` |

**Pravidlo, které si zapamatuj: v LaTeXu píšeš každé zpětné lomítko dvakrát.**

Typický průšvih — matice. LaTeX potřebuje `\begin{pmatrix} 1 & 2 \\ 2 & 4 \end{pmatrix}`,
oddělovač řádků je `\\`. V JSONu se z každého lomítka stanou dvě, takže:

```json
"prompt": "Matice $A = \\begin{pmatrix} 1 & 2 \\\\ 2 & 4 \\end{pmatrix}$ má hodnost 1."
```

Druhý typický průšvih — C program, který sám vypisuje `\n`:

```json
"source": "printf(\"Ahoj\\n\");"
```

Tady je `\"` escapovaná uvozovka (JSON) a `\\n` je zpětné lomítko + `n`, takže se do
souboru dostane `printf("Ahoj\n");` — přesně jak má být. Kdybys napsal `\n`, rozpadne se
kód na dva řádky uprostřed řetězce a program nepůjde přeložit.

Kontrola na závěr: **v JSONu nesmí zbýt žádné osamocené `\`,** kromě těch v platných
escapech `\" \\ \/ \b \f \n \r \t \uXXXX`. `npm run content:check` ti to řekne, ale
sekvence typu `\i` v `\in` rozbije parser dřív, než se dostane k validaci — pak dostaneš
neužitečnou hlášku o neplatném JSONu.

### Obrázky

Soubor patří do `public/content/img/<predmet>/`, v JSONu se na něj odkazuje cestou
**bez `public`**. Preferuj SVG (ostré v obou motivech), jinak PNG nebo WebP.

```json
"figure": {
  "src": "/content/img/iel/delic-napeti.svg",
  "alt": "Schéma odporového děliče: zdroj U, sériově R1 a R2, výstup A-B odebíraný z R2.",
  "caption": "Nezatížený odporový dělič",
  "width": 420,
  "height": 260
}
```

`alt` je povinný a **popisuje, co je vidět**, ne k čemu obrázek je. Špatně: „schéma".
Dobře: to nahoře. `width` a `height` vyplň, ať stránka při načítání neposkakuje.

**Obrázek, který nemáš, nevymýšlej.** Když otázka bez schématu nedává smysl a schéma
nemáš k dispozici, otázku nepiš a zmíň to ve výstupu. Odkaz na neexistující soubor
shodí `content:check`.

### Kód jako součást zadání

Když má otázka jiného typu než `codeOutput` ukázat kus kódu, použij pole `code` —
dostane vlastní panel se zvýrazněnou syntaxí:

```json
"code": {
  "language": "c",
  "filename": "ukazatel.c",
  "source": "int pole[4] = {10, 20, 30, 40};\nint *p = pole + 1;\nprintf(\"%d\\n\", *(p + 2));"
}
```

Krátký úryvek můžeš nechat i jako blok kódu přímo v `prompt`. `code` použij, když je
kód hlavním předmětem otázky.

---

## 6. Pravidla kvality

Tohle hlídá `npm run content:lint`. Každé pravidlo je tam proto, že ho modely
pravidelně porušují. U otázek se `status: "draft"` jsou nálezy **varování**,
u `reviewed` **chyby**. `npm run content:lint -- --strict` udělá chybu i z varování —
pusť si to, ať víš, co jsi po sobě nechal.

| Pravidlo (název v linteru) | Kdy se ozve | Proč |
|---|---|---|
| `meta-moznost` | Možnost typu „všechny výše uvedené", „žádná z uvedených", „a i b" bez `pin` | Testuje vylučovací strategii, ne znalost. Stačí poznat dvě správné a zbytek se dopočítá. A po zamíchání pořadí je „všechny **výše** uvedené" holý nesmysl. Buď takovou možnost zruš, nebo jí dej `"pin": "last"` |
| `prozrazujici-delka` | Správná možnost je 1,5× delší než nejdelší distraktor (a o 15+ znaků) | Nejsilnější nápověda vůbec: „vyber tu dlouhou s podmínkami". Autor si správnou odpověď podvědomě dovysvětlí |
| `pozicni-vychylka` | V sadě s 8+ otázkami typu `single` padá správná odpověď na jednu pozici 1,8× častěji, než by odpovídalo náhodě | **Modely sypou správnou odpověď na A a B.** Zamíchej pořadí `choices` ručně a uprav `correct` |
| `slabe-distraktory` | `single` má míň než 3 možnosti | Dvě možnosti = hádání s 50% úspěšností. Když má otázka opravdu jen dvě odpovědi, je to `trueFalse` |
| `duplicitni-moznost` | Dvě možnosti po normalizaci říkají totéž | Zbytečná možnost zužuje výběr zadarmo |
| `duplicitni-zadani` | Dvě otázky mají stejné zadání (napříč **všemi** soubory) | Opakování téhož zkresluje odhad znalosti a nudí. U `codeOutput` se porovnává i zdroják, takže deset otázek „Co program vypíše?" je v pořádku |
| `zaporne-zadani` | Zadání obsahuje `NE`, „kromě" nebo „nesprávn" a zápor **není tučně** | Zápor se přehlédne a člověk pak neumí otázku, kterou umí. Piš `Které tvrzení **ne**platí?` |
| `prilis-dlouhe-zadani` | `prompt` přes 600 znaků | Dlouhé zadání testuje čtení. Delší kód patří do `code`, schéma do `figure` |
| `chybi-alt` | `alt` obrázku má míň než 10 znaků | „schéma" není popis. Napiš, co je na obrázku vidět |
| `chybi-vysvetleni` | `reviewed` otázka bez `explanation` | Bez vysvětlení se uživatel jen dozví, že se spletl. Hodnota kvízu je tady, ne v odpovědi. **Piš `explanation` vždy**, i když jsi `draft` a linter mlčí |

Co linter nezkontroluje, ale platí stejně:

- **Zadání musí dávat smysl bez slidů.** Uživatel je má u zkoušky v hlavě, ne na stole.
  Žádné „podle vzorce ze slidu 14".
- **Žádné odkazy na jiné otázky.** „V předchozí otázce…" po zamíchání pořadí nefunguje.
- **Distraktory stejného tvaru jako správná odpověď.** Tři čísla a jedna věta poznáš
  bez počítání. Drž stejnou gramatickou formu i řád velikosti.
- **Rozptyl `difficulty` a typů otázek.** Deset stejných `single` s obtížností 3 nic neměří.

### Jak psát distraktory

Postup, který funguje: vyřeš úlohu **špatně**, a to způsobem, jakým by ji špatně vyřešil
student. Zapomeň na jednotku. Zaměň vzorec. Zaokrouhli špatným směrem. Vezmi rozměr místo
hodnosti. Takový distraktor pak popiš v `feedback` — a tím se otázka mění z testu na
učební materiál.

Čemu se vyhnout: vtipné možnosti, možnosti mimo obor (záporná pravděpodobnost), možnosti
lišící se jen překlepem, a čtvrtá možnost přilepená jen proto, že „mají být čtyři".
Tři dobré distraktory jsou lepší než dva dobré a jeden vatový.

---

## 7. Identita otázek — `id` se nikdy nemění

Uživatelský pokrok je uložený **pod `id` otázky**, ne pod pořadím v souboru.
Když změníš `id`, aplikace považuje otázku za novou: zmizí střak, počet pokusů,
koeficient snadnosti i naplánované opakování. Pro uživatele to znamená, že se otázka,
kterou už uměl, objeví znovu jako neznámá — a to je ztráta, kterou nejde vrátit.

**Pravidla:**

- `id` přiděl jednou a už na něj nesahej. Ani při opravě překlepu, ani při přeformulování,
  ani když se ti po měsíci nelíbí.
- `id` **nikdy** neodvozuj z pořadí (`idm-03-otazka-7`) ani z obsahu. Odvoď ho z **pojmu**,
  který otázka zkouší: `idm-03-relace-tranzitivita`.
- Když `id` opravdu musíš změnit (třeba proto, že koliduje s jiným), dej to staré
  do `formerIds`:

```json
{
  "id": "idm-03-relace-tranzitivita",
  "formerIds": ["idm-03-tranzitivita"],
  "type": "trueFalse"
}
```

  Aplikace pak historii najde pod starým `id` a převede ji na nové. `formerIds` se
  **nikdy nemaže** — je to migrační stopa, ne poznámka.

- Otázku, která už nedává smysl, **nepřepisuj na jinou otázku pod stejným `id`**.
  Smaž ji a napiš novou s novým `id`. Přepsaná otázka by zdědila statistiku něčeho jiného.

### `materialHash`

Aplikace si u každé zodpovězené otázky pamatuje hash polí, která ovlivňují odpověď
(zadání, možnosti, správná odpověď). Při načtení porovná hash s uloženým:

| Co jsi změnil | Hash | Co se stane |
|---|---|---|
| Překlep v `explanation`, `hint`, `tags`, `difficulty` | stejný | Nic, pokrok zůstává |
| Přeformulování zadání beze změny významu | může se změnit | Pokrok se resetuje — proto formulace laď **před** prvním commitem |
| Jiná správná odpověď, přidaná/odebraná možnost, jiné zadání | jiný | Pokrok se resetuje. **Tak to má být** — člověk uměl něco jiného |

Prakticky: drobné opravy textu jsou v pořádku a měl bys je dělat. Změna významu resetuje
učení, a to je správně — jen to nedělej omylem. Když upravuješ existující soubor,
sahej jen na to, co opravuješ.

---

## 8. `status: "draft"` vs. `"reviewed"`

**Píšeš vždy `"draft"`. Bez výjimky.** Na `"reviewed"` to přepíná jedině člověk,
který otázku přečetl.

Proč: ty neumíš ověřit, jestli se odpověď shoduje s tím, co se opravdu přednášelo
a co se bude zkoušet. Umíš to jen odhadnout z materiálů, které jsi dostal — a ty mohou
být neúplné, zastaralé nebo špatně přečtené. `draft` je upřímné přiznání téhle nejistoty.

Co ten příznak dělá v praxi:

- `draft` — v UI označené jako nezkontrolované. Nálezy linteru jsou jen **varování**,
  takže build neshodí. Pravidla tím ale nepřestávají platit — pusť si
  `npm run content:lint -- --strict` a uvidíš je jako chyby.
- `reviewed` — každý nález linteru je **chyba**; `explanation` je tvrdě vyžadované.
  Otázka se počítá do „hotového" obsahu.

Když nastavíš `reviewed` sám, obejdeš jedinou kontrolu kvality, kterou projekt má.

---

## 9. Checklist před odevzdáním

Spusť:

- [ ] `npm run content:check` — prochází bez chyb
- [ ] `npm run content:lint -- --strict` — projdi i varování; buď je oprav, nebo ve výstupu vysvětli, proč zůstávají
- [ ] `npm run check` — když jsi sáhl i na kód (typecheck + lint + obsah + testy)

Projdi očima:

- [ ] Každá otázka má `explanation`, a to vysvětluje **proč**, ne jen opakuje odpověď
- [ ] Každý distraktor je chyba, kterou by student vážně udělal
- [ ] Správné odpovědi nejsou soustředěné na prvních pozicích
- [ ] Správná odpověď není nejdelší možnost
- [ ] Žádná otázka neodkazuje na slide, přednášku ani jinou otázku
- [ ] `difficulty` je rozprostřená, ne všude 3
- [ ] Typy otázek jsou promíchané, ne samé `single`
- [ ] `id` jsou mluvící, kebab-case, a nikde se neopakují
- [ ] Všechny `status` jsou `"draft"`
- [ ] Každý odkazovaný obrázek v `public/content/img/` skutečně existuje
- [ ] Kód v `codeOutput` jde přeložit a `expected` odpovídá skutečnému výstupu
- [ ] `source` v hlavičce sady říká, ze kterého materiálu sada vznikla

Do výstupu napiš: kolik otázek, z jakého materiálu, které jsou nejisté a proč.

---

## 10. Časté chyby

Vlevo je (zkrácená) hláška, kterou uvidíš z `npm run content:check`.

| Hláška | Co je špatně | Oprava |
|---|---|---|
| `Neplatný JSON: Unexpected token …` | Skoro vždycky jednoduché zpětné lomítko v LaTeXu | `\in` → `\\in`. Zdvoj **všechna** lomítka — viz sekce 5 |
| `Pole id je "…", ale podle názvu souboru má být "…"` | `id` sady neodpovídá názvu souboru | `id` = název souboru bez `.questions.json`, **bez prefixu předmětu** |
| `Pole course je "…", ale soubor leží v content/…/` | Nesedí kód předmětu | Sjednoť `course` s adresářem |
| `Id otázky "…" už existuje v …` | Zkopíroval jsi otázku a nepřejmenoval ji | `id` musí být unikátní v **celém repu**, ne jen v souboru |
| `correct: "…" není id žádné možnosti (jsou tu: …)` | Do `correct` jsi napsal text odpovědi nebo pořadí | Patří tam `id` možnosti |
| `Správné jsou všechny možnosti – taková otázka nic nezjistí` | `multi`, kde je správné všechno | Přidej aspoň jeden distraktor |
| `Dvě možnosti mají stejné id "…"` | Zkopírovaná možnost | `id` musí být unikátní v rámci otázky |
| `correctOrder musí obsahovat každé id z items právě jednou` | Překlep nebo zapomenutá položka | Zkontroluj obě pole proti sobě |
| `"…" není id žádné položky vlevo` / `Položka vlevo "…" nemá v pairs protějšek` | Rozpadlé `pairs` u `matching` | Každé levé `id` právě jednou, pravá `id` musí existovat |
| `Mezera {{2}} v template nemá odpovídající klíč v blanks` | Čísla mezer nesedí | Číslo mezery je klíč v `blanks` jako **řetězec**: `"2"` |
| `blanks obsahuje klíč "3", ale {{3}} v template není` | Zbylý blank po úpravě textu | Smaž ho, nebo mezeru doplň |
| `mode: "exact" vyžaduje neprázdné pole expected` | `codeOutput` bez očekávaného výstupu | Doplň `expected`, nebo přepni na `mode: "choice"` |
| `mode: "exact" a zároveň choices – jedno z toho je navíc` | Míchaná konfigurace | Vyber jeden režim |
| `mode: "choice" vyžaduje pole choices` / `… correct` | Chybí nabídka nebo správná odpověď | Doplň obojí |
| `Obrázek "…" neexistuje – čekal jsem ho v public/content/img/…` | Cesta nesedí nebo soubor nemáš | Zkontroluj velikost písmen (Linux je case-sensitive). Obrázek, který nemáš, **nevymýšlej** |
| `cesta musí být tvaru /content/img/<predmet>/…` | Cesta začíná `public/` nebo `./` | Odkazuje se od kořene webu, bez `public` |
| `musí být kebab-case: malá písmena, číslice a pomlčky` | Diakritika, velké písmeno, mezera nebo podtržítko v `id`/`tags` | `Relace_Tranzitivita` → `relace-tranzitivita`. **`id` ani `tags` nesnesou diakritiku** |
| `Invalid input` u `type` | Překlep v názvu typu | Přesně jeden z devíti řetězců — pozor na camelCase u `trueFalse` a `codeOutput` |
| `Unrecognized key(s)` | Pole patřící jinému typu otázky | `single`/`multi` → `correct`, `trueFalse`/`numeric` → `answer`, `shortText` → `accept`, `cloze` → `blanks` |
| `Too small: expected … to have >=3` u `tags` | Štítek kratší než 3 znaky | Použij kód předmětu (`izp`) nebo delší slovo |
| `Invalid literal` u `schemaVersion` | Napsal jsi `"1"` místo `1` | Je to číslo: `"schemaVersion": 1` |
| `formerIds obsahuje vlastní id otázky` | Přejmenování zapsané do kolečka | Do `formerIds` patří jen **stará** `id` |
| `formerId "…" je zároveň živé id otázky v …` | Recyklované `id` | Historie učení by se slila. Zvol jiné `id` |
| `Soubor sem nepatří – čekám jen course.json a *.questions.json` | Poznámkový soubor v `content/` | Přesuň ho jinam |
| `Adresář "…" neodpovídá žádnému kódu předmětu` | Nový předmět | Patří i do `COURSE_CODES` v `src/content/schema.ts` — to je cizí soubor, napiš si o změnu |

A z `npm run content:lint` (názvy pravidel a jejich vysvětlení jsou v sekci 6):
`meta-moznost`, `prozrazujici-delka`, `pozicni-vychylka`, `slabe-distraktory`,
`duplicitni-moznost`, `duplicitni-zadani`, `zaporne-zadani`, `prilis-dlouhe-zadani`,
`chybi-alt`, `chybi-vysvetleni`.
