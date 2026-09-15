/**
 * Schéma obsahu kvízů.
 *
 * Tohle je JEDINÝ zdroj pravdy o tom, jak vypadá soubor s otázkami.
 * Když tady něco změníš, spusť `npm run content:schema`, aby se
 * přegeneroval JSON Schema pro editory, a `npm run content:check`.
 *
 * Dokumentace pro autory obsahu: docs/AUTHORING.md
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Základní stavební kameny                                            */
/* ------------------------------------------------------------------ */

/** Kód předmětu. Nové předměty se přidávají sem a do content/<kod>/course.json. */
export const COURSE_CODES = ["izp", "ilg", "idm", "iel", "ius"] as const;
export const CourseCode = z.enum(COURSE_CODES);
export type CourseCode = z.infer<typeof CourseCode>;

/**
 * Identifikátor otázky. Kebab-case, globálně unikátní napříč celým repem.
 * Doporučený tvar: <predmet>-<cislo-sady>-<koncept>, např. `idm-03-relace-tranzitivita`.
 *
 * NIKDY nepoužívej pořadové číslo ani hash obsahu – id musí přežít
 * opravu překlepu, jinak uživatelům zmizí historie učení.
 */
export const Slug = z
  .string()
  .min(3)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "musí být kebab-case: malá písmena, číslice a pomlčky (např. 'idm-03-relace-tranzitivita')",
  );

/** Krátký identifikátor v rámci jedné otázky (možnost, položka, blank). */
export const LocalId = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9_-]+$/i, "jen písmena, číslice, '-' a '_'");

/**
 * Markdown s rozšířeními. Renderuje se serverově.
 * Podporuje: GFM tabulky, odrážky, **tučné**, `kód`, ```bloky kódu```,
 * obrázky ![popis](/content/img/...), a LaTeX mezi $...$ (inline) nebo $$...$$ (blok).
 *
 * Pozor v JSONu: zpětné lomítko se píše dvojitě – "$x \\in A$".
 */
export const Markdown = z.string().min(1).max(8000);

/** Obrázek. `src` je cesta od kořene webu, soubory patří do public/content/img/<predmet>/. */
export const ImageRef = z.object({
  src: z
    .string()
    .regex(
      /^\/content\/img\/[a-z0-9/_-]+\.(png|jpg|jpeg|svg|webp|avif)$/i,
      "cesta musí být tvaru /content/img/<predmet>/<soubor>.(png|jpg|svg|webp|avif)",
    ),
  /** Povinný popis pro čtečky obrazovky. Popiš, co je na obrázku vidět. */
  alt: z.string().min(3).max(300),
  caption: z.string().max(300).optional(),
  /** Rozměry v pixelech. Když je vyplníš, stránka při načítání neposkakuje. */
  width: z.int().positive().max(4000).optional(),
  height: z.int().positive().max(4000).optional(),
});
export type ImageRef = z.infer<typeof ImageRef>;

/** Jazyk pro zvýraznění syntaxe. Musí to znát Shiki. */
export const CodeLanguage = z.enum([
  "c",
  "cpp",
  "asm",
  "bash",
  "shell",
  "python",
  "javascript",
  "typescript",
  "sql",
  "vhdl",
  "verilog",
  "latex",
  "json",
  "yaml",
  "xml",
  "makefile",
  "diff",
  "text",
]);

/** Blok kódu, který je součástí zadání (renderuje se ve vlastním panelu). */
export const CodeBlock = z.object({
  language: CodeLanguage,
  source: z.string().min(1).max(6000),
  /** Volitelný název souboru zobrazený v hlavičce panelu. */
  filename: z.string().max(80).optional(),
});

/** Pravidla pro porovnání volně psané odpovědi. */
export const TextNormalization = z.object({
  /** Ignorovat velikost písmen. Výchozí: true. */
  caseInsensitive: z.boolean().default(true),
  /** Ignorovat diakritiku, takže "hodnost" == "hodnost". Výchozí: true. */
  stripDiacritics: z.boolean().default(true),
  /** Oříznout mezery na krajích. Výchozí: true. */
  trim: z.boolean().default(true),
  /** Více mezer uvnitř brát jako jednu. Výchozí: true. */
  collapseWhitespace: z.boolean().default(true),
  /** Zahodit veškerou interpunkci. Výchozí: false (rozbíjí odpovědi jako "O(n log n)"). */
  stripPunctuation: z.boolean().default(false),
});

/**
 * Tolerance u číselné odpovědi.
 * - absolute: |odpověď − správně| <= value   (value: 0 znamená přesnou shodu)
 * - relative: |odpověď − správně| <= |správně| * value   (value: 0.05 = 5 %)
 * - decimals: shoda po zaokrouhlení na `value` desetinných míst
 */
export const NumericTolerance = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("absolute"), value: z.number().min(0) }),
  z.object({ kind: z.literal("relative"), value: z.number().min(0).max(1) }),
  z.object({ kind: z.literal("decimals"), value: z.int().min(0).max(10) }),
]);

/** Jedna nabízená možnost u výběrových otázek. */
export const Choice = z.object({
  id: LocalId,
  /** Text možnosti. Markdown – takže i vzorec, kód nebo obrázek. */
  text: Markdown,
  image: ImageRef.optional(),
  /**
   * Vysvětlení, které se ukáže, když uživatel vybere právě tuhle možnost.
   * U chytře napsaných distraktorů je tohle nejcennější část kvízu –
   * vysvětli, PROČ je to lákavé a v čem je to špatně.
   */
  feedback: z.string().max(1000).optional(),
  /**
   * Zamkne možnost na kraj seznamu i při míchání pořadí.
   * Použij u "žádná z předchozích" – jinak ji míchání posune doprostřed
   * a otázka přestane dávat smysl.
   */
  pin: z.enum(["first", "last"]).optional(),
});
export type Choice = z.infer<typeof Choice>;

/* ------------------------------------------------------------------ */
/* Společná pole všech typů otázek                                     */
/* ------------------------------------------------------------------ */

const questionBase = {
  id: Slug,
  /** Zadání. Markdown s LaTeXem, tabulkami, obrázky. */
  prompt: Markdown,
  /** Velký obrázek pod zadáním (schéma, diagram, graf). */
  figure: ImageRef.optional(),
  /** Blok kódu pod zadáním. */
  code: CodeBlock.optional(),
  /** Nápověda na vyžádání. Nesmí prozradit odpověď. */
  hint: z.string().max(600).optional(),
  /**
   * Vysvětlení správné odpovědi. Ukáže se po vyhodnocení.
   * U otázek se `status: "reviewed"` je prakticky povinné – bez něj se
   * uživatel nic nenaučí, jen se dozví, že se spletl.
   */
  explanation: Markdown.optional(),
  /** Obtížnost 1 (triviální) až 5 (chyták na zkoušku). */
  difficulty: z.int().min(1).max(5).default(3),
  /** Štítky pro filtrování a statistiky, kebab-case. */
  tags: z.array(Slug).max(12).default([]),
  /**
   * Dřívější id téhle otázky. Když otázku přejmenuješ, staré id sem –
   * jinak uživatelům zmizí historie učení.
   */
  formerIds: z.array(Slug).max(10).default([]),
  /**
   * draft = vygenerováno, ještě neprošlo kontrolou člověkem
   * reviewed = zkontrolováno, linter na to platí naplno
   *
   * Agenti píšou VŽDY "draft". Na "reviewed" to přepíná jenom člověk.
   */
  status: z.enum(["draft", "reviewed"]).default("draft"),
};

/* ------------------------------------------------------------------ */
/* Typy otázek                                                         */
/* ------------------------------------------------------------------ */

/** Výběr jedné správné možnosti ze seznamu. */
export const SingleChoiceQuestion = z.object({
  ...questionBase,
  type: z.literal("single"),
  choices: z.array(Choice).min(2).max(8),
  /** Id správné možnosti. */
  correct: LocalId,
  /** Zamíchat pořadí možností. Výchozí: true. */
  shuffleChoices: z.boolean().default(true),
});

/** Výběr libovolného počtu správných možností. */
export const MultiChoiceQuestion = z.object({
  ...questionBase,
  type: z.literal("multi"),
  choices: z.array(Choice).min(3).max(10),
  /** Id všech správných možností. Musí být aspoň jedno a ne všechna. */
  correct: z.array(LocalId).min(1),
  /**
   * Uznat i částečně správnou odpověď (poměr trefených mínus chybně
   * zaškrtnuté). Výchozí: true – jinak je multi-choice frustrující.
   */
  partialCredit: z.boolean().default(true),
  shuffleChoices: z.boolean().default(true),
});

/** Tvrzení, které je pravdivé nebo nepravdivé. */
export const TrueFalseQuestion = z.object({
  ...questionBase,
  type: z.literal("trueFalse"),
  answer: z.boolean(),
});

/** Krátká volně psaná odpověď (jedno slovo, pojem, vzorec). */
export const ShortTextQuestion = z.object({
  ...questionBase,
  type: z.literal("shortText"),
  /**
   * Všechny varianty, které uznáváme. Mysli na synonyma, zkratky,
   * české i anglické znění: ["hodnost", "rank", "hodnost matice"].
   */
  accept: z.array(z.string().min(1).max(200)).min(1).max(20),
  normalize: TextNormalization.prefault({}),
  /** Nápis v prázdném políčku, např. "např. pivot". */
  placeholder: z.string().max(60).optional(),
});

/** Číselná odpověď. */
export const NumericQuestion = z.object({
  ...questionBase,
  type: z.literal("numeric"),
  answer: z.number(),
  /** Výchozí je přesná shoda – lenivost se tu nepromíjí sama od sebe. */
  tolerance: NumericTolerance.prefault({ kind: "absolute", value: 0 }),
  /** Jednotka zobrazená za políčkem, např. "V", "bitů". */
  unit: z.string().max(20).nullable().default(null),
});

/** Seřazení položek do správného pořadí. */
export const OrderingQuestion = z.object({
  ...questionBase,
  type: z.literal("ordering"),
  items: z.array(z.object({ id: LocalId, text: Markdown })).min(3).max(8),
  /** Id položek ve správném pořadí. Musí obsahovat každé id právě jednou. */
  correctOrder: z.array(LocalId).min(3).max(8),
});

/** Přiřazení dvojic mezi dvěma sloupci. */
export const MatchingQuestion = z.object({
  ...questionBase,
  type: z.literal("matching"),
  left: z.array(z.object({ id: LocalId, text: Markdown })).min(2).max(8),
  /**
   * Pravý sloupec. Může obsahovat i položky navíc, které nikam nepatří –
   * to je dobrý způsob, jak otázku ztížit.
   */
  right: z.array(z.object({ id: LocalId, text: Markdown })).min(2).max(10),
  /** Správné dvojice [idVlevo, idVpravo]. Každé id vlevo právě jednou. */
  pairs: z.array(z.tuple([LocalId, LocalId])).min(2).max(8),
});

/** Doplňování do mezer ve větě. */
export const ClozeQuestion = z.object({
  ...questionBase,
  type: z.literal("cloze"),
  /**
   * Text s mezerami zapsanými jako {{1}}, {{2}}, ...
   * Markdown funguje i tady.
   */
  template: z.string().min(5).max(2000).regex(/\{\{\d+\}\}/, "musí obsahovat aspoň jednu mezeru {{1}}"),
  /** Klíč = číslo mezery jako text ("1", "2"), hodnota = uznávané odpovědi. */
  blanks: z.record(
    z.string().regex(/^\d+$/),
    z.object({
      accept: z.array(z.string().min(1).max(200)).min(1).max(15),
      normalize: TextNormalization.prefault({}),
      placeholder: z.string().max(40).optional(),
    }),
  ),
});

/** Odhad výstupu programu. */
export const CodeOutputQuestion = z.object({
  ...questionBase,
  type: z.literal("codeOutput"),
  language: CodeLanguage,
  /** Zdrojový kód. V JSONu jsou konce řádků jako \n. */
  source: z.string().min(1).max(6000),
  filename: z.string().max(80).optional(),
  /**
   * exact  – porovná se po znacích (jen se ořežou mezery na koncích řádků)
   * choice – uživatel vybírá z `choices` místo psaní
   */
  mode: z.enum(["exact", "choice"]).default("exact"),
  /** Očekávaný výstup. Povinné při mode: "exact". */
  expected: z.string().max(2000).optional(),
  /** Nabídka možností. Povinné při mode: "choice". */
  choices: z.array(Choice).min(2).max(6).optional(),
  /** Id správné možnosti. Povinné při mode: "choice". */
  correct: LocalId.optional(),
  shuffleChoices: z.boolean().default(true),
});

/** Sjednocení všech typů otázek, rozlišené podle pole `type`. */
export const Question = z.discriminatedUnion("type", [
  SingleChoiceQuestion,
  MultiChoiceQuestion,
  TrueFalseQuestion,
  ShortTextQuestion,
  NumericQuestion,
  OrderingQuestion,
  MatchingQuestion,
  ClozeQuestion,
  CodeOutputQuestion,
]);
export type Question = z.infer<typeof Question>;
export type QuestionType = Question["type"];

export const QUESTION_TYPES = [
  "single",
  "multi",
  "trueFalse",
  "shortText",
  "numeric",
  "ordering",
  "matching",
  "cloze",
  "codeOutput",
] as const satisfies readonly QuestionType[];

/* ------------------------------------------------------------------ */
/* Sada otázek = jeden soubor                                          */
/* ------------------------------------------------------------------ */

/** Odkaz na materiál, ze kterého sada vznikla. */
export const SourceRef = z.object({
  kind: z.enum(["slides", "lecture", "textbook", "exam", "notes", "exercise", "other"]),
  /** Název souboru nebo odkaz, např. "IDM-2025-prednaska-03.pdf". */
  ref: z.string().min(1).max(300),
  pages: z.array(z.int().positive()).max(60).optional(),
  note: z.string().max(300).optional(),
});

export const QuestionSet = z.object({
  /** Relativní cesta ke schématu – rozsvítí napovídání v editoru. */
  $schema: z.string().optional(),
  /** Id sady, kebab-case, unikátní v rámci předmětu. Shoduje se s názvem souboru. */
  id: Slug,
  /** Název zobrazený uživateli, česky, bez čísla přednášky. */
  title: z.string().min(2).max(120),
  course: CourseCode,
  /** Číslo přednášky/kapitoly. Určuje pořadí sad v předmětu. */
  lecture: z.int().min(0).max(40).optional(),
  /** Jedna až dvě věty: co si tímhle člověk procvičí. */
  description: z.string().max(400).optional(),
  source: SourceRef.optional(),
  /** Verze schématu, podle které je soubor napsaný. Teď vždy 1. */
  schemaVersion: z.literal(1),
  questions: z.array(Question).min(1).max(200),
});
export type QuestionSet = z.infer<typeof QuestionSet>;

/* ------------------------------------------------------------------ */
/* Předmět = content/<kod>/course.json                                 */
/* ------------------------------------------------------------------ */

export const Course = z.object({
  $schema: z.string().optional(),
  code: CourseCode,
  /** Zkratka velkými písmeny, např. "IDM". */
  abbr: z.string().min(2).max(6),
  /** Plný český název, např. "Diskrétní matematika". */
  name: z.string().min(2).max(120),
  /** Ročník a semestr, ve kterém se předmět učí. */
  semester: z.enum(["zimni", "letni"]),
  year: z.int().min(1).max(3).default(1),
  credits: z.int().min(1).max(12).optional(),
  /** Jedna až tři věty o předmětu. */
  description: z.string().max(500).optional(),
  /**
   * Barevný akcent předmětu. Odkazuje na paletu v globals.css –
   * viz --color-accent-<name>. Drž se nabídky, ať web nevypadá jako cirkus.
   */
  accent: z.enum(["slate", "indigo", "violet", "teal", "amber", "rose"]),
  /** Odkaz na kartu předmětu ve VUT. */
  url: z.string().url().optional(),
});
export type Course = z.infer<typeof Course>;
