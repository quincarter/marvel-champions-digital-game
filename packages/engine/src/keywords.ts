import type { KeywordInstance, KeywordName } from "@mc/content";
import { DEFAULT_DEPS, type EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import {
  cardOf,
  encounterFace,
  getInstance,
  identityFace,
  isVillain,
  fixedMainSchemeStage,
  mainSchemeStageOf,
  mainSchemeStateOf,
  villainStageOf,
} from "./query.js";
import { cannotHaveStatus, grantedAttackKeywords, statusLimit } from "./rules.js";
import {
  cardsInPlay,
  constantAbilityRefs,
  constantControllerOf,
  uncontrolledYouOf,
  constantSources,
  controllerOf,
  evaluate,
  matchesQuery,
  keywordsBlankFor,
  lastingReaches,
  refsLiveUnderLastingBlank,
  resolveValue,
  type EffectContext,
} from "./select.js";
import type { AttackKeyword, StatusName } from "./spec.js";
import type { GameState } from "./state.js";

/**
 * Keyword semantics are engine behavior keyed off the `KeywordInstance` list on
 * the `@mc/content` card — never a per-card special case. This module is the
 * single lookup layer; the rules themselves live where the relevant game action
 * is resolved (attacks in `select.ts`/`actions.ts`, damage in `resolve/event.ts`,
 * statuses and counters in `effects.ts`).
 *
 * `deps` lets keywords *gained* from constant abilities ("Klaw gains retaliate
 * 1") count; without it only printed keywords are seen.
 */
export function printedKeywordsOf(
  state: GameState,
  id: InstanceId,
  deps: EngineDeps = DEFAULT_DEPS,
): readonly KeywordInstance[] {
  // RRG 1.8 "Blank" (p. 10): no printed text in the text box, keywords included. `deps` makes a *constant*
  // class-wide blank visible (Tech Theft); the lasting kind needs no registry.
  const printed = unblankedPrintedKeywordsOf(state, id);
  return printed.length === 0 || keywordsBlankFor(state, id, deps) ? [] : printed;
}

/**
 * The keywords printed on a card's showing face with no text-box blank applied (`printedKeywordsOf` less the blank
 * check). A facedown card and a card treated as another type still have none. The Permanent keyword's blank
 * protection reads this (RRG 1.8 "Permanent", p. 32; docs/phase7-wave5.md §4.1 Q31), since the keyword protects the
 * very text box it is printed in, and so it can be asked from inside every blank check without recursion.
 */
export function unblankedPrintedKeywordsOf(state: GameState, id: InstanceId): readonly KeywordInstance[] {
  const card = cardOf(state, id);
  if (!card) return [];
  if (state.instances[id]?.facedownAs || state.instances[id]?.treatedAs) return [];
  const face = encounterFace(state, id);
  if (face) return face.keywords;
  if (card.type === "villain") {
    return isVillain(state, id) ? villainStageOf(state, id).keywords : [];
  }
  if (card.type === "main_scheme") {
    const scheme = mainSchemeStateOf(state, id);
    if (scheme) return mainSchemeStageOf(state, scheme).keywords;
    return fixedMainSchemeStage(state, id)?.keywords ?? [];
  }
  if (card.type === "hero_identity") {
    // Keywords are per face: read the face the identity is currently showing.
    const player = state.players.find((p) => p.identity.instanceId === id);
    if (!player) return [];
    return identityFace(state, player).face.keywords;
  }
  return "keywords" in card ? card.keywords : [];
}

/**
 * The form types a card prints, on either face ("Energy form.", "Mass form."; docs/phase7-wave4.md §3.1), read from the
 * card data even while it is facedown or blanked: the owner knows their own facedown card (`TargetQuery.printedForm`).
 */
export function printedFormTypes(state: GameState, id: InstanceId): readonly string[] {
  const card = cardOf(state, id);
  if (!card) return [];
  const faces: readonly (readonly KeywordInstance[])[] = [
    "keywords" in card ? card.keywords : [],
    "flipSide" in card && card.flipSide ? card.flipSide.keywords : [],
  ];
  const types = faces.flatMap((keywords) => keywords.flatMap((k) => (k.name === "form" ? [k.formType] : [])));
  return [...new Set(types)];
}

/**
 * The additional form a card in play grants right now: its showing face's form keyword. A facedown card shows none (RRG
 * 1.8 "Facedown"), and neither does a blanked text box (RRG 1.8 "Blank", p. 10).
 */
export function activeFormType(state: GameState, id: InstanceId, deps: EngineDeps = DEFAULT_DEPS): string | undefined {
  const form = printedKeywordsOf(state, id, deps).find((k) => k.name === "form");
  return form?.name === "form" ? form.formType : undefined;
}

/** Set while a live keyword value (`KeywordGrantSpec.value`) is being read: a re-entrancy guard, not game state. */
let readingGrantValue = false;

/**
 * What constant abilities in play and lasting effects do to a card's keywords right now: the keywords they grant ("X
 * gains retaliate 1"; RRG "Gains": not printed) and the keyword names they take away ("Magneto loses steady",
 * `KeywordGrantSpec.loses`; docs/phase7-wave6.md §3.13).
 */
interface KeywordChanges {
  readonly granted: readonly KeywordInstance[];
  readonly lost: ReadonlySet<KeywordName>;
}

const NO_LOSSES: ReadonlySet<KeywordName> = new Set();

function grantedKeywords(state: GameState, deps: EngineDeps, id: InstanceId): KeywordChanges {
  if (readingKeywordGrants) return scanGrantedKeywords(state, deps, id);
  readingKeywordGrants = true;
  try {
    return scanGrantedKeywords(state, deps, id);
  } finally {
    readingKeywordGrants = false;
  }
}

/**
 * Set while `grantedKeywords` is scanning: a re-entrancy guard, not game state. While it is set, a `TargetQuery`
 * `withKeyword`/`withoutKeyword` clause (`queryHasKeyword`) reads printed keywords only, so a keyword grant whose own
 * `target`/`affects` asks about keywords cannot recurse — the same cut `traitsOf` makes for trait grants.
 */
let readingKeywordGrants = false;

function scanGrantedKeywords(state: GameState, deps: EngineDeps, id: InstanceId): KeywordChanges {
  const granted: KeywordInstance[] = [];
  let lost: Set<KeywordName> | null = null;
  const changes = (): KeywordChanges => ({ granted, lost: lost ?? NO_LOSSES });
  // "She gains retaliate 1 until the end of the phase" (`grantKeywordUntil`, docs/phase7-wave4.md §3.39).
  for (const effect of state.lastingEffects) {
    if (effect.kind === "keywordGrant" && lastingReaches(state, effect, id, deps)) granted.push(effect.keyword);
  }
  if (Object.keys(deps.abilities).length === 0) return changes();
  const inPlay = cardsInPlay(state);
  // "In expert mode, this card gains surge" on a treachery (Surprise!, `sm` 27112; docs/phase7-wave5.md §3.11): an
  // encounter card's grants to itself are read wherever it is, since a revealed treachery is never in play — the
  // `revealCannotBeCanceled` reading of the card's own text (docs/phase7-wave4.md §3.14).
  const ownText = !inPlay.includes(id) && getInstance(state, id)?.ownerId === null ? [id] : [];
  // `constantSources`: the cards in play, and a card in the victory display whose text works there (§3.50 of wave 7).
  for (const sourceId of [...constantSources(state, deps), ...ownText]) {
    for (const ref of constantAbilityRefs(state, sourceId, deps)) {
      const definition = deps.abilities[ref.id];
      if (definition?.trigger.kind !== "constant" || !definition.trigger.keywordGrants) continue;
      // An uncontrolled card whose "you" the rules name (an attachment on a player card, an obligation) grants as that
      // player, as its stat modifiers do (`uncontrolledYouOf`; RRG 1.8 "Attachment", p. 8, "Obligation", p. 30).
      const context: EffectContext = {
        selfInstanceId: sourceId,
        controllerId: constantControllerOf(state, sourceId) ?? uncontrolledYouOf(state, sourceId),
        event: null,
        bindings: {},
        deps,
      };
      for (const grant of definition.trigger.keywordGrants) {
        if (grant.while && !evaluate(state, grant.while, context)) continue;
        if (!matchesQuery(state, id, grant.target, context)) continue;
        if (grant.loses) {
          (lost ??= new Set()).add(grant.keyword.name);
          continue;
        }
        if (!grant.value) {
          granted.push(grant.keyword);
          continue;
        }
        // "Retaliate X, where X is …" (docs/phase7-wave4.md §3.53): read live. While one such X is being read, other
        // live-valued grants are skipped, so an X that asks about keywords cannot re-enter this scan.
        if (readingGrantValue) continue;
        readingGrantValue = true;
        let value: number;
        try {
          value = resolveValue(state, grant.value, context, deps);
        } finally {
          readingGrantValue = false;
        }
        if (value > 0 && "value" in grant.keyword) granted.push({ ...grant.keyword, value });
      }
    }
  }
  return changes();
}

/** Set while `hasGrantedPermanent` is scanning: a re-entrancy guard, not game state. */
let readingGrantedPermanent = false;

/**
 * Whether another card's effect or rule grants this card the Permanent keyword right now, for its blank protection (RRG
 * 1.8 "Permanent", p. 32; docs/phase7-wave5.md §4.1 Q45: a granted keyword protects as a printed one does). Loop-free
 * by construction, as `grantedKeywords` is not (it reads each source's text box through every blank, and a blank check
 * asks this):
 *
 * - This card's own text box is never read: a constant rule on this card granting itself Permanent is skipped, so the
 *   answer cannot depend on whether that very text box is blank. A lasting grant is state, not text, and counts
 *   whoever made it.
 * - A granting card's rules are read under the *lasting* blank only (`refsLiveUnderLastingBlank`), as `blankedSets`
 *   reads a blank rule's source, and each grant's `target`/`while` and each lasting grant's `affects` match with
 *   `DEFAULT_DEPS` (printed characteristics), so nothing here fills a per-state cache with a guarded answer.
 * - While the scan runs, a nested ask (whether the *granting* card is itself protected from a lasting blank) returns
 *   false, so a nested card counts only a printed Permanent. A card that is permanent only through a grant does not in
 *   turn pass its own grant on through a blank that reaches it.
 *
 * So a grant from a card blanked by a constant rule (Tech Theft) still counts here, and two cards granting each other
 * Permanent both fall to a blank that reaches them both; no card grants Permanent that way today.
 */
export function hasGrantedPermanent(state: GameState, id: InstanceId, deps: EngineDeps = DEFAULT_DEPS): boolean {
  if (readingGrantedPermanent) return false;
  readingGrantedPermanent = true;
  try {
    for (const effect of state.lastingEffects) {
      // A lasting grant outlives the ability that made it, so one this card's own ability made counts too.
      if (effect.kind !== "keywordGrant" || effect.keyword.name !== "permanent") continue;
      if (lastingReaches(state, effect, id, DEFAULT_DEPS)) return true;
    }
    if (Object.keys(deps.abilities).length === 0) return false;
    for (const sourceId of cardsInPlay(state)) {
      if (sourceId === id) continue;
      for (const ref of refsLiveUnderLastingBlank(state, sourceId, deps)) {
        const definition = deps.abilities[ref.id];
        if (definition?.trigger.kind !== "constant" || !definition.trigger.keywordGrants) continue;
        const context: EffectContext = {
          selfInstanceId: sourceId,
          controllerId: controllerOf(state, sourceId),
          event: null,
          bindings: {},
          deps: DEFAULT_DEPS,
        };
        for (const grant of definition.trigger.keywordGrants) {
          if (grant.keyword.name !== "permanent" || grant.loses) continue;
          if (grant.while && !evaluate(state, grant.while, context)) continue;
          if (matchesQuery(state, id, grant.target, context)) return true;
        }
      }
    }
    return false;
  } finally {
    readingGrantedPermanent = false;
  }
}

export function keywordsOf(
  state: GameState,
  id: InstanceId,
  deps: EngineDeps = DEFAULT_DEPS,
): readonly KeywordInstance[] {
  const printed = printedKeywordsOf(state, id, deps);
  const { granted, lost } = grantedKeywords(state, deps, id);
  const all = granted.length === 0 ? printed : [...printed, ...granted];
  // RRG 1.8 "'Loses'" (p. 27): a lost keyword is gone whether printed or gained, and "cannot be regained while the
  // ability causing it to be lost is in effect, even if a new effect would cause the characteristic to be gained" —
  // so losses apply after every grant, and every instance of the name goes (all of a card's retaliate, say).
  return lost.size === 0 ? all : all.filter((keyword) => !lost.has(keyword.name));
}

export const hasKeyword = (
  state: GameState,
  id: InstanceId,
  name: KeywordName,
  deps: EngineDeps = DEFAULT_DEPS,
): boolean => keywordsOf(state, id, deps).some((keyword) => keyword.name === name);

/**
 * Permanent (RRG 1.8 "Permanent", p. 32): "Effects on cards not from this card's set cannot defeat this card, remove
 * this card from play, or blank any part of its text box." Read off the printed card as well as its keywords right
 * now, so neither a blank nor turning the card facedown takes it away: Spectrum's facedown energy forms and Vision's
 * mass forms stay in play (docs/phase7-wave4.md §4 Q25, user decision 2026-09-26).
 */
export function isPermanent(state: GameState, id: InstanceId, deps: EngineDeps = DEFAULT_DEPS): boolean {
  return hasKeyword(state, id, "permanent", deps) || printsPermanent(state, id);
}

/** The printed card carries Permanent, whatever face shows and whatever blanks it (`isPermanent`'s fallback). */
function printsPermanent(state: GameState, id: InstanceId): boolean {
  const card = cardOf(state, id);
  return !!card && "keywords" in card && card.keywords.some((keyword) => keyword.name === "permanent");
}

/**
 * Whether a card has this keyword for a `TargetQuery` `withKeyword`/`withoutKeyword` clause: `hasKeyword` (printed,
 * less a blank, plus granted), except that Permanent is `isPermanent`, so "a non-permanent side scheme" excludes
 * exactly the cards the keyword's own protection treats as permanent (docs/phase7-wave4.md §4 Q25; a granted Permanent
 * counts, docs/phase7-wave5.md §4.1 Q45). Inside a keyword-grant scan only printed keywords are read (see
 * `readingKeywordGrants`).
 */
export function queryHasKeyword(state: GameState, id: InstanceId, name: KeywordName, deps: EngineDeps): boolean {
  if (readingKeywordGrants) {
    if (name === "permanent" && printsPermanent(state, id)) return true;
    return printedKeywordsOf(state, id, deps).some((keyword) => keyword.name === name);
  }
  return name === "permanent" ? isPermanent(state, id, deps) : hasKeyword(state, id, name, deps);
}

/** RRG "Keywords": repeated instances of a numbered keyword add their values together. */
export function keywordTotal(
  state: GameState,
  id: InstanceId,
  name: "retaliate" | "incite" | "hinder" | "victory",
  deps: EngineDeps = DEFAULT_DEPS,
): number {
  let total = 0;
  for (const keyword of keywordsOf(state, id, deps)) {
    if (keyword.name !== name) continue;
    total += keyword.value;
    // "Hinder 2[per_hero]": RRG 1.8 "Per Player Icon" (p. 32) multiplies by the players who started the scenario
    // (docs/phase7-wave3.md §1.3).
    if (keyword.name === "hinder") total += (keyword.perPlayer ?? 0) * state.startingPlayerCount;
  }
  return total;
}

export const usesKeyword = (
  state: GameState,
  id: InstanceId,
  deps: EngineDeps = DEFAULT_DEPS,
): Extract<KeywordInstance, { name: "uses" }> | undefined =>
  keywordsOf(state, id, deps).find(
    (keyword): keyword is Extract<KeywordInstance, { name: "uses" }> => keyword.name === "uses",
  );

export const ATTACK_KEYWORDS: readonly AttackKeyword[] = ["piercing", "ranged", "overkill"];

/**
 * Everything an attack needs to know for `attackKeywordsOf`. Nothing here is stored: an attack's keywords are
 * recomputed once, when the attack pushes its damage, and stamped on that damage event.
 */
export interface AttackKeywordContext {
  readonly attackerInstanceId: InstanceId;
  /** The card whose ability is making the attack ("your [Arrow] attacks"); null for a basic attack or an enemy activation. */
  readonly viaInstanceId?: InstanceId | null;
  /** Whether this is a character's basic attack ("your basic attacks gain piercing"); false for an enemy activation. */
  readonly basic?: boolean;
  /** Keywords the attack carries itself: `attack.keywords` ("this attack gains piercing"). */
  readonly keywords?: readonly AttackKeyword[];
  /** The attack/activation event frame's vars, where `modifyAttack` records a grant made mid-activation. */
  readonly vars?: Readonly<Record<string, number>>;
}

/**
 * The `AttackKeyword`s one attack has, from every source at once (RRG 1.8 "Piercing", p. 32; "Ranged", p. 35;
 * "Overkill", p. 31 — each is worded as a property of an attack, not of a character):
 *
 * 1. the attacker's own printed or granted keyword (Crossbones "gains piercing while …");
 * 2. `attack.keywords` on the effect that made it ("this attack gains piercing", Piercing Strike);
 * 3. `modifyAttack.keywords` during the activation, recorded as a var named after the keyword on the attack's own
 *    event frame ("the attack gains piercing", Crossfire's boost) — the same var `overkill` has always used;
 * 4. a constant `attackKeywords` rule in play ("each of your [Arrow] attacks gain ranged", Hawkeye's Bow).
 */
export function attackKeywordsOf(
  state: GameState,
  deps: EngineDeps,
  attack: AttackKeywordContext,
): readonly AttackKeyword[] {
  const via = attack.viaInstanceId ?? null;
  const fromRules = grantedAttackKeywords(state, deps, attack.attackerInstanceId, via, attack.basic === true);
  return ATTACK_KEYWORDS.filter(
    (name) =>
      hasKeyword(state, attack.attackerInstanceId, name, deps) ||
      attack.keywords?.includes(name) === true ||
      (attack.vars?.[name] ?? 0) > 0 ||
      fromRules.includes(name),
  );
}

/**
 * RRG "Status Cards": one of each type per character. Steady allows a second
 * stunned and a second confused; stalwart allows neither; a `statusLimit` rule sets tough's.
 */
export function statusCapacity(
  state: GameState,
  id: InstanceId,
  status: StatusName,
  deps: EngineDeps = DEFAULT_DEPS,
): number {
  // "Ronan the Accuser cannot be stunned." (`ron` 90001; `cannotHaveStatus`, docs/phase7-wave3.md §3.7).
  if (cannotHaveStatus(state, deps, id, status)) return 0;
  // "Any number of" / "1 additional" tough status card(s) (docs/phase7-wave5.md §3.19, docs/phase7-wave6.md §3.7).
  // Steady and stalwart name only stunned and confused, so they never touch tough's capacity.
  if (status === "tough") return statusLimit(state, deps, id, "tough") ?? 1;
  if (hasKeyword(state, id, "stalwart", deps)) return 0;
  return hasKeyword(state, id, "steady", deps) ? 2 : 1;
}

/**
 * Whether a `status` card given to `id` now would be placed on it: it holds fewer than its capacity (RRG 1.8 "Status
 * Cards", p. 41). The one decision `giveStatus`, a `giveStatus` cost and `TargetQuery.canTakeStatus` share, so a query
 * asking for room can never disagree with the give that follows it. A card not in play has no room.
 */
export function canTakeStatus(
  state: GameState,
  id: InstanceId,
  status: StatusName,
  deps: EngineDeps = DEFAULT_DEPS,
): boolean {
  const instance = getInstance(state, id);
  return instance !== undefined && instance.statuses[status] < statusCapacity(state, id, status, deps);
}

/** RRG "Steady": a steady character is not stunned/confused until it holds two of that card. */
export function statusActive(
  state: GameState,
  id: InstanceId,
  status: StatusName,
  deps: EngineDeps = DEFAULT_DEPS,
): boolean {
  const instance = state.instances[id];
  if (!instance) return false;
  const needed = status === "tough" ? 1 : hasKeyword(state, id, "steady", deps) ? 2 : 1;
  return instance.statuses[status] >= needed;
}
