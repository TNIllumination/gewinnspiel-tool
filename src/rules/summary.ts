import { parseRuleConfig, type RuleType } from "./types";

/// Fasst die gespeicherten Regeln in ganzen Saetzen zusammen.
///
/// Die Formularfelder einzeln zu lesen beantwortet nicht die Frage, die man
/// wirklich hat: "Was gilt jetzt eigentlich?" — vor allem, weil eine 0 in
/// einem Feld bedeutet, dass die Regel gar nicht angewendet wird.
export function describeRules(
  rules: { type: RuleType; config: unknown; enabled?: boolean }[],
): string[] {
  const active = rules.filter((r) => r.enabled !== false);
  const lines: string[] = [];
  const has = (type: RuleType) => active.find((r) => r.type === type);

  const keyword = has("KEYWORD");
  if (keyword) {
    const cfg = parseRuleConfig("KEYWORD", keyword.config);
    const words = cfg.keywords.map((k) => `„${k}“`).join(cfg.mode === "all" ? " und " : " oder ");
    lines.push(
      cfg.keywords.length === 1
        ? `Der Kommentar muss ${words} enthalten.`
        : cfg.mode === "all"
          ? `Der Kommentar muss ${words} enthalten — alle davon.`
          : `Der Kommentar muss ${words} enthalten — eines genügt.`,
    );
  } else {
    lines.push("Es ist kein bestimmtes Wort gefordert.");
  }

  const mentions = has("MENTIONS");
  if (mentions) {
    const cfg = parseRuleConfig("MENTIONS", mentions.config);
    lines.push(
      cfg.min === 1
        ? "Es muss eine Freundin oder ein Freund markiert werden."
        : `Es müssen ${cfg.min} verschiedene Freunde markiert werden.`,
    );
  } else {
    lines.push("Freunde markieren ist nicht gefordert.");
  }

  const minLength = has("MIN_LENGTH");
  if (minLength) {
    const cfg = parseRuleConfig("MIN_LENGTH", minLength.config);
    lines.push(`Die Antwort muss mindestens ${cfg.min} Zeichen lang sein.`);
  }

  const dedupe = has("DEDUPE");
  if (dedupe) {
    const cfg = parseRuleConfig("DEDUPE", dedupe.config);
    lines.push(
      cfg.mode === "one_per_user"
        ? "Pro Person zählt ein Los — es gilt der erste Kommentar."
        : cfg.mode === "max_per_user"
          ? `Pro Person zählen höchstens ${cfg.max} Kommentare.`
          : "Jeder Kommentar ist ein eigenes Los.",
    );
  }

  const bonus = has("BONUS");
  if (bonus) {
    const cfg = parseRuleConfig("BONUS", bonus.config);
    if (cfg.when === "mentions_at_least") {
      lines.push(
        `Wer ${cfg.mentionsAtLeast} oder mehr Freunde markiert, bekommt ${cfg.extraLots} Zusatzlos(e).`,
      );
    }
  }

  const blocklist = has("BLOCKLIST");
  if (blocklist) {
    const cfg = parseRuleConfig("BLOCKLIST", blocklist.config);
    if (cfg.usernames.length > 0) {
      lines.push(
        `${cfg.usernames.length} Account(s) sind von der Teilnahme ausgeschlossen.`,
      );
    }
  }

  return lines;
}
