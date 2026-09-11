/**
 * Splits normalized card text into the structured pieces the schema wants:
 * keywords, play restrictions, attachment host rules, and one entry per
 * printed ability (which becomes an `AbilityReference`).
 *
 * The parser never encodes behavior — it only decides *where abilities are*
 * and gives each a stable id. Anything it can't classify is reported in
 * `unclassified` and the ingest run fails, so new wording in a future pack is
 * surfaced instead of silently dropped.
 *
 * Ability id convention (`<cardCode>.<slug>`, stable — never renumber):
 * - Printed ability name → slug of the name: `01001a.spider-sense`.
 * - Structural encounter/scenario timings → bare slug: `setup`, `boost`,
 *   `when-revealed`, `when-revealed-hero`, `when-revealed-alter-ego`,
 *   `when-defeated`, `obligation` (the whole obligation text).
 * - Everything else → `<card-name-slug>-<kind>`, kind ∈ action | resource |
 *   response | interrupt | forced-response | forced-interrupt | special |
 *   constant: `01008.web-shooter-resource`, `01099.charge-forced-interrupt`.
 *   If two abilities on one card would collide, the form qualifier printed on
 *   the trigger is added (`01018.energy-channel-hero-action`), then a numeric
 *   suffix (`-2`) as a last resort.
 * - Keyword lines (`Guard.`, `Toughness.`), reminder text in parentheses,
 *   restrictions (`Max 1 per player.`), attachment rules (`Attach to a
 *   minion.`), a main scheme's `Contents:` paragraph and the final-stage
 *   reminder "If this stage is completed, the players lose the game." are data
 *   or rules reminders, not abilities.
 * - A leading `[star]` marker is a printed reminder icon, not part of the
 *   ability kind; it stays in the card text.
 */
import type { AttachmentHost, KeywordInstance, PlayRestrictions } from "../../src/schema/index.ts";
import { slugify } from "./text.ts";

export type AbilityKind =
  | "action"
  | "resource"
  | "response"
  | "interrupt"
  | "forced-response"
  | "forced-interrupt"
  | "special"
  | "constant"
  | "setup"
  | "boost"
  | "when-revealed"
  | "when-revealed-hero"
  | "when-revealed-alter-ego"
  | "when-defeated"
  | "obligation";

const STRUCTURAL_KINDS: ReadonlySet<AbilityKind> = new Set([
  "setup",
  "boost",
  "when-revealed",
  "when-revealed-hero",
  "when-revealed-alter-ego",
  "when-defeated",
  "obligation",
]);

export interface ParsedAbility {
  readonly kind: AbilityKind;
  /** Printed form qualifier on the trigger ("Hero Action" → "hero"). */
  readonly form?: "hero" | "alter-ego";
  /** Printed ability label ("attack", "thwart", "defense") after the trigger. */
  readonly label?: "attack" | "thwart" | "defense";
  /** Printed ability name ("Spider-Sense"), when the card names it. */
  readonly name?: string;
  /** The ability's own slice of the card text (for notes/debugging). */
  readonly text: string;
}

export interface ParsedText {
  readonly keywords: KeywordInstance[];
  readonly abilities: ParsedAbility[];
  readonly restrictions: PlayRestrictions;
  /** Parsed "Max N per deck." — cross-checked against MarvelCDB `deck_limit`. */
  readonly maxPerDeckText?: number;
  readonly attachesTo?: AttachmentHost;
  /** Printed name inside "Attach to Rhino." — the caller checks it's the villain. */
  readonly attachesToVillainNamed?: string;
  readonly unclassified: string[];
}

export interface ParseOptions {
  /** Obligation cards are one whole-card ability; no sentence classification. */
  readonly obligation?: boolean;
  /** Names of villains in the pack, so "Attach to Rhino." maps to `{ kind: "villain" }`. */
  readonly villainNames: ReadonlySet<string>;
}

const TRIGGER =
  String.raw`(?:(?:Hero |Alter-Ego )?(?:Forced )?(?:Action|Resource|Response|Interrupt)|Special|Setup|Boost|When Revealed(?: \((?:Hero|Alter-Ego)\))?|When Defeated|Contents)`;
/** A trigger header at a sentence boundary: start of line, or after `.`/`)`/`!` + space. */
const HEADER_RE = new RegExp(
  String.raw`(?:^|(?<=[.)!]\s+)|(?<=\s{2,}))(?:\[star\]\s*)?(${TRIGGER})(?: \((attack|thwart|defense)\))?:`,
  "g",
);
/** Named ability at the start of a line: `Spider-Sense — Interrupt:` / `"I Object!" — Interrupt:`. */
const NAMED_RE = new RegExp(String.raw`^(.+?) — (${TRIGGER})(?: \((attack|thwart|defense)\))?:`);

interface Header {
  readonly index: number;
  readonly length: number;
  readonly trigger: string;
  readonly label?: string;
  readonly name?: string;
}

function findHeaders(line: string): Header[] {
  const headers: Header[] = [];
  const named = NAMED_RE.exec(line);
  if (named) {
    headers.push({
      index: 0,
      length: named[0].length,
      trigger: named[2] as string,
      ...(named[3] ? { label: named[3] } : {}),
      name: (named[1] as string).trim(),
    });
  }
  HEADER_RE.lastIndex = 0;
  for (let m = HEADER_RE.exec(line); m !== null; m = HEADER_RE.exec(line)) {
    if (named && m.index < named[0].length) continue;
    headers.push({ index: m.index, length: m[0].length, trigger: m[1] as string, ...(m[2] ? { label: m[2] } : {}) });
  }
  return headers.sort((a, b) => a.index - b.index);
}

type KindResult = { kind: AbilityKind | "contents"; form?: "hero" | "alter-ego" };

function kindOf(trigger: string): KindResult {
  const form: "hero" | "alter-ego" | undefined = trigger.startsWith("Hero ")
    ? "hero"
    : trigger.startsWith("Alter-Ego ")
      ? "alter-ego"
      : undefined;
  const bare = trigger.replace(/^(Hero|Alter-Ego) /, "");
  const withForm = (kind: AbilityKind): KindResult => (form ? { kind, form } : { kind });
  switch (bare) {
    case "Action":
      return withForm("action");
    case "Resource":
      return withForm("resource");
    case "Response":
      return withForm("response");
    case "Interrupt":
      return withForm("interrupt");
    case "Forced Response":
      return withForm("forced-response");
    case "Forced Interrupt":
      return withForm("forced-interrupt");
    case "Special":
      return { kind: "special" };
    case "Setup":
      return { kind: "setup" };
    case "Boost":
      return { kind: "boost" };
    case "When Revealed":
      return { kind: "when-revealed" };
    case "When Revealed (Hero)":
      return { kind: "when-revealed-hero" };
    case "When Revealed (Alter-Ego)":
      return { kind: "when-revealed-alter-ego" };
    case "When Defeated":
      return { kind: "when-defeated" };
    case "Contents":
      return { kind: "contents" };
    default:
      throw new Error(`Unhandled trigger "${trigger}"`);
  }
}

/**
 * Sentence split that respects parentheses and dotted acronyms
 * ("S.H.I.E.L.D.", "M.O.D.O.K."): a sentence ends at `.`/`!` (or a closing
 * `)` at depth 0 that is followed by a capital) when followed by whitespace.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    const next = text[i + 1];
    const atBoundary = next === undefined || /\s/.test(next);
    if (!atBoundary || depth > 0) continue;
    const isAcronymDot = ch === "." && /[A-Z]/.test(text[i - 1] ?? "") && /[.\s]|^$/.test(text[i - 2] ?? "");
    const endsSentence =
      ((ch === "." || ch === "!") && !isAcronymDot) || (ch === ")" && /^\s+[A-Z[(•]/.test(text.slice(i + 1)));
    if (endsSentence || next === undefined) {
      const s = text.slice(start, i + 1).trim();
      if (s) out.push(s);
      start = i + 1;
    }
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  // A reminder parenthetical glued to the previous sentence ("Surge. (After …)")
  // was split off above; one that opens a sentence stays a separate reminder.
  return out;
}

const SIMPLE_KEYWORDS: Readonly<Record<string, KeywordInstance["name"]>> = {
  guard: "guard",
  toughness: "toughness",
  surge: "surge",
  quickstrike: "quickstrike",
  overkill: "overkill",
  peril: "peril",
  restricted: "restricted",
  permanent: "permanent",
  piercing: "piercing",
  ranged: "ranged",
  villainous: "villainous",
  stalwart: "stalwart",
  steady: "steady",
  patrol: "patrol",
  assault: "assault",
  temporary: "temporary",
  vulnerable: "vulnerable",
  alliance: "alliance",
  amplify: "amplify",
};

/** Keyword sentence, optionally followed by its own reminder text: `Surge (After …)`, `Retaliate 1. (After …)`. */
function parseKeyword(sentence: string): KeywordInstance | undefined {
  // `Uses (N type counters)` carries its parameter in parentheses, so match it
  // before reminder text is stripped.
  const uses = /^Uses \((\d+) ([\w\- ]+?) counters?\)\.?$/.exec(sentence);
  if (uses) return { name: "uses", count: Number(uses[1]), counterType: uses[2] as string };
  const s = sentence.replace(/\s*\([^)]*\)\.?$/, "").replace(/\.$/, "").trim();
  const simple = SIMPLE_KEYWORDS[s.toLowerCase()];
  if (simple) return { name: simple } as KeywordInstance;
  // "Setup." (keyword, card starts in play) vs "Setup:" (ability) — only the keyword reaches here.
  if (s === "Setup" && /^Setup\.?$/.test(sentence)) return { name: "setup" };
  const m = /^(Retaliate|Incite|Hinder|Victory) (\d+)$/.exec(s);
  if (m) {
    const name = (m[1] as string).toLowerCase() as "retaliate" | "incite" | "hinder" | "victory";
    return { name, value: Number(m[2]) };
  }
  return undefined;
}

function parseAttach(sentence: string, villainNames: ReadonlySet<string>): { host: AttachmentHost; villainName?: string } | undefined {
  const s = sentence.replace(/\.$/, "");
  const m = /^Attach to (.+)$/.exec(s);
  if (!m) return undefined;
  const target = m[1] as string;
  const simple: Readonly<Record<string, AttachmentHost>> = {
    "a minion": { kind: "minion" },
    "an enemy": { kind: "enemy" },
    "an ally": { kind: "ally" },
    "a hero": { kind: "hero" },
    "a character": { kind: "anyCharacter" },
    "the villain": { kind: "villain" },
    "the main scheme": { kind: "mainScheme" },
    "a side scheme": { kind: "sideScheme" },
  };
  const hit = simple[target];
  if (hit) return { host: hit };
  if (villainNames.has(target)) return { host: { kind: "villain" }, villainName: target };
  const highest = /^the minion with the highest printed hit points(?: and without another (.+) attached)?$/.exec(target);
  if (highest) {
    return {
      host: highest[1]
        ? { kind: "minionWithHighestPrintedHp", withoutAttachmentNamed: highest[1] }
        : { kind: "minionWithHighestPrintedHp" },
    };
  }
  const named = /^the (.+) (?:environment|side scheme|support|upgrade)$/.exec(target);
  if (named) return { host: { kind: "namedCard", name: named[1] as string } };
  return undefined;
}

interface MutableRestrictions {
  maxPerPlayer?: number;
  maxPerHost?: number;
  form?: "hero" | "alterEgo";
  anyPlayerControl?: boolean;
}

function parseRestriction(sentence: string, into: MutableRestrictions): { maxPerDeck?: number } | undefined {
  let m = /^Max (\d+) per deck\.$/.exec(sentence);
  if (m) return { maxPerDeck: Number(m[1]) };
  m = /^Max (\d+) per player\.$/.exec(sentence);
  if (m) {
    into.maxPerPlayer = Number(m[1]);
    return {};
  }
  m = /^Max (\d+) per (?:enemy|ally|minion|character|hero)\.$/.exec(sentence);
  if (m) {
    into.maxPerHost = Number(m[1]);
    return {};
  }
  if (/^Hero form only\.$/.test(sentence)) {
    into.form = "hero";
    return {};
  }
  if (/^Alter-Ego form only\.$/.test(sentence)) {
    into.form = "alterEgo";
    return {};
  }
  if (/^Play under any player's control\.$/.test(sentence)) {
    into.anyPlayerControl = true;
    return {};
  }
  return undefined;
}

const STAGE_LOSS_REMINDER = /^If this stage is completed, the players lose the game\.?$/;

export function parseCardText(text: string, options: ParseOptions): ParsedText {
  const keywords: KeywordInstance[] = [];
  const abilities: ParsedAbility[] = [];
  const restrictions: MutableRestrictions = {};
  const unclassified: string[] = [];
  let attachesTo: AttachmentHost | undefined;
  let attachesToVillainNamed: string | undefined;
  let maxPerDeckText: number | undefined;

  if (options.obligation) {
    if (text.trim()) abilities.push({ kind: "obligation", text });
    return { keywords, abilities, restrictions, unclassified };
  }

  for (const line of text.split("\n")) {
    const headers = findHeaders(line);
    const preamble = line.slice(0, headers[0]?.index ?? line.length).trim();

    // Preamble: keywords, reminders, restrictions, attach rules, constants.
    let constantBuffer: string[] = [];
    const flushConstant = () => {
      if (constantBuffer.length > 0) abilities.push({ kind: "constant", text: constantBuffer.join(" ") });
      constantBuffer = [];
    };
    for (const raw of splitSentences(preamble)) {
      const sentence = raw.replace(/^\[star\]\s*/, "");
      const keyword = parseKeyword(sentence);
      if (keyword) {
        flushConstant();
        keywords.push(keyword);
        continue;
      }
      if (/^\(.*\)\.?$/.test(sentence)) continue; // reminder text
      if (STAGE_LOSS_REMINDER.test(sentence)) continue;
      const restriction = parseRestriction(sentence, restrictions);
      if (restriction) {
        flushConstant();
        if (restriction.maxPerDeck !== undefined) maxPerDeckText = restriction.maxPerDeck;
        continue;
      }
      const attach = parseAttach(sentence, options.villainNames);
      if (attach) {
        flushConstant();
        if (attachesTo) unclassified.push(`second attach rule: ${sentence}`);
        attachesTo = attach.host;
        if (attach.villainName) attachesToVillainNamed = attach.villainName;
        continue;
      }
      if (/^Attach to /.test(sentence)) {
        unclassified.push(`unrecognized attach rule: ${sentence}`);
        continue;
      }
      constantBuffer.push(sentence);
    }
    flushConstant();

    // Triggered / structural abilities.
    headers.forEach((h, i) => {
      const end = headers[i + 1]?.index ?? line.length;
      const body = line.slice(h.index, end).trim();
      const { kind, form } = kindOf(h.trigger);
      if (kind === "contents") return; // informational scenario contents, not an ability
      // Final-stage loss reminder glued after an ability body is not part of the ability.
      abilities.push({
        kind,
        ...(form ? { form } : {}),
        ...(h.label ? { label: h.label as "attack" | "thwart" | "defense" } : {}),
        ...(h.name ? { name: h.name } : {}),
        text: body,
      });
    });
  }

  return {
    keywords,
    abilities,
    restrictions,
    ...(maxPerDeckText !== undefined ? { maxPerDeckText } : {}),
    ...(attachesTo ? { attachesTo } : {}),
    ...(attachesToVillainNamed ? { attachesToVillainNamed } : {}),
    unclassified,
  };
}

/**
 * Assigns `<cardCode>.<slug>` ids to one card face's abilities, resolving
 * collisions deterministically (see file header). `used` is shared across the
 * whole pack so ids are globally unique.
 */
export function assignAbilityIds(
  cardCode: string,
  cardName: string,
  abilities: readonly ParsedAbility[],
  used: Set<string>,
): { id: string; ability: ParsedAbility }[] {
  const cardSlug = slugify(cardName);
  const out: { id: string; ability: ParsedAbility }[] = [];
  for (const ability of abilities) {
    const candidates: string[] = [];
    if (ability.name) candidates.push(slugify(ability.name));
    else if (STRUCTURAL_KINDS.has(ability.kind)) candidates.push(ability.kind);
    else {
      candidates.push(`${cardSlug}-${ability.kind}`);
      if (ability.form) candidates.push(`${cardSlug}-${ability.form}-${ability.kind}`);
    }
    let id = candidates.map((c) => `${cardCode}.${c}`).find((c) => !used.has(c));
    if (id === undefined) {
      const base = `${cardCode}.${candidates[candidates.length - 1] as string}`;
      let n = 2;
      while (used.has(`${base}-${n}`)) n++;
      id = `${base}-${n}`;
    }
    used.add(id);
    out.push({ id, ability });
  }
  return out;
}
