"use client";

import { useState } from "react";
import { Download, Upload, Trash2 } from "lucide-react";
import { useProgress, usePrefs } from "@/lib/progress/context";
import { Card, Button, Switch, Segmented, buttonStyles } from "@/components/ui";

export function SettingsPanel() {
  const store = useProgress();
  const prefs = usePrefs();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function exportProgress() {
    if (!store) return;
    const snapshot = await store.exportAll();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vut-kvizy-pokrok-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importProgress(file: File) {
    if (!store) return;
    setBusy(true);
    try {
      const snapshot = JSON.parse(await file.text());
      const { merged, skipped } = await store.importAll(snapshot);
      setNote(`Sloučeno ${merged} záznamů, ${skipped} přeskočeno.`);
    } catch {
      setNote("Soubor se nepodařilo načíst – není to platná záloha.");
    } finally {
      setBusy(false);
    }
  }

  async function resetAll() {
    if (!store) return;
    if (!confirm("Opravdu smazat všechen pokrok? Tohle se nedá vrátit.")) return;
    await store.reset();
    setNote("Pokrok smazán.");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Nastavení</h1>

      <Card className="mt-8 divide-y divide-border-base">
        <Row
          title="Míchat pořadí možností"
          description="Aby se otázka nedala naučit podle pozice odpovědi."
        >
          <Switch
            checked={prefs?.shuffleChoices ?? true}
            onChange={(v) => void store?.setPrefs({ shuffleChoices: v })}
            label="Míchat pořadí možností"
          />
        </Row>
        <Row
          title="Míchat pořadí otázek"
          description="Každý průchod sadou přijde v jiném sledu."
        >
          <Switch
            checked={prefs?.shuffleQuestions ?? true}
            onChange={(v) => void store?.setPrefs({ shuffleQuestions: v })}
            label="Míchat pořadí otázek"
          />
        </Row>
        <Row
          title="Vysvětlení hned po odpovědi"
          description="Když vypneš, uvidíš vysvětlení až v souhrnu na konci."
        >
          <Switch
            checked={prefs?.instantFeedback ?? true}
            onChange={(v) => void store?.setPrefs({ instantFeedback: v })}
            label="Vysvětlení hned po odpovědi"
          />
        </Row>
        <Row title="Délka tréninku" description="Kolik otázek dostaneš v jedné sérii.">
          <Segmented
            value={String(prefs?.sessionSize ?? 15)}
            onChange={(v) => void store?.setPrefs({ sessionSize: Number(v) })}
            options={[
              { value: "10", label: "10" },
              { value: "15", label: "15" },
              { value: "25", label: "25" },
              { value: "40", label: "40" },
            ]}
            label="Délka tréninku"
          />
        </Row>
      </Card>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-text-muted">Tvoje data</h2>
        <p className="mt-1 text-sm text-text-faint">
          Pokrok se ukládá jenom v tomhle prohlížeči. Když si smažeš data stránky
          nebo přejdeš na jiné zařízení, zmizí – proto ta záloha.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={exportProgress} disabled={busy}>
            <Download className="size-4" aria-hidden />
            Stáhnout zálohu
          </Button>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importProgress(f);
                e.target.value = "";
              }}
            />
            <span className={buttonStyles("secondary", "md", busy ? "pointer-events-none opacity-50" : undefined)}>
              <Upload className="size-4" aria-hidden />
              Načíst zálohu
            </span>
          </label>
          <Button variant="danger" onClick={resetAll} disabled={busy}>
            <Trash2 className="size-4" aria-hidden />
            Smazat pokrok
          </Button>
        </div>
        {note && <p className="mt-3 text-sm text-text-muted">{note}</p>}
      </section>
    </div>
  );
}

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-text-muted">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
