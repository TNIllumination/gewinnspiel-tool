import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { renderHandbook, tocHtml } from "@/docs/render";
import { PageHeader } from "@/components/ui";

// Dasselbe Handbuch wie in ANLEITUNG.html, durch denselben Renderer —
// die beiden koennen deshalb nicht auseinanderlaufen.

export const dynamic = "force-dynamic";

export default async function HilfePage() {
  if (!(await getSessionUserId())) redirect("/admin/login");

  let markdown: string;
  try {
    markdown = await readFile(
      join(process.cwd(), "docs", "HANDBUCH.md"),
      "utf8",
    );
  } catch {
    markdown =
      "## Handbuch nicht gefunden\n\nDie Datei `docs/HANDBUCH.md` fehlt. " +
      "Führe `update.bat` aus, um die fehlenden Dateien nachzuladen.";
  }

  const { html, toc } = renderHandbook(markdown);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="Handbuch"
        subtitle="Alles zum Nachschlagen — vom Einlesen der Kommentare bis zur Ziehung."
        back={{ href: "/admin", label: "Zurück zur Verwaltung" }}
      />

      <div className="grid gap-8 lg:grid-cols-[260px_1fr] lg:items-start">
        <nav
          id="inhalt"
          className="rounded-xl border border-slate-200 bg-white p-5 lg:sticky lg:top-6"
          aria-label="Inhaltsverzeichnis"
        >
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Inhalt
          </h2>
          <div
            className="handbuch-toc text-sm"
            dangerouslySetInnerHTML={{ __html: tocHtml(toc) }}
          />
        </nav>

        <article
          className="handbuch rounded-xl border border-slate-200 bg-white p-6 sm:p-8"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </main>
  );
}
