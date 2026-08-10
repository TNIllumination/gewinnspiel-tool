import { db } from "./db";

/// Revisionssicheres Protokoll. Jede Verarbeitung personenbezogener Daten
/// wird festgehalten — Nachweispflicht nach Art. 5 Abs. 2 DSGVO.
export async function audit(params: {
  action: string;
  entity: string;
  entityId?: string | null;
  actor: string;
  detail?: unknown;
}) {
  await db.auditLog.create({
    data: {
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      actor: params.actor,
      detail: (params.detail ?? null) as never,
    },
  });
}

/// Erzeugt einen URL-tauglichen Bezeichner aus einem Titel.
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .normalize("NFD")
      .replace(/[\u0300-\u036F]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "gewinnspiel"
  );
}
