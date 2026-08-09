import {
  containsText,
  extractMentions,
  graphemeLength,
  sameUser,
} from "./text";
import { parseRuleConfig, type RuleType } from "./types";

export interface CommentInput {
  /// Eigene Kennung des Aufrufers. Die Engine reicht sie unveraendert durch,
  /// damit sich das Ergebnis eindeutig zuordnen laesst.
  id?: string;
  externalId?: string | null;
  username: string;
  userRef?: string | null;
  text: string;
  commentedAt: Date;
  likeCount?: number;
  /// Von welcher Plattform die Teilnahme stammt. Fehlt sie, gelten alle
  /// Teilnahmen als von derselben Quelle.
  platform?: string | null;
}

export interface Rejection {
  ruleType: RuleType;
  message: string;
}

export interface EvaluatedEntry extends CommentInput {
  valid: boolean;
  /// Anzahl Lose in der Ziehung. 0, wenn die Teilnahme ungueltig ist.
  lots: number;
  /// Warum wurde abgelehnt? Leer, wenn gueltig. Wird dem Betreiber angezeigt
  /// und ist die Grundlage fuer eine nachvollziehbare Entscheidung.
  rejections: Rejection[];
}

export interface RuleSpec {
  type: RuleType;
  config: unknown;
  enabled?: boolean;
  position?: number;
}

export interface EvaluationContext {
  /// Eigener Handle — wird bei "Freunde markieren" nicht mitgezaehlt.
  ownerHandle?: string | null;
}

export interface EvaluationSummary {
  entries: EvaluatedEntry[];
  validCount: number;
  rejectedCount: number;
  totalLots: number;
  /// Wie oft jede Regel zur Ablehnung gefuehrt hat.
  rejectionsByRule: Partial<Record<RuleType, number>>;
}

/// Prueft alle Kommentare gegen die Regeln.
///
/// Zwei Durchgaenge, weil sich Regeln unterscheiden:
///   1. Einzelpruefung  — haengt nur am jeweiligen Kommentar
///   2. Querpruefung    — braucht den Blick auf alle (Mehrfachteilnahme)
export function evaluateEntries(
  comments: CommentInput[],
  rules: RuleSpec[],
  ctx: EvaluationContext = {},
): EvaluationSummary {
  const active = rules
    .filter((r) => r.enabled !== false)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  // Aeltester Kommentar zuerst — entscheidet, welche Teilnahme bei
  // Mehrfachteilnahme die gueltige ist.
  const ordered = [...comments].sort(
    (a, b) => a.commentedAt.getTime() - b.commentedAt.getTime(),
  );

  const entries: EvaluatedEntry[] = ordered.map((comment) =>
    evaluateSingle(comment, active, ctx),
  );

  applyDedupe(entries, active);

  const rejectionsByRule: Partial<Record<RuleType, number>> = {};
  let validCount = 0;
  let totalLots = 0;

  for (const entry of entries) {
    if (entry.valid) {
      validCount += 1;
      totalLots += entry.lots;
    } else {
      entry.lots = 0;
      for (const r of entry.rejections) {
        rejectionsByRule[r.ruleType] = (rejectionsByRule[r.ruleType] ?? 0) + 1;
      }
    }
  }

  return {
    entries,
    validCount,
    rejectedCount: entries.length - validCount,
    totalLots,
    rejectionsByRule,
  };
}

function evaluateSingle(
  comment: CommentInput,
  rules: RuleSpec[],
  ctx: EvaluationContext,
): EvaluatedEntry {
  const rejections: Rejection[] = [];
  let lots = 1;

  const mentions = extractMentions(comment.text).filter((handle) => {
    if (sameUser(handle, comment.username)) return false;
    if (ctx.ownerHandle && sameUser(handle, ctx.ownerHandle)) return false;
    return true;
  });

  for (const rule of rules) {
    switch (rule.type) {
      case "KEYWORD": {
        const cfg = parseRuleConfig("KEYWORD", rule.config);
        const hits = cfg.keywords.filter((k) => containsText(comment.text, k));
        const ok = cfg.mode === "all" ? hits.length === cfg.keywords.length : hits.length > 0;
        if (!ok) {
          const missing = cfg.keywords.filter((k) => !hits.includes(k));
          rejections.push({
            ruleType: "KEYWORD",
            message:
              cfg.mode === "all"
                ? `Es fehlen die Angaben: ${missing.map(q).join(", ")}.`
                : `Der Kommentar enthält keines der geforderten Wörter (${cfg.keywords.map(q).join(", ")}).`,
          });
        }
        break;
      }

      case "MENTIONS": {
        const cfg = parseRuleConfig("MENTIONS", rule.config);
        const counted = cfg.allowSelfMention
          ? extractMentions(comment.text)
          : mentions;
        if (counted.length < cfg.min) {
          rejections.push({
            ruleType: "MENTIONS",
            message: `Es müssen ${cfg.min} ${cfg.min === 1 ? "Freund" : "verschiedene Freunde"} markiert werden, markiert ${counted.length === 1 ? "wurde" : "wurden"} ${counted.length}.`,
          });
        }
        break;
      }

      case "MIN_LENGTH": {
        const cfg = parseRuleConfig("MIN_LENGTH", rule.config);
        const length = graphemeLength(comment.text);
        if (length < cfg.min) {
          rejections.push({
            ruleType: "MIN_LENGTH",
            message: `Die Antwort ist mit ${length} Zeichen zu kurz, gefordert sind mindestens ${cfg.min}.`,
          });
        }
        break;
      }

      case "TIMEWINDOW": {
        const cfg = parseRuleConfig("TIMEWINDOW", rule.config);
        const at = comment.commentedAt.getTime();
        if (cfg.from && at < new Date(cfg.from).getTime()) {
          rejections.push({
            ruleType: "TIMEWINDOW",
            message: `Der Kommentar stammt von vor dem Start des Gewinnspiels (${formatDe(cfg.from)}).`,
          });
        }
        if (cfg.to && at > new Date(cfg.to).getTime()) {
          rejections.push({
            ruleType: "TIMEWINDOW",
            message: `Der Kommentar kam nach dem Einsendeschluss (${formatDe(cfg.to)}).`,
          });
        }
        break;
      }

      case "BLOCKLIST": {
        const cfg = parseRuleConfig("BLOCKLIST", rule.config);
        if (cfg.usernames.some((u) => sameUser(u, comment.username))) {
          rejections.push({
            ruleType: "BLOCKLIST",
            message: "Dieser Account ist von der Teilnahme ausgeschlossen.",
          });
        }
        break;
      }

      case "BONUS": {
        const cfg = parseRuleConfig("BONUS", rule.config);
        let earned = false;
        if (cfg.when === "always") earned = true;
        if (cfg.when === "keyword")
          earned = cfg.keywords.some((k) => containsText(comment.text, k));
        if (cfg.when === "mentions_at_least")
          earned = mentions.length >= cfg.mentionsAtLeast;
        if (earned) lots += cfg.extraLots;
        break;
      }

      case "DEDUPE":
        // Querpruefung, siehe applyDedupe.
        break;
    }
  }

  return {
    ...comment,
    valid: rejections.length === 0,
    lots,
    rejections,
  };
}

/// Mehrfachteilnahme. Laeuft ueber alle Eintraege, weil erst der Vergleich
/// untereinander zeigt, wer mehrfach kommentiert hat.
function applyDedupe(entries: EvaluatedEntry[], rules: RuleSpec[]) {
  const rule = rules.find((r) => r.type === "DEDUPE");
  if (!rule) return;

  const cfg = parseRuleConfig("DEDUPE", rule.config);
  if (cfg.mode === "all_comments") return;

  const allowed = cfg.mode === "one_per_user" ? 1 : cfg.max;
  const countPerUser = new Map<string, number>();

  // entries ist bereits chronologisch — die frueheste Teilnahme gewinnt.
  for (const entry of entries) {
    if (!entry.valid) continue;

    // Die Plattform gehoert in den Schluessel: Ob @anna von TikTok dieselbe
    // Person ist wie @anna von Instagram, kann niemand feststellen — es
    // koennten zwei Fremde sein. Wer auf beiden Plattformen kommentiert,
    // ist deshalb zweimal im Topf. Genau das wird auch angesagt.
    const name = entry.username.trim().replace(/^@/, "").toLowerCase();
    const key = `${entry.platform ?? ""}|${name}`;
    const used = countPerUser.get(key) ?? 0;

    if (used >= allowed) {
      entry.valid = false;
      entry.rejections.push({
        ruleType: "DEDUPE",
        message:
          allowed === 1
            ? "Mehrfachteilnahme — es zählt der erste Kommentar dieser Person auf dieser Plattform."
            : `Mehrfachteilnahme — pro Person zählen höchstens ${allowed} Kommentare je Plattform.`,
      });
    } else {
      countPerUser.set(key, used + 1);
    }
  }
}

function q(value: string) {
  return `„${value}“`;
}

function formatDe(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  });
}
