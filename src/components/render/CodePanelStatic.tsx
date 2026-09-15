import { cn } from "@/lib/cn";

import { CopyButton } from "./CopyButton";
import { LANG_LABEL, normalizeLang } from "./highlight";

export type CodePanelStaticProps = {
  language: string;
  /** Původní kód – potřebuje ho tlačítko na kopírování. */
  source: string;
  /** Hotové HTML ze Shiki. Vyrábí ho server (`highlight`). */
  html: string;
  filename?: string;
  className?: string;
};

/**
 * Samotné tělo panelu s kódem, bez obarvování.
 *
 * Existuje odděleně od `CodePanel`, protože obarvování je asynchronní
 * a běží jen na serveru – zatímco tenhle kus se musí dát vykreslit
 * i z klientské komponenty, která dostane hotové HTML v props.
 */
export function CodePanelStatic({
  language,
  source,
  html,
  filename,
  className,
}: CodePanelStaticProps) {
  const lang = normalizeLang(language);

  return (
    <figure
      className={cn(
        "my-4 overflow-hidden rounded-card border border-border-base bg-surface shadow-card",
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3 border-b border-border-base bg-bg-subtle px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          {filename ? (
            <span className="truncate font-mono text-xs text-text" title={filename}>
              {filename}
            </span>
          ) : null}
          <span
            className={cn(
              "shrink-0 rounded-chip border border-border-base bg-surface px-1.5 py-0.5",
              "text-[0.68rem] tracking-wide text-text-muted uppercase",
            )}
          >
            {LANG_LABEL[lang]}
          </span>
        </span>
        <CopyButton value={source} />
      </figcaption>

      {/* Shiki vrací celé <pre class="shiki">; globální styl mu dává vlastní
          pozadí a zaoblení, tady je chceme potlačit, ať to sedí do panelu. */}
      <div
        className="[&>.shiki]:rounded-none! [&>.shiki]:my-0 [&>.shiki]:px-4 [&>.shiki]:py-3"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
}
