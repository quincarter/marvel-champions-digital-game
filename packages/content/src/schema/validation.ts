import type {
  AllyCard,
  AnyCard,
  AttachmentCard,
  AttachmentHost,
  EncounterCardFlipSide,
  EvidenceCard,
  HeroIdentityCard,
  MainSchemeCard,
  MainSchemeThreatField,
  MinionCard,
  PlayerCard,
  SideSchemeCard,
  TreacheryCard,
  UpgradeCard,
  VillainCard,
} from "./cards/index.js";
import {
  ATTACHMENT_HOST_CATEGORIES,
  ATTACHMENT_HOST_KINDS,
  HOST_MEASURES,
  SUPERLATIVE_HOST_POOLS,
  type AttachmentHostCategory,
  type HostMeasure,
  type SuperlativeHostPool,
} from "./cards/attachment-host.js";
import { EVIDENCE_KINDS } from "./cards/evidence.js";
import type { AbilityReference } from "./abilities.js";
import type { CampaignId, EncounterSetId } from "./ids.js";
import { KNOWN_KEYWORD_NAMES, type KeywordName } from "./keywords.js";
import type { Campaign, EncounterSet, Scenario, ScenarioSeparateDeck, StarterDeck } from "./sets.js";

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const ok: ValidationResult = { valid: true, errors: [] };
const fail = (...errors: string[]): ValidationResult => ({ valid: false, errors });
const result = (errors: readonly string[]): ValidationResult => (errors.length === 0 ? ok : fail(...errors));

function isCardText(value: unknown): value is { printed: string; current: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.printed === "string" && v.printed.length > 0 && typeof v.current === "string" && v.current.length > 0;
}

/** Empty strings allowed: some printed cards have no rules text at all (Energy Absorption, Rhino I, Usurp the Throne). */
function isCardTextAllowEmpty(value: unknown): value is { printed: string; current: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.printed === "string" && typeof v.current === "string";
}

const isPrintedStat = (value: unknown): boolean =>
  value === null || value === "X" || (typeof value === "number" && Number.isFinite(value) && value >= 0);

function isScalingValue(value: unknown): value is { base: number; perPlayer: number } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.base === "number" && typeof v.perPlayer === "number";
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1;

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

/** Every `AbilityReference` needs an id; the dropped `trigger` field is rejected so stale data is caught. */
function abilityRefErrors(refs: unknown, label: string): string[] {
  if (!Array.isArray(refs)) return [`${label} abilities must be an array`];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const ref of refs as readonly AbilityReference[]) {
    if (!ref || !isNonEmptyString(ref.id)) {
      errors.push(`${label} has an ability reference without an id`);
      continue;
    }
    if (seen.has(ref.id)) errors.push(`${label} references ability ${ref.id} twice`);
    seen.add(ref.id);
    if ("trigger" in ref) errors.push(`${label} ability ${ref.id} has a 'trigger' field (dropped in Phase 2)`);
    if (ref.label !== undefined && !isNonEmptyString(ref.label))
      errors.push(`${label} ability ${ref.id} label is empty`);
  }
  return errors;
}

/**
 * The resource types a Requirement may name. Every printed Requirement names physical, mental or energy icons; a wild
 * one is never printed, and the engine's typed cost slots have no wild slot, so it is refused rather than guessed at.
 */
const REQUIREMENT_TYPES: readonly string[] = ["physical", "mental", "energy"];

/**
 * A Requirement keyword's resources (RRG 1.8 "Requirement (Resources)", p. 37): exactly one of `resources` (icon counts,
 * each a positive whole number, at least one type) or the single-icon `icon` (docs/phase7-wave2.md §6.1).
 */
function requirementErrors(k: { resources?: unknown; icon?: unknown }, label: string): string[] {
  const hasResources = k.resources !== undefined;
  const hasIcon = k.icon !== undefined;
  if (hasResources === hasIcon) return [`${label} requirement keyword needs exactly one of resources or icon`];
  if (hasIcon)
    return REQUIREMENT_TYPES.includes(k.icon as string)
      ? []
      : [`${label} requirement icon '${String(k.icon)}' must be physical, mental or energy`];
  if (typeof k.resources !== "object" || k.resources === null)
    return [`${label} requirement resources must be icon counts`];
  const entries = Object.entries(k.resources as Record<string, unknown>);
  if (entries.length === 0) return [`${label} requirement resources must name at least one resource`];
  const errors: string[] = [];
  for (const [type, count] of entries) {
    if (!REQUIREMENT_TYPES.includes(type))
      errors.push(`${label} requirement resource '${type}' must be physical, mental or energy`);
    else if (!isPositiveInteger(count))
      errors.push(`${label} requirement needs a positive whole number of ${type} resources`);
  }
  return errors;
}

/**
 * Prerequisite (form or trait): at least one of `traits` (a non-empty OR) or `form` (the Fear No Evil rulebook, p. 3;
 * docs/phase7-wave2.md §7.5). A keyword with neither could only mean "no prerequisite", so it is refused.
 */
function prerequisiteErrors(k: { traits?: unknown; form?: unknown }, label: string): string[] {
  const errors: string[] = [];
  const hasTraits = k.traits !== undefined;
  if (hasTraits && (!Array.isArray(k.traits) || k.traits.length === 0 || !k.traits.every(isNonEmptyString))) {
    errors.push(`${label} prerequisite keyword traits must name at least one trait`);
  }
  if (k.form !== undefined && k.form !== "hero" && k.form !== "alterEgo") {
    errors.push(`${label} prerequisite keyword form must be 'hero' or 'alterEgo' when present`);
  }
  if (!hasTraits && k.form === undefined)
    errors.push(`${label} prerequisite keyword needs a form or at least one trait`);
  return errors;
}

/** Discount X (trait): a positive value and at least one trait (the Fear No Evil rulebook, p. 3; docs/phase7-wave2.md §6.2). */
function discountErrors(k: { value?: unknown; traits?: unknown }, label: string): string[] {
  const errors: string[] = [];
  if (!isPositiveInteger(k.value)) errors.push(`${label} discount keyword needs a positive whole-number value`);
  if (!Array.isArray(k.traits) || k.traits.length === 0 || !k.traits.every(isNonEmptyString)) {
    errors.push(`${label} discount keyword needs the trait(s) it is qualified by`);
  }
  return errors;
}

function keywordListErrors(keywords: unknown, label: string): string[] {
  if (!Array.isArray(keywords)) return [`${label} keywords must be an array`];
  const errors: string[] = [];
  for (const k of keywords as readonly {
    name?: unknown;
    count?: unknown;
    countPerPlayer?: unknown;
    value?: unknown;
    perPlayer?: unknown;
    resources?: unknown;
    icon?: unknown;
    traits?: unknown;
    form?: unknown;
  }[]) {
    if (!k || !isNonEmptyString(k.name)) errors.push(`${label} has a keyword without a name`);
    // `Uses (2[per_hero] ammo counters)` prints no flat part, so `count` may be 0 when `countPerPlayer` carries the
    // value; either way the card must enter play with at least one counter (docs/phase7-wave3.md §1.3).
    if (k?.name === "uses") {
      const perPlayer = k.countPerPlayer;
      if (perPlayer !== undefined && !isPositiveInteger(perPlayer)) {
        errors.push(`${label} uses keyword countPerPlayer must be a positive whole number when present`);
      }
      const flat = isNonNegativeInteger(k.count) ? k.count : -1;
      if (flat < 0 || (flat < 1 && perPlayer === undefined)) errors.push("uses keyword must have a count >= 1");
    }
    if (k?.name === "hinder" && k.perPlayer !== undefined && !isPositiveInteger(k.perPlayer)) {
      errors.push(`${label} hinder keyword perPlayer must be a positive whole number when present`);
    }
    if (
      (k?.name === "retaliate" || k?.name === "incite" || k?.name === "hinder" || k?.name === "victory") &&
      !isNonNegativeNumber(k.value)
    ) {
      errors.push(`${label} keyword ${String(k.name)} needs a numeric value`);
    }
    if (k?.name === "requirement") errors.push(...requirementErrors(k, label));
    if (k?.name === "discount") errors.push(...discountErrors(k, label));
    if (k?.name === "prerequisite") errors.push(...prerequisiteErrors(k, label));
  }
  return errors;
}

export function validateAttachmentHost(host: unknown, label: string): string[] {
  if (typeof host !== "object" || host === null) return [`${label} attachesTo must be an AttachmentHost object`];
  const h = host as Partial<AttachmentHost> & Record<string, unknown>;
  const kind = h.kind as AttachmentHost["kind"];
  if (!ATTACHMENT_HOST_KINDS.includes(kind)) {
    return [`${label} attachesTo.kind '${String(h.kind)}' is not a known host kind`];
  }
  const errors: string[] = [];
  const optionalName = (key: string): void => {
    if (h[key] !== undefined && !isNonEmptyString(h[key]))
      errors.push(`${label} ${kind} host ${key} must be a non-empty string when present`);
  };
  const qualifiers = (): void => {
    optionalName("trait");
    optionalName("withoutTrait");
    optionalName("withoutAttachmentNamed");
    optionalName("titleContains");
    for (const key of ["keyword", "withoutKeyword"] as const) {
      if (h[key] !== undefined && !KNOWN_KEYWORD_NAMES.includes(h[key] as KeywordName)) {
        errors.push(`${label} ${kind} host ${key} '${String(h[key])}' is not a known keyword`);
      }
    }
    // "an enemy that X-23 or Honey Badger attacked this turn": an empty list could only mean "no host", so it is refused.
    if (h.attackedThisTurnBy !== undefined) {
      const names: unknown = h.attackedThisTurnBy;
      if (!Array.isArray(names) || names.length === 0 || !names.every(isNonEmptyString)) {
        errors.push(`${label} ${kind} host attackedThisTurnBy must name at least one card title`);
      }
    }
  };
  /** Every `HostQualifiers` field, for the "a qualified host needs at least one" check. */
  const anyQualifier = (): boolean =>
    h.trait !== undefined ||
    h.withoutTrait !== undefined ||
    h.withoutAttachmentNamed !== undefined ||
    h.keyword !== undefined ||
    h.withoutKeyword !== undefined ||
    h.titleContains !== undefined ||
    h.attackedThisTurnBy !== undefined;
  switch (kind) {
    case "namedCard":
    case "namedVillain":
      if (!isNonEmptyString(h.name)) errors.push(`${label} ${kind} host needs a name`);
      break;
    case "minionWithHighestPrintedHp":
      optionalName("withoutAttachmentNamed");
      break;
    case "villainSideScheme": {
      const of = h.of;
      const ofOk =
        of === "activeVillain" ||
        (typeof of === "object" && of !== null && isNonEmptyString((of as Record<string, unknown>).villainName));
      if (!ofOk) errors.push(`${label} villainSideScheme host needs of: "activeVillain" or { villainName }`);
      break;
    }
    case "yourIdentity":
      if (h.form !== undefined && h.form !== "hero" && h.form !== "alterEgo") {
        errors.push(`${label} yourIdentity host form must be 'hero' or 'alterEgo' when present`);
      }
      break;
    case "qualified":
      if (!ATTACHMENT_HOST_CATEGORIES.includes(h.category as AttachmentHostCategory)) {
        errors.push(`${label} qualified host category '${String(h.category)}' is not a known category`);
      }
      qualifiers();
      if (!anyQualifier()) {
        errors.push(
          `${label} qualified host needs at least one qualifier (an unqualified category uses its plain kind)`,
        );
      }
      break;
    case "ifAble": {
      const nested = [h.preferred, h.otherwise] as unknown[];
      for (const [i, inner] of nested.entries()) {
        const part = `${label} ifAble ${i === 0 ? "preferred" : "otherwise"}`;
        if (typeof inner === "object" && inner !== null && (inner as { kind?: unknown }).kind === "ifAble") {
          errors.push(`${part} host cannot itself be ifAble`);
        } else {
          errors.push(...validateAttachmentHost(inner, part));
        }
      }
      break;
    }
    case "superlative":
      if (!SUPERLATIVE_HOST_POOLS.includes(h.among as SuperlativeHostPool)) {
        errors.push(`${label} superlative host among '${String(h.among)}' is not a known pool`);
      }
      if (h.order !== "highest" && h.order !== "lowest")
        errors.push(`${label} superlative host order must be 'highest' or 'lowest'`);
      if (!HOST_MEASURES.includes(h.measure as HostMeasure)) {
        errors.push(`${label} superlative host measure '${String(h.measure)}' is not a known measure`);
      }
      // Only villains print an activation order value (The Sinister Six).
      if (h.measure === "activationOrder" && h.among !== "villain") {
        errors.push(`${label} superlative host measure 'activationOrder' ranks villains only`);
      }
      // Only player cards print a resource cost, so an encounter-only pool ranked by it is a parse error
      // (Beguiled, 'Pool-ized rank `ally`). `friendlyCharacter` is allowed: it can hold allies.
      if (h.measure === "printedCost" && h.among !== "ally" && h.among !== "friendlyCharacter") {
        errors.push(
          `${label} superlative host measure 'printedCost' ranks player cards, so among must be 'ally' or 'friendlyCharacter'`,
        );
      }
      qualifiers();
      break;
    case "anyOf": {
      const hosts: unknown = h.hosts;
      if (!Array.isArray(hosts) || hosts.length < 2) {
        errors.push(`${label} anyOf host must list at least two hosts`);
        break;
      }
      for (const [i, inner] of (hosts as readonly unknown[]).entries()) {
        const part = `${label} anyOf host ${i + 1}`;
        const innerKind = typeof inner === "object" && inner !== null ? (inner as { kind?: unknown }).kind : undefined;
        if (innerKind === "ifAble" || innerKind === "anyOf")
          errors.push(`${part} cannot itself be ${String(innerKind)}`);
        else errors.push(...validateAttachmentHost(inner, part));
      }
      break;
    }
    case "leader":
      if (h.of !== "enemy" && h.of !== "yours") errors.push(`${label} leader host of must be 'enemy' or 'yours'`);
      break;
    default:
      break;
  }
  return errors;
}

function baseErrors(card: AnyCard): string[] {
  const errors: string[] = [];
  if (!card.id) errors.push("missing id");
  if (!card.name || card.name.trim().length === 0) errors.push("missing name");
  if (!card.setCode) errors.push("missing setCode");
  if (!card.cycleId) errors.push("missing cycleId");
  if (!card.collectorNumber) errors.push("missing collectorNumber");
  if (!Number.isFinite(card.quantityInSet) || card.quantityInSet < 1) {
    errors.push("quantityInSet must be a positive number");
  }
  if (typeof card.unique !== "boolean") errors.push("missing/invalid unique flag");
  // RRG 1.8 "Amplify Icon" (p. 7); docs/phase7-wave3.md §1.2. Absent means none, so 0 is never written.
  if (card.amplifyIcons !== undefined && !isPositiveInteger(card.amplifyIcons)) {
    errors.push("amplifyIcons must be a positive whole number when present");
  }
  return errors;
}

/**
 * Printed boost icons: a whole number of at least 0. There is no upper bound: Joystick (51039), Fixer (53038) and
 * Blizzard (54034) print 4 (docs/phase7-wave2.md §6.13; the old cap of 3 was a placeholder no rule states).
 *
 * `starIcon` is a plain boolean when present at all (docs/phase7-wave2-data.md): a boost area carries at most one
 * star, so there is no count to validate, just the type.
 */
function boostErrors(card: { boostIcons: number; starIcon?: unknown }, label: string): string[] {
  const errors: string[] = [];
  if (!isNonNegativeInteger(card.boostIcons)) errors.push(`${label} boostIcons must be a whole number of at least 0`);
  if (card.starIcon !== undefined && typeof card.starIcon !== "boolean") {
    errors.push(`${label} starIcon must be a boolean when present`);
  }
  return errors;
}

/**
 * A card's `starIcon` and its own printed `Boost:` ability should never disagree: RRG 1.8 "Boost, Boost Icon" ties
 * the star exactly to "the card has a 'Boost' ability" — a `.boost`-suffixed ability ref is `@mc/content`'s own
 * naming convention for that ability (every pack, checked in `wave2-data-requests.test.ts`: 703/703 encounter-side
 * cards agree). This is an ingest-quality signal, not a hard schema error — a card can legitimately have a `.boost`
 * ref named differently in principle — so it is surfaced as a warning string for a test to assert is empty across
 * the pool, not folded into `ValidationResult`.
 */
export function starIconAbilityMismatch(
  card: { readonly cardCode?: string; readonly starIcon?: boolean; readonly abilities: readonly AbilityReference[] },
  label: string,
): string | null {
  if (!Array.isArray(card.abilities)) return null;
  const hasBoostRef = card.abilities.some((ref) => typeof ref?.id === "string" && ref.id.endsWith(".boost"));
  const starIcon = card.starIcon === true;
  if (hasBoostRef === starIcon) return null;
  return hasBoostRef
    ? `${label} has a ".boost" ability ref but starIcon is not true`
    : `${label} has starIcon: true but no ".boost" ability ref`;
}

/** Fields every player-deck card shares: text, keywords, abilities, deck limit, play restrictions, separate deck. */
function playerCommonErrors(card: PlayerCard): string[] {
  const errors: string[] = [];
  // Resource cards can be printed with no text box (Energy Absorption, Vibranium).
  const textOk = card.type === "resource" ? isCardTextAllowEmpty(card.text) : isCardText(card.text);
  if (!textOk) errors.push(`${card.type} text must have non-empty printed and current strings`);
  errors.push(...keywordListErrors(card.keywords, card.type));
  errors.push(...abilityRefErrors(card.abilities, card.type));
  if (card.separateDeck !== undefined) {
    // RRG 1.8 "Deck": a card of a separate deck an identity brings is never in a player deck.
    if (!isNonEmptyString(card.separateDeck)) errors.push(`${card.type} separateDeck must name the deck`);
    if (card.deckLimit !== 0)
      errors.push(`${card.type} in a separate deck cannot be put in a player deck, so its deckLimit must be 0`);
  } else if (!isPositiveInteger(card.deckLimit)) {
    errors.push(`${card.type} deckLimit must be a positive integer`);
  }
  const r = card.playRestrictions;
  if (r !== undefined) {
    if (typeof r !== "object" || r === null) errors.push("playRestrictions must be an object");
    else {
      if (r.maxPerPlayer !== undefined && !isPositiveInteger(r.maxPerPlayer)) {
        errors.push("playRestrictions.maxPerPlayer must be a positive integer");
      }
      if (r.maxPerHost !== undefined && !isPositiveInteger(r.maxPerHost)) {
        errors.push("playRestrictions.maxPerHost must be a positive integer");
      }
      if (r.form !== undefined && r.form !== "hero" && r.form !== "alterEgo") {
        errors.push("playRestrictions.form must be 'hero' or 'alterEgo'");
      }
      if (r.anyPlayerControl !== undefined && typeof r.anyPlayerControl !== "boolean") {
        errors.push("playRestrictions.anyPlayerControl must be a boolean");
      }
      if (r.maxPerRound !== undefined && !isPositiveInteger(r.maxPerRound)) {
        errors.push("playRestrictions.maxPerRound must be a positive integer");
      }
      if (r.requiresIdentityTrait !== undefined && !isNonEmptyString(r.requiresIdentityTrait)) {
        errors.push("playRestrictions.requiresIdentityTrait must be a trait");
      }
      if (r.requiresControlledCharacterTrait !== undefined && !isNonEmptyString(r.requiresControlledCharacterTrait)) {
        errors.push("playRestrictions.requiresControlledCharacterTrait must be a trait");
      }
      if (r.maxPerPhase !== undefined && !isPositiveInteger(r.maxPerPhase)) {
        errors.push("playRestrictions.maxPerPhase must be a positive integer");
      }
    }
  }
  if ("cost" in card && !isNonNegativeNumber(card.cost)) errors.push(`${card.type} cost must be a non-negative number`);
  if ("specialCost" in card && card.specialCost !== undefined) {
    if (card.specialCost !== "X" && card.specialCost !== "dash")
      errors.push(`${card.type} specialCost must be 'X' or 'dash'`);
    else if (card.cost !== 0)
      errors.push(`${card.type} cost is printed ${card.specialCost === "X" ? "X" : "—"}, so its value must be 0`);
  }
  errors.push(...wave2PlayerCardErrors(card));
  return errors;
}

/** Wave 2 player card fields: `printedAspect`, `specificTo`, `flipSide`, and the "none" classification. */
function wave2PlayerCardErrors(card: PlayerCard): string[] {
  const errors: string[] = [];
  const aspect = card.aspect as string;
  if (card.printedAspect !== undefined) {
    if (!CHOOSABLE_PRINTED_ASPECTS.includes(card.printedAspect)) {
      errors.push(
        `${card.type} printedAspect '${String(card.printedAspect)}' must be Aggression, Justice, Leadership, Protection or 'Pool`,
      );
    }
    if (!aspect.startsWith("hero:")) {
      errors.push(
        `${card.type} printedAspect is only for an identity-specific card that also prints an aspect; a plain aspect card uses aspect`,
      );
    }
  }
  const specific = card.specificTo;
  if (specific !== undefined) {
    if (typeof specific !== "object" || specific === null) errors.push(`${card.type} specificTo must be an object`);
    else {
      if (specific.kind !== "scenario" && specific.kind !== "campaign" && specific.kind !== "competitive") {
        errors.push(`${card.type} specificTo.kind must be 'scenario', 'campaign' or 'competitive'`);
      }
      if (!isNonEmptyString(specific.encounterSetId))
        errors.push(`${card.type} specificTo must name its encounter set`);
    }
  }
  // RRG 1.8 "Classifications" (p. 12): a player card with no identity, aspect or basic classification is only ever
  // scenario- or campaign-specific.
  if (aspect === "none" && specific === undefined) {
    errors.push(
      `${card.type} with no aspect classification must say which scenario or campaign set it belongs to (specificTo)`,
    );
  }
  errors.push(...flipSideErrors(card, card.type));
  return errors;
}

const CHOOSABLE_PRINTED_ASPECTS: readonly string[] = ["aggression", "justice", "leadership", "protection", "pool"];

export function validateAllyCard(card: AllyCard): ValidationResult {
  const errors = [...baseErrors(card), ...playerCommonErrors(card)];
  if (!isPrintedStat(card.atk)) errors.push('ally atk must be a non-negative number, "X", or null (printed —)');
  if (!isPrintedStat(card.thw)) errors.push('ally thw must be a non-negative number, "X", or null (printed —)');
  // 0 is printed on Ant-Man (12011) and Wasp (13012), which gain hit points from pym counters.
  if (!isNonNegativeInteger(card.hp)) errors.push("ally hp must be a whole number of at least 0");
  if (
    !card.consequentialDamage ||
    !isNonNegativeNumber(card.consequentialDamage.attack) ||
    !isNonNegativeNumber(card.consequentialDamage.thwart)
  ) {
    errors.push("ally consequentialDamage must have non-negative attack and thwart values");
  }
  return result(errors);
}

export function validateUpgradeCard(card: UpgradeCard): ValidationResult {
  const errors = [...baseErrors(card), ...playerCommonErrors(card)];
  if (card.attachesTo !== undefined) errors.push(...validateAttachmentHost(card.attachesTo, "upgrade"));
  return result(errors);
}

export function validateHeroIdentityCard(card: HeroIdentityCard): ValidationResult {
  const errors = baseErrors(card);
  // docs/phase7-wave3.md §1.5 (Gamora's Skilled Tactician).
  const allowance = card.deckbuilding?.offAspectAllowance;
  if (allowance !== undefined) {
    if (!isPositiveInteger(allowance.maxCards))
      errors.push("offAspectAllowance maxCards must be a positive whole number");
    if (
      !Array.isArray(allowance.anyTrait) ||
      allowance.anyTrait.length === 0 ||
      !allowance.anyTrait.every(isNonEmptyString)
    )
      errors.push("offAspectAllowance anyTrait must list at least one trait");
    if (!isNonEmptyString(allowance.cardType)) errors.push("offAspectAllowance needs a cardType");
  }
  if (!isNonNegativeNumber(card.hp) || card.hp < 1) errors.push("identity hp must be a positive number");
  if ("keywords" in card) errors.push("identity keywords live on each face, not on the card (Phase 2)");
  if (!isNonEmptyString(card.obligationCardId)) errors.push("identity must reference its obligationCardId");
  if (!isNonEmptyString(card.nemesisEncounterSetId)) errors.push("identity must reference its nemesisEncounterSetId");
  if (!card.hero) errors.push("missing hero face");
  else {
    if (!card.hero.faceName) errors.push("hero face missing faceName");
    if (!isCardText(card.hero.text)) errors.push("hero face text must have non-empty printed and current strings");
    if (!isNonNegativeNumber(card.hero.handSize) || card.hero.handSize < 1) {
      errors.push("hero handSize must be a positive number");
    }
    errors.push(...keywordListErrors(card.hero.keywords, "hero face"));
    errors.push(...abilityRefErrors(card.hero.abilities, "hero face"));
  }
  if (!card.alterEgo) errors.push("missing alterEgo face");
  else {
    if (!card.alterEgo.faceName) errors.push("alterEgo face missing faceName");
    if (!isCardText(card.alterEgo.text)) {
      errors.push("alterEgo face text must have non-empty printed and current strings");
    }
    if (!isNonNegativeNumber(card.alterEgo.rec)) errors.push("alterEgo rec must be a non-negative number");
    if (!isNonNegativeNumber(card.alterEgo.handSize) || card.alterEgo.handSize < 1) {
      errors.push("alterEgo handSize must be a positive number");
    }
    errors.push(...keywordListErrors(card.alterEgo.keywords, "alterEgo face"));
    errors.push(...abilityRefErrors(card.alterEgo.abilities, "alterEgo face"));
  }
  const extra: unknown = card.additionalHeroForms;
  if (extra !== undefined) {
    if (!Array.isArray(extra) || extra.length === 0)
      errors.push("identity additionalHeroForms must list at least one hero form when present");
    else {
      for (const [i, form] of (extra as HeroIdentityCard["hero"][]).entries()) {
        const label = `additional hero form ${i + 1}`;
        if (!isNonEmptyString(form?.faceName)) errors.push(`${label} missing faceName`);
        if (!isCardText(form?.text)) errors.push(`${label} text must have non-empty printed and current strings`);
        if (!isNonNegativeNumber(form?.handSize) || form.handSize < 1)
          errors.push(`${label} handSize must be a positive number`);
        for (const stat of ["atk", "thw", "def"] as const) {
          if (!isNonNegativeNumber(form?.[stat])) errors.push(`${label} ${stat} must be a non-negative number`);
        }
        if (!Array.isArray(form?.traits)) errors.push(`${label} traits must be an array`);
        errors.push(...keywordListErrors(form?.keywords, label));
        errors.push(...abilityRefErrors(form?.abilities, label));
      }
    }
  }
  // Ability ids are unique per card, across every face (see `additionalHeroForms`).
  const faceRefs = [
    card.hero?.abilities,
    card.alterEgo?.abilities,
    ...(Array.isArray(extra) ? (extra as HeroIdentityCard["hero"][]).map((f) => f?.abilities) : []),
  ];
  const seenIds = new Set<string>();
  for (const refs of faceRefs) {
    if (!Array.isArray(refs)) continue;
    const ids = new Set((refs as readonly AbilityReference[]).map((ref) => ref?.id));
    for (const id of ids) {
      if (typeof id !== "string") continue;
      if (seenIds.has(id))
        errors.push(`identity ability ${id} appears on more than one face; ability ids are unique per card`);
      seenIds.add(id);
    }
  }
  if (card.separateDecks !== undefined) {
    if (!Array.isArray(card.separateDecks)) errors.push("identity separateDecks must be an array");
    else {
      const names = new Set<string>();
      for (const deck of card.separateDecks) {
        const label = `identity separate deck ${isNonEmptyString(deck.name) ? deck.name : "(unnamed)"}`;
        if (!isNonEmptyString(deck.name)) errors.push("identity separate deck needs a name");
        else if (names.has(deck.name)) errors.push(`${label} is listed twice`);
        else names.add(deck.name);
        if (!Array.isArray(deck.cards) || deck.cards.length === 0) errors.push(`${label} must list its cards`);
        else {
          const seen = new Set<string>();
          for (const entry of deck.cards) {
            if (!isNonEmptyString(entry.cardId)) errors.push(`${label} has an entry without a cardId`);
            else if (seen.has(entry.cardId)) errors.push(`${label} lists ${entry.cardId} twice`);
            else seen.add(entry.cardId);
            if (!isPositiveInteger(entry.quantity)) errors.push(`${label} quantity for ${entry.cardId} must be >= 1`);
          }
        }
        if (typeof deck.topCardFaceup !== "boolean") errors.push(`${label} topCardFaceup must be a boolean`);
        if (deck.discardPile !== "own" && deck.discardPile !== "none")
          errors.push(`${label} discardPile must be 'own' or 'none'`);
        if (deck.whenEmpty !== "reshuffleDiscardWithoutPenalty" && deck.whenEmpty !== "stayEmpty") {
          errors.push(`${label} whenEmpty must be 'reshuffleDiscardWithoutPenalty' or 'stayEmpty'`);
        }
        // With no discard pile there is nothing to reshuffle (docs/phase7-wave2.md §15).
        if (deck.discardPile === "none" && deck.whenEmpty === "reshuffleDiscardWithoutPenalty") {
          errors.push(`${label} has no discard pile, so it cannot reshuffle one when empty`);
        }
        if (deck.cardFamily !== undefined && deck.cardFamily !== "player" && deck.cardFamily !== "encounter") {
          errors.push(`${label} cardFamily must be 'player' or 'encounter'`);
        }
      }
    }
  }
  const separated = card.separatedIdentity;
  if (separated !== undefined) {
    if (typeof separated !== "object" || separated === null)
      errors.push("identity separatedIdentity must be an object");
    else {
      if (!isNonEmptyString(separated.alterEgoCardNumber))
        errors.push("identity separatedIdentity must give the alter-ego card's collector number");
      const faces = [
        [separated.heroCardOtherSide, "support", "hero card's other side"],
        [separated.alterEgoCardOtherSide, "upgrade", "alter-ego card's other side"],
      ] as const;
      const allFaceIds = new Set(
        faceRefs.flatMap((refs) =>
          Array.isArray(refs) ? (refs as readonly AbilityReference[]).map((ref) => ref?.id) : [],
        ),
      );
      for (const [face, cardType, name] of faces) {
        const label = `identity separatedIdentity ${name}`;
        if (typeof face !== "object" || face === null) {
          errors.push(`${label} is missing`);
          continue;
        }
        if (face.cardType !== cardType) errors.push(`${label} is a ${cardType} card`);
        errors.push(...flipSideErrors({ flipSide: face, abilities: [] }, label));
        for (const ref of Array.isArray(face.abilities) ? face.abilities : []) {
          if (ref && allFaceIds.has(ref.id))
            errors.push(`${label} ability ${ref.id} is also on another face; ability ids are unique per card`);
          if (ref) allFaceIds.add(ref.id);
        }
      }
    }
  }
  return result(errors);
}

export function validateVillainCard(card: VillainCard): ValidationResult {
  const errors = baseErrors(card);
  if (!card.sides || card.sides.length === 0) {
    errors.push("villain must have at least one side");
    return result(errors);
  }
  // Two faces for double-sided stage cards, three for foldable "three-sided" ones (Apocalypse; docs/phase7-wave2.md §6.9).
  if (card.sides.length > 3) errors.push("villain has at most three sides (the faces of its stage cards)");
  const letters = card.sides.map((side) => side.side);
  if (new Set(letters).size !== letters.length) errors.push("villain sides must be distinct");
  if (card.sides.length === 3 && !(["A", "B", "C"] as const).every((letter) => letters.includes(letter))) {
    errors.push("a three-sided villain's sides are A, B and C");
  }
  if (card.sides.length < 3 && letters.includes("C"))
    errors.push("villain side C is the third face of a three-sided villain");
  for (const side of card.sides) {
    if (side.side !== "A" && side.side !== "B" && side.side !== "C")
      errors.push(`villain side ${String(side.side)} must be A, B or C`);
    if (!isNonEmptyString(side.name)) errors.push(`villain side ${side.side} needs a name`);
    if (!side.stages || side.stages.length === 0) {
      errors.push(`villain side ${side.side} must have at least one stage`);
      continue;
    }
    const labelled = side.stages.filter((stage) => stage.stageLabel !== undefined).length;
    if (labelled !== 0 && labelled !== side.stages.length) {
      errors.push(
        `villain side ${side.side} labels some stages but not all; either every stage has a stageLabel or none does`,
      );
    }
    side.stages.forEach((stage, i) => {
      const label = `villain side ${side.side} stage ${stage.stageLabel ?? stage.stageNumber}`;
      if (i > 0 && stage.stageNumber <= (side.stages[i - 1]?.stageNumber ?? 0)) {
        errors.push(`${label} must be numbered after the previous stage`);
      }
      if (stage.stageLabel !== undefined && !isNonEmptyString(stage.stageLabel)) {
        errors.push(`${label} stageLabel must be a non-empty string when present`);
      }
      if (!isScalingValue(stage.hp)) errors.push(`${label} hp must be a ScalingValue`);
      // A face printed with ∞ hit points (RRG 1.8 "Hit Points", p. 22; docs/phase7-wave3.md §1.1) holds 0, the way a
      // dashed stat does, so no reader can mistake a placeholder for a printed number.
      const infinite: unknown = stage.infiniteHp;
      if (infinite !== undefined && typeof infinite !== "boolean") errors.push(`${label} infiniteHp must be a boolean`);
      if (infinite === true && isScalingValue(stage.hp) && (stage.hp.base !== 0 || stage.hp.perPlayer !== 0)) {
        errors.push(`${label} prints infinite hit points, so its hp must be { base: 0, perPlayer: 0 }`);
      }
      if (!isNonNegativeNumber(stage.atk)) errors.push(`${label} atk must be a non-negative number`);
      if (!isNonNegativeNumber(stage.sch)) errors.push(`${label} sch must be a non-negative number`);
      // Read as untrusted data: `Array.isArray` would otherwise widen the element type to `any`.
      const dashed: unknown = stage.dashedStats;
      if (dashed !== undefined) {
        if (!Array.isArray(dashed)) errors.push(`${label} dashedStats must be an array`);
        else {
          const stats: readonly unknown[] = dashed;
          if (new Set(stats).size !== stats.length) errors.push(`${label} dashedStats lists a stat twice`);
          for (const stat of stats) {
            if (stat !== "atk" && stat !== "sch") errors.push(`${label} dashedStats may only list 'atk' and 'sch'`);
            else if (stage[stat] !== 0) errors.push(`${label} ${stat} is printed "—", so its value must be 0`);
          }
        }
      }
      // A villain stage can be printed with no text (Rhino I).
      if (!isCardTextAllowEmpty(stage.text)) errors.push(`${label} text must have printed and current strings`);
      errors.push(...keywordListErrors(stage.keywords, label));
      errors.push(...abilityRefErrors(stage.abilities, label));
    });
  }
  const [first, ...others] = card.sides;
  // Every side is a face of the same stage cards (see `VillainSide`).
  const numbers = (stages: readonly { stageNumber: number }[] | undefined): string =>
    (stages ?? []).map((s) => s.stageNumber).join(",");
  if (others.some((side) => numbers(first.stages) !== numbers(side.stages))) {
    errors.push(
      "a villain's sides are the faces of the same stage cards, so every side must list the same stage numbers",
    );
  }
  if (card.startingSide !== undefined && !card.sides.some((side) => side.side === card.startingSide)) {
    errors.push(`villain startingSide ${String(card.startingSide)} is not one of its sides`);
  }
  if (card.printedType !== undefined && card.printedType !== "leader")
    errors.push("villain printedType must be 'leader' when present");
  if (card.activationOrder !== undefined && !isPositiveInteger(card.activationOrder)) {
    errors.push("villain activationOrder must be a positive whole number");
  }
  return result(errors);
}

/** The face a double-sided encounter card flips to (see `EncounterCardFlipSide`). */
function flipSideErrors(
  card: { readonly flipSide?: EncounterCardFlipSide; readonly abilities: unknown },
  label: string,
): string[] {
  const back = card.flipSide;
  if (back === undefined) return [];
  if (typeof back !== "object" || back === null) return [`${label} flipSide must be an object`];
  const side = `${label} flip side`;
  const errors: string[] = [];
  if (!isNonEmptyString(back.name)) errors.push(`${side} needs a name`);
  if (back.subtitle !== undefined && !isNonEmptyString(back.subtitle))
    errors.push(`${side} subtitle must be a non-empty string when present`);
  if (!Array.isArray(back.traits)) errors.push(`${side} traits must be an array`);
  if (!isCardText(back.text)) errors.push(`${side} text must have non-empty printed and current strings`);
  errors.push(...keywordListErrors(back.keywords, side));
  errors.push(...abilityRefErrors(back.abilities, side));
  // docs/phase7-wave3.md §1.2: this face's own amplify icons, a positive whole number when present.
  if (back.amplifyIcons !== undefined && !isPositiveInteger(back.amplifyIcons))
    errors.push(`${side} amplifyIcons must be a positive whole number when present`);
  if (Array.isArray(back.abilities) && Array.isArray(card.abilities)) {
    const front = new Set((card.abilities as readonly AbilityReference[]).map((ref) => ref?.id));
    for (const ref of back.abilities) {
      if (ref && front.has(ref.id))
        errors.push(`${side} ability ${ref.id} is also on the front face; ability ids are unique per card`);
    }
  }
  return errors;
}

function encounterCommonErrors(
  card: {
    boostIcons: number;
    keywords: unknown;
    abilities: unknown;
    text: unknown;
    flipSide?: EncounterCardFlipSide;
    separateDeck?: unknown;
  },
  label: string,
): string[] {
  return [
    ...boostErrors(card, label),
    ...keywordListErrors(card.keywords, label),
    ...abilityRefErrors(card.abilities, label),
    ...(isCardText(card.text) ? [] : [`${label} text must have non-empty printed and current strings`]),
    ...flipSideErrors(card, label),
    // An identity's encounter-backed separate deck (Hercules's Labor deck; docs/phase7-wave2.md §15).
    ...(card.separateDeck === undefined || isNonEmptyString(card.separateDeck)
      ? []
      : [`${label} separateDeck must name the deck`]),
  ];
}

export function validateMinionCard(card: MinionCard): ValidationResult {
  const errors = baseErrors(card);
  errors.push(...boostErrors(card, "minion"));
  errors.push(...keywordListErrors(card.keywords, "minion"));
  errors.push(...abilityRefErrors(card.abilities, "minion"));
  errors.push(...flipSideErrors(card, "minion"));
  if (!isPrintedStat(card.atk)) errors.push('minion atk must be a non-negative number, "X", or null (printed —)');
  if (!isPrintedStat(card.sch)) errors.push('minion sch must be a non-negative number, "X", or null (printed —)');
  if (!isNonNegativeNumber(card.hp) || card.hp < 1) errors.push("minion hp must be a positive number");
  if (card.nemesisMinion !== undefined && typeof card.nemesisMinion !== "boolean")
    errors.push("minion nemesisMinion must be a boolean");
  return result(errors);
}

export function validateAttachmentCard(card: AttachmentCard): ValidationResult {
  const errors = [...baseErrors(card), ...encounterCommonErrors(card, "attachment")];
  errors.push(...validateAttachmentHost(card.attachesTo, "attachment"));
  const mods = card.statModifiers;
  if (mods !== undefined) {
    if (typeof mods !== "object" || mods === null) errors.push("attachment statModifiers must be an object");
    else {
      for (const [key, value] of Object.entries(mods)) {
        if (!["atk", "sch", "thw", "hp"].includes(key)) errors.push(`attachment statModifiers.${key} is not a stat`);
        else if (typeof value !== "number" || !Number.isFinite(value)) {
          errors.push(`attachment statModifiers.${key} must be a number`);
        }
      }
    }
  }
  return result(errors);
}

const MAIN_SCHEME_THREAT_FIELDS: readonly MainSchemeThreatField[] = ["startingThreat", "targetThreat", "acceleration"];

export function validateMainSchemeCard(card: MainSchemeCard): ValidationResult {
  const errors = baseErrors(card);
  if (!card.stages || card.stages.length === 0) {
    errors.push("main scheme must have at least one stage");
  } else {
    for (const stage of card.stages) {
      const label = `main scheme stage ${stage.stageNumber}${stage.stageLetter ?? ""}`;
      if (stage.name !== undefined && (typeof stage.name !== "string" || stage.name.trim().length === 0)) {
        errors.push(`${label} name must be a non-empty string when present`);
      }
      if (!isScalingValue(stage.startingThreat)) errors.push(`${label} startingThreat must be a ScalingValue`);
      if (!isScalingValue(stage.targetThreat)) errors.push(`${label} targetThreat must be a ScalingValue`);
      if (!isScalingValue(stage.acceleration)) errors.push(`${label} acceleration must be a ScalingValue`);
      const printedX: unknown = stage.printedX;
      if (printedX !== undefined) {
        if (!Array.isArray(printedX)) errors.push(`${label} printedX must be an array`);
        else {
          const fields: readonly unknown[] = printedX;
          if (new Set(fields).size !== fields.length) errors.push(`${label} printedX lists a field twice`);
          for (const field of fields) {
            if (!MAIN_SCHEME_THREAT_FIELDS.includes(field as MainSchemeThreatField)) {
              errors.push(`${label} printedX lists '${String(field)}', which is not a threat value`);
              continue;
            }
            const value = stage[field as MainSchemeThreatField];
            if (isScalingValue(value) && (value.base !== 0 || value.perPlayer !== 0)) {
              errors.push(`${label} ${field} is printed "X", so its value must be { base: 0, perPlayer: 0 }`);
            }
          }
        }
      }
      const dashed: unknown = stage.dashedValues;
      if (dashed !== undefined) {
        if (!Array.isArray(dashed)) errors.push(`${label} dashedValues must be an array`);
        else {
          const fields: readonly unknown[] = dashed;
          if (new Set(fields).size !== fields.length) errors.push(`${label} dashedValues lists a field twice`);
          for (const field of fields) {
            if (!MAIN_SCHEME_THREAT_FIELDS.includes(field as MainSchemeThreatField)) {
              errors.push(`${label} dashedValues lists '${String(field)}', which is not a threat value`);
              continue;
            }
            if (Array.isArray(stage.printedX) && stage.printedX.includes(field as MainSchemeThreatField)) {
              errors.push(`${label} ${String(field)} cannot be printed both "—" and "X"`);
            }
            const value = stage[field as MainSchemeThreatField];
            if (isScalingValue(value) && (value.base !== 0 || value.perPlayer !== 0)) {
              errors.push(`${label} ${String(field)} is printed "—", so its value must be { base: 0, perPlayer: 0 }`);
            }
          }
        }
      }
      // A main scheme side can be printed with no text, like a villain stage (Attack on Mount Athena 04061: stage 1's B
      // side, stages 2 and 3's A sides; docs/phase7-wave2.md §6.13).
      if (!isCardTextAllowEmpty(stage.text)) errors.push(`${label} text must have printed and current strings`);
      errors.push(...abilityRefErrors(stage.abilities, label));
      if (!stage.aSide || typeof stage.aSide !== "object") errors.push(`${label} is missing its aSide`);
      else {
        if (!isCardTextAllowEmpty(stage.aSide.text))
          errors.push(`${label} aSide text must have printed and current strings`);
        errors.push(...abilityRefErrors(stage.aSide.abilities, `${label} aSide`));
      }
    }
    // Stages sharing a stage number are alternatives (The Once and Future Kang's four stage 3 cards), so each must be
    // told apart by its letter or its name.
    const keys = new Set<string>();
    for (const stage of card.stages) {
      const key = `${stage.stageNumber}|${stage.stageLetter ?? ""}|${stage.name ?? ""}`;
      if (keys.has(key)) {
        errors.push(
          `main scheme has two stage ${stage.stageNumber}${stage.stageLetter ?? ""} entries with the same name; alternative stages need a stageLetter or a name to tell them apart`,
        );
      }
      keys.add(key);
    }
  }
  return result(errors);
}

export function validateSideSchemeCard(card: SideSchemeCard): ValidationResult {
  const errors = baseErrors(card);
  // A side scheme can be printed with no text (Usurp the Throne): the allowance is local to this type.
  errors.push(
    ...encounterCommonErrors(
      { ...card, text: isCardTextAllowEmpty(card.text) ? { printed: "-", current: "-" } : card.text },
      "side scheme",
    ),
  );
  if (!isScalingValue(card.startingThreat)) errors.push("side scheme startingThreat must be a ScalingValue");
  if (card.signatureOf !== undefined && !isNonEmptyString(card.signatureOf)) {
    errors.push("side scheme signatureOf must name the villain it belongs to");
  }
  return result(errors);
}

export function validateTreacheryCard(card: TreacheryCard): ValidationResult {
  const errors = baseErrors(card);
  errors.push(...encounterCommonErrors(card, "treachery"));
  if (card.keywords.some((k) => k.name === "surge") && card.abilities.length === 0) {
    errors.push("treachery with surge should reference at least one ability (when_revealed expected)");
  }
  return result(errors);
}

/** An Agents of S.H.I.E.L.D. evidence card (see `EvidenceCard`; docs/phase7-wave2.md §6.4). */
export function validateEvidenceCard(card: EvidenceCard): ValidationResult {
  const errors = baseErrors(card);
  if (!EVIDENCE_KINDS.includes(card.evidence))
    errors.push(`evidence card kind '${String(card.evidence)}' must be means, motive or opportunity`);
  if (!Array.isArray(card.encounterSetIds) || card.encounterSetIds.length === 0)
    errors.push("evidence card must name its set");
  if (!Array.isArray(card.traits)) errors.push("evidence traits must be an array");
  if (!isCardText(card.text)) errors.push("evidence text must have non-empty printed and current strings");
  errors.push(...abilityRefErrors(card.abilities, "evidence"));
  if (card.evidenceIcon !== undefined && !isNonEmptyString(card.evidenceIcon))
    errors.push("evidence evidenceIcon must be a non-empty string when present");
  return result(errors);
}

/** Dispatches to the type-specific validator. */
export function validateCard(card: AnyCard): ValidationResult {
  switch (card.type) {
    case "ally":
      return validateAllyCard(card);
    case "upgrade":
      return validateUpgradeCard(card);
    case "event":
    case "support":
    case "resource":
    case "player_side_scheme":
      return result([...baseErrors(card), ...playerCommonErrors(card)]);
    case "hero_identity":
      return validateHeroIdentityCard(card);
    case "villain":
      return validateVillainCard(card);
    case "minion":
      return validateMinionCard(card);
    case "main_scheme":
      return validateMainSchemeCard(card);
    case "side_scheme":
      return validateSideSchemeCard(card);
    case "treachery":
      return validateTreacheryCard(card);
    case "attachment":
      return validateAttachmentCard(card);
    case "obligation":
    case "environment":
      return result([...baseErrors(card), ...encounterCommonErrors(card, card.type)]);
    case "evidence":
      return validateEvidenceCard(card);
  }
}

const isStageRange = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((n) => isPositiveInteger(n)) &&
  (value[0] as number) <= (value[1] as number);

export function validateScenario(scenario: Scenario): ValidationResult {
  const errors: string[] = [];
  if (!isNonEmptyString(scenario.id)) errors.push("scenario missing id");
  if (!isNonEmptyString(scenario.name)) errors.push("scenario missing name");
  if (!isNonEmptyString(scenario.villainCardId)) errors.push("scenario missing villainCardId");
  if (!isNonEmptyString(scenario.mainSchemeCardId)) errors.push("scenario missing mainSchemeCardId");
  for (const key of [
    "encounterSetIds",
    "recommendedModularSetIds",
    "standardEncounterSetIds",
    "expertEncounterSetIds",
  ] as const) {
    if (!Array.isArray(scenario[key])) errors.push(`scenario ${key} must be an array`);
  }
  if (
    !scenario.villainStages ||
    !isStageRange(scenario.villainStages.standard) ||
    !isStageRange(scenario.villainStages.expert)
  ) {
    errors.push("scenario villainStages.standard/expert must be [first, last] stage numerals");
  }
  const multi = scenario.multipleVillains;
  if (multi !== undefined) {
    if (!Array.isArray(multi.villains) || multi.villains.length < 2) {
      errors.push("scenario multipleVillains must list at least two villains");
    } else {
      if (multi.villains[0]?.villainCardId !== scenario.villainCardId) {
        errors.push("scenario villainCardId must be the first of multipleVillains.villains");
      }
      const ids = new Set<string>();
      for (const villain of multi.villains) {
        if (!isNonEmptyString(villain.villainCardId))
          errors.push("scenario multipleVillains entry missing villainCardId");
        else if (ids.has(villain.villainCardId))
          errors.push(`scenario multipleVillains lists ${villain.villainCardId} twice`);
        else ids.add(villain.villainCardId);
        if (!Array.isArray(villain.encounterSetIds))
          errors.push(`scenario villain ${villain.villainCardId} encounterSetIds must be an array`);
        else if (multi.encounterDecks === "perVillain" && villain.encounterSetIds.length === 0) {
          errors.push(
            `scenario villain ${villain.villainCardId} has its own encounter deck, so it needs the encounter sets to build it from`,
          );
        }
        if (villain.signatureSideSchemeCardId !== undefined && !isNonEmptyString(villain.signatureSideSchemeCardId)) {
          errors.push(
            `scenario villain ${villain.villainCardId} signatureSideSchemeCardId must be a card id when present`,
          );
        }
      }
    }
    if (multi.encounterDecks !== "perVillain")
      errors.push("scenario multipleVillains.encounterDecks must be 'perVillain'");
    if (multi.activation !== "activeVillainOnly")
      errors.push("scenario multipleVillains.activation must be 'activeVillainOnly'");
    if (multi.winCondition !== "allVillainsDefeated")
      errors.push("scenario multipleVillains.winCondition must be 'allVillainsDefeated'");
  }
  if (scenario.usesIdentityEncounterSets !== undefined && typeof scenario.usesIdentityEncounterSets !== "boolean") {
    errors.push("scenario usesIdentityEncounterSets must be a boolean");
  }
  if (scenario.modularSetCount !== undefined && !isNonNegativeInteger(scenario.modularSetCount)) {
    errors.push("scenario modularSetCount must be a whole number of at least 0");
  }
  errors.push(...wave2ScenarioErrors(scenario));
  return result(errors);
}

const isCardIdList = (value: unknown): boolean => Array.isArray(value) && value.every((id) => isNonEmptyString(id));

/** Wave 2 scenario fields: set-aside and expert villains, victory, separate game areas, separate decks. */
function wave2ScenarioErrors(scenario: Scenario): string[] {
  const errors: string[] = [];
  if (scenario.setAsideVillainCardIds !== undefined) {
    if (!isCardIdList(scenario.setAsideVillainCardIds))
      errors.push("scenario setAsideVillainCardIds must be a list of card ids");
    else if (scenario.setAsideVillainCardIds.includes(scenario.villainCardId)) {
      errors.push("scenario setAsideVillainCardIds cannot include the villain that starts in the villain deck");
    }
  }
  const expert = scenario.expertVillains;
  if (expert !== undefined) {
    if (!isNonEmptyString(expert.villainCardId)) errors.push("scenario expertVillains must name its villainCardId");
    if (!isCardIdList(expert.setAsideVillainCardIds))
      errors.push("scenario expertVillains.setAsideVillainCardIds must be a list of card ids");
    if (scenario.multipleVillains !== undefined)
      errors.push("scenario expertVillains is not defined for a scenario with multipleVillains");
  }
  if (
    scenario.victory !== undefined &&
    scenario.victory !== "finalVillainStage" &&
    scenario.victory !== "cardAbility"
  ) {
    errors.push("scenario victory must be 'finalVillainStage' or 'cardAbility'");
  }
  const areas = scenario.separateGameAreas;
  if (areas !== undefined) {
    if (areas.isolation !== "areasCannotAffectEachOther")
      errors.push("scenario separateGameAreas.isolation must be 'areasCannotAffectEachOther'");
    if (!isPositiveInteger(areas.centralStageNumber))
      errors.push("scenario separateGameAreas.centralStageNumber must be a stage number");
    if (areas.encounterDeck !== "shared") errors.push("scenario separateGameAreas.encounterDeck must be 'shared'");
    if (areas.environments !== "inEveryArea")
      errors.push("scenario separateGameAreas.environments must be 'inEveryArea'");
    if (areas.eachPlayer !== "sameArea") errors.push("scenario separateGameAreas.eachPlayer must be 'sameArea'");
    if (areas.uniqueness !== "perArea") errors.push("scenario separateGameAreas.uniqueness must be 'perArea'");
    if (areas.joining !== "sideSchemesAndEngagedMinionsMove")
      errors.push("scenario separateGameAreas.joining must be 'sideSchemesAndEngagedMinionsMove'");
    if (scenario.multipleVillains !== undefined)
      errors.push("scenario separateGameAreas is not defined for a scenario with multipleVillains");
  }
  const decks: unknown = scenario.separateDecks;
  if (decks !== undefined) {
    if (!Array.isArray(decks)) errors.push("scenario separateDecks must be an array");
    else {
      const names = new Set<string>();
      for (const deck of decks as readonly Partial<ScenarioSeparateDeck>[]) {
        const label = `scenario separate deck ${isNonEmptyString(deck?.name) ? deck.name : "(unnamed)"}`;
        if (!isNonEmptyString(deck?.name)) errors.push("scenario separate deck needs a name");
        else if (names.has(deck.name)) errors.push(`${label} is listed twice`);
        else names.add(deck.name);
        const contents = deck?.contents;
        const sets = contents?.encounterSetIds;
        if (!contents || (sets === undefined && contents.cardType === undefined)) {
          errors.push(`${label} contents must name encounter sets, a card type, or both`);
        } else {
          if (sets !== undefined && (!Array.isArray(sets) || sets.length === 0 || !sets.every(isNonEmptyString))) {
            errors.push(`${label} contents.encounterSetIds must list encounter set ids`);
          }
          if (contents.cardType !== undefined && contents.cardType !== "side_scheme")
            errors.push(`${label} contents.cardType must be 'side_scheme'`);
        }
        if (deck?.discardPile !== "own" && deck?.discardPile !== "encounter")
          errors.push(`${label} discardPile must be 'own' or 'encounter'`);
        if (deck?.whenEmpty !== "reshuffleDiscardWithoutPenalty" && deck?.whenEmpty !== "remainsEmpty") {
          errors.push(`${label} whenEmpty must be 'reshuffleDiscardWithoutPenalty' or 'remainsEmpty'`);
        }
        if (deck?.whenEmpty === "reshuffleDiscardWithoutPenalty" && deck.discardPile !== "own") {
          errors.push(`${label} can only reshuffle a discard pile of its own`);
        }
      }
    }
  }
  return errors;
}

/**
 * Which campaign, if any, a scenario is being validated as part of (docs/campaign-mode-design.md §8).
 *
 * Absent is a **standalone** scenario, and the refusals below are exactly what they have always been. `campaignId`
 * is carried so the message can name the campaign; `campaignSetIds` is the campaign's own campaign-specific sets
 * (`Campaign.campaignSetIds`), supplied by the caller because that field is the card-data half of the same rule.
 */
export interface ScenarioModeContext {
  readonly campaignId?: CampaignId;
  readonly campaignSetIds?: readonly EncounterSetId[];
}

/**
 * A scenario checked against the encounter set records it names (wave 2 schema pass, docs/phase7-wave2.md §6.3).
 *
 * **Campaign-specific sets** (RRG 1.8 "Campaign-Specific Card", p. 11: "can only be used during a campaign from the
 * same product (determined by that product's set icon)") are legal only when the scenario is being validated as
 * part of a campaign, and only when the set belongs to *that* campaign — which is the set-icon test, expressed as
 * membership of the campaign's own `campaignSetIds`. Played standalone, the refusal stands: that is the rule, not a
 * "campaign mode is not built" placeholder.
 *
 * **Competitive-only sets** (the Civil War rulebook, p. 3: the Standard PvP set "replaces the standard encounter set
 * when playing in competitive mode") are still refused unconditionally: competitive mode is not built.
 *
 * A set id the list doesn't contain is reported, so the check can't pass by omission.
 */
export function validateScenarioEncounterSets(
  scenario: Scenario,
  sets: readonly EncounterSet[],
  context?: ScenarioModeContext,
): ValidationResult {
  const byId = new Map(sets.map((set) => [set.id as string, set]));
  const errors: string[] = [];
  const named = [
    ...scenario.encounterSetIds,
    ...scenario.recommendedModularSetIds,
    ...scenario.standardEncounterSetIds,
    ...scenario.expertEncounterSetIds,
    ...(scenario.multipleVillains?.villains.flatMap((villain) => villain.encounterSetIds) ?? []),
  ];
  for (const id of new Set(named)) {
    const set = byId.get(id);
    if (!set) errors.push(`scenario ${scenario.id} names encounter set ${id}, which is not registered`);
    else if (set.campaignSpecific && !(context?.campaignSetIds ?? []).includes(id)) {
      errors.push(
        context?.campaignId === undefined
          ? `scenario ${scenario.id} names campaign-specific set ${id}; a campaign-specific set can only be used during a campaign from the same product`
          : `scenario ${scenario.id} names campaign-specific set ${id}, which does not belong to campaign ${context.campaignId}`,
      );
    } else if (set.competitiveOnly)
      errors.push(`scenario ${scenario.id} names competitive-only set ${id}; competitive mode is not built`);
  }
  return result(errors);
}

export function validateStarterDeck(deck: StarterDeck): ValidationResult {
  const errors: string[] = [];
  if (!isNonEmptyString(deck.id)) errors.push("starter deck missing id");
  if (!isNonEmptyString(deck.name)) errors.push("starter deck missing name");
  if (!isNonEmptyString(deck.identityCardId)) errors.push("starter deck missing identityCardId");
  if (!Array.isArray(deck.aspects)) errors.push("starter deck aspects must be an array");
  if (!Array.isArray(deck.cards) || deck.cards.length === 0) errors.push("starter deck must list its cards");
  else {
    const seen = new Set<string>();
    for (const entry of deck.cards) {
      if (!isNonEmptyString(entry.cardId)) errors.push("starter deck entry missing cardId");
      else if (seen.has(entry.cardId)) errors.push(`starter deck lists ${entry.cardId} twice`);
      else seen.add(entry.cardId);
      if (!isPositiveInteger(entry.quantity)) errors.push(`starter deck quantity for ${entry.cardId} must be >= 1`);
    }
  }
  if (!deck.provenance || typeof deck.provenance.verified !== "boolean" || !Array.isArray(deck.provenance.sources)) {
    errors.push("starter deck provenance must say whether the list is verified and cite sources");
  } else if (deck.provenance.verified && deck.provenance.sources.length === 0) {
    errors.push("a verified starter deck must cite at least one source");
  }
  return result(errors);
}

/**
 * Structural checks only — `campaign.id` is well-formed, `boxCode` looks like a printed FFG box code, scenarios and
 * sets are non-empty and duplicate-free, and a source is cited. This does **not** check that the named scenarios
 * or encounter sets actually exist in `@mc/content`'s pool: that is a cross-reference against real data, which
 * belongs to a per-pack test (in the style of `validateScenarioEncounterSets`'s own caller) rather than this
 * package-agnostic structural check (docs/campaign-mode-design.md §3, §9.1 row 1).
 */
export function validateCampaign(campaign: Campaign): ValidationResult {
  const errors: string[] = [];
  if (!isNonEmptyString(campaign.id)) errors.push("campaign missing id");
  if (!isNonEmptyString(campaign.name)) errors.push("campaign missing name");
  if (!/^MC\d{2}$/.test(campaign.boxCode)) errors.push(`campaign ${campaign.id} boxCode must look like "MC10"`);
  if (!isNonEmptyString(campaign.packCode)) errors.push(`campaign ${campaign.id} missing packCode`);
  if (!Array.isArray(campaign.scenarioIds) || campaign.scenarioIds.length === 0) {
    errors.push(`campaign ${campaign.id} must list at least one scenario`);
  } else {
    const seen = new Set<string>();
    for (const id of campaign.scenarioIds) {
      if (seen.has(id)) errors.push(`campaign ${campaign.id} lists scenario ${id} twice`);
      else seen.add(id);
    }
  }
  if (!Array.isArray(campaign.campaignSetIds) || campaign.campaignSetIds.length === 0) {
    errors.push(`campaign ${campaign.id} must list at least one campaign-specific set`);
  } else if (new Set(campaign.campaignSetIds).size !== campaign.campaignSetIds.length) {
    errors.push(`campaign ${campaign.id} lists a campaignSetIds entry twice`);
  }
  if (campaign.perSeatSetIds !== undefined) {
    if (!Array.isArray(campaign.perSeatSetIds) || campaign.perSeatSetIds.length === 0) {
      errors.push(`campaign ${campaign.id} perSeatSetIds must be a non-empty array when present`);
    } else if (new Set(campaign.perSeatSetIds).size !== campaign.perSeatSetIds.length) {
      errors.push(`campaign ${campaign.id} lists a perSeatSetIds entry twice`);
    }
  }
  if (campaign.prohibited !== undefined) {
    const { cardIds, encounterSetIds } = campaign.prohibited;
    if (cardIds !== undefined && !Array.isArray(cardIds)) {
      errors.push(`campaign ${campaign.id} prohibited.cardIds must be an array when present`);
    }
    if (encounterSetIds !== undefined && !Array.isArray(encounterSetIds)) {
      errors.push(`campaign ${campaign.id} prohibited.encounterSetIds must be an array when present`);
    }
  }
  if (!isNonEmptyString(campaign.logSheetReference)) errors.push(`campaign ${campaign.id} missing logSheetReference`);
  return result(errors);
}
