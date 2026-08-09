import { z } from "zod";

export const RULE_TYPES = [
  "KEYWORD",
  "MENTIONS",
  "MIN_LENGTH",
  "TIMEWINDOW",
  "BLOCKLIST",
  "DEDUPE",
  "BONUS",
] as const;

export type RuleType = (typeof RULE_TYPES)[number];

export const keywordConfig = z.object({
  keywords: z.array(z.string().min(1)).min(1),
  /// "any" = eines der Woerter genuegt, "all" = alle muessen vorkommen.
  mode: z.enum(["any", "all"]).default("any"),
});

export const mentionsConfig = z.object({
  /// Wie viele verschiedene Freunde getaggt werden muessen.
  min: z.number().int().min(1).default(1),
  /// Zaehlt sich selbst zu taggen mit? Standard: nein.
  allowSelfMention: z.boolean().default(false),
});

export const minLengthConfig = z.object({
  min: z.number().int().min(1).default(3),
});

export const timeWindowConfig = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

export const blocklistConfig = z.object({
  /// Eigene Zweitaccounts, Team, fruehere Gewinner.
  usernames: z.array(z.string().min(1)).default([]),
});

export const dedupeConfig = z.object({
  /// one_per_user  = ein Los pro Person (Standard, fairste Variante)
  /// max_per_user  = hoechstens `max` Teilnahmen pro Person
  /// all_comments  = jeder Kommentar ist ein eigenes Los
  mode: z
    .enum(["one_per_user", "max_per_user", "all_comments"])
    .default("one_per_user"),
  max: z.number().int().min(1).default(1),
});

export const bonusConfig = z.object({
  /// Bedingung fuer Zusatzlose.
  when: z.enum(["keyword", "mentions_at_least", "always"]).default("keyword"),
  keywords: z.array(z.string().min(1)).default([]),
  mentionsAtLeast: z.number().int().min(1).default(2),
  /// Zusaetzliche Lose, wenn die Bedingung zutrifft.
  extraLots: z.number().int().min(1).max(50).default(1),
});

const CONFIG_SCHEMAS = {
  KEYWORD: keywordConfig,
  MENTIONS: mentionsConfig,
  MIN_LENGTH: minLengthConfig,
  TIMEWINDOW: timeWindowConfig,
  BLOCKLIST: blocklistConfig,
  DEDUPE: dedupeConfig,
  BONUS: bonusConfig,
} as const;

export type RuleConfigMap = {
  [K in RuleType]: z.infer<(typeof CONFIG_SCHEMAS)[K]>;
};

/// Validiert und ergaenzt Standardwerte. Wirft mit lesbarer Meldung,
/// damit ein Konfigurationsfehler in der Oberflaeche erklaerbar bleibt.
export function parseRuleConfig<K extends RuleType>(
  type: K,
  config: unknown,
): RuleConfigMap[K] {
  const schema = CONFIG_SCHEMAS[type];
  const result = schema.safeParse(config ?? {});
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `${i.path.join(".") || "(Wurzel)"}: ${i.message}`)
      .join("; ");
    throw new Error(`Regel "${type}" ist falsch konfiguriert — ${details}`);
  }
  return result.data as RuleConfigMap[K];
}

/// Menschenlesbare Beschriftung fuer die Oberflaeche.
export const RULE_LABELS: Record<RuleType, string> = {
  KEYWORD: "Schlüsselwort muss vorkommen",
  MENTIONS: "Freunde markieren",
  MIN_LENGTH: "Mindestlänge der Antwort",
  TIMEWINDOW: "Zeitfenster",
  BLOCKLIST: "Ausgeschlossene Accounts",
  DEDUPE: "Mehrfachteilnahme",
  BONUS: "Zusatzlose",
};
