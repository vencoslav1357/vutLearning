/**
 * Renderování bohatého textu z obsahu kvízů.
 *
 * Všechno kromě `CopyButton` a `ImageZoom` jsou Server Components –
 * KaTeX ani Shiki se do prohlížeče neposílají.
 */
export { RichText, type RichTextProps } from "./RichText";
export { Math, type MathProps } from "./Math";
export { CodePanel, type CodePanelProps } from "./CodePanel";
export { Figure, type FigureProps } from "./Figure";
export { highlight, normalizeLang, LANG_LABEL, type CodeLang } from "./highlight";
