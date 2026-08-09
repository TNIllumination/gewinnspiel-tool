import { db } from "@/lib/db";

/// Impressum-Verweis für die Fußzeile der öffentlichen Seiten.
///
/// Ist keines hinterlegt, erscheint nichts — ob eines nötig ist, entscheidet
/// der Veranstalter, nicht das Werkzeug. Der gleiche Verweis steht in den
/// erzeugten HTML-Dateien (`src/legal/publish.ts`), damit beide Fassungen
/// gleich aussehen.
export async function ImpressumLink({ className = "" }: { className?: string }) {
  const settings = await db.settings.findUnique({ where: { id: "settings" } });
  const url = settings?.impressumUrl?.trim();
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`shrink-0 underline hover:text-slate-800 ${className}`}
    >
      Impressum
    </a>
  );
}
