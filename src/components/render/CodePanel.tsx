/**
 * Panel s blokem kódu, který patří k zadání otázky.
 *
 * SERVER ONLY (uvnitř se čeká na Shiki). Vykreslení samotné řeší
 * `CodePanelStatic`, aby se stejný panel dal použít i z klientské
 * komponenty, která dostane obarvené HTML v props.
 */
import { CodePanelStatic } from "./CodePanelStatic";
import { highlight, normalizeLang } from "./highlight";

export type CodePanelProps = {
  /** Jazyk podle `CodeLanguage` ve schématu; neznámý spadne na prostý text. */
  language: string;
  source: string;
  /** Název souboru do hlavičky panelu. */
  filename?: string;
  className?: string;
};

export async function CodePanel({ language, source, filename, className }: CodePanelProps) {
  const lang = normalizeLang(language);
  const code = source.replace(/\s+$/, "");
  const html = await highlight(code, lang);

  return (
    <CodePanelStatic
      language={lang}
      source={code}
      html={html}
      filename={filename}
      className={className}
    />
  );
}
