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
import type { AttachmentHost, AttachmentHostCategory, HostMeasure, KeywordInstance, ResourceIconType, Trait } from "../../src/schema/index.ts";
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
  | "when-completed"
  | "obligation";

const STRUCTURAL_KINDS: ReadonlySet<AbilityKind> = new Set([
  "setup",
  "boost",
  "when-revealed",
  "when-revealed-hero",
  "when-revealed-alter-ego",
  "when-defeated",
  "when-completed",
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

/**
 * `PlayRestrictions` shape, but with trait fields left as plain uppercased strings — the parser has no access to
 * the schema's branding helpers at runtime under Node type-stripping (see `normalize.ts`'s own `brand` helper);
 * the caller brands them into `Trait` when building the card.
 */
export interface ParsedRestrictions {
  readonly maxPerPlayer?: number;
  readonly maxPerHost?: number;
  readonly form?: "hero" | "alterEgo";
  readonly anyPlayerControl?: boolean;
  readonly maxPerRound?: number;
  readonly requiresIdentityTrait?: string;
  readonly requiresControlledCharacterTrait?: string;
}

export interface ParsedText {
  readonly keywords: KeywordInstance[];
  readonly abilities: ParsedAbility[];
  readonly restrictions: ParsedRestrictions;
  /** Parsed "Max N per deck." — cross-checked against MarvelCDB `deck_limit`. */
  readonly maxPerDeckText?: number;
  readonly attachesTo?: AttachmentHost;
  /** Printed name inside "Attach to Rhino." — the caller checks it's the villain. */
  readonly attachesToVillainNamed?: string;
  /** "(<Hero>'s nemesis minion.)" reminder text (docs/phase7-wave1.md §1.7). */
  readonly nemesisMinion?: boolean;
  /** "<Villain>'s Side Scheme." (The Wrecking Crew's signature side schemes, docs/phase7-wave1.md §1.1). */
  readonly signatureOf?: string;
  readonly unclassified: string[];
}

export interface ParseOptions {
  /** Obligation cards are one whole-card ability; no sentence classification. */
  readonly obligation?: boolean;
  /** Names of villains in the pack, so "Attach to Rhino." maps to `{ kind: "villain" }`. */
  readonly villainNames: ReadonlySet<string>;
  /**
   * Whether *this scenario* puts several villains in play at once (docs/phase7-wave1.md §1.6 — The Wrecking
   * Crew), so "Attach to Wrecker." maps to `{ kind: "namedVillain" }` instead of the single-villain `{ kind:
   * "villain" }`. Not the same as "this pack contains more than one villain name" — Core's three scenarios each
   * have one villain, so its Rhino/Klaw/Ultron attachments stay `villain` even though the pack has three names.
   */
  readonly multipleVillains?: boolean;
}

const TRIGGER =
  String.raw`(?:(?:Hero |Alter-Ego )?(?:Forced )?(?:Action|Resource|Response|Interrupt)|Special|Setup|Boost|When Revealed(?: \((?:Hero|Alter-Ego)\))?|When Defeated|When Completed|Contents)`;
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
    case "When Completed":
      return { kind: "when-completed" };
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

/** A single "[icon]" resource token, as it survives `toPlainText` (docs/phase7-wave2.md). */
const RESOURCE_ICON_RE = /\[(energy|mental|physical|wild)\]/g;

/**
 * Keyword sentence, optionally followed by its own reminder text: `Surge (After …)`, `Retaliate 1. (After …)`.
 *
 * Team-Up and Teamwork are fully representable in the current schema (`KeywordInstance`'s `teamUp.names` and
 * `teamwork.sharedTrait`) and are resolved here. Requirement is only resolved when it names exactly one resource
 * icon (`icon: ResourceIconType`, singular) — every printed multi-icon Requirement (two of the same icon, or
 * several different icons) needs a schema shape this repo doesn't have yet (a count/list, not a single icon), so
 * `parseCardText` reports those explicitly rather than silently dropping the extra icons. Discount always needs a
 * target-trait qualifier that the current stub shape has no field for at all, so it is never resolved here; see
 * the same caller.
 */
function parseKeyword(sentence: string): KeywordInstance | undefined {
  // `Uses (N type counters)` carries its parameter in parentheses, so match it
  // before reminder text is stripped.
  const uses = /^Uses \((\d+) ([\w\- ]+?) counters?\)\.?$/.exec(sentence);
  if (uses) return { name: "uses", count: Number(uses[1]), counterType: uses[2] as string };
  const teamUp = /^Team-Up \((.+?) and (.+)\)\.?$/.exec(sentence);
  if (teamUp) return { name: "teamUp", names: [(teamUp[1] as string).trim(), (teamUp[2] as string).trim()] };
  const teamwork = /^Teamwork \((.+)\)\.?$/.exec(sentence);
  if (teamwork) return { name: "teamwork", sharedTrait: (teamwork[1] as string).trim().toUpperCase() as Trait };
  const requirement = /^Requirement \(((?:\[(?:energy|mental|physical|wild)\])+)\)\.?$/.exec(sentence);
  if (requirement) {
    const icons = [...(requirement[1] as string).matchAll(RESOURCE_ICON_RE)].map((mm) => mm[1] as ResourceIconType);
    if (icons.length === 1) return { name: "requirement", icon: icons[0] as ResourceIconType };
    return undefined; // multi-icon: reported by parseCardText, see doc comment above.
  }
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

/**
 * Wave 1 attachment host phrasing (docs/phase7-wave1.md §1.6, extended for wave 2 — docs/phase7-wave2-data.md
 * §"attachment hosts"). `villainNames.size > 1` means several villains are in play at once (The Wrecking Crew),
 * so a named villain becomes `namedVillain` rather than the single-villain `villain` kind ("Attach to Green
 * Goblin." stays `villain` when there is only one villain — Green Goblin insert's Hysteria).
 *
 * Every branch below resolves to a host kind the schema already has (`AttachmentHost`, `HostQualifiers`,
 * `SuperlativeHostPool`/`HostMeasure`) — nothing here is a new shape. A sentence with a *trailing behavioral
 * clause* on the same sentence ("...and give it a tough status card.", "...and exhaust it.") is deliberately left
 * unresolved: the clause is a card effect, not part of the host, and this parser only ever decides *where
 * abilities are* (file header) — it must not fabricate a host that drops half a printed sentence. Likewise a
 * *conditional/fallback* host ("Attach to X, if able. If you cannot, attach to Y.", "...Otherwise, attach to the
 * villain.") is left unresolved rather than resolved to just the primary target: `AttachmentHost` has no
 * "try this, else that" shape, so silently keeping only the primary would make the card work only part of the
 * time it should. `parseCardText` reports both sentences of a detected fallback pair explicitly (see below) so
 * this doesn't read as ordinary unclassified text.
 */
function parseAttach(
  sentence: string,
  villainNames: ReadonlySet<string>,
  multiVillain: boolean,
): { host: AttachmentHost; villainName?: string } | undefined {
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
    "a scheme": { kind: "scheme" },
    // MarvelCDB overwhelmingly prints "Attach to your identity." (no "card") from wave 2 on; the Phase 2/wave 1
    // "your identity card" phrasing is kept too, in case an older pack uses it verbatim.
    "your identity card": { kind: "yourIdentity" },
    "your identity": { kind: "yourIdentity" },
    "your hero": { kind: "yourIdentity", form: "hero" },
    "your alter-ego": { kind: "yourIdentity", form: "alterEgo" },
    "a friendly character": { kind: "friendlyCharacter" },
    "the active villain's side scheme": { kind: "villainSideScheme", of: "activeVillain" },
  };
  // Case-insensitive on the phrase itself (MarvelCDB is inconsistent — "Attach to the Villain." in `trors`);
  // proper names below stay case-sensitive.
  const hit = simple[target.toLowerCase()];
  if (hit) return { host: hit };
  if (villainNames.has(target)) {
    return multiVillain ? { host: { kind: "namedVillain", name: target }, villainName: target } : { host: { kind: "villain" }, villainName: target };
  }
  // "Attach to Kang." (`toafk`): the villain's own printed name always carries a parenthetical form/stage
  // ("Kang (The Conqueror)"), which reminder text never repeats. Only meaningful for a single-villain pack — the
  // resolved `namedVillain` on a multi-villain one would still need the full per-stage name to match at runtime
  // (`currentName(...) === host.name`, `packages/engine/src/resolve/reveal.ts`), which no surveyed pack needs.
  const shortNameOf = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (!multiVillain) {
    const villainShortMatch = [...villainNames].find((name) => shortNameOf(name) === target);
    if (villainShortMatch) return { host: { kind: "villain" }, villainName: villainShortMatch };
  }
  const highest = /^the minion with the highest printed hit points(?: and without another (.+) attached)?$/.exec(target);
  if (highest) {
    return {
      host: highest[1]
        ? { kind: "minionWithHighestPrintedHp", withoutAttachmentNamed: highest[1] }
        : { kind: "minionWithHighestPrintedHp" },
    };
  }
  const superlativeEnemyHp = /^the enemy with the highest printed hit points(?: and without another (.+) attached)?$/.exec(target);
  if (superlativeEnemyHp) {
    return {
      host: {
        kind: "superlative",
        among: "enemy",
        order: "highest",
        measure: "printedHp",
        ...(superlativeEnemyHp[1] ? { withoutAttachmentNamed: superlativeEnemyHp[1] } : {}),
      },
    };
  }
  // Trait-qualified / negated category: "an Avenger ally", "a non-ELITE minion", "a Sentinel minion without
  // Energy Barrier attached" (`HostQualifiers.trait` / `withoutTrait` / `withoutAttachmentNamed`). Anchored at
  // the end of the sentence, so a trailing behavioral clause ("...and give it a tough status card") correctly
  // fails to match rather than being silently dropped.
  const qualifiedRe =
    /^(?:an?|the) (non-)?(.+?) (ally|minion|enemy|character|friendly character)(?:\s+(?:and\s+)?without (?:a copy of |another copy of |another )?(.+?) attached)?$/i;
  const qualified = qualifiedRe.exec(target);
  if (qualified) {
    const negated = Boolean(qualified[1]);
    const trait = (qualified[2] as string).trim().toUpperCase() as Trait;
    const categoryWord = (qualified[3] as string).toLowerCase();
    const category = categoryWord === "friendly character" ? "friendlyCharacter" : categoryWord;
    const withoutAttachmentNamed = qualified[4]?.trim();
    return {
      host: {
        kind: "qualified",
        category: category as AttachmentHostCategory,
        ...(negated ? { withoutTrait: trait } : { trait }),
        ...(withoutAttachmentNamed ? { withoutAttachmentNamed } : {}),
      },
    };
  }
  // Superlative over a named pool: "the minion with the most remaining hit points without another copy of X
  // attached", "the enemy with the highest ATK", "the villain with the fewest hit points without the Aerial
  // trait". A descriptor this doesn't recognize (e.g. "highest activation order value", "most traits") is a
  // `HostMeasure` the schema doesn't have — this returns `undefined` rather than guessing at a measure.
  let supRest = target;
  let supWithoutAttachmentNamed: string | undefined;
  let supWithoutTrait: string | undefined;
  const namedSuffix = /^(.*?)\s+(?:and\s+)?without (?:a copy of |another copy of |another )?(.+?) attached$/i.exec(supRest);
  if (namedSuffix) {
    supRest = namedSuffix[1] as string;
    supWithoutAttachmentNamed = (namedSuffix[2] as string).trim();
  } else {
    const traitSuffix = /^(.*?)\s+(?:and\s+)?without the (.+?) trait$/i.exec(supRest);
    if (traitSuffix) {
      supRest = traitSuffix[1] as string;
      supWithoutTrait = (traitSuffix[2] as string).trim();
    }
  }
  const supCore = /^(?:the|a) (minion|enemy|villain|friendly character) with the (highest|lowest|most|fewest) (.+)$/i.exec(supRest);
  if (supCore) {
    const poolWord = (supCore[1] as string).toLowerCase();
    const among = poolWord === "friendly character" ? "friendlyCharacter" : (poolWord as "minion" | "enemy" | "villain");
    const orderWord = (supCore[2] as string).toLowerCase();
    const order: "highest" | "lowest" = orderWord === "highest" || orderWord === "most" ? "highest" : "lowest";
    const descriptor = (supCore[3] as string).trim().toLowerCase();
    const measure: HostMeasure | undefined =
      descriptor === "printed hit points"
        ? "printedHp"
        : descriptor === "hit points" || descriptor === "remaining hit points"
          ? "remainingHp"
          : descriptor === "printed atk"
            ? "printedAtk"
            : descriptor === "atk"
              ? "atk"
              : descriptor === "sch"
                ? "sch"
                : undefined;
    if (measure) {
      return {
        host: {
          kind: "superlative",
          among,
          order,
          measure,
          ...(supWithoutTrait ? { withoutTrait: supWithoutTrait.toUpperCase() as Trait } : {}),
          ...(supWithoutAttachmentNamed ? { withoutAttachmentNamed: supWithoutAttachmentNamed } : {}),
        },
      };
    }
  }
  const named = /^the (.+) (?:environment|side scheme|support|upgrade)$/.exec(target);
  if (named) return { host: { kind: "namedCard", name: named[1] as string } };
  // A bare proper name not covered above ("Attach to Ahab.", "Attach to Vision.") — the generic named-card host
  // (`AttachmentHost.namedCard`'s doc comment: any in-play card with that exact printed name, not only
  // environments). Only when the target has no leading article ("a"/"an"/"the"/"your") and starts with a capital
  // letter, so this can't swallow an unrecognized common-noun phrase ("an identity-specific ally you control", "a
  // card with \"Spider\" in its title", "an enemy or scheme") that needs a real schema shape instead.
  if (/^[A-Z]/.test(target) && !/^(?:a|an|the|your)\b/.test(target)) {
    return { host: { kind: "namedCard", name: target } };
  }
  return undefined;
}

interface MutableRestrictions {
  maxPerPlayer?: number;
  maxPerHost?: number;
  form?: "hero" | "alterEgo";
  anyPlayerControl?: boolean;
  maxPerRound?: number;
  /** Plain uppercased trait text; the caller brands it as a `Trait`. */
  requiresIdentityTrait?: string;
  requiresControlledCharacterTrait?: string;
}

/** Wave 1 play restrictions (docs/phase7-wave1.md §1.8), in addition to the Phase 2 shapes above. */
function parseRestriction(sentence: string, into: MutableRestrictions): { maxPerDeck?: number } | undefined {
  let m = /^Max (\d+) per deck\.$/.exec(sentence);
  if (m) return { maxPerDeck: Number(m[1]) };
  m = /^Max (\d+) per player\.$/.exec(sentence);
  if (m) {
    into.maxPerPlayer = Number(m[1]);
    return {};
  }
  m = /^Max (\d+) per round\.$/.exec(sentence);
  if (m) {
    into.maxPerRound = Number(m[1]);
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
  m = /^Play only if your identity has the (.+) trait\.$/.exec(sentence);
  if (m) {
    into.requiresIdentityTrait = m[1] as string;
    return {};
  }
  m = /^Play only if you have the (.+) trait\.$/.exec(sentence);
  if (m) {
    into.requiresIdentityTrait = m[1] as string;
    return {};
  }
  m = /^Play only if you control an? (.+) character\.$/.exec(sentence);
  if (m) {
    into.requiresControlledCharacterTrait = m[1] as string;
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
  let nemesisMinion: boolean | undefined;
  let signatureOf: string | undefined;

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
    const sentences = splitSentences(preamble);
    for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex++) {
      const raw = sentences[sentenceIndex] as string;
      const sentence = raw.replace(/^\[star\]\s*/, "");
      // A fallback attach host spans two sentences: "Attach to X[, if able]." + "Otherwise, attach to Y."/"If
      // you cannot, attach to Y." (`AttachmentHost.ifAble`, wave 2, docs/phase7-wave2.md §1.7). Only when the
      // *continuation* itself is another attach directive — "Otherwise, this card gains surge."/"If you
      // cannot, this card gains surge." (Genetic Experiments, Defensive Programming) is a plain fallback
      // *effect*, not a fallback host: the primary sentence resolves on its own below, and the continuation
      // falls through to ordinary constant/ability text.
      if (/^Attach to /.test(sentence)) {
        const next = sentences[sentenceIndex + 1];
        const continuation = next ? /^(?:Otherwise|If you cannot),?\s*(.+)$/i.exec(next) : null;
        const otherwiseAttach = continuation ? /^attach to (.+)$/i.exec(continuation[1] as string) : null;
        if (continuation && otherwiseAttach) {
          flushConstant();
          const preferredSentence = sentence.replace(/,\s*if able\.?$/i, ".");
          const preferred = parseAttach(preferredSentence, options.villainNames, options.multipleVillains ?? false);
          const otherwise = parseAttach(`Attach to ${otherwiseAttach[1] as string}`, options.villainNames, options.multipleVillains ?? false);
          if (preferred && otherwise) {
            if (attachesTo) unclassified.push(`second attach rule: ${sentence}`);
            attachesTo = { kind: "ifAble", preferred: preferred.host, otherwise: otherwise.host };
            if (preferred.villainName) attachesToVillainNamed = preferred.villainName;
          } else {
            unclassified.push(`ifAble attach host: could not parse ${preferred ? "the fallback" : "the preferred"} side: "${sentence}" / "${next}"`);
          }
          sentenceIndex++; // consume the fallback sentence too
          continue;
        }
      }
      const keyword = parseKeyword(sentence);
      if (keyword) {
        flushConstant();
        keywords.push(keyword);
        continue;
      }
      if (/^\(.+ nemesis minion\.\)$/i.test(sentence)) {
        nemesisMinion = true;
        continue;
      }
      if (/^\(.*\)\.?$/.test(sentence)) continue; // reminder text
      if (STAGE_LOSS_REMINDER.test(sentence)) continue;
      // Requirement/Discount that `parseKeyword` didn't fully resolve are real schema gaps (see its doc comment),
      // not plain text — report them explicitly rather than letting them fall into the constant-text buffer below.
      if (/^Requirement \(/.test(sentence)) {
        unclassified.push(`Requirement keyword needs more than one resource icon (schema only has a single "icon" field): ${sentence}`);
        continue;
      }
      if (/^Discount \d+ \(/.test(sentence)) {
        unclassified.push(`Discount keyword needs a target-trait qualifier (schema only has "value", no trait field): ${sentence}`);
        continue;
      }
      const restriction = parseRestriction(sentence, restrictions);
      if (restriction) {
        flushConstant();
        if (restriction.maxPerDeck !== undefined) maxPerDeckText = restriction.maxPerDeck;
        continue;
      }
      const attach = parseAttach(sentence, options.villainNames, options.multipleVillains ?? false);
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
      // "Wrecker's Side Scheme." names which villain this is the signature side scheme of. It stays part of the
      // card's printed text/ability (it is not stripped like a keyword or restriction line) — only the villain
      // name is captured separately.
      const signature = /^(.+)'s Side Scheme\.$/.exec(sentence);
      if (signature) signatureOf = signature[1] as string;
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
    ...(nemesisMinion ? { nemesisMinion } : {}),
    ...(signatureOf ? { signatureOf } : {}),
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
