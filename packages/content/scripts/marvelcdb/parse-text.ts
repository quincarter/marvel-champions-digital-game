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
import type {
  AttachmentHost,
  AttachmentHostCategory,
  HostMeasure,
  KeywordInstance,
  ResourceIconCounts,
  ResourceIconType,
  Trait,
} from "../../src/schema/index.ts";
import { slugify } from "./text.ts";

export type AbilityKind =
  | "action"
  | "resource"
  | "response"
  | "interrupt"
  | "forced-action"
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

const TRIGGER = String.raw`(?:(?:Hero |Alter-Ego )?(?:Forced )?(?:Action|Resource|Response|Interrupt)|Special|Setup|Boost|When Revealed(?: \((?:Hero|Alter-Ego)\))?|When Defeated|When Completed|Contents)`;
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
    case "Forced Action":
      return withForm("forced-action");
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
  // docs/phase7-wave2.md §7.5: "Starting. (You may add this card to your hand before drawing your starting
  // hand.)" (Innate Reflexes 60038, `fne`; Innate Aggression/Perception/Inspiration 61034/61036/61037, `jj`) —
  // data only, no pre-opening-draw step in the engine yet.
  starting: "starting",
};

/** A single "[icon]" resource token, as it survives `toPlainText` (docs/phase7-wave2.md). */
const RESOURCE_ICON_RE = /\[(energy|mental|physical|wild)\]/g;

/**
 * Keyword sentence, optionally followed by its own reminder text: `Surge (After …)`, `Retaliate 1. (After …)`.
 *
 * Team-Up and Teamwork are fully representable in the current schema (`KeywordInstance`'s `teamUp.names` and
 * `teamwork.sharedTrait`) and are resolved here. Requirement counts every printed icon (repeats included) into
 * `resources: ResourceIconCounts`; a single icon still resolves to the wave 1 `icon` field for exactly one match
 * (docs/phase7-wave2.md §6.1). Discount resolves to `{ value, traits }`, an OR of every named trait
 * (docs/phase7-wave2.md §6.2).
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
  // RRG 1.8 "Linked (Card Title)" (p. 27): "Cards with the linked keyword cannot be included in a player's deck.
  // Instead, they are brought into the game by the card title in the parentheses following the keyword." A bare
  // `Linked.` (no title — none observed yet) still resolves, with `cardTitle` left unset.
  const linked = /^Linked(?: \((.+)\))?\.?$/.exec(sentence);
  if (linked)
    return { name: "linked", ...(linked[1] !== undefined ? { cardTitle: (linked[1] as string).trim() } : {}) };
  const requirement = /^Requirement \(((?:\[(?:energy|mental|physical|wild)\])+)\)\.?$/.exec(sentence);
  if (requirement) {
    const icons = [...(requirement[1] as string).matchAll(RESOURCE_ICON_RE)].map((mm) => mm[1] as ResourceIconType);
    if (icons.length === 1) return { name: "requirement", icon: icons[0] as ResourceIconType };
    // Wave 2 (docs/phase7-wave2.md §6.1): several icons (repeats included) — `resources` counts each printed icon.
    // `Requirement ([mental][mental])` → `{ mental: 2 }`; `Requirement ([energy][mental][physical])` → one each.
    const resources: { -readonly [K in ResourceIconType]?: number } = {};
    for (const icon of icons) resources[icon] = (resources[icon] ?? 0) + 1;
    return { name: "requirement", resources: resources as ResourceIconCounts };
  }
  // Wave 2 (docs/phase7-wave2.md §6.2): "Discount N (T)." / "Discount N (T1 or T2)." — the Fear No Evil rulebook,
  // "Featured Keywords" (p. 3). `traits` is an OR: at least one trait is listed.
  const discount = /^Discount (\d+) \((.+)\)\.?$/.exec(sentence);
  if (discount) {
    const traits = (discount[2] as string).split(/\s+or\s+/).map((t) => t.trim().toUpperCase() as Trait);
    return { name: "discount", value: Number(discount[1]), traits };
  }
  // docs/phase7-wave2.md §7.5, §7.7: "Prerequisite (T)." / "Prerequisite (T1 or T2)." — Defend Our City (61029,
  // `jj`): "Prerequisite (Defender)." `traits` is an OR, spelled like `discount`'s. No emitted card prints the
  // "form" half yet ("Prerequisite (hero form)." / "Prerequisite (alter-ego form)."), so that's recognized too,
  // on the strength of the rulebook's own "form or trait" phrasing, but unconfirmed against a printed card.
  const prerequisite = /^Prerequisite \((.+)\)\.?$/.exec(sentence);
  if (prerequisite) {
    const inner = (prerequisite[1] as string).trim();
    const formMatch = /^(hero|alter-ego) form$/i.exec(inner);
    if (formMatch)
      return { name: "prerequisite", form: (formMatch[1] as string).toLowerCase() === "hero" ? "hero" : "alterEgo" };
    const traits = inner.split(/\s+or\s+/).map((t) => t.trim().toUpperCase() as Trait);
    return { name: "prerequisite", traits };
  }
  const s = sentence
    .replace(/\s*\([^)]*\)\.?$/, "")
    .replace(/\.$/, "")
    .trim();
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
    // Wave 2 schema pass (docs/phase7-wave2.md §6.3, §6.8): "the enemy leader" / "your leader" (Civil War); "the
    // villain who is not the active villain" (Direct Assault, `mts`).
    "the enemy leader": { kind: "leader", of: "enemy" },
    "your leader": { kind: "leader", of: "yours" },
    "the villain who is not the active villain": { kind: "nonActiveVillain" },
    // docs/phase7-wave2.md §7.2: "Attach to an encounter card in play." (Coordinated Effort 58032) — any card in
    // play on the encounter side, whatever its type, as opposed to a specific category.
    "an encounter card in play": { kind: "encounterCard" },
  };
  // Case-insensitive on the phrase itself (MarvelCDB is inconsistent — "Attach to the Villain." in `trors`);
  // proper names below stay case-sensitive.
  const hit = simple[target.toLowerCase()];
  if (hit) return { host: hit };
  // "Attach to your Iron Man leader." / "Attach to your She-Hulk leader." (Civil War, Synthezoid): the printed
  // name is redundant — a player controls at most one leader — so this is the same host as the bare "your leader".
  if (/^your .+ leader$/i.test(target)) return { host: { kind: "leader", of: "yours" } };
  // "Attach to an ally you control." — allies are always player-controlled (no such thing as an enemy ally), so
  // "you control" is a redundant qualifier here, unlike on a minion/enemy/character where it would matter.
  if (/^an? ally you control$/i.test(target)) return { host: { kind: "ally" } };
  // "Attach to the Avatar of Loki villain." — the villain's own printed name, with a redundant trailing "villain"
  // category word (unlike the bare "Attach to <Name>." form already handled by the `villainNames` check below).
  const namedVillainSuffix = /^the (.+) villain$/i.exec(target);
  if (namedVillainSuffix) {
    const name = namedVillainSuffix[1] as string;
    if (villainNames.has(name))
      return multiVillain
        ? { host: { kind: "namedVillain", name }, villainName: name }
        : { host: { kind: "villain" }, villainName: name };
  }
  // Wave 2 schema pass (docs/phase7-wave2.md §6.6): an OR of two hosts, every candidate of each once. Tried before
  // the villain-name/qualified/superlative checks below, since "X or Y" would otherwise fail every single-host
  // pattern on the whole phrase. " or " never appears inside those single-host phrases themselves (a trait name
  // never contains the standalone word "or"), so a literal split is safe.
  const orParts = target.split(/\s+or\s+/i);
  if (orParts.length === 2) {
    // "an X-FORCE or X-MEN ally": two trait-qualified hosts sharing one trailing category noun.
    const sharedCategory = /^(?:an?|the) (.+?) or (.+?) (ally|minion|enemy|character|friendly character)$/i.exec(
      target,
    );
    if (sharedCategory) {
      const categoryWord = (sharedCategory[3] as string).toLowerCase();
      const category = (
        categoryWord === "friendly character" ? "friendlyCharacter" : categoryWord
      ) as AttachmentHostCategory;
      const h1: AttachmentHost = {
        kind: "qualified",
        category,
        trait: (sharedCategory[1] as string).trim().toUpperCase() as Trait,
      };
      const h2: AttachmentHost = {
        kind: "qualified",
        category,
        trait: (sharedCategory[2] as string).trim().toUpperCase() as Trait,
      };
      return { host: { kind: "anyOf", hosts: [h1, h2] } };
    }
    // Otherwise each half resolves independently: a plain category ("an enemy or scheme") or a proper name
    // ("Greycrow or Harpoon").
    const resolveHalf = (part: string): AttachmentHost | undefined => {
      const p = part.trim();
      const bySimple = simple[p.toLowerCase()] ?? simple[`a ${p.toLowerCase()}`] ?? simple[`an ${p.toLowerCase()}`];
      if (bySimple) return bySimple;
      if (/^[A-Z]/.test(p) && !/^(?:a|an|the|your)\b/.test(p)) return { kind: "namedCard", name: p };
      return undefined;
    };
    const h1 = resolveHalf(orParts[0] as string);
    const h2 = resolveHalf(orParts[1] as string);
    if (h1 && h2) return { host: { kind: "anyOf", hosts: [h1, h2] } };
  }
  if (villainNames.has(target)) {
    return multiVillain
      ? { host: { kind: "namedVillain", name: target }, villainName: target }
      : { host: { kind: "villain" }, villainName: target };
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
  const highest = /^the minion with the highest printed hit points(?: and without another (.+) attached)?$/.exec(
    target,
  );
  if (highest) {
    return {
      host: highest[1]
        ? { kind: "minionWithHighestPrintedHp", withoutAttachmentNamed: highest[1] }
        : { kind: "minionWithHighestPrintedHp" },
    };
  }
  const superlativeEnemyHp =
    /^the enemy with the highest printed hit points(?: and without another (.+) attached)?$/.exec(target);
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
  // A plain category with only a "without X attached" suffix and no trait word at all: "an enemy without a copy
  // of Adamantium Upgrades attached" (Wolverine). Tried before the trait-qualified pattern below, since that
  // pattern requires a word between the article and the category noun and would otherwise never match here.
  const CATEGORY_NOUN = "ally|minion|enemy|character|friendly character|side scheme";
  const bareWithoutRe = new RegExp(
    `^(?:an?|the) (${CATEGORY_NOUN})\\s+(?:and\\s+)?without (?:a copy of |another copy of |another )?(.+?) attached$`,
    "i",
  );
  const bareWithout = bareWithoutRe.exec(target);
  if (bareWithout) {
    const categoryWord = (bareWithout[1] as string).toLowerCase();
    const category =
      categoryWord === "friendly character"
        ? "friendlyCharacter"
        : categoryWord === "side scheme"
          ? "sideScheme"
          : categoryWord;
    return {
      host: {
        kind: "qualified",
        category: category as AttachmentHostCategory,
        withoutAttachmentNamed: (bareWithout[2] as string).trim(),
      },
    };
  }
  // Trait-qualified / negated category: "an Avenger ally", "a non-ELITE minion", "a non-permanent side scheme",
  // "a Sentinel minion without Energy Barrier attached" (`HostQualifiers.trait` / `withoutTrait` /
  // `withoutAttachmentNamed`). Anchored at the end of the sentence, so a trailing behavioral clause ("...and give
  // it a tough status card") correctly fails to match rather than being silently dropped.
  const qualifiedRe = new RegExp(
    `^(?:an?|the) (non-)?(.+?) (${CATEGORY_NOUN})(?:\\s+(?:and\\s+)?without (?:a copy of |another copy of |another )?(.+?) attached)?$`,
    "i",
  );
  const qualified = qualifiedRe.exec(target);
  if (qualified) {
    const negated = Boolean(qualified[1]);
    const word = (qualified[2] as string).trim();
    const categoryWord = (qualified[3] as string).toLowerCase();
    const category =
      categoryWord === "friendly character"
        ? "friendlyCharacter"
        : categoryWord === "side scheme"
          ? "sideScheme"
          : categoryWord;
    const withoutAttachmentNamed = qualified[4]?.trim();
    // Wave 2 (docs/phase7-wave2.md §6.5): "a non-permanent side scheme" — the qualifying word is a keyword
    // (Permanent is a keyword, not a trait), not a trait, so it becomes `withoutKeyword`/`keyword` instead.
    const keywordName = SIMPLE_KEYWORDS[word.toLowerCase()];
    return {
      host: {
        kind: "qualified",
        category: category as AttachmentHostCategory,
        ...(keywordName
          ? negated
            ? { withoutKeyword: keywordName }
            : { keyword: keywordName }
          : negated
            ? { withoutTrait: word.toUpperCase() as Trait }
            : { trait: word.toUpperCase() as Trait }),
        ...(withoutAttachmentNamed ? { withoutAttachmentNamed } : {}),
      },
    };
  }
  // docs/phase7-wave2.md §7.3: "a character with 'Spider' in its title" (Warrior of the Great Web, 30029) — a
  // substring of the title, not a trait. MarvelCDB prints the quoted substring with double quotes.
  const titleContains = /^a character with "(.+)" in its title$/i.exec(target);
  if (titleContains) {
    return { host: { kind: "qualified", category: "character", titleContains: titleContains[1] as string } };
  }
  // docs/phase7-wave2.md §7.4: "an enemy that A or B attacked this turn" (Puncture Wound, 43012) — data only (the
  // engine records no per-turn attack history yet), but still parsed into the real shape rather than left
  // unclassified, so the card's data is correct and only its playability is gated (docs/phase7-wave1.md §3.1).
  const attackedThisTurn = /^an enemy that (.+) attacked this turn$/i.exec(target);
  if (attackedThisTurn) {
    const names = (attackedThisTurn[1] as string).split(/\s+or\s+/).map((n) => n.trim());
    return { host: { kind: "qualified", category: "enemy", attackedThisTurnBy: names } };
  }
  // Superlative over a named pool: "the minion with the most remaining hit points without another copy of X
  // attached", "the enemy with the highest ATK", "the villain with the fewest hit points without the Aerial
  // trait". A descriptor this doesn't recognize (e.g. "highest activation order value", "most traits") is a
  // `HostMeasure` the schema doesn't have — this returns `undefined` rather than guessing at a measure.
  let supRest = target;
  let supWithoutAttachmentNamed: string | undefined;
  let supWithoutTrait: string | undefined;
  const namedSuffix = /^(.*?)\s+(?:and\s+)?without (?:a copy of |another copy of |another )?(.+?) attached$/i.exec(
    supRest,
  );
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
  const supCore =
    /^(?:the|a) (minion|enemy|villain|friendly character|ally) with the (highest|lowest|most|fewest) (.+)$/i.exec(
      supRest,
    );
  if (supCore) {
    const poolWord = (supCore[1] as string).toLowerCase();
    const among =
      poolWord === "friendly character" ? "friendlyCharacter" : (poolWord as "minion" | "enemy" | "villain" | "ally");
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
                : // "the ally with the lowest THW without Possessed attached" (Possessed, `storm` 36038) — the
                  // card's printed THW, the `thw` counterpart of `printedAtk`/`printedCost` (docs/
                  // phase7-wave2-data.md Part 4/5 §5 item 2b, landed as `HostMeasure "thw"`).
                  descriptor === "thw"
                  ? "thw"
                  : // Wave 2 (docs/phase7-wave2.md §6.7): "the villain with the highest activation order value" (The
                    // Sinister Six), "the minion with the most traits" (Cyborg Tech).
                    descriptor === "activation order value"
                    ? "activationOrder"
                    : descriptor === "traits"
                      ? "traitCount"
                      : // docs/phase7-wave2.md §7.1: "the ally with the highest cost" (Beguiled 25031, 'Pool-ized 44041) —
                        // the card's *printed* cost (RRG 1.8 "Printed", p. 35), named `printedCost` like
                        // `printedHp`/`printedAtk` are, not `cost` (a card in play has no other cost).
                        descriptor === "cost"
                        ? "printedCost"
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
  // docs/phase7-wave2.md §7.2: "Max 1 per encounter card." (Coordinated Effort, 58032) — the second sentence of
  // its printed pair with "Attach to an encounter card in play.".
  m = /^Max (\d+) per (?:enemy|ally|minion|character|hero|encounter card)\.$/.exec(sentence);
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
  // "Play only if you are in Giant hero form." (Giant Stomp; Hive Mind, "Tiny"): the trait is printed on that hero
  // face only, so this is hero form plus the identity trait (PlayRestrictions docblock, docs/phase7-wave2.md §1.3).
  m = /^Play only if you are in (.+) hero form\.$/.exec(sentence);
  if (m) {
    into.form = "hero";
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
    const lines = text.split("\n");
    const allHeaders = lines.flatMap((oline) => findHeaders(oline).map((h) => ({ ...h, oline })));

    // A persistent constant clause (no formal trigger header at all) printed alongside exactly one triggered
    // clause under a single obligation (Martial Law `trors` 04165 "Your hand size is reduced by 1.\nAlter-Ego
    // Action: ...", Anti-Hero Propaganda `trors` 04166, Depowered `toafk` 11020, Fear of Kang `toafk` 11049): an
    // `AbilityDefinition` carries exactly one `AbilityTriggerSpec`, so the constant clause needs its own
    // `-constant` ref beside the triggered clause's own ref (docs/phase7-wave2-data.md "Part 8" — 11020/11049's
    // original split, now generalized here instead of hand-edited per card). This *replaces* the whole-text
    // catchall rather than adding to it, unlike the >=2-header shape below: there is no coherent "whole text"
    // ref left to keep once one of the two clauses isn't a formal trigger at all. Detected structurally — every
    // line before the first header carries none — not by card name, so any future obligation of this exact shape
    // gets the same split for free.
    const preambleLines: string[] = [];
    for (const oline of lines) {
      if (findHeaders(oline).length > 0) break;
      if (oline.trim()) preambleLines.push(oline.trim());
    }
    const [h] = allHeaders;
    if (preambleLines.length > 0 && allHeaders.length === 1 && h) {
      const { kind: hkind, form } = kindOf(h.trigger);
      if (hkind !== "contents") {
        abilities.push({ kind: "constant", text: preambleLines.join(" ") });
        abilities.push({
          kind: hkind,
          ...(form ? { form } : {}),
          ...(h.label ? { label: h.label as "attack" | "thwart" | "defense" } : {}),
          ...(h.name ? { name: h.name } : {}),
          text: h.oline.slice(h.index).trim(),
        });
        return { keywords, abilities, restrictions, unclassified };
      }
    }

    if (text.trim()) abilities.push({ kind: "obligation", text });
    // ADDITIVE, only when the printed text carries two or more distinct formal trigger headers (Kang's four
    // Temporal obligations — Weakened 11018 "Forced Response: After you use a basic hero power, take 1 damage.
    // / Alter-Ego Action: Discard a [physical] resource from your hand → discard this obligation." —
    // docs/phase7-wave2-scripting.md §7/§8): every printed trigger gets its own ref, alongside the existing
    // whole-card `obligation` ref above (kept exactly as before, so no existing ref id moves). An obligation
    // with zero or one header (the overwhelming majority of the corpus) is untouched — this only fires for the
    // genuinely-merged-triggers shape, not every obligation, so it doesn't multiply refs pack-wide for no reason.
    if (allHeaders.length >= 2) {
      for (const oline of lines) {
        const oheaders = findHeaders(oline);
        oheaders.forEach((h, i) => {
          const oend = oheaders[i + 1]?.index ?? oline.length;
          const obody = oline.slice(h.index, oend).trim();
          const { kind: hkind, form } = kindOf(h.trigger);
          if (hkind === "contents") return;
          abilities.push({
            kind: hkind,
            ...(form ? { form } : {}),
            ...(h.label ? { label: h.label as "attack" | "thwart" | "defense" } : {}),
            ...(h.name ? { name: h.name } : {}),
            text: obody,
          });
        });
      }
    }
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
      if (sentence.startsWith("Attach to ")) {
        const next = sentences[sentenceIndex + 1];
        const continuation = next ? /^(?:Otherwise|If you cannot),?\s*(.+)$/i.exec(next) : null;
        const otherwiseAttach = continuation ? /^attach to (.+)$/i.exec(continuation[1] as string) : null;
        if (continuation && otherwiseAttach) {
          flushConstant();
          const preferredSentence = sentence.replace(/,\s*if able\.?$/i, ".");
          const preferred = parseAttach(preferredSentence, options.villainNames, options.multipleVillains ?? false);
          const otherwise = parseAttach(
            `Attach to ${otherwiseAttach[1] as string}`,
            options.villainNames,
            options.multipleVillains ?? false,
          );
          if (preferred && otherwise) {
            if (attachesTo) unclassified.push(`second attach rule: ${sentence}`);
            attachesTo = { kind: "ifAble", preferred: preferred.host, otherwise: otherwise.host };
            if (preferred.villainName) attachesToVillainNamed = preferred.villainName;
          } else {
            unclassified.push(
              `ifAble attach host: could not parse ${preferred ? "the fallback" : "the preferred"} side: "${sentence}" / "${next}"`,
            );
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
      if (sentence.startsWith("Attach to ")) {
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
      // An attach rule can print as a triggered ability's own opening sentence instead of the preamble —
      // "When Revealed: Attach to the ally with the highest cost without Beguiled attached. Attached ally
      // engages its controller. Otherwise, this card gains surge." (Beguiled `valk` 25031, 'Pool-ized
      // `deadpool` 44041, Possessed `storm` 36038, "Lost" Child `jubilee` 47027) — every surveyed instance is a
      // `When Revealed:` ability whose printed sentence still reads exactly like a preamble "Attach to X."
      // sentence, just positioned after the trigger header. Only tried once (the first header carrying one
      // wins, matching the preamble's own "first wins, a second is reported" rule below) and never strips
      // anything from the ability's own text — unlike a preamble attach rule, this sentence is also load-bearing
      // game text (the "Otherwise, this card gains surge." branch depends on it), so `ability-scripting-engineer`
      // still needs to see it verbatim.
      if (!attachesTo) {
        const firstSentence = splitSentences(body.slice(h.length).trim())[0];
        if (firstSentence) {
          const bodyAttach = parseAttach(firstSentence, options.villainNames, options.multipleVillains ?? false);
          if (bodyAttach) {
            attachesTo = bodyAttach.host;
            if (bodyAttach.villainName) attachesToVillainNamed = bodyAttach.villainName;
          } else {
            // A narrower idiom than the one above: the attach target is named mid-sentence, in a "you may pay a
            // cost to attach this card to X" clause, rather than the sentence's own leading verb — Bandolier of
            // Stakes (`mojo` 39048): "You may spend 1 resource of any type to attach this card to your identity.
            // Otherwise, discard this card." Confirmed the only instance of this exact idiom in the corpus
            // (docs/phase7-wave2-data.md). Re-synthesizes an ordinary "Attach to X." sentence from the captured
            // target and reuses `parseAttach` unchanged, so it resolves to any host shape that already works.
            const midSentence = /\bto attach this card to (.+?)\.?$/i.exec(firstSentence.replace(/\.$/, ""));
            if (midSentence) {
              const synthetic = parseAttach(
                `Attach to ${midSentence[1] as string}.`,
                options.villainNames,
                options.multipleVillains ?? false,
              );
              if (synthetic) {
                attachesTo = synthetic.host;
                if (synthetic.villainName) attachesToVillainNamed = synthetic.villainName;
              }
            }
          }
        }
      }
      // Final-stage loss reminder glued after an ability body is not part of the ability.
      abilities.push({
        kind,
        ...(form ? { form } : {}),
        ...(h.label ? { label: h.label as "attack" | "thwart" | "defense" } : {}),
        ...(h.name ? { name: h.name } : {}),
        text: body,
      });
      // A side scheme can print "When [it/this scheme] is defeated, ..." as inline prose glued onto another
      // trigger's own body, instead of its own formal "When Defeated:" header (contrast Hydra Prison, 04122,
      // which prints a real "When Defeated:" header and already gets its own ref the ordinary way) — Marked for
      // Death (trors 04028), Captured by Hydra (trors 04107), 45055 (`aoa`): docs/phase7-wave2-scripting.md §7.
      // Recognized as its own additional `when-defeated` ability, ADDITIVE to the enclosing trigger's own ref
      // (which keeps its existing kind/id unchanged) — the ability-scripting-engineer needs each printed trigger
      // on its own ref to script independently. Skipped when `kind` is already `when-defeated` (a formal header
      // whose own body happens to restate "when it is defeated" would otherwise double up).
      if (kind !== "when-defeated") {
        const bodySentences = splitSentences(body);
        const inlineDefeatedIndex = bodySentences.findIndex((s) =>
          /^When (?:this scheme|this card|this attachment|it) is defeated,/i.test(s),
        );
        if (inlineDefeatedIndex !== -1) {
          abilities.push({ kind: "when-defeated", text: bodySentences.slice(inlineDefeatedIndex).join(" ") });
        }
      }
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
