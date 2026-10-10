import type { AbilityReference, AnyCard, CardId, HeroIdentityCard, Trait } from "@mc/content";
import {
  type AbilityDefinition,
  type AbilityTriggerSpec,
  type CardIcon,
  DEFAULT_DEPS,
  type EngineDeps,
  type RuleSpec,
} from "./abilities.js";
import { isRulesCardType, type RulesCardType } from "./card-types.js";
import { countersOfType } from "./counter-types.js";
import type { InstanceId, PlayerId } from "./ids.js";
import {
  activeFormType,
  canTakeStatus,
  hasGrantedPermanent,
  hasKeyword,
  printedFormTypes,
  queryHasKeyword,
  statusActive,
  unblankedPrintedKeywordsOf,
} from "./keywords.js";
import {
  activeEncounterDeck,
  activeVillain,
  baseStat,
  cardOf,
  characterProfile,
  characterStat,
  closedToPlayerCard,
  currentName,
  encounterFace,
  getInstance,
  getPlayer,
  handSize,
  hasStarIcon,
  heroFacesOf,
  identityFace,
  isMinion,
  isVillain,
  locateCard,
  mainSchemeStage,
  fixedMainSchemeStage,
  mainSchemeStageOf,
  mainSchemeStateOf,
  showingResources,
  mainSchemeStates,
  mainSchemeFor,
  printedCostOf,
  sharedMainSchemes,
  activationOrderOf,
  activeVillainIdFor,
  areaOfCard,
  areaOfPlayer,
  maxHitPoints,
  nextClockwisePlayer,
  playerOrder,
  printedHandSize,
  printedHpNumeral,
  printedMinionHp,
  printedProfile,
  textBoxBlank,
  undefeatedVillains,
  villainOf,
  villainStageOf,
  isPlayerCardType,
  scenarioPlayAreaOf,
} from "./query.js";
import type { LogValue } from "./campaign.js";
import {
  campaignLogContains,
  campaignLogField,
  campaignLogIsSet,
  campaignLogNumber,
  campaignSeatNumber,
} from "./campaign-state.js";
import { amplifyIconsInPlay, boostIconsFor } from "./modifiers.js";
import { RESOURCE_TYPES, type ResourcePool } from "./resources.js";
import { attachHostCandidates, hostAllowsCategory } from "./attachment-hosts.js";
import { canPaySpend } from "./payable.js";
import { canUseBasicPower } from "./basic-power-uses.js";
import { uniqueEntryBlocker } from "./unique.js";
import { threatRemovalBlocked } from "./resolve/event.js";
import {
  canHaveAttached,
  cannotEnterPlay,
  cannotFlip,
  canTakePlayerAttack,
  iconsInPlay,
  playerAttackInProgress,
} from "./rules.js";
import {
  currentActivationFrameId,
  PAID_AS_PREFIX,
  PLAY_NOTE_PREFIX,
  playFrameOf,
  playPaymentVars,
  type Bindings,
  type Vars,
} from "./stack.js";
import {
  type AttachmentBound,
  lastingEffectWaiting,
  type LastingDuration,
  type LastingReach,
  type LastingScope,
} from "./lasting.js";
import type {
  CharacterNames,
  PlayerRef,
  Predicate,
  TargetCategory,
  TargetQuery,
  TargetRef,
  ValueSpec,
  AbilityTimingWord,
  StatComparison,
} from "./spec.js";
import { characterTitledAs, identityCardTitledAs, sharesTitleWithAny } from "./titles.js";
import { STATUS_NAMES, type Form, type GameAreaState, type GameState, type ZoneId } from "./state.js";
import type { TriggerEvent } from "./trigger-events.js";
import { damageTakenKey, eventSubjects } from "./trigger-events.js";

/**
 * The hero identity cards of the players a ref names, read live from each player's identity instance: the source of
 * "your obligation" and "your nemesis set" (RRG 1.8 "Obligation" / "Nemesis Encounter Set", p. 30). A player whose
 * identity is not a hero identity contributes nothing.
 */
function heroIdentitiesOf(state: GameState, players: PlayerRef, context: EffectContext): readonly HeroIdentityCard[] {
  return resolvePlayers(state, players, context).flatMap((playerId) => {
    const instanceId = getPlayer(state, playerId)?.identity.instanceId;
    const identity = instanceId === undefined ? undefined : cardOf(state, instanceId);
    return identity?.type === "hero_identity" ? [identity] : [];
  });
}

/** Minion card ids per encounter set, per card pool (a pool never changes during a game, so this is read once). */
const minionsBySetCache = new WeakMap<GameState["cardPool"], ReadonlyMap<string, readonly string[]>>();

/** Whether `cardId` is the only minion card in `setId` (RRG 1.8 "Nemesis Encounter Set", p. 30). */
function soleMinionOfSet(state: GameState, setId: string, cardId: string): boolean {
  let bySet = minionsBySetCache.get(state.cardPool);
  if (!bySet) {
    const built = new Map<string, string[]>();
    for (const card of Object.values(state.cardPool)) {
      if (card.type !== "minion") continue;
      for (const set of card.encounterSetIds) built.set(set, [...(built.get(set) ?? []), card.id]);
    }
    bySet = built;
    minionsBySetCache.set(state.cardPool, bySet);
  }
  const minions = bySet.get(setId) ?? [];
  return minions.length === 1 && minions[0] === cardId;
}

/** `EffectContext.lastKnown` for a card that is no longer in play; undefined for one in play or not recorded. */
const lastKnownOf = (state: GameState, id: InstanceId, context: EffectContext): LastKnownCard | undefined => {
  const known = context.lastKnown?.[id];
  return known !== undefined && !cardsInPlay(state).includes(id) ? known : undefined;
};

/** Everything an effect needs to turn authoring-time refs into concrete ids. */
export interface EffectContext {
  readonly selfInstanceId: InstanceId | null;
  readonly controllerId: PlayerId | null;
  readonly event: TriggerEvent | null;
  readonly bindings: Bindings;
  /** Numbers bound by the ability's cost and earlier effects (see `ValueSpec` `var`). */
  readonly vars?: Vars;
  /** The ability registry, so granted keywords/traits and modified stats are seen. */
  readonly deps?: EngineDeps;
  /** "That player" inside `forEachPlayer`. */
  readonly scopedPlayerId?: PlayerId | null;
  /**
   * The effects are those of an ability labeled "(thwart)", used by a player (RRG 1.8 "Labeled Ability", p. 26: "that
   * ability is considered to be a thwart made by that player's identity"): threat such an ability removes from a
   * scheme is a thwart by the controller's identity, however the removal is written (`removeThreat`, `divide`,
   * `modifyAttack.removesThreat` / `removesThreatFrom`). Owner decision, 2026-10-03. Set by `contextOf` and by
   * `abilityLacksValidTarget`; absent for every other ability and for a delayed effect.
   */
  readonly thwartLabeled?: boolean;
  /**
   * The same for an ability labeled "(attack)" (RRG 1.8 "Labeled Ability", p. 26: "that ability is considered to be an
   * attack made by that player's identity"; owner rulings Q48 and Q49, docs/phase7-wave8.md §4.1): damage such an
   * ability deals to an enemy is an attack on that enemy by the controller's identity, so an enemy that identity may
   * not attack (guard, `cannotAttack`) is no target for it (`resolve/attack-ability.ts`, `target-validity.ts`). Set by
   * `contextOf` and by `abilityLacksValidTarget`.
   */
  readonly attackLabeled?: boolean;
  /**
   * What this context may match inside a closed in-play scenario area (`closedScenarioPlayArea`,
   * docs/phase7-wave8.md §3.33): the area its ability declares (`AbilityDefinition.reaches`, `reachOf`), or `"all"`
   * for a read. A condition, a count and an event pattern are reads (§4.1 Q18 = A: "counting or watching them does
   * not affect them"), and `evaluate`, `resolveValue` and the trigger matcher mark their own context so. Absent: the
   * context is that of an ability that picks or changes cards and does not refer to the area.
   */
  readonly reaches?: "all" | { readonly scenarioPlayArea: string };
  /**
   * Last known information about cards that may have left play, by card: what was attached to each and the status
   * cards it held (`LastKnownCard`). A query's `hasAttachment`, `hasStatus` and `hasAnyStatus` read it for a card that
   * is no longer in play; a card still in play is always read live. Set only where a ruling asks for it: an ally's
   * consequential damage after an attack that defeated its target (`rules.ts` `lastKnownFromAttack`).
   */
  readonly lastKnown?: Readonly<Record<InstanceId, LastKnownCard>>;
}

/** A card as it last was in play, as far as `EffectContext.lastKnown` carries it. */
export interface LastKnownCard {
  readonly attachments: readonly InstanceId[];
  readonly statuses: Readonly<Record<"stunned" | "confused" | "tough", number>>;
}

/** `AbilityDefinition.reaches` as a context field: spread into the context an ability's queries are read in. */
export const reachOf = (
  definition: AbilityDefinition | undefined,
): { readonly reaches?: { readonly scenarioPlayArea: string } } =>
  definition?.reaches ? { reaches: definition.reaches } : {};

/**
 * MC45 p. 5: "Cards in the mission area are in play but under no player's control. They cannot be affected by card
 * abilities unless the ability refers to the mission area." Whether `id` is such a card for this context: in a closed
 * in-play scenario area (or attached to a card in one) that the context does not reach. A card is never closed to its
 * own abilities ("this card", `self`): the sentence is about what reaches into the area, and a card there that could
 * not name itself could not resolve its own text. Reads are not closed (`EffectContext.reaches`).
 *
 * The one test behind every query (`explainQuery`) and every ref that names a card without a query (`resolveRef`).
 * Free in a game with no such area.
 */
export function closedScenarioPlayArea(state: GameState, id: InstanceId, context: EffectContext): string | null {
  const areas = state.scenarioPlayAreas;
  if (areas === undefined) return null;
  if (context.reaches === "all" || id === context.selfInstanceId) return null;
  const name = scenarioPlayAreaOf(state, id);
  if (name === null || areas[name]?.closed !== true) return null;
  return context.reaches?.scenarioPlayArea === name ? null : name;
}

/** The context a lasting effect evaluates in: the ability that created it. */
export const lastingContext = (scope: LastingScope, deps: EngineDeps): EffectContext => ({
  selfInstanceId: scope.selfInstanceId,
  controllerId: scope.controllerId,
  event: null,
  bindings: scope.bindings,
  vars: scope.vars,
  deps,
});

/**
 * Whether a lasting effect's `whileAttached` bound still holds (`AttachmentBound`, docs/phase7-wave6.md §3.50, §4.1
 * Q28): the card is in play, attached to that host.
 */
export function attachmentHolds(state: GameState, bound: AttachmentBound): boolean {
  return state.instances[bound.card]?.attachedTo === bound.host && cardsInPlay(state).includes(bound.host);
}

/**
 * Whether a lasting effect touches this card right now (fixed targets, or a live query). One still waiting to start
 * (`lastingEffectWaiting`: Psychic Kicker's "for its next basic thwart or attack", docs/phase7-wave6.md §3.39) touches
 * nothing yet.
 */
export function lastingReaches(
  state: GameState,
  effect: LastingReach & {
    readonly scope: LastingScope;
    readonly duration?: LastingDuration;
    readonly whileAttached?: AttachmentBound;
  },
  id: InstanceId,
  deps: EngineDeps,
): boolean {
  if (effect.duration && lastingEffectWaiting(effect.duration)) return false;
  if (effect.whileAttached && !attachmentHolds(state, effect.whileAttached)) return false;
  if (effect.targets) return effect.targets.includes(id);
  return effect.affects ? matchesQuery(state, id, effect.affects, lastingContext(effect.scope, deps)) : false;
}

/**
 * The play's frame slot holding the card whose ability played it (`EffectSpec playFromHand.via`; docs/phase7-wave6.md
 * §3.42), inherited by the played card's ability frames and read by `Predicate playedVia`.
 */
export const PLAYED_VIA_SLOT = "playedVia";

/**
 * The slot of an ability frame naming the targets of every triggering condition it answers at once
 * (`EventPattern.together`): "for each [energy] resource discarded" counts the icons of all the cards one discard put
 * in the discard pile, whichever of them the answer is listed under.
 */
export const TOGETHER_TARGETS_SLOT = "together.targets";

/**
 * The slot a lasting stat modifier's `amount` reads the card whose stat is being read from (`EffectSpec
 * modifyStatUntil`, docs/phase7-wave6.md §3.43: "while Wolverine or Jubilee is making a basic attack …, **they** get
 * +2 ATK"). Bound only for that read.
 */
export const AFFECTED_SLOT = "affected";

/** The `enemyAttack` event frame slot a defense records its defender in (`resolve/enemy-activation.ts` `setDefender`). */
export const DEFENDER_SLOT = "defender";

/**
 * RRG 1.8 "You, Your" (p. 49): "Some player cards are considered to be an extension of a player's identity" — events
 * the player plays, resources they spend, and upgrades they control "unless attached to a different friendly
 * character" — so what they do is done by that identity. Allies, supports, player side schemes and encounter cards are
 * not. `TargetQuery.extensionOf` (docs/phase7-wave4.md §3.22: "If Valkyrie defeated that enemy" when an event she
 * played dealt the damage). Read wherever the card is (an event or spent resource is out of play by then); an event or
 * resource is its owner's, an upgrade its controller's.
 */
export function isIdentityExtension(state: GameState, id: InstanceId, players: readonly PlayerId[]): boolean {
  const card = cardOf(state, id);
  const instance = state.instances[id];
  if (!card || !instance) return false;
  const identityOf = (player: PlayerId) => state.players.find((p) => p.playerId === player)?.identity.instanceId;
  if (players.some((player) => identityOf(player) === id)) return true;
  if (card.type === "event" || card.type === "resource")
    return instance.ownerId !== null && players.includes(instance.ownerId);
  if (card.type !== "upgrade") return false;
  const controller = controllerOf(state, id);
  if (controller === null || !players.includes(controller)) return false;
  const host = instance.attachedTo;
  if (host === null || host === identityOf(controller)) return true;
  // "Unless attached to a different friendly character": an upgrade on an enemy (Death-Glow) is still an extension.
  const hostCategories = categoriesOf(state, host);
  return !(hostCategories.includes("ally") || hostCategories.includes("identity"));
}

/**
 * The character a card's ability is performed by, or null when no character performs it: "Characters other than [X]
 * cannot remove threat from [this scheme]" (`RuleSpec threatCannotBeRemoved.exceptBy`, docs/phase7-wave7.md §3.51).
 *
 * - A character (RRG 1.8 "Character", p. 12: "Identities (heroes and alter-egos), allies, villains, and minions are
 *   all characters") acts for itself.
 * - An event or a resource is its owner's identity (RRG 1.8 "You, Your", p. 49: what resolves from a player playing an
 *   event is "performed by that player's identity").
 * - An upgrade attached to a friendly character other than its controller's identity is that character. The RRG says
 *   only that such an upgrade is not an extension of the controller's identity ("unless attached to a different
 *   friendly character"), not whose it is then; the engine reads it as its host's. Any other upgrade (attached to the
 *   identity, to an enemy, or to nothing) is its controller's identity.
 * - A support, a player side scheme and every encounter card that is not a villain or minion is nobody's (RRG 1.8
 *   "You, Your", p. 49: their abilities "are not considered to be performed by that player's identity").
 */
export function actingCharacterOf(state: GameState, id: InstanceId): InstanceId | null {
  const card = cardOf(state, id);
  const instance = state.instances[id];
  if (!card || !instance) return null;
  if (categoriesOf(state, id).includes("character")) return id;
  const identityOf = (player: PlayerId | null) =>
    state.players.find((p) => p.playerId === player)?.identity.instanceId ?? null;
  if (card.type === "event" || card.type === "resource") return identityOf(instance.ownerId);
  if (card.type !== "upgrade") return null;
  const host = instance.attachedTo;
  const hostCategories = host === null ? [] : categoriesOf(state, host);
  if (host !== null && (hostCategories.includes("ally") || hostCategories.includes("identity"))) return host;
  return identityOf(controllerOf(state, id));
}

/**
 * The card type a card has now, as `TargetQuery cardTypeIs` reads it (docs/phase7-wave7.md §3.33): its printed type,
 * which for a double-sided card is its front face's and is the same on either face of an identity. RRG 1.8 "Card
 * Types" (p. 12): "If an ability causes a card to change its card type, it loses all other card types it might
 * possess", so a card in play as a facedown minion or treated as a minion or an ally is that type only. Null for a
 * card whose schema `type` is not a card type of the rules.
 */
export function cardTypeOf(state: GameState, id: InstanceId): RulesCardType | null {
  const instance = getInstance(state, id);
  const card = cardOf(state, id);
  if (!instance || !card) return null;
  if (instance.facedownAs?.kind === "minion" || instance.treatedAs?.kind === "minion") return "minion";
  if (instance.treatedAs?.kind === "ally") return "ally";
  return isRulesCardType(card.type) ? card.type : null;
}

/**
 * The var a "choose one entry of a fixed list" effect binds its answer as (`EffectSpec chooseCardType`,
 * docs/phase7-wave7.md §3.33): `<bind>.chosen.<entry id>` = 1. Vars are numbers, so the entry is named in the key;
 * the binding lives in the resolving ability's vars and nowhere else.
 */
export const chosenVar = (bind: string, entry: string): string => `${bind}.chosen.${entry}`;

/** The entry bound under `bind` by such an effect, read back from the vars; null when nothing is bound. */
export function chosenFromList(vars: Vars | undefined, bind: string): string | null {
  const prefix = chosenVar(bind, "");
  const name = Object.keys(vars ?? {}).find((key) => key.startsWith(prefix) && vars?.[key] === 1);
  return name === undefined ? null : name.slice(prefix.length);
}

export function categoriesOf(state: GameState, id: InstanceId): readonly TargetCategory[] {
  const instance = getInstance(state, id);
  const card = cardOf(state, id);
  if (!instance || !card) return [];
  if (instance.facedownAs?.kind === "minion") return ["minion", "enemy", "character"];
  // An ally an attachment treats as a minion (docs/phase7-wave4.md §3.9).
  if (instance.treatedAs?.kind === "minion") return ["minion", "enemy", "character"];
  // A minion a player controls as an ally (Mind Control, Karma; §3.29).
  if (instance.treatedAs?.kind === "ally") return ["ally", "character"];
  const player = state.players.find((p) => p.identity.instanceId === id);
  if (card.type === "hero_identity" && player) {
    return player.identity.form === "hero" ? ["identity", "hero", "character"] : ["identity", "alterEgo", "character"];
  }
  switch (card.type) {
    case "ally":
      // An ally attached to a card and controlled by no player (Odin on the main scheme, Robert Kelly on Find the
      // Senator) is still an ally and a character in play (RRG 1.8 "In Play and Out of Play", p. 23: a faceup ally that
      // has entered play is in play; "Ally", p. 7: at zero hit points it is defeated), just not a friendly one: ruling
      // Jun 25, 2026 (4) #5, "Characters not under player control are not friendly characters" (`isCaptiveAlly`,
      // docs/phase7-wave6.md §3.75). Ruling Aug 3, 2026 (4) #1 keeps Possessed off Odin because he "cannot have
      // attachments", not because he is no ally.
      return ["ally", "character"];
    case "minion":
      return ["minion", "enemy", "character"];
    case "villain":
      return ["villain", "enemy", "character"];
    case "main_scheme":
      return ["mainScheme", "scheme"];
    case "side_scheme":
    case "player_side_scheme":
      return ["sideScheme", "scheme"];
    case "upgrade":
      return ["upgrade"];
    case "support":
      return ["support"];
    case "attachment":
      return ["attachment"];
    case "event":
      return ["event"];
    case "resource":
      return ["resource"];
    case "treachery":
      return ["treachery"];
    case "obligation":
      return ["obligation"];
    case "environment":
      return ["environment"];
    default:
      return [];
  }
}

/** The three player-card classifications a card effect compares (RRG 1.8 "Classifications", p. 12). */
export type PlayerCardClassification = "identitySpecific" | "aspect" | "basic";

/**
 * The player-card classifications this card belongs to, read off its card data wherever it is (`TargetQuery
 * sameClassificationAs`, docs/phase7-wave6.md §3.51). An identity card is identity-specific in either form (RRG 1.8
 * "Identity-Specific Card", p. 23); a card with an identity's set icon (`aspect: "hero:<id>"`) is identity-specific,
 * and also aspect when it prints one (`printedAspect`); the five aspects are one "aspect" classification (§4.1 Q29);
 * "basic" is basic. Encounter cards and a card printed with none of the three (`aspect: "none"`, a Captive ally) have
 * none. Neither control nor a "treat as" changes a card's classification: it is a printed attribute.
 */
export function classificationsOf(state: GameState, id: InstanceId): readonly PlayerCardClassification[] {
  const card = cardOf(state, id);
  if (!card) return [];
  if (card.type === "hero_identity") return ["identitySpecific"];
  if (!("aspect" in card)) return [];
  const aspect = String(card.aspect);
  if (aspect.startsWith("hero:"))
    return card.printedAspect === undefined ? ["identitySpecific"] : ["identitySpecific", "aspect"];
  if (aspect === "basic") return ["basic"];
  if (aspect === "none") return [];
  return ["aspect"];
}

/**
 * An ally card, controlled or not, that no attachment treats as a minion. Its readers walk a play area, so a captive
 * attached to a card (`isCaptiveAlly`, in no play area) never reaches them.
 */
export function isAlly(state: GameState, id: InstanceId): boolean {
  return categoriesOf(state, id).includes("ally");
}

/**
 * An ally attached to a card and controlled by no player (Odin on the main scheme, Robert Kelly on Find the Senator;
 * docs/phase7-wave6.md §3.75): an ally and a character in play, but not friendly (RRG 1.8 "Friendly", p. 20: "cards the
 * players control"; ruling Jun 25, 2026 (4) #5). A query for a friendly character, `["identity", "ally"]` (the DSL's
 * `FRIENDLY_CHARACTER`), does not match it (`explainQuery`'s "notFriendly").
 */
export function isCaptiveAlly(state: GameState, id: InstanceId): boolean {
  const instance = getInstance(state, id);
  return (
    instance !== undefined &&
    instance.controllerId === null &&
    instance.attachedTo !== null &&
    categoriesOf(state, id).includes("ally")
  );
}

/**
 * A minion attached to another card: "When Defeated: Attach [this minion] to the non-[PSIONIC] ally with the highest
 * cost" (docs/phase7-wave7.md §3.44). RRG 1.8 FAQ "Malice (#199)" (p. 64): while attached she "retains the minion card
 * type" and "any damage on her", "can be attacked and targeted by card abilities (including attachments) like any
 * minion, but cannot be defeated again, even if she gains hit points or heals damage", "is not considered engaged with
 * a player and so cannot activate", and "is discarded when the card to which she is attached leaves play". She is a
 * minion only, not an attachment (§4.1 Q26): `categoriesOf` reads the card type, never where the card sits. An ally
 * attached to a card is `isCaptiveAlly`, which is defeated as any ally.
 */
export function isAttachedMinion(state: GameState, id: InstanceId): boolean {
  return getInstance(state, id)?.attachedTo != null && categoriesOf(state, id).includes("minion");
}

/**
 * A minion an environment holds (`EffectSpec attach` with `as: "heldMinion"`; docs/phase7-wave9.md §3.21): Thunderbolt
 * Backup, `aos` 50131b, "(The minion attached here is in play and can be targeted by attacks and abilities.)". MC50
 * p. 15: "The attached minion is considered to be in play, retains all tokens, status cards, and attachments on it, and
 * can be targeted by attacks and player card abilities. The attached minion does not activate because it is not engaged
 * with any player."
 *
 * It is an attached minion (`isAttachedMinion`) in everything that follows from being engaged with nobody: it never
 * activates (`cannotActivate`), its guard and patrol stop no player (RRG 1.8 "Guard", p. 21, and "Patrol", p. 32, both
 * read "while a minion … is engaged with a player"), and it is no player's "minion engaged with you". Unlike the minion
 * of FAQ "Malice (#199)" (p. 64), whose "cannot be defeated again" is that entry's own, it is defeated at zero hit
 * points or by an effect as any minion is (`cannotBeDefeatedAgain`): the scenario is won by defeating these minions.
 * `engage` takes it off its host into the engaging player's play area with everything on it (`engageInPlayMinion`).
 * RRG 1.8 "Attach To" (p. 8) still governs the host: when it leaves play "the attached card is discarded", not defeated.
 */
export function isHeldMinion(state: GameState, id: InstanceId): boolean {
  return getInstance(state, id)?.heldMinion === true && isAttachedMinion(state, id);
}

/**
 * RRG 1.8 FAQ "Malice (#199)" (p. 64): a minion its own text attached to a card "cannot be defeated again, even if she
 * gains hit points or heals damage". A minion an environment holds is not that minion (`isHeldMinion`).
 */
export function cannotBeDefeatedAgain(state: GameState, id: InstanceId): boolean {
  return isAttachedMinion(state, id) && !isHeldMinion(state, id);
}

/** The printed timing word of an ability's trigger, or null for one with none (a constant, When Revealed, …; §3.33). */
export function timingWordOf(trigger: AbilityTriggerSpec): AbilityTimingWord | null {
  const form = (base: "action" | "interrupt" | "response" | "resource", f: Form | undefined): AbilityTimingWord =>
    f === "hero"
      ? (`hero${base[0]!.toUpperCase()}${base.slice(1)}` as AbilityTimingWord)
      : f === "alterEgo"
        ? (`alterEgo${base[0]!.toUpperCase()}${base.slice(1)}` as AbilityTimingWord)
        : base;
  switch (trigger.kind) {
    case "action":
      return form(trigger.kind, trigger.form);
    case "resource":
      // "Interrupt: When you spend this card …" (`whenSpent`) is printed as an interrupt.
      return form(trigger.whenSpent ? "interrupt" : "resource", trigger.form);
    case "interrupt":
      return trigger.forced ? "forcedInterrupt" : form("interrupt", trigger.form);
    case "response":
      return trigger.forced ? "forcedResponse" : form("response", trigger.form);
    default:
      return null;
  }
}

function printedTraitsOf(state: GameState, id: InstanceId): readonly Trait[] {
  const card = cardOf(state, id);
  if (!card) return [];
  const facedown = getInstance(state, id)?.facedownAs;
  if (facedown) return facedown.traits;
  const treated = getInstance(state, id)?.treatedAs;
  if (treated) {
    if (treated.kind === "ally") return treated.traits;
    const printed = card.type === "ally" ? card.traits : [];
    return treated.keepPrintedTraits ? [...treated.traits, ...printed] : treated.traits;
  }
  const face = encounterFace(state, id);
  if (face) return face.traits;
  if (card.type === "hero_identity") {
    const player = state.players.find((p) => p.identity.instanceId === id);
    if (!player) return [];
    return identityFace(state, player).face.traits;
  }
  if (card.type === "villain") return isVillain(state, id) ? villainStageOf(state, id).traits : [];
  if (card.type === "main_scheme") {
    const scheme = mainSchemeStateOf(state, id);
    if (scheme) return mainSchemeStageOf(state, scheme).traits;
    return fixedMainSchemeStage(state, id)?.traits ?? [];
  }
  return "traits" in card ? card.traits : [];
}

/**
 * Printed traits plus traits gained from constant abilities and lasting effects (RRG "Gains").
 *
 * **A constant trait grant's own `while` and `target` are read against printed characteristics and lasting effects
 * only, never against traits (or keywords, or anything else) that constant abilities grant** — the same guard
 * `blankedByConstantRules` uses below, and for the same reason: a condition like "while you have the Giant trait"
 * (Yellowjacket 12027, Ant-Man's ally 13002) re-enters this function, which would otherwise recurse forever whatever
 * the board looks like, and two grants each conditional on the other's granted trait have no answer at all.
 *
 * The RRG does not settle this: "Modifiers" (p. 29) says a modified quantity is recalculated from its base value and
 * all active modifiers, with no rule for a modifier whose own condition depends on the result, and "Constant
 * Abilities" (p. 5) only says a conditional one is active "anytime the specific condition is met". So this is the
 * engine's reading, chosen because it terminates and because no answer depends on the order cards are visited (see
 * docs/phase7-wave2.md §17.5). It costs the cards that need it nothing: a three-sided identity prints Giant/Tiny on
 * its own hero face, so a form-conditional grant reads a printed trait.
 */
export function traitsOf(state: GameState, id: InstanceId, deps: EngineDeps = DEFAULT_DEPS): readonly Trait[] {
  return traitsOfGuarded(state, id, deps, new Set());
}

/**
 * `traitsOf`, with the cards whose traits are already being worked out (`reading`). A copied-traits grant
 * (`traitGrant.copiedFrom`, "you gain each of the attached character's TRAITS", docs/phase7-wave6.md §3.50) reads its
 * source's traits live (§4.1 Q28), printed and granted; a source already being read in this chain (two characters
 * copying each other) gives its printed traits only, so the read terminates and neither side's answer depends on which
 * is asked first.
 */
function traitsOfGuarded(
  state: GameState,
  id: InstanceId,
  deps: EngineDeps,
  reading: ReadonlySet<InstanceId>,
): readonly Trait[] {
  const traits = [...printedTraitsOf(state, id)];
  for (const effect of state.lastingEffects) {
    if (effect.kind !== "traitGrant" || !lastingReaches(state, effect, id, deps)) continue;
    if (effect.trait !== undefined) {
      traits.push(effect.trait);
      continue;
    }
    const inPlay = cardsInPlay(state);
    const nested = new Set([...reading, id]);
    for (const source of effect.copiedFrom) {
      if (source === id || !inPlay.includes(source)) continue;
      const copied = nested.has(source) ? printedTraitsOf(state, source) : traitsOfGuarded(state, source, deps, nested);
      // A trait already had is not had twice ("Gains", RRG 1.8 p. 21).
      for (const trait of copied) if (!traits.includes(trait)) traits.push(trait);
    }
  }
  // "Considered a [Symbiote] environment" (`countsAs`, docs/phase7-wave5.md §3.9).
  traits.push(...(countsAsExtras(state, deps).get(id)?.traits ?? []));
  if (Object.keys(deps.abilities).length > 0) {
    // A card in the victory display grants a trait too when its text says so (`constantSources`, §3.50 of wave 7).
    for (const sourceId of constantSources(state, deps)) {
      for (const ref of constantAbilityRefs(state, sourceId, deps)) {
        const definition = deps.abilities[ref.id];
        if (definition?.trigger.kind !== "constant" || !definition.trigger.traitGrants) continue;
        // `DEFAULT_DEPS`: printed characteristics only, so neither the condition nor the target query can re-enter
        // this function (a `while: hasTrait(...)`, a `target` that asks what a card may attack, …).
        // "You" is the granting card's speaker, as for its rules and stat modifiers (`constantYouOf`).
        const context: EffectContext = {
          selfInstanceId: sourceId,
          controllerId: constantYouOf(state, sourceId),
          event: null,
          bindings: {},
          deps: DEFAULT_DEPS,
          ...reachOf(definition),
        };
        for (const grant of definition.trigger.traitGrants) {
          if (grant.while && !evaluate(state, grant.while, context)) continue;
          // Trait grants can't depend on traits being granted: every trait filter here only sees printed traits (reading
          // granted traits would recurse back into this function).
          const { trait: requiredTrait, withoutTrait, anyTrait, ...rest } = grant.target;
          const printed = printedTraitsOf(state, id);
          const traitsMatch =
            (!requiredTrait || printed.includes(requiredTrait)) &&
            (!withoutTrait || !printed.includes(withoutTrait)) &&
            (!anyTrait || anyTrait.some((wanted) => printed.includes(wanted)));
          if (matchesQuery(state, id, rest, context) && traitsMatch) {
            if (grant.trait) traits.push(grant.trait);
            if (grant.traitsOf) {
              const query = grant.traitsOf;
              for (const other of cardsInPlay(state)) {
                if (other !== id && matchesQuery(state, other, query, context))
                  traits.push(...printedTraitsOf(state, other));
              }
            }
          }
        }
      }
    }
  }
  return traits;
}

/** Every card instance that is in play, in a stable order (RRG "In Play and Out of Play"). */
/**
 * The faceup cards `playerId` controls that grant an additional form of `formType` now (docs/phase7-wave4.md §3.1): the
 * player "is in <name> <type> form" while one shows that name (RRG 1.8 "Form, Change Form", p. 21).
 */
export function additionalFormCards(
  state: GameState,
  playerId: PlayerId,
  formType: string,
  deps: EngineDeps = DEFAULT_DEPS,
): readonly InstanceId[] {
  return cardsInPlay(state).filter(
    (id) => controllerOf(state, id) === playerId && activeFormType(state, id, deps) === formType,
  );
}

/**
 * The main scheme a `focusedMainScheme` rule names (Focused Defense's host, docs/phase7-wave4.md §3.2), when it is a
 * main scheme in play; else null.
 */
export function focusedMainSchemeId(state: GameState, deps: EngineDeps): InstanceId | null {
  for (const { rule, context } of activeRules(state, deps, "focusedMainScheme")) {
    const scheme = resolveRef(state, rule.scheme, context).find((id) => mainSchemeStateOf(state, id) !== undefined);
    if (scheme !== undefined) return scheme;
  }
  return null;
}

/**
 * The one main scheme encounter cards, enemy threat, acceleration tokens, crisis and patrol mean when a
 * `focusedMainScheme` rule says `encounterCards: "focused"` (Venom Goblin's glider counter, docs/phase7-wave5.md §3.3);
 * else null.
 */
export function gliderMainSchemeId(state: GameState, deps: EngineDeps): InstanceId | null {
  for (const { rule, context } of activeRules(state, deps, "focusedMainScheme")) {
    if (rule.encounterCards !== "focused") continue;
    const scheme = resolveRef(state, rule.scheme, context).find((id) => mainSchemeStateOf(state, id) !== undefined);
    if (scheme !== undefined) return scheme;
  }
  return null;
}

/**
 * Acceleration tokens on cards in play that are not main schemes (their `acceleration` counter, docs/phase7-wave5.md
 * §3.4). RRG 1.8 "Acceleration Token" (p. 5): they "still add threat to the main scheme during step one" — to "the main
 * scheme", so to the glider's when there is one (MC27 p. 17), else the central one.
 */
export function offSchemeAccelerationTokens(state: GameState): number {
  const schemes = new Set(mainSchemeStates(state).map((s) => s.instanceId));
  return cardsInPlay(state)
    .filter((id) => !schemes.has(id))
    .reduce((sum, id) => sum + (getInstance(state, id)?.counters["acceleration"] ?? 0), 0);
}

/** The four icons "for each [crisis], [acceleration], [amplify], and [hazard] in play" counts, in printed order. */
const ALL_CARD_ICONS: readonly CardIcon[] = ["crisis", "acceleration", "amplify", "hazard"];

/**
 * Acceleration tokens on one card in play: a main scheme's `accelerationTokens`, any other card's `acceleration`
 * counter (docs/phase7-wave5.md §3.4). None on a card out of play.
 */
export function accelerationTokensOnCard(state: GameState, id: InstanceId): number {
  const scheme = mainSchemeStates(state).find((candidate) => candidate.instanceId === id);
  if (scheme) return scheme.accelerationTokens;
  return cardsInPlay(state).includes(id) ? (getInstance(state, id)?.counters["acceleration"] ?? 0) : 0;
}

/**
 * Whether the crisis icon and patrol protect this card as "the main scheme": any main scheme, or with a glider-style
 * focus (§3.3; MC21 p. 21 FAQ, "encounter effects that refer to 'the main scheme' only refer to the scheme with the
 * glider counter") only the focused one.
 */
export function isProtectedMainScheme(state: GameState, deps: EngineDeps, id: InstanceId): boolean {
  if (mainSchemeStateOf(state, id) === undefined) return false;
  const glider = gliderMainSchemeId(state, deps);
  return glider === null || glider === id;
}

/** "(Aggression, Justice, Leadership and Protection)": the aspects `ValueSpec distinctAspects` counts (§3.12 of wave 4). */
const FOUR_ASPECTS: readonly string[] = ["aggression", "justice", "leadership", "protection"];

/**
 * The card types `ValueSpec largestHandTypeGroup` groups a hand by: the six MC40 p. 18 lists ("ally, event, player
 * side scheme, resource, support, and upgrade"), the player card types of RRG 1.8 "Card Types" (p. 12) without
 * identity. An encounter card type forms no group (docs/phase7-wave7.md §4.1 Q18 = B).
 */
const HAND_GROUP_TYPES: readonly AnyCard["type"][] = [
  "ally",
  "event",
  "player_side_scheme",
  "resource",
  "support",
  "upgrade",
];

/**
 * The binding slot an ability's frame records its card's host in, read when the ability is initiated (before its cost
 * is paid; `resolve/frames.ts` `abilityFrame`). RRG 1.8 "Initiating Abilities" (p. 24, steps 5-7) and "Cost Arrow
 * Icon" (p. 13): the cost is paid in full before the effect resolves, so a "discard this card →" ability resolves with
 * its card already gone. Its "attached scheme"/"attached character" is read as the card it was attached to (the RRG
 * has no explicit last-known-information rule; this is the only reading under which such text does anything), so
 * `host` and `hostOfSelf` read this slot once the card is no longer attached (Overwatch, `spiderham` 30019).
 */
export const SELF_HOST = "_selfHost";

/**
 * `bindings` plus the card's current host under `SELF_HOST`, when it has one. An unattached card keeps what it was
 * given: an action records its host before its resources are paid (`actions.ts`), which may already have moved it.
 */
export function withSelfHost(state: GameState, instanceId: InstanceId, bindings: Bindings): Bindings {
  const host = getInstance(state, instanceId)?.attachedTo ?? null;
  return host ? { ...bindings, [SELF_HOST]: [host] } : bindings;
}

/** The card this ability's card is attached to: now, or, once it has left its host, when the ability was initiated. */
function hostOfSelfId(state: GameState, context: EffectContext): InstanceId | null {
  if (!context.selfInstanceId) return null;
  const live = getInstance(state, context.selfInstanceId)?.attachedTo ?? null;
  if (live !== null) return live;
  // Its host left play and it stayed (a permanent attachment): to that leaving it is still "attached [card]".
  const event = context.event;
  if (event?.kind === "cardLeavesPlay" && event.strandedAttachments?.includes(context.selfInstanceId))
    return event.instanceId;
  return context.bindings[SELF_HOST]?.[0] ?? null;
}

/**
 * The binding slot the "which villain?" choice fills for a player card's ability with more than one villain in play
 * (owner, 2026-10-04, matrix Q-M2): a player card that targets "the villain" lets its player choose any villain in play.
 * A constant effect or keyword on a player card that says "the villain" is not asked and means the active villain.
 */
export const VILLAIN_CHOICE = "_villain";

/** The binding slot the "which main scheme?" choice fills for a player card's ability (docs/phase7-wave4.md §3.2). */
export const MAIN_SCHEME_CHOICE = "_mainScheme";

/**
 * A player's card: owned by a player (a player deck card, even while it resolves or sits out of play), or a player card
 * type with an encounter back under a player's control (Longshot, docs/phase7-wave6.md §3.71): the scenario owns it,
 * but it is an ally (RRG 1.8 "Player Card", p. 33), so its attack is a player card's ("by player card effects").
 */
export function isPlayerCard(state: GameState, id: InstanceId | null): boolean {
  if (id === null) return false;
  const instance = getInstance(state, id);
  if (!instance) return false;
  if (instance.ownerId !== null) return true;
  const card = cardOf(state, id);
  return instance.controllerId !== null && card !== undefined && isPlayerCardType(card);
}

/**
 * RRG 1.8 "In Play and Out of Play" (p. 23): "Facedown cards attached to in-play cards are out of play." A card attached
 * facedown (`attachCard`'s `facedown`, a swap into a facedown attachment's place) is on its host but not in play: its
 * text is inactive, no ability counts or targets it as an upgrade, ally or support "you control", and it neither enters
 * nor leaves play as it comes and goes. It still goes where its host's attachments go when the host leaves play (RRG
 * 1.8 "Leaves Play", p. 27), its owner may look at it (`visibility.ts`), and an ability that names it finds it: a
 * `TargetQuery` asking for `facedown: true` (`selectTargets`), "the cards attached here" (`TargetRef attachmentsOf`),
 * "you may play the event attached here" (`playableAttachments`). The same standing as a tucked card (RRG 1.8 "Tuck",
 * p. 45). Not a facedown card in play in a role (`FacedownRole` `minion`), nor a loose facedown card in a play area.
 */
export function isFacedownAttachment(state: GameState, id: InstanceId): boolean {
  const instance = getInstance(state, id);
  return instance !== undefined && instance.attachedTo !== null && instance.facedownAs?.kind === "blank";
}

/** The walk behind `cardsInPlay`, in table order; `withFacedownAttachments` keeps the out-of-play facedown attachments. */
function cardsOnTable(state: GameState, withFacedownAttachments: boolean): readonly InstanceId[] {
  // A defeated villain's last stage is removed from the game (RRG 1.8 "Villain Defeat", p. 47), so it is out of play.
  const villains = undefeatedVillains(state).map((villain) => villain.instanceId);
  const ids: InstanceId[] = [...villains, state.mainScheme.instanceId];
  // A card attached to an attachment is in play too, however deep (docs/phase7-wave5.md §4.1 Q50).
  const attachmentsOf = (id: InstanceId): void => {
    for (const attachment of getInstance(state, id)?.attachments ?? []) {
      // A facedown attachment is out of play (p. 23), and nothing attaches to a card out of play.
      if (isFacedownAttachment(state, attachment)) {
        if (withFacedownAttachments) ids.push(attachment);
        continue;
      }
      ids.push(attachment);
      attachmentsOf(attachment);
    }
  };
  const withAttachments = (id: InstanceId): void => {
    ids.push(id);
    attachmentsOf(id);
  };
  for (const villainId of villains) attachmentsOf(villainId);
  attachmentsOf(state.mainScheme.instanceId);
  // A main scheme stage in play beside the central one (Tower Defense; docs/phase7-wave4.md §3.2).
  for (const extra of state.extraMainSchemes ?? []) withAttachments(extra.instanceId);
  // Each separate game area's own main scheme stage (docs/phase7-wave2.md §3.1).
  for (const area of state.gameAreas) if (area.mainScheme) withAttachments(area.mainScheme.instanceId);
  for (const player of playerOrder(state)) {
    withAttachments(player.identity.instanceId);
    for (const id of player.playArea) withAttachments(id);
  }
  for (const id of state.villainArea) withAttachments(id);
  // The scenario's in-play areas no player controls (the mission area, docs/phase7-wave8.md §3.33).
  if (state.scenarioPlayAreas)
    for (const area of Object.values(state.scenarioPlayAreas)) for (const id of area.cards) withAttachments(id);
  return ids;
}

/** Every card in play. A facedown attachment is not (`isFacedownAttachment`, RRG 1.8 p. 23). */
export function cardsInPlay(state: GameState): readonly InstanceId[] {
  return cardsOnTable(state, false);
}

/** The facedown cards attached to cards in play: out of play, on their hosts (`isFacedownAttachment`). */
export function facedownAttachments(state: GameState): readonly InstanceId[] {
  return cardsOnTable(state, true).filter((id) => isFacedownAttachment(state, id));
}

/** A card a "find" names, and the deck it is in (null outside a deck). */
export interface FoundCard {
  readonly id: InstanceId;
  readonly deck: ZoneId | null;
}

/**
 * The cards matching `query` (owned by one of `owners`, when given) in every game area a "find" searches (RRG 1.8
 * "Find", p. 19; docs/phase7-wave6.md §3.48), in the order it looks: cards in play (attached cards included), tucked
 * cards, the set-aside areas (each player's, the scenario's, its named out-of-play areas), hands, discard piles, and
 * last the decks — player decks, separate decks, encounter decks, scenario decks — so a card in an open area is found
 * before anyone searches a deck ("Players should not unnecessarily search game areas if they know where the card
 * they are looking for can be found"). `decksSearchedByFind` names the decks the find then shuffles.
 *
 * Not searched (RRG 1.8 "Find", p. 19): facedown encounter cards in an in-play area (dealt encounter cards, boost cards,
 * a facedown encounter card in play or tucked), the victory display, removed-from-game cards; nor, ruling December 17,
 * 2025 (4) answer 3, anything outside the game ("The **Find** keyword can only search 'in game' areas"), which has no
 * instance here at all. Engine reading: an event card mid-resolution (`PlayerState.resolving`) is not found either; it
 * belongs to the play in progress.
 */
export function findCards(
  state: GameState,
  query: TargetQuery,
  context: EffectContext,
  owners: ReadonlySet<PlayerId> | null,
): readonly FoundCard[] {
  const found: FoundCard[] = [];
  const seen = new Set<InstanceId>();
  const facedownEncounter = (id: InstanceId): boolean => {
    const instance = getInstance(state, id);
    return instance !== undefined && !instance.faceup && !isPlayerCard(state, id);
  };
  const look = (ids: readonly InstanceId[], deck: ZoneId | null = null): void => {
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const instance = getInstance(state, id);
      if (!instance) continue;
      if (owners !== null && (instance.ownerId === null || !owners.has(instance.ownerId))) continue;
      if (!matchesQuery(state, id, query, context)) continue;
      found.push({ id, deck });
    }
  };
  const inPlay = cardsInPlay(state);
  look(inPlay.filter((id) => !facedownEncounter(id)));
  look(inPlay.flatMap((id) => (getInstance(state, id)?.tucked ?? []).filter((t) => !facedownEncounter(t))));
  const players = playerOrder(state);
  for (const player of players) look(player.setAside);
  look(state.encounterSetAside);
  for (const ids of Object.values(state.scenarioAreas ?? {})) look(ids);
  for (const player of players) look(player.hand);
  for (const player of players) {
    look(player.discard);
    for (const piles of Object.values(player.separateDecks)) look(piles.discard);
  }
  for (const deckId of state.encounterDeckOrder) look(state.encounterDecks[deckId]?.discard ?? []);
  for (const piles of Object.values(state.scenarioDecks)) look(piles.discard);
  for (const { zone, ids } of findDecks(state, context)) look(ids, zone);
  return found;
}

/**
 * The decks a "find" looks through, in the order it looks, after every open area: each player's deck and separate
 * decks in player order, the encounter decks, the scenario decks. Not a scenario deck closed to player cards when the
 * find is a player card's (the show deck "cannot be affected by player card effects", MojoMania insert p. 11;
 * docs/phase7-wave6.md §3.66).
 */
function findDecks(
  state: GameState,
  context: EffectContext,
): readonly { readonly zone: ZoneId; readonly ids: readonly InstanceId[] }[] {
  const decks: { zone: ZoneId; ids: readonly InstanceId[] }[] = [];
  for (const player of playerOrder(state)) {
    decks.push({ zone: { kind: "deck", playerId: player.playerId }, ids: player.deck });
    for (const [name, piles] of Object.entries(player.separateDecks))
      decks.push({ zone: { kind: "separateDeck", playerId: player.playerId, name }, ids: piles.deck });
  }
  for (const deckId of state.encounterDeckOrder)
    decks.push({ zone: { kind: "encounterDeck", deckId }, ids: state.encounterDecks[deckId]?.deck ?? [] });
  const sourceCardId = context.selfInstanceId ? getInstance(state, context.selfInstanceId)?.cardId : undefined;
  for (const [name, piles] of Object.entries(state.scenarioDecks)) {
    if (closedToPlayerCard(state, name, sourceCardId)) continue;
    decks.push({ zone: { kind: "scenarioDeck", name }, ids: piles.deck });
  }
  return decks;
}

/**
 * The decks a "find" searched, each shuffled once the find completes, whether or not it found the card (RRG 1.8
 * "Shuffle", p. 40: "Any time a deck is searched by a game step or card ability, that deck is shuffled after the game
 * step or card ability completes its resolution"; "Search", p. 39: "If any portion of a deck is searched … shuffle that
 * entire deck"; the owner's decision, 2026-10-03, docs/phase7-wave6.md §4.1 Q77). `found`: the card the find took, the
 * first in search order, or undefined when it found none.
 *
 * - **Found in an open area** (in play, tucked, set aside, a hand, a discard pile): no deck was searched (RRG 1.8
 *   "Find", p. 19: "Players should not unnecessarily search game areas if they know where the card they are looking
 *   for can be found"), so none is shuffled.
 * - **Found in a deck**: that deck, and each deck the card could have been in that the find looks through before it.
 * - **Not found**: every deck the card could have been in.
 *
 * The decks a card "could be found" in (p. 19) follow from whose card it is, which the players know: a player's card
 * could be in its owner's deck and separate decks, since it goes back to its owner's out-of-play areas (RRG 1.8
 * "Ownership and Control", p. 31); an encounter card (no owner) in an encounter deck or a scenario deck. With `owners`
 * ("your Touched") the card is theirs. Without, it is read from the copies of the card this game has, wherever they
 * are now; a card with no copy in the game at all could be anywhere, so every deck is searched. An empty deck holds
 * nothing to look through and is not shuffled.
 */
export function decksSearchedByFind(
  state: GameState,
  query: TargetQuery,
  context: EffectContext,
  owners: ReadonlySet<PlayerId> | null,
  found: FoundCard | undefined,
): readonly ZoneId[] {
  if (found && found.deck === null) return [];
  const sameDeck = (zone: ZoneId): boolean => JSON.stringify(zone) === JSON.stringify(found?.deck);
  // Whose card it is: its owners, null for an encounter card.
  const holders = new Set<PlayerId | null>(owners ?? []);
  if (owners === null)
    for (const id of Object.keys(state.instances) as InstanceId[])
      if (matchesQuery(state, id, query, context)) holders.add(getInstance(state, id)?.ownerId ?? null);
  const searched: ZoneId[] = [];
  for (const { zone, ids } of findDecks(state, context)) {
    const holds = found !== undefined && sameDeck(zone);
    const couldHold = holders.size === 0 || holders.has("playerId" in zone ? zone.playerId : null);
    if ((holds || couldHold) && ids.length > 0) searched.push(zone);
    if (holds) break;
  }
  return searched;
}

/**
 * Which clause of a `TargetQuery` rejected a card.
 *
 * These are clause names, not player-facing copy: the engine has no wording for them (unlike `EngineError.message`,
 * which is written for exactly that), so a client keeps its own code→wording table. They exist so "why isn't that a
 * legal target?" can be answered by the filter that actually ran, rather than by a second implementation of it.
 */
export type QueryExclusion =
  | "unknownCard"
  /** Not in the in-play scenario area the query names (`TargetQuery.inScenarioPlayArea`). */
  | "notInScenarioPlayArea"
  /** In a closed in-play scenario area the ability does not refer to (MC45 p. 5; `closedScenarioPlayArea`). */
  | "closedScenarioPlayArea"
  | "wrongSelf"
  | "wrongCategory"
  /** A query for a friendly character (`["identity", "ally"]`) and an ally no player controls (`isCaptiveAlly`). */
  | "notFriendly"
  | "wrongController"
  | "notIdentityExtension"
  | "notEngagedWithYou"
  | "notEngaged"
  | "missingTrait"
  | "hasExcludedTrait"
  /** Lacks the query's `withKeyword` keyword (printed or granted). */
  | "missingKeyword"
  /** Has the query's `withoutKeyword` keyword (printed or granted). */
  | "hasExcludedKeyword"
  /** Matches none of the query's `anyOf` alternatives, or matches the query it must not (`not`). */
  | "matchesNoAlternative"
  | "wrongName"
  | "wrongPrintedId"
  | "wrongFacedown"
  /** The card prints no form keyword of the query's `printedForm` type (docs/phase7-wave4.md §3.1). */
  | "wrongForm"
  /** No ability with one of the query's `abilityTiming` words (docs/phase7-wave4.md §3.33), or none printed with a `printsAbility` label. */
  | "noSuchAbility"
  | "wrongStarIcon"
  | "wrongUnique"
  | "notHostOfSelf"
  | "notAttachedToHost"
  /** No card attached to it matches the query's `hasAttachment`. */
  | "missingAttachment"
  | "cannotHaveAttached"
  /** Its own "attach to" text allows none of the hosts the query's `canAttachTo` names, or no card of its `canAttachToCategory`. */
  | "cannotAttachTo"
  /**
   * The query's `canEnterPlay` asks for a card that can enter play, and this one cannot: a card in play matches it
   * under the unique rule, or a `RuleSpec cannotEnterPlay` names it.
   */
  | "cannotEnterPlay"
  /** A `cannotFlip` rule names it, and the query's `canFlip` asks for a card that can be flipped. */
  | "cannotFlip"
  | "wrongOwner"
  | "missingPrintedResource"
  | "wrongAspect"
  | "exhausted"
  | "ready"
  | "noThreat"
  | "hasThreat"
  /** No counter of the query's `hasCounter` type on it (docs/phase7-wave5.md §3.3). */
  | "missingCounter"
  | "notDamaged"
  | "damaged"
  | "missingStatus"
  | "hasStatus"
  /** `canTakeStatus`: a status card of that type given to it now would not be placed. */
  | "noStatusRoom"
  | "printedHpTooHigh"
  | "printedCostTooHigh"
  | "printedCostTooLow"
  /** The card's stat fails the query's `statCompare`, or it has no stats. */
  | "statComparisonFailed"
  | "cannotBeAttacked"
  /** `canAttackOneOf`: there is no other card in play the query matches that this character could attack. */
  | "nothingToAttack"
  | "alreadyChosen"
  | "notInSlot"
  | "wrongSignatureSideScheme"
  | "notEngagedWithPlayer"
  /** Not in the play area of a player the query's `inPlayAreaOf` names (docs/phase7-wave4.md §3.16). */
  | "notInPlayArea"
  | "wrongIdentitySet"
  | "notNemesisMinion"
  /** Not a copy of the obligation of a player the query's `obligationOf` names. */
  | "notObligation"
  /** Not the side scheme of the nemesis set of a player the query's `nemesisSideSchemeOf` names. */
  | "notNemesisSideScheme"
  /** Not a card of the nemesis encounter set of a player the query's `nemesisSetOf` names. */
  | "notNemesisSet"
  | "noSharedTrait"
  /** Not the other face (`otherFaceId`) of a card the query's `otherFaceOf` names. */
  | "notOtherFace"
  /** Shares no classification (identity-specific, aspect, basic) with the query's `sameClassificationAs` cards, or is not of its `classification`. */
  | "wrongClassification"
  | "wrongEncounterSet"
  /** The card's title is not recorded in the campaign-log field the query names (`inCampaignLogField`). */
  | "notInCampaignLog"
  /** In a different separate game area from the effect's (docs/phase7-wave2.md §3.1). */
  | "otherGameArea";

/**
 * The single implementation of "does this card match this query?", reported as *which clause said no*.
 *
 * `matchesQuery` is this function asked whether it found anything, so the filter that selects targets and the
 * explanation of why a card was not selected can never drift apart (see `why-not.ts`). Clauses are checked in the
 * order they are written; the first one that rejects is the one reported.
 */
export function explainQuery(
  state: GameState,
  id: InstanceId,
  query: TargetQuery,
  context: EffectContext,
): QueryExclusion | null {
  if (!inContextArea(state, id, context)) return "otherGameArea";
  const instance = getInstance(state, id);
  if (!instance) return "unknownCard";
  // The mission area (docs/phase7-wave8.md §3.33): a query that names an in-play scenario area matches only cards in
  // it, and a closed area's cards are matched by no query that does not, unless the ability reaches the area.
  if (query.inScenarioPlayArea !== undefined) {
    if (scenarioPlayAreaOf(state, id) !== query.inScenarioPlayArea) return "notInScenarioPlayArea";
  } else if (closedScenarioPlayArea(state, id, context) !== null) return "closedScenarioPlayArea";
  if (query.self !== undefined) {
    const isSelf = context.selfInstanceId === id;
    if (query.self !== isSelf) return "wrongSelf";
  }
  if (query.categories) {
    // A card "considered" another type (`countsAs`, docs/phase7-wave5.md §3.9) matches it too.
    const categories = [
      ...categoriesOf(state, id),
      ...(context.deps ? (countsAsExtras(state, context.deps).get(id)?.categories ?? []) : []),
    ];
    if (!query.categories.some((category) => categories.includes(category))) return "wrongCategory";
    // "A friendly character" is written `["identity", "ally"]`: a captive ally is an ally but no player's (§3.75).
    if (query.categories.includes("identity") && isCaptiveAlly(state, id)) return "notFriendly";
  }
  if (query.cardTypeIs !== undefined) {
    // docs/phase7-wave7.md §3.33: the type chosen earlier in this resolution; nothing chosen matches no card.
    const chosen = chosenFromList(context.vars, query.cardTypeIs.chosen);
    if (chosen === null || cardTypeOf(state, id) !== chosen) return "wrongCategory";
  }
  if (query.controller) {
    const controller = controllerOf(state, id);
    if (query.controller === "encounter" && controller !== null) return "wrongController";
    if (query.controller === "you" && controller !== context.controllerId) return "wrongController";
    if (query.controller === "other" && (controller === null || controller === context.controllerId)) {
      return "wrongController";
    }
  }
  if (query.engagedWith === "you" && instance.engagedWith !== context.controllerId) return "notEngagedWithYou";
  if (query.engagedWith === "any" && instance.engagedWith === null) return "notEngaged";
  if (query.trait && !traitsOf(state, id, context.deps).includes(query.trait)) return "missingTrait";
  if (query.withoutTrait && traitsOf(state, id, context.deps).includes(query.withoutTrait)) return "hasExcludedTrait";
  if (query.anyTrait) {
    const traits = traitsOf(state, id, context.deps);
    if (!query.anyTrait.some((wanted) => traits.includes(wanted))) return "missingTrait";
  }
  if (query.withKeyword !== undefined && !queryHasKeyword(state, id, query.withKeyword, context.deps ?? DEFAULT_DEPS))
    return "missingKeyword";
  if (
    query.withoutKeyword !== undefined &&
    queryHasKeyword(state, id, query.withoutKeyword, context.deps ?? DEFAULT_DEPS)
  )
    return "hasExcludedKeyword";
  if (query.anyOf !== undefined && !query.anyOf.some((alternative) => matchesQuery(state, id, alternative, context)))
    return "matchesNoAlternative";
  // The general negation (docs/phase7-wave7.md §3.8): the card must fail the inner query.
  if (query.not !== undefined && matchesQuery(state, id, query.not, context)) return "matchesNoAlternative";
  // The name showing now: a facedown card has none; a villain or flipped card has its current face's.
  if (query.name !== undefined && currentName(state, id) !== query.name) return "wrongName";
  if (query.printedId !== undefined && instance.cardId !== query.printedId) return "wrongPrintedId";
  if (query.facedown !== undefined && (instance.facedownAs !== null) !== query.facedown) return "wrongFacedown";
  if (query.printedForm !== undefined && !printedFormTypes(state, id).includes(query.printedForm)) return "wrongForm";
  if (query.abilityTiming !== undefined) {
    const wanted = query.abilityTiming;
    const deps = context.deps ?? DEFAULT_DEPS;
    const has = activeAbilityRefs(state, id, deps).some((ref) => {
      const trigger = deps.abilities[ref.id]?.trigger;
      const word = trigger ? timingWordOf(trigger) : null;
      return word !== null && wanted.includes(word);
    });
    if (!has) return "noSuchAbility";
  }
  // The labels the card prints (docs/phase7-wave8.md §3.77), not the abilities it has now: no blank or grant is read.
  if (query.printsAbility !== undefined) {
    const { kinds, form } = query.printsAbility;
    const deps = context.deps ?? DEFAULT_DEPS;
    const card = cardOf(state, id);
    const prints =
      card !== undefined &&
      printedAbilityRefs(card).some((ref) => {
        const trigger = deps.abilities[ref.id]?.trigger;
        if (trigger?.kind === "action") return kinds.includes("action") && trigger.form === form;
        if (trigger?.kind === "response") return kinds.includes("response") && !trigger.forced && trigger.form === form;
        return false;
      });
    if (!prints) return "noSuchAbility";
  }
  // "If that card has a star icon (★) in the boost area" (Longshot, `wolv`). A printed fact (`hasStarIcon`), not a
  // read of the ability registry: see docs/phase7-wave2.md §18.6. RRG 1.8 "Boost, Boost Icon" (p. 11) — a star is not
  // a boost icon, so this clause says nothing about the card's pip count.
  if (query.starIcon !== undefined && hasStarIcon(state, id) !== query.starIcon) return "wrongStarIcon";
  // "Against a unique enemy" (Godslayer, `gam` 18018): the same printed-fact reading `unique.ts`'s `isUnique` uses
  // for the deckbuilding unique rule (RRG 1.8 "Unique", p. 46) — every hero identity is unique whether or not its
  // own card prints the icon. Read inline here (not `isUnique` itself) to avoid a `select.ts` ↔ `unique.ts` import
  // cycle (`unique.ts` already imports `cardsInPlay` from here).
  if (query.unique !== undefined) {
    const card = cardOf(state, id);
    const printedUnique = (card?.unique ?? false) || card?.type === "hero_identity";
    if (printedUnique !== query.unique) return "wrongUnique";
  }
  if (query.hostOfSelf !== undefined) {
    const host = hostOfSelfId(state, context);
    if ((host === id) !== query.hostOfSelf) return "notHostOfSelf";
  }
  // "A Weapon upgrade **on your hero**": the candidate is attached to one of the cards the ref names. The mirror of
  // `hostOfSelf`, which asks whether the candidate *is* this card's host.
  if (query.host !== undefined) {
    const attachedTo = instance.attachedTo;
    if (attachedTo === null || !resolveRef(state, query.host, context).includes(attachedTo)) return "notAttachedToHost";
  }
  // "An ally with a weapon attachment upgrade" (docs/phase7-wave3.md §3.40): the other direction of `host`.
  if (query.hasAttachment !== undefined) {
    const wanted = query.hasAttachment;
    // A facedown attachment is out of play (RRG 1.8 p. 23): no "with an upgrade attached" unless facedown ones are asked for.
    const counts = (attached: InstanceId): boolean =>
      wanted.facedown === true || !isFacedownAttachment(state, attached);
    // A card that has left play: what was attached to it as last known (`EffectContext.lastKnown`).
    const known = lastKnownOf(state, id, context);
    const attachments = known ? known.attachments : instance.attachments.filter(counts);
    if (!attachments.some((attached) => matchesQuery(state, attached, wanted, context))) return "missingAttachment";
  }
  // "Attach it to another character": only a host that can take that card (`cannotHaveAttachments`).
  if (query.canHaveAttached !== undefined) {
    const attachments = resolveRef(state, query.canHaveAttached, context);
    if (!attachments.some((attachment) => canHaveAttached(state, context.deps ?? DEFAULT_DEPS, id, attachment)))
      return "cannotHaveAttached";
  }
  // "An upgrade that can be attached to Deathlok": the card's own printed host, as a play reads it.
  if (query.canAttachTo !== undefined) {
    const deps = context.deps ?? DEFAULT_DEPS;
    const hosts = resolveRef(state, query.canAttachTo, context);
    const allowed = hosts.some((host) => {
      const controller = controllerOf(state, host) ?? instance.ownerId ?? context.controllerId;
      return controller !== null && attachHostCandidates(state, deps, id, controller).includes(host);
    });
    if (!allowed) return "cannotAttachTo";
  }
  // "An upgrade that can be attached to an ally" (docs/phase7-wave8.md §3.59): the printed host text alone.
  if (query.canAttachToCategory !== undefined) {
    const card = cardOf(state, id);
    const printed = card && "attachesTo" in card ? card.attachesTo : undefined;
    if (!printed || !hostAllowsCategory(printed, query.canAttachToCategory)) return "cannotAttachTo";
  }
  // "Chooses 1 set-aside upgrade and puts it into play": not a unique card that matches one in play.
  if (query.canEnterPlay !== undefined) {
    const [forPlayer] = resolvePlayers(state, query.canEnterPlay, context);
    if (uniqueEntryBlocker(state, context.deps ?? DEFAULT_DEPS, id, forPlayer ?? null)) return "cannotEnterPlay";
    // Nor a card a rule keeps out of play (`RuleSpec cannotEnterPlay`, docs/phase7-wave8.md §3.43).
    if (!cardsInPlay(state).includes(id) && cannotEnterPlay(state, context.deps ?? DEFAULT_DEPS, id))
      return "cannotEnterPlay";
  }
  if (query.canFlip && cannotFlip(state, context.deps ?? DEFAULT_DEPS, id)) return "cannotFlip";
  if (query.owner === "you" && instance.ownerId !== context.controllerId) return "wrongOwner";
  if (query.printedResource !== undefined) {
    if (printedResourcesOf(state, id, context.deps)[query.printedResource] <= 0) return "missingPrintedResource";
  }
  if (query.anyPrintedResource !== undefined) {
    const pool = printedResourcesOf(state, id, context.deps);
    if (!query.anyPrintedResource.some((type) => pool[type] > 0)) return "missingPrintedResource";
  }
  if (query.printedResourceNamed !== undefined) {
    const { type, wild } = query.printedResourceNamed;
    const pool = printedResourcesOf(state, id, context.deps);
    // `anyType` is the owner's reading for a named type (docs/phase7-wave7.md §4.1 Q40 = B); `ownType` is RRG p. 48.
    if (pool[type] <= 0 && !(wild === "anyType" && pool.wild > 0)) return "missingPrintedResource";
  }
  if (query.aspect !== undefined) {
    const card = cardOf(state, id);
    // An identity-specific card may also print an aspect (Spider-Woman's Venom Blast: `printedAspect`,
    // docs/phase7-wave2.md §1.2); card effects asking for an aspect's cards count it.
    if (!card || !("aspect" in card) || (card.aspect !== query.aspect && card.printedAspect !== query.aspect))
      return "wrongAspect";
  }
  // "An aspect card": the OR of the four core aspects, read the same way `aspect` is.
  if (query.anyAspect !== undefined) {
    const card = cardOf(state, id);
    const aspects =
      card && "aspect" in card
        ? [String(card.aspect), ...(card.printedAspect === undefined ? [] : [String(card.printedAspect)])]
        : [];
    if (!query.anyAspect.some((wanted) => aspects.includes(wanted))) return "wrongAspect";
  }
  if (query.exhausted !== undefined && instance.exhausted !== query.exhausted)
    return query.exhausted ? "ready" : "exhausted";
  if (query.hasThreat !== undefined && instance.threat > 0 !== query.hasThreat)
    return query.hasThreat ? "noThreat" : "hasThreat";
  if (query.hasCounter !== undefined && countersOfType(state, id, query.hasCounter) <= 0) return "missingCounter";
  if (query.damaged !== undefined && instance.damage > 0 !== query.damaged)
    return query.damaged ? "notDamaged" : "damaged";
  // The status cards of a card that has left play are its last known ones (`EffectContext.lastKnown`).
  const statuses =
    query.hasStatus || query.hasAnyStatus !== undefined
      ? (lastKnownOf(state, id, context)?.statuses ?? instance.statuses)
      : instance.statuses;
  if (query.hasStatus && statuses[query.hasStatus] <= 0) return "missingStatus";
  // "A status card in play": a character carrying at least one of any type (RRG 1.8 "Status Cards", p. 42 lists
  // exactly three). Counts the cards present, so a steady character's second stunned card still reads as "has one".
  if (query.hasAnyStatus !== undefined) {
    const any = STATUS_NAMES.some((status) => statuses[status] > 0);
    if (any !== query.hasAnyStatus) return query.hasAnyStatus ? "missingStatus" : "hasStatus";
  }
  // Room for a status card of that type, by the check `giveStatus` itself makes (RRG 1.8 "Status Cards", p. 41).
  if (query.canTakeStatus !== undefined && !canTakeStatus(state, id, query.canTakeStatus, context.deps ?? DEFAULT_DEPS))
    return "noStatusRoom";
  if (query.maxPrintedHp !== undefined) {
    const card = cardOf(state, id);
    const hp =
      card?.type === "minion" ? printedMinionHp(state, card) : card && "hp" in card ? (card.hp as number) : undefined;
    if (hp === undefined || hp > query.maxPrintedHp) return "printedHpTooHigh";
  }
  if (query.maxPrintedCost !== undefined) {
    const cost = printedCostOf(state, cardOf(state, id));
    const bound =
      typeof query.maxPrintedCost === "number"
        ? query.maxPrintedCost
        : resolveValue(state, query.maxPrintedCost, context);
    if (cost > bound) return "printedCostTooHigh";
  }
  if (query.minPrintedCost !== undefined) {
    const cost = printedCostOf(state, cardOf(state, id));
    const bound =
      typeof query.minPrintedCost === "number"
        ? query.minPrintedCost
        : resolveValue(state, query.minPrintedCost, context);
    if (cost < bound) return "printedCostTooLow";
  }
  if (query.statCompare !== undefined) {
    const { stat, op, value, printed } = query.statCompare;
    const profile = printed ? printedProfile(state, id) : characterProfile(state, id, context.deps);
    if (!profile) return "statComparisonFailed";
    const own = (profile.missing as readonly string[]).includes(stat) ? 0 : profile[stat];
    if (!compareStat(own, op, resolveValue(state, value, context))) return "statComparisonFailed";
  }
  if (query.remainingHpCompare !== undefined) {
    const { op, value } = query.remainingHpCompare;
    const remaining = consideredRemainingHitPoints(state, id, context.deps ?? DEFAULT_DEPS);
    if (remaining === undefined || !compareStat(remaining, op, resolveValue(state, value, context)))
      return "statComparisonFailed";
  }
  if (query.attackableBy) {
    const [attacker] = resolveRef(state, query.attackableBy, context);
    if (!attacker || !canAttack(state, attacker, id, context.deps)) return "cannotBeAttacked";
  }
  if (query.canTakeAttackInProgress === "player") {
    const attack = playerAttackInProgress(state.stack);
    if (!attack || !canTakePlayerAttack(state, context.deps ?? DEFAULT_DEPS, attack, id)) return "cannotBeAttacked";
  }
  if (query.canAttackOneOf) {
    const among = query.canAttackOneOf;
    const any = cardsInPlay(state).some(
      (other) =>
        other !== id && matchesQuery(state, other, among, context) && canAttack(state, id, other, context.deps),
    );
    if (!any) return "nothingToAttack";
  }
  if (query.excludeSlots?.some((slot) => (context.bindings[slot] ?? []).includes(id))) return "alreadyChosen";
  // "each *other* environment card in play": everything this ref names is out.
  if (query.excluding !== undefined && resolveRef(state, query.excluding, context).includes(id)) return "alreadyChosen";
  if (query.inSlot !== undefined && !(context.bindings[query.inSlot] ?? []).includes(id)) return "notInSlot";
  if (query.controlledBy) {
    const controller = controllerOf(state, id);
    if (controller === null || !resolvePlayers(state, query.controlledBy, context).includes(controller))
      return "wrongController";
  }
  if (query.extensionOf && !isIdentityExtension(state, id, resolvePlayers(state, query.extensionOf, context)))
    return "notIdentityExtension";
  if (
    query.signatureSideScheme !== undefined &&
    state.villains.some((villain) => villain.signatureSideSchemeId === id) !== query.signatureSideScheme
  ) {
    return "wrongSignatureSideScheme";
  }
  if (query.inPlayAreaOf) {
    const owners = resolvePlayers(state, query.inPlayAreaOf, context);
    if (!state.players.some((p) => owners.includes(p.playerId) && p.playArea.includes(id))) return "notInPlayArea";
  }
  if (query.engagedWithPlayer) {
    if (
      instance.engagedWith === null ||
      !resolvePlayers(state, query.engagedWithPlayer, context).includes(instance.engagedWith)
    )
      return "notEngagedWithPlayer";
  }
  if (query.identitySetOf) {
    // RRG 1.8 "Identity-Specific Card" (p. 23): the set icon, carried as `aspect: "hero:<identity card id>"`.
    const card = cardOf(state, id);
    const aspect = card && "aspect" in card ? String(card.aspect) : null;
    const identities = resolvePlayers(state, query.identitySetOf, context).map(
      (playerId) => getPlayer(state, playerId)?.identity.cardId,
    );
    if (!aspect || !identities.some((cardId) => cardId !== undefined && aspect === `hero:${cardId}`))
      return "wrongIdentitySet";
  }
  if (query.nemesisMinionOf) {
    // RRG 1.8 "Nemesis Encounter Set" (p. 30): "An identity's 'nemesis minion' is the minion belonging to that
    // identity's nemesis set. If a nemesis set has multiple minions in it, the 'nemesis minion' is designated by
    // parenthetical text" (the card data's `nemesisMinion` flag). A set with one minion prints no parenthetical
    // (every Core nemesis set), so its only minion is the nemesis minion (docs/phase7-wave4.md §3.50).
    const card = cardOf(state, id);
    if (!card || card.type !== "minion") return "notNemesisMinion";
    const sets = card.encounterSetIds;
    const owned = heroIdentitiesOf(state, query.nemesisMinionOf, context).map(
      (identity) => identity.nemesisEncounterSetId,
    );
    const nemesisSet = owned.find((setId) => sets.includes(setId));
    if (nemesisSet === undefined) return "notNemesisMinion";
    if (card.nemesisMinion !== true && !soleMinionOfSet(state, nemesisSet, card.id)) return "notNemesisMinion";
  }
  if (query.obligationOf) {
    // RRG 1.8 "Obligation" (p. 30): the identity's own obligation card, every copy of it, wherever it is.
    const cardId = getInstance(state, id)?.cardId;
    const obligations = heroIdentitiesOf(state, query.obligationOf, context).map(
      (identity) => identity.obligationCardId,
    );
    if (cardId === undefined || !obligations.includes(cardId)) return "notObligation";
  }
  if (query.nemesisSideSchemeOf) {
    // RRG 1.8 "Nemesis Encounter Set" (p. 30): the side scheme belonging to the identity's nemesis set.
    const card = cardOf(state, id);
    if (!card || card.type !== "side_scheme") return "notNemesisSideScheme";
    const sets = card.encounterSetIds;
    const owned = heroIdentitiesOf(state, query.nemesisSideSchemeOf, context).map(
      (identity) => identity.nemesisEncounterSetId,
    );
    if (!owned.some((setId) => sets.includes(setId))) return "notNemesisSideScheme";
  }
  if (query.nemesisSetOf) {
    // RRG 1.8 "Nemesis Encounter Set" (p. 30): any card of the identity's own nemesis set, wherever it is.
    const sets = encounterSetsOf(state, id);
    const owned = heroIdentitiesOf(state, query.nemesisSetOf, context).map(
      (identity) => identity.nemesisEncounterSetId,
    );
    if (!owned.some((setId) => sets.includes(setId))) return "notNemesisSet";
  }
  if (query.sharesTraitWith) {
    // "A card that shares a trait with your hero" (docs/phase7-wave2.md §20.1): both sides read live, so a granted
    // trait counts either way (RRG 1.8 "Gains", p. 21).
    const mine = traitsOf(state, id, context.deps);
    const theirs = new Set(
      resolveRef(state, query.sharesTraitWith, context).flatMap((other) => traitsOf(state, other, context.deps)),
    );
    if (!mine.some((trait) => theirs.has(trait))) return "noSharedTrait";
  }
  if (query.sharesTraitWithHeroOf) {
    // "Must share a trait with your hero", asked while the identity is on its alter-ego side (MC45 p. 20;
    // docs/phase7-wave8.md §3.44): the hero side's printed traits, whichever side is up.
    const mine = traitsOf(state, id, context.deps);
    const theirs = new Set(
      heroIdentitiesOf(state, query.sharesTraitWithHeroOf, context).flatMap((identity) => identity.hero.traits),
    );
    if (!mine.some((trait) => theirs.has(trait))) return "noSharedTrait";
  }
  if (query.otherFaceOf) {
    // "Found on the reverse sides of the [OVERSEER] minions" (MC45 p. 14; docs/phase7-wave8.md §3.46): card data only.
    const mine = cardOf(state, id);
    const isReverse =
      mine !== undefined &&
      resolveRef(state, query.otherFaceOf, context).some((other) => {
        const theirs = cardOf(state, other);
        if (!theirs || other === id || theirs.id === mine.id) return false;
        return theirs.otherFaceId === mine.id || mine.otherFaceId === theirs.id;
      });
    if (!isReverse) return "notOtherFace";
  }
  if (query.sharesTitleWith) {
    // "The minion that shares a title with the villain" (docs/phase7-wave7.md §3.8): titles as they show now, compared
    // as the uniqueness rule compares them; a facedown card has none. Read off the card wherever it is.
    if (!sharesTitleWithAny(state, id, resolveRef(state, query.sharesTitleWith, context))) return "wrongName";
  }
  if (query.encounterSetOf) {
    // "A card from the <X> encounter set" (docs/phase7-wave2.md §20.2): read off card data, so it matches wherever
    // the card is — an encounter deck, a discard pile, set aside, in play.
    const sets = encounterSetsOf(state, id);
    if (sets.length === 0) return "wrongEncounterSet";
    const wanted = new Set(
      resolveRef(state, query.encounterSetOf, context).flatMap((other) => encounterSetsOf(state, other)),
    );
    if (!sets.some((setId) => wanted.has(setId))) return "wrongEncounterSet";
  }
  if (query.scenarioSpecific !== undefined) {
    // RRG 1.8 "Scenario-Specific Card" (p. 39): a card of the set the scenario's own main scheme belongs to.
    const mainScheme = state.cardPool[state.mainScheme.cardId];
    const own = mainScheme && "encounterSetIds" in mainScheme ? (mainScheme.encounterSetIds as readonly string[]) : [];
    const isScenarioSpecific = encounterSetsOf(state, id).some((setId) => own.includes(setId));
    if (isScenarioSpecific !== query.scenarioSpecific) return "wrongEncounterSet";
  }
  // Team-Up names (docs/phase7-wave3.md §3.34; `titles.ts`): the character showing that title, or a card of the
  // identity-specific set of the identity with that title, whoever controls either.
  if (query.titled !== undefined) {
    const names = characterNames(state, query.titled, context);
    if (!names.some((name) => characterTitledAs(state, id, name))) return "wrongName";
  }
  if (query.identitySetTitled !== undefined) {
    const card = cardOf(state, id);
    const aspect = card && "aspect" in card ? String(card.aspect) : "";
    const identity = aspect.startsWith("hero:") ? state.cardPool[aspect.slice("hero:".length)] : undefined;
    const names = identity?.type === "hero_identity" ? characterNames(state, query.identitySetTitled, context) : [];
    if (identity?.type !== "hero_identity" || !names.some((name) => identityCardTitledAs(identity, name)))
      return "wrongIdentitySet";
  }
  if (query.sameClassificationAs !== undefined) {
    // RRG 1.8 "Classifications" (p. 12); docs/phase7-wave6.md §3.51, §4.1 Q29.
    const mine = classificationsOf(state, id);
    const theirs = new Set(
      resolveRef(state, query.sameClassificationAs, context).flatMap((other) => classificationsOf(state, other)),
    );
    if (!mine.some((classification) => theirs.has(classification))) return "wrongClassification";
  }
  // RRG 1.8 "Classifications" (p. 12); docs/phase7-wave8.md §3.53. A printed attribute, read wherever the card is.
  if (query.classification !== undefined && !classificationsOf(state, id).includes(query.classification))
    return "wrongClassification";
  if (query.inEncounterSet !== undefined && !encounterSetsOf(state, id).includes(query.inEncounterSet))
    return "wrongEncounterSet";
  if (query.inCampaignLogField) {
    // "Each EXPERIMENTAL attachment recorded in the campaign log" (MC10 p. 7) as a filter. Membership only: the
    // `campaignLog` selector is where a title recorded twice names two cards (ruling June 2, 2026 (3) answer 3).
    const value = campaignFieldRead(state, query.inCampaignLogField, context);
    if (!campaignLogContains(value, instance.cardId)) return "notInCampaignLog";
  }
  return null;
}

/**
 * The campaign-log field an in-game read names: the shared one, or the column of the seat `seat` resolves to.
 *
 * Undefined when the game has no campaign, when the field is not in the frozen view, or when `seat` names nobody
 * seated in the campaign — every reader above treats all three the same way, as "nothing recorded".
 */
export function campaignFieldRead(
  state: GameState,
  spec: { readonly field: string; readonly seat?: PlayerRef },
  context: EffectContext,
): LogValue | undefined {
  if (!state.campaign) return undefined;
  const seatNumber = campaignSeatRead(state, spec, context);
  if (spec.seat && seatNumber === null) return undefined;
  return campaignLogField(state, spec.field, seatNumber);
}

/**
 * Whose column a campaign-log read or write addresses: the seat `seat` resolves to (the first, as every `PlayerRef`
 * used as a singular does), or null for the shared field and for a `seat` that names nobody.
 */
export function campaignSeatRead(
  state: GameState,
  spec: { readonly seat?: PlayerRef },
  context: EffectContext,
): number | null {
  if (!spec.seat) return null;
  const [playerId] = resolvePlayers(state, spec.seat, context);
  return playerId === undefined ? null : campaignSeatNumber(state, playerId);
}

/** The encounter sets a card belongs to (`encounterSetIds`); empty for a player card. */
function encounterSetsOf(state: GameState, id: InstanceId): readonly string[] {
  const card = cardOf(state, id);
  return card && "encounterSetIds" in card ? (card.encounterSetIds as readonly string[]) : [];
}

/**
 * The separate game area an effect resolves in (docs/phase7-wave2.md §3.1), or null for every area: the players share
 * one area, or the effect's card is area-neutral (an environment, the central stage). The Once and Future Kang insert:
 * "Cards and components in one game area cannot affect another game area (with the exception of the text on stage 2B)."
 *
 * The card resolving the effect decides when it is in an area; otherwise the player resolving it ("That player", then
 * the controller) does, which covers an encounter card revealed by a player and an ability of a card out of play.
 */
export function contextArea(state: GameState, context: EffectContext): GameAreaState | null {
  if (state.gameAreas.length === 0) return null;
  const self = context.selfInstanceId;
  if (self) {
    const area = areaOfCard(state, self);
    if (area) return area;
    if (cardsInPlay(state).includes(self)) return null;
  }
  const player = context.scopedPlayerId ?? context.controllerId;
  return player ? areaOfPlayer(state, player) : null;
}

/** Whether a card can be affected from the effect's area: same area, or either side is in every area. */
export function inContextArea(state: GameState, id: InstanceId, context: EffectContext): boolean {
  if (state.gameAreas.length === 0) return true;
  const area = contextArea(state, context);
  if (!area) return true;
  const cardArea = areaOfCard(state, id);
  return cardArea === null || cardArea.areaId === area.areaId;
}

export const matchesQuery = (state: GameState, id: InstanceId, query: TargetQuery, context: EffectContext): boolean =>
  explainQuery(state, id, query, context) === null;

/**
 * Rule restrictions from constant abilities in play ("cannot take damage",
 * "threat cannot be removed", ally limit, "must defend with an ally"). Like
 * modifiers, they are recomputed on every check (RRG "Constant Abilities").
 *
 * Lives here rather than in `rules.ts` (which is where every consumer of it lives) only so that `canAttack`, an
 * older and much more widely called resident of this module, can read rules through the same one scan as everything
 * else instead of its own hand-rolled copy that saw constant abilities but not lasting ones (docs/phase7-wave2.md
 * §25.2). `rules.ts` imports it straight back out.
 */
export interface ActiveRule<K extends RuleSpec["kind"]> {
  readonly rule: Extract<RuleSpec, { kind: K }>;
  /**
   * The context every query, player ref and `while` of the rule is read in. Its `controllerId` is the rule's "you"
   * (`speakerId`), not the source card's controller: the clauses of one printed sentence ("*you* cannot play *your*
   * hero-specific cards") agree on who "you" is, and a card no player controls but that speaks to one (an obligation,
   * an attachment on a player card, an engaged minion) names that player instead of nobody (`constantYouOf`;
   * docs/phase7-wave2.md §25.3, docs/you-reader-audit.md).
   */
  readonly context: EffectContext;
  /** Who "you" is for the rule: the card's speaker (`constantYouOf`), or a lasting effect's controller. */
  readonly speakerId: PlayerId | null;
  /** A `ruleGrant` lasting effect's duration; absent for a constant ability's rule and a scenario's. */
  readonly lastingUntil?: LastingDuration;
}

/**
 * Every rule of this kind in force right now: from constant abilities on cards in play, **and** from
 * `ruleGrant` lasting effects (docs/phase7-wave2.md §22, "you cannot change form until your next turn ends").
 *
 * A lasting rule's source card is usually gone by the time it is read — both obligations that need this discard
 * themselves as they resolve — so its `speakerId` is the creating ability's own controller rather than anything
 * derived from the card's current position (RRG 1.8 "Lasting Effects", p. 26: a lasting effect keeps working
 * "whether or not the card that created the lasting effect is in play").
 */
export function activeRules<K extends RuleSpec["kind"]>(
  state: GameState,
  deps: EngineDeps,
  kind: K,
): readonly ActiveRule<K>[] {
  const found: ActiveRule<K>[] = [];
  const record = (rule: RuleSpec, context: EffectContext, lastingUntil?: LastingDuration) => {
    found.push({
      rule: rule as Extract<RuleSpec, { kind: K }>,
      context,
      speakerId: context.controllerId,
      ...(lastingUntil ? { lastingUntil } : {}),
    });
  };
  for (const sourceId of constantSources(state, deps)) {
    for (const ref of constantAbilityRefs(state, sourceId, deps)) {
      const definition = deps.abilities[ref.id];
      if (definition?.trigger.kind !== "constant") continue;
      for (const rule of definition.trigger.rules ?? []) {
        if (rule.kind !== kind) continue;
        // "You" is the card's speaker for the rule's `while` ("while you are in alter-ego form" on an obligation,
        // docs/phase7-wave6.md §3.58) and for every query and player ref its readers match.
        const context: EffectContext = {
          selfInstanceId: sourceId,
          controllerId: constantYouOf(state, sourceId),
          event: null,
          bindings: {},
          deps,
          ...reachOf(definition),
        };
        if ("while" in rule && rule.while && !evaluate(state, rule.while, context)) continue;
        record(rule, context);
      }
    }
  }
  for (const effect of state.lastingEffects) {
    if (effect.kind !== "ruleGrant" || effect.rule.kind !== kind) continue;
    const context = lastingContext(effect.scope, deps);
    if ("while" in effect.rule && effect.rule.while && !evaluate(state, effect.rule.while, context)) continue;
    record(effect.rule, context, effect.duration);
  }
  // Rules the scenario imposes without a card (`ScenarioRules.rules`, docs/phase7-wave4.md §3.40).
  for (const rule of state.scenarioRules.rules ?? []) {
    if (rule.kind !== kind) continue;
    const context: EffectContext = { selfInstanceId: null, controllerId: null, event: null, bindings: {}, deps };
    if ("while" in rule && rule.while && !evaluate(state, rule.while, context)) continue;
    record(rule, context);
  }
  return found;
}

/**
 * **The one place that decides who "you" is for a card in play, from the card's own state.** Every constant reader
 * (rules, stat modifiers, keyword and trait grants, cost modifiers, text-box blanks, `countsAs`) and the action
 * abilities of an uncontrolled card read it; docs/you-reader-audit.md lists them. In order:
 *
 * 1. the card's controller;
 * 2. the player the rules name for an uncontrolled card (`uncontrolledYouOf`): the controller of the player card it is
 *    attached to (RRG 1.8 "Attachment", p. 8), or the player whose play area holds it when it is an obligation
 *    ("Obligation", p. 30) or an environment placed there;
 * 3. the player whose play area it is otherwise in: an engaged minion's engaged player.
 *
 * Null for everything else (a card in the villain's area, an attachment on an enemy or a scheme). This is the reading
 * with no other context to go on, which is all a constant ability has. Text about a context names it with its own ref
 * and never comes here: the attacked player (`PlayerRef attackedPlayer`), an event's player (`eventPlayer`), a chosen
 * target, the player resolving a When Revealed or Boost ability (the ability frame's controller). A triggered ability
 * on an uncontrolled card stops at step 2 (`uncontrolledYouOf`) so that the event still decides for an enemy.
 */
export function speakerOf(state: GameState, sourceId: InstanceId | null): PlayerId | null {
  if (!sourceId) return null;
  return (
    controllerOf(state, sourceId) ??
    uncontrolledYouOf(state, sourceId) ??
    state.players.find((p) => p.playArea.includes(sourceId))?.playerId ??
    null
  );
}

/**
 * `speakerOf` for a card read as one of `constantSources`: a card in the victory display speaks for its owner
 * (`constantControllerOf`, docs/phase7-wave7.md §3.50), having neither a controller nor a place on the table.
 */
export function constantYouOf(state: GameState, sourceId: InstanceId): PlayerId | null {
  return state.victoryDisplay.includes(sourceId) ? constantControllerOf(state, sourceId) : speakerOf(state, sourceId);
}

/**
 * Who a triggered ability's "you"/"your" is on an uncontrolled card whose "you" the rules name: an attachment on a
 * player card ("it refers to the attached player card's controller", RRG 1.8 "Attachment", p. 8), or an obligation
 * ("apply only to the player whose play area the obligation is in", RRG 1.8 "Obligation", p. 30). Null for every
 * other uncontrolled card (an enemy, a scheme), whose "you" is still the player the event is about.
 *
 * Narrower than `speakerOf` on purpose: an engaged minion is in a player's area too, but "after you attack this
 * minion" means whichever player attacks it.
 */
export function uncontrolledYouOf(state: GameState, id: InstanceId): PlayerId | null {
  const instance = getInstance(state, id);
  if (!instance) return null;
  if (instance.attachedTo) return controllerOf(state, instance.attachedTo);
  // An obligation, and an environment placed in a player's play area (Ebony Maw's Spells, "in front of them in their play
  // area", MC21 p. 6; "deal 4 damage to your identity": docs/phase7-wave4.md §3.16).
  const type = cardOf(state, id)?.type;
  if (type !== "obligation" && type !== "environment") return null;
  return state.players.find((p) => p.playArea.includes(id))?.playerId ?? null;
}

/**
 * The binding slot that records the cards an ability discarded from `playerId`'s deck, by an effect or as a cost
 * (`recordDeckDiscard`), on the frame that keeps a set of them. Read by `countedResourcesOf`.
 */
export const DECK_DISCARDS_PREFIX = "_deckDiscards:";
export const deckDiscardsSlot = (playerId: PlayerId): string => `${DECK_DISCARDS_PREFIX}${playerId}`;

/**
 * A card's printed resources as an ability counts them (`<bind>.<type>`, `ValueSpec totalPrintedResources`): the
 * printed icons (`printed`), with each icon a `deckDiscardIconCount` rule names counted `times` times when this
 * ability discarded the card from the deck of a player the rule binds ("count each printed [wild] icon twice",
 * docs/phase7-wave7.md §3.56). The type of an icon is unchanged, and so is the card for every other reader.
 *
 * Two such rules on one icon do not multiply: the larger `times` counts (no card pair in the pool does this).
 */
export function countedResourcesOf(
  state: GameState,
  id: InstanceId,
  printed: ResourcePool,
  bindings: Bindings,
  deps: EngineDeps | undefined,
): ResourcePool {
  if (!deps || !Object.keys(bindings).some((slot) => slot.startsWith(DECK_DISCARDS_PREFIX))) return printed;
  let counted = printed;
  for (const active of activeRules(state, deps, "deckDiscardIconCount")) {
    const { resource, times } = active.rule;
    const fromTheirDeck = rulePlayers(state, active.rule, active).some((playerId) =>
      (bindings[deckDiscardsSlot(playerId)] ?? []).includes(id),
    );
    if (fromTheirDeck) counted = { ...counted, [resource]: Math.max(counted[resource], printed[resource] * times) };
  }
  return counted;
}

/**
 * A card's printed resources as they count now: its printed icons, unless a `printedResourceAs` rule turns every icon
 * of a card in a named player's hand into one resource of a type ("Treat the printed resource of each card in your hand
 * as if it were [energy]", Haywire; docs/phase7-wave5.md §3.20).
 */
export function printedResourcesOf(state: GameState, id: InstanceId, deps: EngineDeps | undefined): ResourcePool {
  const printed = showingResources(state, id);
  if (!deps) return printed;
  const zone = locateCard(state, id);
  if (zone?.kind !== "hand") return printed;
  for (const active of activeRules(state, deps, "printedResourceAs")) {
    if (!rulePlayers(state, active.rule, active).includes(zone.playerId)) continue;
    const total = printed.physical + printed.mental + printed.energy + printed.wild;
    return { physical: 0, mental: 0, energy: 0, wild: 0, [active.rule.as]: total };
  }
  return printed;
}

/**
 * The players whose deck's top card is kept faceup right now (`RuleSpec topOfDeckFaceup`, docs/phase7-wave8.md §3.48),
 * each once. Read from the rules in force, never from anything stored: a rule that is off (the other face, a blank
 * text box, a false `while`, its card out of play) is simply not among `activeRules`.
 */
export function deckTopFaceupPlayers(state: GameState, deps: EngineDeps): readonly PlayerId[] {
  const players: PlayerId[] = [];
  for (const active of activeRules(state, deps, "topOfDeckFaceup")) {
    if (active.rule.deck === "encounter") continue;
    for (const playerId of rulePlayers(state, active.rule, active)) {
      if (!players.includes(playerId)) players.push(playerId);
    }
  }
  return players;
}

/** Characters whose floor is being read right now: a floor rule's own `while` reads their true dial (no re-entry). */
const readingFloorOf = new Set<InstanceId>();

/**
 * The floor a `consideredRemainingHp` rule puts on what readers see as this character's remaining hit points
 * (docs/phase7-wave8.md §3.10): the highest `atLeast` among the rules in force that match it, undefined with none.
 * "As if it has at least 1 hit point" while an ability resolves (`resolveSpecials.asIf`, §3.11) is such a rule, granted
 * for as long as that ability's effects last, so it is read here with the rest.
 */
export function hitPointFloor(state: GameState, id: InstanceId, deps: EngineDeps): number | undefined {
  if (readingFloorOf.has(id)) return undefined;
  readingFloorOf.add(id);
  try {
    let floor: number | undefined;
    for (const { rule, context } of activeRules(state, deps, "consideredRemainingHp")) {
      if (floor !== undefined && rule.atLeast <= floor) continue;
      if (matchesQuery(state, id, rule.target, context)) floor = rule.atLeast;
    }
    return floor;
  } finally {
    readingFloorOf.delete(id);
  }
}

/**
 * A character's remaining hit points as every reader of the game state sees them: the dial (maximum hit points minus
 * damage, never below 0), raised to any `consideredRemainingHp` floor in force (§3.10, §4.1 Q6 = A). Undefined for a
 * card with no hit points. `remainingHitPoints` (`query.ts`) is the true dial.
 */
export function consideredRemainingHitPoints(state: GameState, id: InstanceId, deps: EngineDeps): number | undefined {
  const max = maxHitPoints(state, id, deps);
  const instance = getInstance(state, id);
  if (max === undefined || !instance) return undefined;
  return Math.max(0, max - instance.damage, hitPointFloor(state, id, deps) ?? 0);
}

/**
 * The card showing on top of `playerId`'s deck under a `topOfDeckFaceup` rule: the deck's first card while the rule
 * holds for that player, null when it does not or the deck is empty. The single derivation `faceVisible`, the
 * `topOfDeckFaceup` predicate's `matches` and the log (`announceDeckTops`) agree on.
 */
export function shownDeckTop(state: GameState, deps: EngineDeps, playerId: PlayerId): InstanceId | null {
  const top = getPlayer(state, playerId)?.deck[0];
  if (top === undefined) return null;
  return deckTopFaceupPlayers(state, deps).includes(playerId) ? top : null;
}

/**
 * Whether the top card of the encounter deck is kept faceup right now (`RuleSpec topOfDeckFaceup { deck: "encounter" }`,
 * docs/phase7-wave9.md §3.42): one rule in force is enough, and a second adds nothing. Read from the rules in force,
 * never from anything stored.
 */
export const encounterTopFaceup = (state: GameState, deps: EngineDeps): boolean =>
  activeRules(state, deps, "topOfDeckFaceup").some((active) => active.rule.deck === "encounter");

/**
 * The card showing on top of the encounter deck under that rule: the first card of the active villain's encounter deck
 * while the rule holds, null when it does not or the deck is empty. The single derivation `faceVisible`, the
 * `topOfDeckFaceup` predicate and the log (`announceDeckTops`) agree on.
 */
export function shownEncounterTop(state: GameState, deps: EngineDeps): InstanceId | null {
  const top = activeEncounterDeck(state).deck[0];
  if (top === undefined) return null;
  return encounterTopFaceup(state, deps) ? top : null;
}

/** The players a rule's `player` ref binds, with "you" read as the rule's speaker (`ActiveRule.context`). */
export const rulePlayers = (
  state: GameState,
  rule: { readonly player: PlayerRef },
  active: Pick<ActiveRule<RuleSpec["kind"]>, "context">,
): readonly PlayerId[] => resolvePlayers(state, rule.player, active.context);

const guardEngagedWith = (state: GameState, playerId: PlayerId, deps: EngineDeps): boolean =>
  cardsInPlay(state).some(
    (id) =>
      isMinion(state, id) && getInstance(state, id)?.engagedWith === playerId && hasKeyword(state, id, "guard", deps),
  );

/**
 * A `characterIgnores` rule exempts this character from guard, patrol or the crisis icon (docs/phase7-wave4.md §3.24),
 * or its attack on `against` from that character's retaliate (docs/phase7-wave7.md §3.30).
 */
export function characterIgnores(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId | null | undefined,
  what: "guard" | "patrol" | "crisis" | "retaliate",
  /** A basic thwart (`characterIgnores.basicOnly`, docs/phase7-wave5.md §3.22). */
  basic = false,
  /** The attacked character (`characterIgnores.against`); a rule with `against` holds only when this matches it. */
  against: InstanceId | null = null,
): boolean {
  if (!id) return false;
  return activeRules(state, deps, "characterIgnores").some(
    ({ rule, context }) =>
      rule.ignores.includes(what) &&
      (rule.basicOnly !== true || basic) &&
      (rule.against === undefined || (against !== null && matchesQuery(state, against, rule.against, context))) &&
      matchesQuery(state, id, rule.target, context),
  );
}

/**
 * Whether a basic thwart by this character may target this scheme (`RuleSpec basicThwartTargets`, docs/phase7-wave5.md
 * §3.22): every rule naming the character must list the scheme.
 */
export function basicThwartTargetAllowed(
  state: GameState,
  deps: EngineDeps,
  thwarterId: InstanceId,
  schemeId: InstanceId,
): boolean {
  return activeRules(state, deps, "basicThwartTargets").every(
    ({ rule, context }) =>
      !matchesQuery(state, thwarterId, rule.character, context) ||
      resolveRef(state, rule.among, context).includes(schemeId),
  );
}

/**
 * RRG "Guard": while a minion with guard is engaged with a player, that player
 * cannot use cards they control to attack a villain without this keyword. It
 * restricts the *controller*, so it blocks that player's allies too, and it
 * only ever protects villains — other minions stay attackable. Ranged does not
 * bypass guard (RRG "Ranged" only ignores retaliate). With several villains in
 * play it protects every one of them, not only the active villain (RRG 1.8
 * "Guard", p. 21: "The engaged player cannot attack any villain.").
 */
export function canAttack(
  state: GameState,
  attackerId: InstanceId,
  targetId: InstanceId,
  deps: EngineDeps = DEFAULT_DEPS,
): boolean {
  const controller = controllerOf(state, attackerId);
  // An attack by an enemy is nobody's attack: neither guard nor a player-scoped `cannotAttack` (an `attacker`-scoped
  // one still can, and does apply to an enemy attacker — see `attackForbidden`).
  if (attackForbidden(state, attackerId, controller, targetId, deps)) return false;
  if (controller === null) return true;
  if (!isVillain(state, targetId)) return true;
  if (hasKeyword(state, targetId, "guard", deps)) return true;
  if (characterIgnores(state, deps, attackerId, "guard")) return true;
  return !guardEngagedWith(state, controller, deps);
}

/**
 * A `cannotAttack` rule in force forbids this attack: "Players cannot attack other villains" (Distracting Taunts,
 * `twc` 07035 — no `player`, so the whole table) or "You cannot attack Kang" (Fear of Kang, `toafk` 11049 — a
 * `player`, so only them). docs/phase7-wave2.md §25. "Drax cannot attack minions" (`gam` 18019, docs/phase7-wave3.md
 * §3.26) is scoped by `attacker` instead — the attacking *character*, checked regardless of controller (so it
 * reaches an enemy's own attack too, unlike every `player`-scoped rule, which a controller-less attacker can never
 * match).
 *
 * `attackerPlayerId` is the **attacker's controller**, which is what "you cannot attack" restricts: RRG 1.8 "Guard"
 * (p. 21) equates "that player cannot use cards they control to attack a villain" with the constant ability "The
 * engaged player cannot attack any villain", so a player's allies attack on their behalf. It is deliberately not the
 * rule card's own controller, which for an obligation is nobody.
 */
function attackForbidden(
  state: GameState,
  attackerId: InstanceId,
  attackerPlayerId: PlayerId | null,
  targetId: InstanceId,
  deps: EngineDeps,
): boolean {
  return activeRules(state, deps, "cannotAttack").some((active) => {
    const { player, target, attacker } = active.rule;
    if (attacker && !matchesQuery(state, attackerId, attacker, active.context)) return false;
    if (player) {
      if (attackerPlayerId === null || !rulePlayers(state, { player }, active).includes(attackerPlayerId)) {
        return false;
      }
    }
    return matchesQuery(state, targetId, target, active.context);
  });
}

/** A minion's controller is null (it belongs to the encounter side) even while engaged. */
export function controllerOf(state: GameState, id: InstanceId): PlayerId | null {
  const instance = getInstance(state, id);
  if (!instance) return null;
  const player = state.players.find((p) => p.identity.instanceId === id);
  if (player) return player.playerId;
  return instance.controllerId;
}

/**
 * The player an event's source card acts for: its controller, else the player the rules name for an uncontrolled card
 * (`uncontrolledYouOf`: the holder of an obligation, RRG 1.8 "Obligation", p. 30; the controller of the player card an
 * attachment is on, "Attachment", p. 8), so damage or a threat removal from such a card is that player's and a defeat
 * it causes names them (`characterDefeated.defeatedByPlayerId`). Null for every other encounter card. An event no
 * player makes (`noPlayer` on a `dealDamage` or `removeThreat` event; owner decision, docs/phase7-wave7.md §4.1 Q2)
 * names nobody whoever the card speaks to.
 */
export function sourcePlayerOf(
  state: GameState,
  event: { readonly sourceInstanceId: InstanceId | null; readonly noPlayer?: true },
): PlayerId | null {
  if (event.noPlayer || event.sourceInstanceId === null) return null;
  return controllerOf(state, event.sourceInstanceId) ?? uncontrolledYouOf(state, event.sourceInstanceId);
}

/**
 * The names a `CharacterNames` spec stands for (docs/phase7-wave3.md §3.34): written out, or read from the Team-Up
 * keyword of the card(s) a ref names — wherever that card is, since a Team-Up event resolves out of play.
 */
export function characterNames(state: GameState, spec: CharacterNames, context: EffectContext): readonly string[] {
  if ("names" in spec) return spec.names;
  return resolveRef(state, spec.teamUpOf, context).flatMap((id) => {
    const card = cardOf(state, id);
    const teamUp = card && "keywords" in card ? card.keywords.find((k) => k.name === "teamUp") : undefined;
    const names = teamUp?.name === "teamUp" && teamUp.names ? teamUp.names : [];
    return spec.index === undefined ? names : names.slice(spec.index, spec.index + 1);
  });
}

/**
 * The cards in play matching `query`. RRG 1.8 "In Play and Out of Play" (p. 23): "Card abilities only interact with,
 * and can only target, cards that are in play (unless the ability text specifically refers to an out-of-play area)", so
 * a query that asks for facedown cards (`facedown: true`: "each facedown card attached here") also reads the facedown
 * attachments, which are out of play; no other query sees them.
 */
export const selectTargets = (state: GameState, query: TargetQuery, context: EffectContext): readonly InstanceId[] =>
  cardsOnTable(state, query.facedown === true).filter((id) => matchesQuery(state, id, query, context));

/**
 * The players who may trigger an action, interrupt or response that names them (`triggerableBy`, docs/phase7-wave6.md
 * §3.11), read with "this card" as the ability's card and "you" as its controller, or the player the rules name for an
 * uncontrolled card (`uncontrolledYouOf`: an obligation's holder); null when the ability names nobody
 * and today's rule (its controller, or the acting player on an uncontrolled card) applies. A forced ability is never
 * read this way: nobody chooses to trigger it.
 */
export function triggeringPlayers(
  state: GameState,
  deps: EngineDeps,
  instanceId: InstanceId,
  trigger: AbilityTriggerSpec,
  event: TriggerEvent | null,
): readonly PlayerId[] | null {
  if (trigger.kind !== "action" && trigger.kind !== "interrupt" && trigger.kind !== "response") return null;
  if (trigger.kind !== "action" && trigger.forced) return null;
  if (!trigger.triggerableBy) return null;
  const context: EffectContext = {
    selfInstanceId: instanceId,
    controllerId: controllerOf(state, instanceId) ?? uncontrolledYouOf(state, instanceId),
    event,
    bindings: {},
    deps,
  };
  return resolvePlayers(state, trigger.triggerableBy, context);
}

export function resolvePlayers(state: GameState, ref: PlayerRef, context: EffectContext): readonly PlayerId[] {
  switch (ref.kind) {
    case "controller":
      return context.controllerId ? [context.controllerId] : [];
    case "eventPlayer": {
      const players = context.event ? eventSubjects(context.event).players : [];
      return players.slice(0, 1);
    }
    case "orElse": {
      const first = resolvePlayers(state, ref.first, context);
      return first.length > 0 ? first : resolvePlayers(state, ref.otherwise, context);
    }
    case "firstPlayer":
      return [state.firstPlayerId];
    case "each": {
      // The Once and Future Kang insert, "Rules Clarifications": "'Each player' refers to each player in the same game
      // area" (docs/phase7-wave2.md §3.1).
      const area = contextArea(state, context);
      return playerOrder(state)
        .map((p) => p.playerId)
        .filter((id) => !area || area.playerIds.includes(id));
    }
    case "id":
      return getPlayer(state, ref.playerId) ? [ref.playerId] : [];
    case "slot": {
      const ids = context.bindings[ref.slot] ?? [];
      return playerOrder(state)
        .filter((p) => ids.includes(p.identity.instanceId))
        .map((p) => p.playerId);
    }
    case "scoped":
      return context.scopedPlayerId ? [context.scopedPlayerId] : [];
    case "others": {
      const excluded = resolvePlayers(state, ref.of, context);
      return playerOrder(state)
        .map((p) => p.playerId)
        .filter((id) => !excluded.includes(id));
    }
    case "nextAfter": {
      // RRG 1.8 "In Player Order" (p. 24): the next clockwise player still in the game; a player is not their own.
      const [of] = resolvePlayers(state, ref.of, context);
      const next = of ? nextClockwisePlayer(state, of) : undefined;
      return next && next.playerId !== of ? [next.playerId] : [];
    }
    case "ownerOf": {
      const owners = resolveRef(state, ref.target, context)
        .map((id) => getInstance(state, id)?.ownerId ?? null)
        .filter((id): id is PlayerId => id !== null);
      return [...new Set(owners)];
    }
    case "controllerOf": {
      // docs/phase7-wave3.md §3.39: encounter cards are controlled by the scenario (RRG 1.8 p. 31), so they name no one.
      const controllers = new Set(resolveRef(state, ref.target, context).map((id) => controllerOf(state, id)));
      return playerOrder(state)
        .map((p) => p.playerId)
        .filter((id) => controllers.has(id));
    }
    case "engagedWith": {
      const engaged = resolveRef(state, ref.of, context)
        .map((id) => getInstance(state, id)?.engagedWith ?? null)
        .filter((id): id is PlayerId => id !== null);
      return [...new Set(engaged)];
    }
    case "defeatingPlayer": {
      const event = context.event;
      if (event?.kind !== "schemeDefeated" && event?.kind !== "characterDefeated") return [];
      const player = event.defeatedByPlayerId ?? null;
      return player !== null && getPlayer(state, player) ? [player] : [];
    }
    case "attackedPlayer": {
      // The stack is innermost-first, as `Predicate attackInProgress` reads it. The event frame carries the attack's
      // target player, the defending player once a defender is declared (RRG 1.8 "Defend, Defense", p. 16: "Any
      // constant or boost abilities that refer to 'you' refer to the defending player"), and the player it was
      // initiated against, which `retargetAttack` rewrites and a declared defender does not (p. 8).
      const attackers = ref.attacker ? resolveRef(state, ref.attacker, context) : null;
      const frame = state.stack.find((f) => {
        if (f.kind !== "event") return false;
        const event = f.event;
        const attacker =
          event.kind === "enemyAttack"
            ? event.enemyInstanceId
            : event.kind === "attack" || event.kind === "enemyAttacksEnemy"
              ? event.attackerInstanceId
              : null;
        return attacker !== null && (attackers === null || attackers.includes(attacker));
      });
      if (frame?.kind !== "event" || frame.event.kind !== "enemyAttack") return [];
      const player = ref.initiated ? frame.event.attackedPlayerId : frame.event.targetPlayerId;
      return getPlayer(state, player) ? [player] : [];
    }
    case "where":
      // docs/phase7-wave6.md §3.11: each candidate tested with itself as the scoped player, in player order.
      return resolvePlayers(state, ref.among ?? { kind: "each" }, context).filter((playerId) =>
        evaluate(state, ref.predicate, { ...context, scopedPlayerId: playerId }),
      );
    case "superlative": {
      // docs/phase7-wave3.md §3.35: each candidate measured with itself as the scoped player, in player order.
      const pool = resolvePlayers(state, ref.among ?? { kind: "each" }, context);
      const scored = pool.map((playerId) => ({
        playerId,
        score: resolveValue(state, ref.measure, { ...context, scopedPlayerId: playerId }),
      }));
      if (scored.length === 0) return [];
      const scores = scored.map((s) => s.score);
      const best = ref.order === "lowest" ? Math.min(...scores) : Math.max(...scores);
      const tied = scored.filter((s) => s.score === best).map((s) => s.playerId);
      return ref.ties === "first" ? tied.slice(0, 1) : tied;
    }
  }
}

/**
 * The cards a ref names. A card in a closed in-play scenario area is left out unless the ability refers to the area
 * (`closedScenarioPlayArea`, docs/phase7-wave8.md §3.33): "attached ally" (`host`), a card named by title, the card an
 * event is about. Not filtered here: `each` and `find`, whose query was matched card by card and may itself name the
 * area; a `superlative`, whose pool was; and a `slot`, which holds what the ability already chose or bound.
 */
export function resolveRef(state: GameState, ref: TargetRef, context: EffectContext): readonly InstanceId[] {
  const found = resolveRefAnywhere(state, ref, context);
  if (state.scenarioPlayAreas === undefined || found.length === 0) return found;
  if (ref.kind === "each" || ref.kind === "find" || ref.kind === "slot" || ref.kind === "superlative") return found;
  return found.filter((id) => closedScenarioPlayArea(state, id, context) === null);
}

function resolveRefAnywhere(state: GameState, ref: TargetRef, context: EffectContext): readonly InstanceId[] {
  switch (ref.kind) {
    case "self":
      return context.selfInstanceId ? [context.selfInstanceId] : [];
    case "host": {
      const host = hostOfSelfId(state, context);
      return host ? [host] : [];
    }
    case "each":
      return selectTargets(state, ref.query, context);
    case "named": {
      // The current face only: a flipped Criminal Enterprise is no longer "Criminal Enterprise" (§3.4).
      const found = cardsInPlay(state).find((id) => currentName(state, id) === ref.name);
      return found ? [found] : [];
    }
    case "slot":
      return context.bindings[ref.slot] ?? [];
    case "eventSource":
      return context.event ? eventSubjects(context.event).sources : [];
    case "eventTarget":
      return context.event ? eventSubjects(context.event).targets : [];
    case "defendingCharacter": {
      // The stack is innermost-first, so a nested or queued attack names its own defender.
      const attack = state.stack.find((f) => f.kind === "event" && f.event.kind === "enemyAttack");
      if (attack?.kind !== "event") return [];
      const inPlay = cardsInPlay(state);
      return (attack.slots[DEFENDER_SLOT] ?? []).filter((id) => inPlay.includes(id));
    }
    case "attackingEnemy": {
      // docs/phase7-wave4.md §3.34: the sibling of `defendingCharacter`, the same innermost attack.
      const attack = state.stack.find((f) => f.kind === "event" && f.event.kind === "enemyAttack");
      if (attack?.kind !== "event" || attack.event.kind !== "enemyAttack") return [];
      const enemy = attack.event.enemyInstanceId;
      return cardsInPlay(state).includes(enemy) ? [enemy] : [];
    }
    case "attackedCharacter": {
      // The innermost attack (by one of `attacker`, when given), as `PlayerRef attackedPlayer` finds it.
      const attackers = ref.attacker ? resolveRef(state, ref.attacker, context) : null;
      for (const f of state.stack) {
        if (f.kind !== "event") continue;
        const event = f.event;
        const attacker =
          event.kind === "enemyAttack"
            ? event.enemyInstanceId
            : event.kind === "attack" || event.kind === "enemyAttacksEnemy"
              ? event.attackerInstanceId
              : null;
        if (attacker === null || (attackers !== null && !attackers.includes(attacker))) continue;
        const target = "targetInstanceId" in event ? event.targetInstanceId : null;
        return target !== null && getInstance(state, target) ? [target] : [];
      }
      return [];
    }
    case "activatingEnemy": {
      // The innermost enemy activation, attack or scheme (the stack is innermost-first).
      const activation = state.stack.find(
        (f) => f.kind === "event" && (f.event.kind === "enemyAttack" || f.event.kind === "enemyScheme"),
      );
      if (activation?.kind !== "event") return [];
      if (activation.event.kind !== "enemyAttack" && activation.event.kind !== "enemyScheme") return [];
      const enemy = activation.event.enemyInstanceId;
      return cardsInPlay(state).includes(enemy) ? [enemy] : [];
    }
    case "villain": {
      // "The villain" is the active villain (The Wrecking Crew insert, "The Active Villain"); in a separate game area,
      // that area's (docs/phase7-wave2.md §3.1).
      const chosen = context.bindings[VILLAIN_CHOICE]?.filter((id) => villainOf(state, id)?.defeated === false);
      if (chosen && chosen.length > 0) return chosen;
      const activeId = activeVillainIdFor(state, contextArea(state, context));
      const active = activeId ? villainOf(state, activeId) : undefined;
      return !active || active.defeated ? [] : [active.instanceId];
    }
    case "mainScheme": {
      // "The main scheme": this area's own stage, or the central one (`of: "central"`, "under stage 4A").
      if (ref.of === "central") return [state.mainScheme.instanceId];
      const area = contextArea(state, context);
      // Two main schemes in the shared area (Tower Defense, docs/phase7-wave4.md §3.2; MC21 p. 10): the one the player
      // chose for this ability (`MAIN_SCHEME_CHOICE`, asked before the effect resolves); on a player card otherwise the
      // one Focused Defense names ("a constant effect on a player card … always refers to the scheme card with the
      // attachment 'Focused Defense'"); on an encounter card, both ("Encounter cards that refer to 'the main scheme'
      // refer to both main scheme cards").
      if (!area && (state.extraMainSchemes ?? []).length > 0) {
        const chosen = context.bindings[MAIN_SCHEME_CHOICE];
        if (chosen) return chosen;
        const deps = context.deps ?? DEFAULT_DEPS;
        if (isPlayerCard(state, context.selfInstanceId))
          return [focusedMainSchemeId(state, deps) ?? state.mainScheme.instanceId];
        // Venom Goblin: an encounter card's "the main scheme" is the one with the glider counter (§3.3).
        const glider = gliderMainSchemeId(state, deps);
        if (glider) return [glider];
        return sharedMainSchemes(state).map((scheme) => scheme.instanceId);
      }
      const scheme = mainSchemeFor(state, area);
      return scheme ? [scheme.instanceId] : [];
    }
    case "identityOf":
      return resolvePlayers(state, ref.player, context)
        .map((id) => getPlayer(state, id)?.identity.instanceId)
        .filter((id): id is InstanceId => id !== undefined);
    case "villainOfSideScheme": {
      const schemes = resolveRef(state, ref.scheme, context);
      return undefeatedVillains(state)
        .filter((villain) => villain.signatureSideSchemeId !== null && schemes.includes(villain.signatureSideSchemeId))
        .map((villain) => villain.instanceId);
    }
    case "signatureSideSchemeOf": {
      const inPlay = cardsInPlay(state);
      return resolveRef(state, ref.villain, context).flatMap((id) => {
        const scheme = villainOf(state, id)?.signatureSideSchemeId;
        return scheme && inPlay.includes(scheme) ? [scheme] : [];
      });
    }
    case "attachmentsOf": {
      // "Each card attached here": in attachment order, out-of-play hosts included (nothing attaches out of play today).
      const attached = resolveRef(state, ref.of, context).flatMap((id) => getInstance(state, id)?.attachments ?? []);
      return ref.filter
        ? attached.filter((id) => matchesQuery(state, id, ref.filter as TargetQuery, context))
        : attached;
    }
    case "tuckedUnder": {
      // "Each face down Kang's Dominion under this stage": tucked cards are out of play, so only a ref finds them.
      const tucked = resolveRef(state, ref.of, context).flatMap((id) => getInstance(state, id)?.tucked ?? []);
      return ref.filter ? tucked.filter((id) => matchesQuery(state, id, ref.filter as TargetQuery, context)) : tucked;
    }
    case "find": {
      const owners = ref.owner ? new Set(resolvePlayers(state, ref.owner, context)) : null;
      return findCards(state, ref.query, context, owners).map((found) => found.id);
    }
    case "superlative": {
      // Each candidate is measured with itself bound to `slot`, so the measure can read another card ("the villain
      // whose side scheme has the most threat"). Ties resolve to every tied card; see the `TargetRef` comment.
      const slot = ref.slot ?? "candidate";
      const candidates = resolveRef(state, ref.among, context).filter((id) => getInstance(state, id) !== undefined);
      if (candidates.length === 0) return [];
      const measured = candidates.map((id) => ({
        id,
        value: resolveValue(state, ref.measure, { ...context, bindings: { ...context.bindings, [slot]: [id] } }),
      }));
      const values = measured.map((entry) => entry.value);
      const best = ref.order === "highest" ? Math.max(...values) : Math.min(...values);
      const tied = measured.filter((entry) => entry.value === best).map((entry) => entry.id);
      return ref.ties === "first" ? tied.slice(0, 1) : tied;
    }
  }
}

/**
 * The threat a thwart removes (RRG 1.8 "Thwart", p. 44; "Basic Power", p. 10: a basic thwart "removes threat equal to
 * the character's THW value"). A "(thwart)" ability's event carries its amount from the start; a basic thwart's
 * carries none until it resolves, so before then (its interrupt window) this is the thwarter's current THW, or ATK
 * for a thwart made with ATK — what `applyPlayerThwart` will remove. `undefined` (no removal) when the thwarter's
 * stat is a printed '—'.
 * Once the thwart has resolved its event's `amount` is the threat actually removed (the event frame's `responses`
 * stage, `resolve/event.ts`).
 */
export function thwartAmount(
  state: GameState,
  deps: EngineDeps,
  event: Extract<TriggerEvent, { kind: "thwart" }>,
): number | undefined {
  const stat = event.useAtk ? "atk" : "thw";
  const thwarter = characterProfile(state, event.thwarterInstanceId, deps);
  // A printed '—' THW removes no threat, even by a "(thwart)" ability (`dash-stats.test.ts`).
  if (thwarter?.missing.includes(stat)) return undefined;
  return event.amount ?? thwarter?.[stat];
}

function eventAmount(state: GameState, deps: EngineDeps, event: TriggerEvent | null): number {
  if (!event) return 0;
  if (event.kind === "thwart") return thwartAmount(state, deps, event) ?? 0;
  return "amount" in event ? (event.amount ?? 0) : 0;
}

/** `deps` lets stat reads include constant and lasting modifiers ("damage equal to your hero's ATK" reads the modified ATK). */
export function resolveValue(
  state: GameState,
  value: ValueSpec,
  context: EffectContext,
  deps: EngineDeps = context.deps ?? DEFAULT_DEPS,
): number {
  // A value is a read: it sees a card in a closed scenario area as what it is (docs/phase7-wave8.md §4.1 Q18 = A).
  if (state.scenarioPlayAreas !== undefined && context.reaches !== "all") context = { ...context, reaches: "all" };
  switch (value.kind) {
    case "const":
      return value.value;
    case "perPlayer":
      return value.base + value.perPlayer * state.startingPlayerCount;
    case "stat": {
      const ids = resolveRef(state, value.of, context);
      const statOfCard = (id: InstanceId): number =>
        value.base
          ? baseStat(state, id, value.stat, deps)
          : value.printed
            ? (printedProfile(state, id)?.[value.stat] ?? 0)
            : // That stat alone (`characterStat`): a modifier whose amount is another stat of the card it modifies
              // ("+X THW, where X is equal to her ATK") must not read the stat it is part of.
              (characterStat(state, id, value.stat, deps) ?? 0);
      // "The total ATK of those allies and your hero" (docs/phase7-wave4.md §3.41).
      if (value.total) return ids.reduce((sum, id) => sum + statOfCard(id), 0);
      const [id] = ids;
      return id ? statOfCard(id) : 0;
    }
    case "counters": {
      const [id] = resolveRef(state, value.of, context);
      if (!id) return 0;
      return countersOfType(state, id, value.counterType);
    }
    case "eventAmount":
      return eventAmount(state, deps, context.event);
    case "var":
      // `of`: the number recorded for a card (`<name>.<instanceId>`), summed over the cards named.
      if (value.of) {
        const perCard = context.vars ?? {};
        return resolveRef(state, value.of, context).reduce((sum, id) => sum + (perCard[`${value.name}.${id}`] ?? 0), 0);
      }
      return context.vars?.[value.name] ?? 0;
    case "eventResult":
      return context.event?.results?.[value.key] ?? 0;
    case "defeatExcessDamage": {
      const defeat = context.event?.kind === "characterDefeated" ? context.event : undefined;
      if (!defeat) return 0;
      if (value.consequential !== undefined && (defeat.consequential === true) !== value.consequential) return 0;
      return defeat.excessDamage ?? 0;
    }
    case "scaled": {
      const base = resolveValue(state, value.value, context, deps);
      // A non-positive divisor is an authoring error (`@mc/cards`' validator rejects it); read it as 0, never NaN/Infinity.
      const divided = !value.divide
        ? base
        : value.divide.by > 0
          ? (value.divide.round === "up" ? Math.ceil : Math.floor)(base / value.divide.by)
          : 0;
      const scaled = divided * (value.times ?? 1) + (value.plus ?? 0);
      return value.max === undefined ? scaled : Math.min(value.max, scaled);
    }
    case "count":
      return selectTargets(state, value.query, { ...context, deps }).length;
    case "sum":
      return value.values.reduce((total, part) => total + resolveValue(state, part, context, deps), 0);
    case "product":
      // docs/phase7-wave4.md §3.47: "N per hero … for each side scheme in victory display".
      return value.values.reduce((total, part) => total * resolveValue(state, part, context, deps), 1);
    case "refCount":
      return new Set(resolveRef(state, value.of, { ...context, deps })).size;
    case "statusCount":
      return [...new Set(resolveRef(state, value.of, { ...context, deps }))].reduce(
        (total, id) =>
          total + (cardsInPlay(state).includes(id) ? (getInstance(state, id)?.statuses[value.status] ?? 0) : 0),
        0,
      );
    case "countInRef": {
      const withDeps = { ...context, deps };
      return resolveRef(state, value.cards, withDeps).filter((id) => matchesQuery(state, id, value.query, withDeps))
        .length;
    }
    case "remainingHp": {
      const [id] = resolveRef(state, value.of, context);
      return id ? (consideredRemainingHitPoints(state, id, deps) ?? 0) : 0;
    }
    case "conditional":
      return evaluate(state, value.if, { ...context, deps })
        ? resolveValue(state, value.then, context, deps)
        : resolveValue(state, value.else, context, deps);
    case "damage": {
      const [id] = resolveRef(state, value.of, context);
      return id ? (getInstance(state, id)?.damage ?? 0) : 0;
    }
    case "threat": {
      const [id] = resolveRef(state, value.of, context);
      return id ? (getInstance(state, id)?.threat ?? 0) : 0;
    }
    case "accelerationTokens":
      return [...new Set(resolveRef(state, value.on, { ...context, deps }))].reduce(
        (total, id) => total + accelerationTokensOnCard(state, id),
        0,
      );
    case "iconsInPlay":
      // One count for every reader (docs/phase7-wave7.md §3.77): the functions step one, the hazard deal and boost
      // amplification already use, so a script's number never drifts from the game's.
      return [...new Set(value.icons ?? ALL_CARD_ICONS)].reduce(
        (total, icon) =>
          total + (icon === "amplify" ? amplifyIconsInPlay(state, deps) : iconsInPlay(state, deps, icon)),
        0,
      );
    case "mainSchemeStageNumber":
      return mainSchemeStage(state).stageNumber;
    case "boostIcons": {
      // One counting function for every read (docs/phase7-wave2.md §3.6): printed icons plus boost icon modifiers,
      // summed over every card the ref names ("the number of boost icons discarded this way"), as `starIcons` does
      // (docs/phase7-wave5.md §4.1 Q56).
      const deps = context.deps;
      return resolveRef(state, value.of, context).reduce((sum, id) => {
        if (deps) return sum + boostIconsFor(state, deps, id);
        const card = cardOf(state, id);
        return sum + (card && "boostIcons" in card ? card.boostIcons : 0);
      }, 0);
    }
    case "starIcons":
      // "For each star icon in the boost area discarded this way" (Slipping Sanity, `scw`). Independent of
      // `boostIcons`: RRG 1.8 "Boost, Boost Icon" (p. 11), "A star icon is not itself considered a boost icon". A
      // boost area carries at most one star, so each card adds 0 or 1; read wherever the cards are, since the pile
      // being counted is normally already in a discard pile by now.
      return resolveRef(state, value.cards, context).filter((id) => hasStarIcon(state, id)).length;
    case "handSize": {
      const [playerId] = resolvePlayers(state, value.player, context);
      if (!playerId) return 0;
      return value.printed ? printedHandSize(state, playerId) : handSize(state, playerId, deps);
    }
    case "paidTypeCount": {
      const vars = paidVarsOf(state, value.of, context);
      return RESOURCE_TYPES.filter((type) => (vars[`${PAID_AS_PREFIX}${type}`] ?? 0) > 0).length;
    }
    case "resourceTypes": {
      const seen = new Set<string>();
      for (const id of resolveRef(state, value.cards, context)) {
        const pool = printedResourcesOf(state, id, deps);
        for (const type of ["physical", "mental", "energy", "wild"] as const) if (pool[type] > 0) seen.add(type);
      }
      return seen.size;
    }
    case "handCount": {
      // docs/phase7-wave5.md §4.1 Q69: no player (an unengaged minion's "engaged player") counts 0.
      const [playerId] = resolvePlayers(state, value.player, context);
      const hand = playerId ? (getPlayer(state, playerId)?.hand ?? []) : [];
      const filter = value.filter;
      return filter ? hand.filter((id) => matchesQuery(state, id, filter, { ...context, deps })).length : hand.length;
    }
    case "largestHandTypeGroup": {
      // docs/phase7-wave7.md §3.32. A tie between types gives the same number, so no choice is asked.
      const [playerId] = resolvePlayers(state, value.player, context);
      const sizes = new Map<AnyCard["type"], number>();
      for (const id of playerId ? (getPlayer(state, playerId)?.hand ?? []) : []) {
        const type = cardOf(state, id)?.type;
        if (type && HAND_GROUP_TYPES.includes(type)) sizes.set(type, (sizes.get(type) ?? 0) + 1);
      }
      return Math.max(0, ...sizes.values());
    }
    case "scenarioAreaCount": {
      const ids = state.scenarioAreas?.[value.name] ?? [];
      const filter = value.filter;
      return filter ? ids.filter((id) => matchesQuery(state, id, filter, { ...context, deps })).length : ids.length;
    }
    case "victoryCondition":
      return state.scenarioRules.victoryCondition ?? 0;
    case "setAsideModularSetCount":
      return (state.setAsideModularSets ?? []).length;
    case "hiddenPileCount":
      // A pile's size is open; its cards are not (docs/phase7-wave9.md §3.29 (a)).
      return (state.hiddenPiles?.[value.pile] ?? []).length;
    case "revealedPileCardCount":
      return value.pile === undefined
        ? Object.values(state.revealedPileCards ?? {}).reduce((sum, ids) => sum + ids.length, 0)
        : (state.revealedPileCards?.[value.pile] ?? []).length;
    case "victoryDisplayCount": {
      // docs/phase7-wave3.md §3.42: out of play, so only a read of the pile itself reaches it.
      const filter = value.filter;
      const ids = state.victoryDisplay;
      return filter ? ids.filter((id) => matchesQuery(state, id, filter, { ...context, deps })).length : ids.length;
    }
    case "dealtEncounterCount": {
      const [playerId] = resolvePlayers(state, value.player, context);
      return playerId ? (getPlayer(state, playerId)?.dealtEncounter.length ?? 0) : 0;
    }
    case "min":
      return Math.min(...value.values.map((part) => resolveValue(state, part, context, deps)));
    case "max":
      return Math.max(...value.values.map((part) => resolveValue(state, part, context, deps)));
    case "deckCount": {
      // The player deck only: a separate deck (`PlayerState.separateDecks`) is its own deck, not part of this one.
      const [playerId] = resolvePlayers(state, value.player, context);
      return playerId ? (getPlayer(state, playerId)?.deck.length ?? 0) : 0;
    }
    case "distinctCardTypes": {
      const types = new Set<string>();
      for (const id of resolveRef(state, value.cards, context)) {
        const card = cardOf(state, id);
        if (card) types.add(card.type);
      }
      return types.size;
    }
    case "distinctAspects": {
      const aspects = new Set<string>();
      for (const id of resolveRef(state, value.cards, context)) {
        const card = cardOf(state, id);
        if (!card || !("aspect" in card)) continue;
        for (const aspect of [card.aspect, card.printedAspect])
          if (aspect !== undefined && FOUR_ASPECTS.includes(aspect)) aspects.add(aspect);
      }
      return aspects.size;
    }
    case "printedCost": {
      const [id] = resolveRef(state, value.of, context);
      return id ? printedCostOf(state, cardOf(state, id)) : 0;
    }
    case "printedHp": {
      const [id] = resolveRef(state, value.of, context);
      if (!id) return 0;
      return value.numeral ? printedHpNumeral(state, id) : (printedProfile(state, id)?.maxHp ?? 0);
    }
    case "totalPrintedCost":
      // Read wherever the cards are (tucked cards are out of play); a card with no printed cost adds 0.
      return resolveRef(state, value.cards, context).reduce(
        (sum, id) => sum + printedCostOf(state, cardOf(state, id)),
        0,
      );
    case "totalPrintedResources": {
      // Printed icons only (RRG 1.8 "Printed", p. 35), read wherever the cards are — a card discarded to pay a cost
      // is already in the discard pile by the time the ability's effects resolve. An icon of a card this ability
      // discarded from a deck may count more than once (`countedResourcesOf`, docs/phase7-wave7.md §3.56).
      const types = value.types ?? RESOURCE_TYPES;
      return resolveRef(state, value.cards, context).reduce((sum, id) => {
        const pool = countedResourcesOf(state, id, printedResourcesOf(state, id, deps), context.bindings, deps);
        return sum + types.reduce((total, type) => total + pool[type], 0);
      }, 0);
    }
    case "activationOrder": {
      const [id] = resolveRef(state, value.of, context);
      return id ? activationOrderOf(state, id) : 0;
    }
    case "villainStageNumber": {
      const [id] = value.of
        ? resolveRef(state, value.of, context)
        : [activeVillainIdFor(state, contextArea(state, context)) ?? activeVillain(state).instanceId];
      return id && isVillain(state, id) ? villainStageOf(state, id).stageNumber : 0;
    }
    case "traitNumber": {
      // "Ironheart's [Version] number" (docs/phase7-wave5.md §3.23).
      const [id] = resolveRef(state, value.of, context);
      if (!id) return 0;
      const prefix = `${value.prefix.toUpperCase()} `;
      const numberIn = (traits: readonly string[]): number | null => {
        const found = traits.find((t) => t.toUpperCase().startsWith(prefix));
        const n = found ? Number.parseInt(found.slice(prefix.length), 10) : Number.NaN;
        return Number.isFinite(n) ? n : null;
      };
      const showing = numberIn(traitsOf(state, id, deps));
      if (showing !== null) return showing;
      const card = cardOf(state, id);
      if (card?.type !== "hero_identity") return 0;
      for (const face of heroFacesOf(card)) {
        const printed = numberIn(face.traits);
        if (printed !== null) return printed;
      }
      return 0;
    }
    // A number the campaign recorded, read out of the frozen `GameState.campaign.log` (design §7.1). Not traced:
    // see `campaignLogRead` in `events.ts` for why a pure, re-entrant read must not emit.
    case "campaignLog":
      return campaignLogNumber(campaignFieldRead(state, value, context), value.of);
  }
}

/**
 * The `paid.*` vars a `paidWith`/`paidWithOnly`/`paidWithCard` predicate reads: the ability's own (`of` omitted), or the play in
 * progress of the card `of` names (`playPaymentVars`) — "if you paid for that event" read by another card's interrupt.
 */
function paidVarsOf(state: GameState, of: TargetRef | undefined, context: EffectContext): Vars {
  if (of === undefined) return context.vars ?? {};
  const [id] = resolveRef(state, of, context);
  if (id === undefined) return {};
  // "After you play …, for each … used to pay for that event": the play's own announcement carries its payment
  // (`TriggerEvent cardPlayed.payment`, docs/phase7-wave8.md §3.62), so it is read from the event being answered and
  // does not depend on what is still on the stack.
  const event = context.event;
  if (event?.kind === "cardPlayed" && event.instanceId === id && event.payment) return event.payment;
  return playPaymentVars(state.stack, id);
}

export function evaluate(state: GameState, predicate: Predicate, context: EffectContext): boolean {
  // A condition is a read: it sees a card in a closed scenario area as what it is (docs/phase7-wave8.md §4.1 Q18 = A).
  if (state.scenarioPlayAreas !== undefined && context.reaches !== "all") context = { ...context, reaches: "all" };
  switch (predicate.kind) {
    case "form": {
      const [playerId] = resolvePlayers(state, predicate.player, context);
      const player = playerId ? getPlayer(state, playerId) : undefined;
      return player?.identity.form === predicate.form;
    }
    case "canPayResources": {
      const [playerId] = resolvePlayers(state, predicate.player, context);
      return (
        playerId !== undefined &&
        canPaySpend(state, context.deps ?? DEFAULT_DEPS, playerId, predicate.resources, predicate.distinctTypes ?? 0)
      );
    }
    case "canUseBasicPower": {
      // docs/phase7-wave8.md §3.64: read as `EffectSpec basicPowerBy` would offer it.
      return resolvePlayers(state, predicate.player, context).some((playerId) =>
        canUseBasicPower(state, context.deps ?? DEFAULT_DEPS, playerId, predicate.powers),
      );
    }
    case "inAdditionalForm": {
      const [playerId] = resolvePlayers(state, predicate.player, context);
      if (!playerId) return false;
      return additionalFormCards(state, playerId, predicate.formType, context.deps).some(
        (id) => predicate.name === undefined || currentName(state, id) === predicate.name,
      );
    }
    case "hasStatus": {
      const [id] = resolveRef(state, predicate.of, context);
      if (!id) return false;
      if (predicate.active) return statusActive(state, id, predicate.status, context.deps ?? DEFAULT_DEPS);
      return (getInstance(state, id)?.statuses[predicate.status] ?? 0) > 0;
    }
    case "exists":
      return selectTargets(state, predicate.query, context).length > 0;
    case "canRemoveThreatFrom": {
      const deps = context.deps ?? DEFAULT_DEPS;
      return resolveRef(state, predicate.scheme, context).some(
        (id) =>
          threatRemovalBlocked(
            state,
            deps,
            id,
            context.selfInstanceId,
            false,
            predicate.ignoreCrisis === true,
            null,
            null,
            false,
            false,
            context.controllerId,
          ) === null,
      );
    }
    case "counterAtLeast": {
      const [id] = resolveRef(state, predicate.of, context);
      const counters = id ? countersOfType(state, id, predicate.counterType) : 0;
      return counters >= predicate.amount;
    }
    case "damagedAtLeast": {
      const [id] = resolveRef(state, predicate.of, context);
      return id ? (getInstance(state, id)?.damage ?? 0) >= predicate.amount : false;
    }
    case "not":
      return !evaluate(state, predicate.of, context);
    case "paidWith": {
      const vars = paidVarsOf(state, predicate.of, context);
      return (vars[`paid.${predicate.resource}`] ?? 0) > 0 || (vars["paid.wild"] ?? 0) > 0;
    }
    case "varAtLeast":
      return (context.vars?.[predicate.name] ?? 0) >= predicate.amount;
    // docs/phase7-wave7.md §3.83: setup input frozen in the state; absent is false.
    case "outsideFact": {
      const [playerId] = resolvePlayers(state, predicate.player, context);
      const player = playerId ? getPlayer(state, playerId) : undefined;
      return player?.outsideFacts?.[predicate.fact] === true;
    }
    case "and":
      return predicate.of.every((p) => evaluate(state, p, context));
    case "or":
      return predicate.of.some((p) => evaluate(state, p, context));
    case "eventResultAtLeast":
      return (context.event?.results?.[predicate.key] ?? 0) >= predicate.amount;
    case "basicPowerIs": {
      const triggering = context.event;
      const power =
        triggering?.kind === "basicPowerUsing" || triggering?.kind === "basicPowerUsed"
          ? triggering.power
          : state.stack.flatMap((f) =>
              f.kind === "event" && f.event.kind === "basicPowerUsing" ? [f.event.power] : [],
            )[0];
      if (power === undefined) return false;
      return typeof predicate.power === "string" ? predicate.power === power : predicate.power.includes(power);
    }
    case "basicPowerStatIs": {
      const triggering = context.event;
      const stat =
        triggering?.kind === "basicPowerUsing" || triggering?.kind === "basicPowerUsed"
          ? triggering.stat
          : state.stack.flatMap((f) =>
              f.kind === "event" && f.event.kind === "basicPowerUsing" ? [f.event.stat] : [],
            )[0];
      if (stat === undefined) return false;
      return typeof predicate.stat === "string" ? predicate.stat === stat : predicate.stat.includes(stat);
    }
    case "eventDamageTakenAtLeast": {
      const results = context.event?.results;
      if (!results) return false;
      const ids = resolveRef(state, predicate.of, context);
      return ids.reduce((sum, id) => sum + (results[damageTakenKey(id)] ?? 0), 0) >= predicate.amount;
    }
    case "hasTrait": {
      const [id] = resolveRef(state, predicate.of, context);
      return id ? traitsOf(state, id, context.deps).includes(predicate.trait) : false;
    }
    case "currentAttack": {
      const id = currentActivationFrameId(state.stack);
      const frame = id ? state.stack.find((f) => f.frameId === id) : undefined;
      return frame?.kind === "event" && (frame.vars[predicate.key] ?? 0) >= predicate.atLeast;
    }
    case "attackInProgress": {
      // The stack is innermost-first: a nested attack (a boost's, a retaliation's) is the one "while attacking" reads.
      const frame = state.stack.find(
        (f) =>
          f.kind === "event" &&
          (f.event.kind === "attack" || f.event.kind === "enemyAttack" || f.event.kind === "enemyAttacksEnemy"),
      );
      if (frame?.kind !== "event") return false;
      const event = frame.event;
      const attacker =
        event.kind === "enemyAttack"
          ? event.enemyInstanceId
          : event.kind === "attack" || event.kind === "enemyAttacksEnemy"
            ? event.attackerInstanceId
            : null;
      const target = "targetInstanceId" in event ? event.targetInstanceId : null;
      const defender = event.kind === "enemyAttack" ? ((frame.slots[DEFENDER_SLOT] ?? [])[0] ?? null) : null;
      // A character's basic attack (RRG 1.8 "Basic Power", p. 10); an enemy's attack never is (§3.43 of wave 6).
      if (predicate.basic !== undefined && (event.kind === "attack" && event.basic === true) !== predicate.basic)
        return false;
      const matches = (id: InstanceId | null, query: TargetQuery | undefined): boolean =>
        query === undefined || (id !== null && matchesQuery(state, id, query, context));
      return (
        matches(attacker, predicate.attacker) &&
        matches(target, predicate.target) &&
        matches(defender, predicate.defender)
      );
    }
    case "thwartInProgress": {
      // The stack is innermost-first, as `attackInProgress` reads it.
      const frame = state.stack.find((f) => f.kind === "event" && f.event.kind === "thwart");
      if (frame?.kind !== "event" || frame.event.kind !== "thwart") return false;
      const event = frame.event;
      if (predicate.basic !== undefined && (event.basic === true) !== predicate.basic) return false;
      const matches = (id: InstanceId, query: TargetQuery | undefined): boolean =>
        query === undefined || matchesQuery(state, id, query, context);
      // A divided basic thwart is one basic thwart against every scheme it names (RRG 1.8 "Assault", p. 8;
      // docs/phase7-wave7.md §4.1 Q3), so each of its shares is a thwart against all of them.
      const schemes = event.dividedAmong ?? [event.schemeInstanceId];
      return (
        matches(event.thwarterInstanceId, predicate.thwarter) && schemes.some((id) => matches(id, predicate.scheme))
      );
    }
    case "revealedFromEncounterDeck": {
      // The stack is innermost-first: the reveal this card's When Revealed belongs to.
      const reveal = state.stack.find((f) => f.kind === "reveal" && f.instanceId === context.selfInstanceId);
      return reveal?.kind === "reveal" && reveal.source === "encounterDeck";
    }
    // How the card being resolved is being played: a record on its play's frame (docs/phase7-wave6.md §3.42, §3.52).
    case "playedVia": {
      const play = context.selfInstanceId ? playFrameOf(state.stack, context.selfInstanceId) : undefined;
      return (play?.bindings[PLAYED_VIA_SLOT] ?? []).some((id) => matchesQuery(state, id, predicate.card, context));
    }
    case "playNote": {
      const play = context.selfInstanceId ? playFrameOf(state.stack, context.selfInstanceId) : undefined;
      const note = play?.vars[`${PLAY_NOTE_PREFIX}${predicate.name}`];
      return note !== undefined && note >= predicate.atLeast;
    }
    case "currentActivationIs": {
      const id = currentActivationFrameId(state.stack);
      const frame = id ? state.stack.find((f) => f.frameId === id) : undefined;
      if (frame?.kind !== "event") return false;
      return predicate.activation === "attack"
        ? frame.event.kind === "enemyAttack"
        : frame.event.kind === "enemyScheme";
    }
    case "refMatches": {
      const inPlay = predicate.anywhere === true ? null : cardsInPlay(state);
      return resolveRef(state, predicate.ref, context).some(
        (id) => (inPlay === null || inPlay.includes(id)) && matchesQuery(state, id, predicate.query, context),
      );
    }
    case "gameStep":
      return (
        state.step.phase === predicate.phase && (predicate.step === undefined || state.step.kind === predicate.step)
      );
    case "turnOf":
      return (
        state.step.phase === "player" &&
        state.step.kind === "turn" &&
        resolvePlayers(state, predicate.player, context).includes(state.step.activePlayerId)
      );
    case "isAttached": {
      const [id] = resolveRef(state, predicate.of, context);
      return id !== undefined && getInstance(state, id)?.attachedTo !== null && getInstance(state, id) !== undefined;
    }
    case "faceNamed": {
      const [id] = resolveRef(state, predicate.of, context);
      return id ? currentName(state, id) === predicate.name : false;
    }
    case "paidWithCard":
      return (paidVarsOf(state, predicate.of, context)[`paid.cards.${predicate.cardType}`] ?? 0) > 0;
    case "paidType":
      return (paidVarsOf(state, predicate.of, context)[`${PAID_AS_PREFIX}${predicate.resource}`] ?? 0) > 0;
    case "paidWithOnly": {
      const vars = paidVarsOf(state, predicate.of, context);
      if ((vars["paid.total"] ?? 0) <= 0) return false;
      return (["physical", "mental", "energy"] as const).every(
        (type) => type === predicate.resource || (vars[`paid.${type}`] ?? 0) === 0,
      );
    }
    case "playedThisTurn": {
      const [playerId] = resolvePlayers(state, predicate.player, context);
      if (playerId === undefined) return false;
      const played = state.playedThisTurn?.[playerId] ?? [];
      const matching = played.filter((id) => matchesQuery(state, id, predicate.cards, context)).length;
      return matching >= (predicate.atLeast ?? 1);
    }
    case "playedThisPhase": {
      const [playerId] = resolvePlayers(state, predicate.player, context);
      if (playerId === undefined) return false;
      const played = state.playedByPlayerThisPhase?.[playerId] ?? [];
      const matching = played.filter((id) => matchesQuery(state, id, predicate.cards, context)).length;
      return matching >= (predicate.atLeast ?? 1);
    }
    case "playedThisRound": {
      const [playerId] = resolvePlayers(state, predicate.player, context);
      if (playerId === undefined) return false;
      const played =
        predicate.cardType === undefined
          ? Object.entries(state.playedByPlayerThisRound)
              .filter(([key]) => key.startsWith(`${playerId}:`))
              .reduce((sum, [, count]) => sum + count, 0)
          : (state.playedByPlayerThisRound[`${playerId}:${predicate.cardType}`] ?? 0);
      return played <= predicate.atMost;
    }
    case "compare": {
      const left = resolveValue(state, predicate.left, context);
      const right = resolveValue(state, predicate.right, context);
      if (predicate.op === "atLeast") return left >= right;
      if (predicate.op === "atMost") return left <= right;
      return left === right;
    }
    case "gameAreasSplit":
      return state.gameAreas.length > 0;
    case "topOfDeckFaceup": {
      const deps = context.deps ?? DEFAULT_DEPS;
      if (predicate.deck === "encounter") {
        if (!encounterTopFaceup(state, deps)) return false;
        const { matches, boostAreaIcons } = predicate;
        if (matches === undefined && boostAreaIcons === undefined) return true;
        // Only the card the rule shows is read (wave 8 §4.1 Q26 = B); an empty deck has none.
        const top = activeEncounterDeck(state).deck[0];
        if (top === undefined) return false;
        if (matches !== undefined && !matchesQuery(state, top, matches, context)) return false;
        if (boostAreaIcons === undefined) return true;
        // Boost icons and the star together, the number a card reads as `<slot>.boostIcons + <slot>.starIcons`.
        const icons = boostIconsFor(state, deps, top) + (hasStarIcon(state, top) ? 1 : 0);
        return icons >= (boostAreaIcons.atLeast ?? 0) && icons <= (boostAreaIcons.atMost ?? Infinity);
      }
      const faceup = deckTopFaceupPlayers(state, deps);
      return resolvePlayers(state, predicate.player, context).some((playerId) => {
        if (!faceup.includes(playerId)) return false;
        if (predicate.matches === undefined) return true;
        // Only the card the rule shows is read (§4.1 Q26 = B); an empty deck has none.
        const top = getPlayer(state, playerId)?.deck[0];
        return top !== undefined && matchesQuery(state, top, predicate.matches, context);
      });
    }
    case "inMode":
      return (state.scenarioRules.difficulty ?? "standard") === predicate.mode;
    case "firstAttackThisTurn": {
      const { against, by } = predicate;
      const matching = (state.attacksThisTurn ?? []).filter(
        (attack) =>
          (!against || matchesQuery(state, attack.targetInstanceId, against, context)) &&
          (!by || matchesQuery(state, attack.attackerInstanceId, by, context)),
      );
      return matching.length === 1;
    }
    case "characterDidThisPhase":
      return (state.characterActsThisPhase ?? []).some(
        (act) =>
          act.did === predicate.did && matchesQuery(state, act.characterInstanceId, predicate.character, context),
      );
    case "areaPlayersDefeated": {
      const area = contextArea(state, context);
      return area !== null && area.playerIds.every((id) => getPlayer(state, id)?.eliminated !== false);
    }
    case "mainSchemeAdvancedBy": {
      // The ability's own card when it is a main scheme (a stage's When Revealed asks about itself), otherwise "the
      // main scheme" of its area. A scheme with no recorded cause matches nothing (docs/phase7-wave7.md §3.12).
      const own = context.selfInstanceId ? mainSchemeStateOf(state, context.selfInstanceId) : undefined;
      const schemes = own
        ? [own]
        : resolveRef(state, { kind: "mainScheme" }, context).map((id) => mainSchemeStateOf(state, id));
      const sources = predicate.source ? resolveRef(state, predicate.source, context) : null;
      return schemes.some((scheme) => {
        const by = scheme?.advancedBy;
        if (by?.cause !== predicate.cause) return false;
        return sources === null || (by.sourceInstanceId !== null && sources.includes(by.sourceInstanceId));
      });
    }
    case "campaignLog": {
      // Every condition given must hold; with none given the question is only "is the field there at all?", which
      // is how "if <field> is in the campaign log" reads when a box tracks a field's mere presence. A field the
      // frozen view does not carry reads as nothing recorded — so `isSet: false` holds for it, and nothing else does.
      if (!state.campaign) return false;
      const value = campaignFieldRead(state, predicate, context);
      if (predicate.has !== undefined && !campaignLogContains(value, predicate.has)) return false;
      if (predicate.atLeast !== undefined && campaignLogNumber(value, predicate.of) < predicate.atLeast) return false;
      if (predicate.isSet !== undefined && campaignLogIsSet(value) !== predicate.isSet) return false;
      const asked = predicate.has !== undefined || predicate.atLeast !== undefined || predicate.isSet !== undefined;
      return asked || value !== undefined;
    }
  }
}

/**
 * Class-wide text blanking: "Treat the printed text box of each [Tech] player card as if it were blank" (Tech Theft),
 * a constant `RuleSpec blankTextBox`. `textBoxBlank` (`query.ts`) covers the *lasting* kind, which is a fixed list of
 * instance ids and so needs no registry; a constant rule has to be found in play, which the naive version gets wrong
 * twice (docs/phase7-wave2.md §8):
 *
 * 1. **Recursion.** Finding the rule needs the in-play cards' live abilities, and matching its `{ trait: TECH }`
 *    target needs `traitsOf`, which needs them too. Both are cut the same way `traitsOf` already cuts trait grants:
 *    the scan below reads each source's refs with the *lasting* blank check only, and evaluates the rule's own
 *    `target`/`while` under `DEFAULT_DEPS`, so granted traits and keywords are never consulted. A blanking rule
 *    therefore cannot depend on another blanking rule, and the answer is a fixed point after one pass.
 * 2. **Cost.** `activeAbilityRefs` is the engine's hottest read, called once per in-play card inside `activeRules`,
 *    `traitsOf`, `grantedKeywords` and `statModifiers`, each of which runs per query candidate. Scanning the board
 *    on every lookup would make all of those quadratic. Two memos keep it O(1) amortized, both over **immutable
 *    inputs and never over game state the engine reads back**: which ability ids carry the rule (per `EngineDeps`,
 *    fixed for a whole game) and which cards are blanked (per `GameState`, which is replaced on every mutation and
 *    never edited in place). A registry with no such rule — Core, wave 1 and all of cycle 1 — short-circuits on the
 *    first `WeakMap` hit, so nothing that exists today pays anything at all.
 */
const NO_BLANKED: ReadonlySet<InstanceId> = new Set<InstanceId>();

/** Ability ids in this registry that carry a constant `blankTextBox` rule. Memoized per registry object. */
const BLANK_RULE_IDS = new WeakMap<EngineDeps, ReadonlySet<string>>();

function blankRuleIds(deps: EngineDeps): ReadonlySet<string> {
  const cached = BLANK_RULE_IDS.get(deps);
  if (cached) return cached;
  const ids = new Set<string>();
  for (const [id, definition] of Object.entries(deps.abilities)) {
    if (
      definition.trigger.kind === "constant" &&
      (definition.trigger.rules ?? []).some((rule) => rule.kind === "blankTextBox")
    ) {
      ids.add(id);
    }
  }
  BLANK_RULE_IDS.set(deps, ids);
  return ids;
}

interface BlankedSets {
  /** Every card a constant rule blanks. */
  readonly text: ReadonlySet<InstanceId>;
  /** The ones blanked by a rule that does not keep keywords ("except for keywords", §3.28 of wave 4). */
  readonly keywords: ReadonlySet<InstanceId>;
}
const NO_BLANKED_SETS: BlankedSets = { text: NO_BLANKED, keywords: NO_BLANKED };
const BLANKED_BY_RULES = new WeakMap<GameState, WeakMap<EngineDeps, BlankedSets>>();

/**
 * Every card a constant `blankTextBox` rule in play treats as blank right now. A rule never blanks its own source
 * (that would erase the rule), and two rules blanking each other both apply — the scan reads printed refs, so the
 * answer does not depend on the order cards are visited.
 */
export function blankedByConstantRules(state: GameState, deps: EngineDeps): ReadonlySet<InstanceId> {
  return blankedSets(state, deps).text;
}

function blankedSets(state: GameState, deps: EngineDeps): BlankedSets {
  const ruleIds = blankRuleIds(deps);
  // A rule the scenario imposes without a card (`ScenarioRules.rules`) blanks too: "Treat the printed text box of
  // each ally at the mission as if it were blank, except for [TRAITS]" (docs/phase7-wave8.md §3.34).
  const scenarioBlanks = (state.scenarioRules.rules ?? []).filter(
    (rule): rule is Extract<RuleSpec, { kind: "blankTextBox" }> => rule.kind === "blankTextBox",
  );
  if (ruleIds.size === 0 && scenarioBlanks.length === 0) return NO_BLANKED_SETS;
  const perDeps = BLANKED_BY_RULES.get(state) ?? new WeakMap<EngineDeps, BlankedSets>();
  const cached = perDeps.get(deps);
  if (cached) return cached;
  const blanked = new Set<InstanceId>();
  const keywordsBlanked = new Set<InstanceId>();
  const inPlay = cardsInPlay(state);
  for (const sourceId of inPlay) {
    // A source's refs under the *lasting* blank only, as protected by its own `textBoxCannotBeBlanked` (§3.31 of wave
    // 5) and its Permanent keyword (§4.1 Q31), neither of which reads a constant blank, so this cannot re-enter.
    const sourceBlank = lastingBlankReaches(state, sourceId, deps);
    const sourceCardId = getInstance(state, sourceId)?.cardId;
    for (const ref of sourceBlank ? [] : unblankedAbilityRefs(state, sourceId)) {
      if (!ruleIds.has(ref.id)) continue;
      const trigger = deps.abilities[ref.id]?.trigger;
      if (trigger?.kind !== "constant") continue;
      for (const rule of trigger.rules ?? []) {
        if (rule.kind !== "blankTextBox") continue;
        // `DEFAULT_DEPS`: printed characteristics only, so matching cannot re-enter this function. "You" is the rule's
        // speaker, as for every other rule (`activeRules`): "each support you control" on an obligation is the player
        // whose play area holds it (Family Matters `mojo` 39061; RRG 1.8 "Obligation", p. 30).
        const context: EffectContext = {
          selfInstanceId: sourceId,
          controllerId: speakerOf(state, sourceId),
          event: null,
          bindings: {},
          deps: DEFAULT_DEPS,
        };
        if (rule.while && !evaluate(state, rule.while, context)) continue;
        for (const id of inPlay) {
          if (id === sourceId || !matchesQuery(state, id, rule.target, context)) continue;
          if (textBoxCannotBeBlanked(state, id, deps) || permanentProtectsFrom(state, id, sourceCardId, deps)) continue;
          blanked.add(id);
          if (!rule.exceptKeywords) keywordsBlanked.add(id);
        }
      }
    }
  }
  // The scenario's own rules: no source card, nobody as "you", printed characteristics only, as above.
  for (const rule of scenarioBlanks) {
    const context: EffectContext = {
      selfInstanceId: null,
      controllerId: null,
      event: null,
      bindings: {},
      deps: DEFAULT_DEPS,
    };
    if (rule.while && !evaluate(state, rule.while, context)) continue;
    for (const id of inPlay) {
      if (!matchesQuery(state, id, rule.target, context)) continue;
      // Permanent's protection is read against the blanking card's set, and a scenario rule has no card: it blanks.
      if (textBoxCannotBeBlanked(state, id, deps)) continue;
      blanked.add(id);
      if (!rule.exceptKeywords) keywordsBlanked.add(id);
    }
  }
  const sets: BlankedSets = { text: blanked, keywords: keywordsBlanked };
  perDeps.set(deps, sets);
  BLANKED_BY_RULES.set(state, perDeps);
  return sets;
}

interface CountsAs {
  readonly categories: readonly TargetCategory[];
  readonly traits: readonly Trait[];
}
const NO_COUNTS_AS: ReadonlyMap<InstanceId, CountsAs> = new Map();
const COUNTS_AS_RULE_IDS = new WeakMap<EngineDeps, ReadonlySet<string>>();
const COUNTS_AS_BY_RULES = new WeakMap<GameState, WeakMap<EngineDeps, ReadonlyMap<InstanceId, CountsAs>>>();

/**
 * The extra categories and traits constant `countsAs` rules in play give each card ("this card is considered a
 * [Symbiote] environment", Festering Mass; docs/phase7-wave5.md §3.9), for query matching only. Each rule's `while` and
 * `target` are read with `DEFAULT_DEPS` (printed characteristics), so matching cannot re-enter this function; cached
 * per state like `blankedSets`.
 */
export function countsAsExtras(state: GameState, deps: EngineDeps): ReadonlyMap<InstanceId, CountsAs> {
  let ruleIds = COUNTS_AS_RULE_IDS.get(deps);
  if (!ruleIds) {
    const ids = new Set<string>();
    for (const [id, definition] of Object.entries(deps.abilities)) {
      if (definition.trigger.kind !== "constant") continue;
      if ((definition.trigger.rules ?? []).some((rule) => rule.kind === "countsAs")) ids.add(id);
    }
    COUNTS_AS_RULE_IDS.set(deps, ids);
    ruleIds = ids;
  }
  if (ruleIds.size === 0) return NO_COUNTS_AS;
  const perDeps = COUNTS_AS_BY_RULES.get(state) ?? new WeakMap<EngineDeps, ReadonlyMap<InstanceId, CountsAs>>();
  const cached = perDeps.get(deps);
  if (cached) return cached;
  const extras = new Map<InstanceId, { categories: TargetCategory[]; traits: Trait[] }>();
  const inPlay = cardsInPlay(state);
  for (const sourceId of inPlay) {
    for (const ref of activeAbilityRefs(state, sourceId, deps)) {
      if (!ruleIds.has(ref.id)) continue;
      const trigger = deps.abilities[ref.id]?.trigger;
      if (trigger?.kind !== "constant") continue;
      for (const rule of trigger.rules ?? []) {
        if (rule.kind !== "countsAs") continue;
        const context: EffectContext = {
          selfInstanceId: sourceId,
          controllerId: speakerOf(state, sourceId),
          event: null,
          bindings: {},
          deps: DEFAULT_DEPS,
        };
        if (rule.while && !evaluate(state, rule.while, context)) continue;
        for (const id of inPlay) {
          if (!matchesQuery(state, id, rule.target, context)) continue;
          const entry = extras.get(id) ?? { categories: [], traits: [] };
          entry.categories.push(...rule.categories);
          entry.traits.push(...(rule.traits ?? []));
          extras.set(id, entry);
        }
      }
    }
  }
  perDeps.set(deps, extras);
  COUNTS_AS_BY_RULES.set(state, perDeps);
  return extras;
}

/** Ability ids in this registry that carry a constant `textBoxCannotBeBlanked` rule. Memoized per registry object. */
const UNBLANKABLE_RULE_IDS = new WeakMap<EngineDeps, ReadonlySet<string>>();

/**
 * "This card's printed text box cannot be treated as if it were blank." (SP//dr Suit 1B, SP//dr; docs/phase7-wave5.md
 * §3.31): whether the card's current face prints a constant `textBoxCannotBeBlanked` rule. Read from the face's refs
 * *before* any blank (`unblankedAbilityRefs`), because the rule protects the text box it is printed in; it never
 * consults a blank, so every blank check below can ask it without recursion. Needs the registry: under `DEFAULT_DEPS`
 * (no abilities) nothing is protected, which only a caller with no registry, and so no abilities to run, ever sees.
 */
export function textBoxCannotBeBlanked(state: GameState, id: InstanceId, deps: EngineDeps): boolean {
  let ruleIds = UNBLANKABLE_RULE_IDS.get(deps);
  if (!ruleIds) {
    const ids = new Set<string>();
    for (const [abilityId, definition] of Object.entries(deps.abilities)) {
      if (definition.trigger.kind !== "constant") continue;
      if ((definition.trigger.rules ?? []).some((rule) => rule.kind === "textBoxCannotBeBlanked")) ids.add(abilityId);
    }
    UNBLANKABLE_RULE_IDS.set(deps, ids);
    ruleIds = ids;
  }
  if (ruleIds.size === 0) return false;
  const protectedBy = ruleIds;
  return unblankedAbilityRefs(state, id).some((ref) => protectedBy.has(ref.id));
}

/**
 * The sets a card belongs to for the Permanent keyword's exception, RRG 1.8 "Permanent" (p. 32): "except by card
 * abilities in the same set (hero set, scenario set, or modular set)". Read off card data, so the card can be anywhere:
 *
 * - **Hero set** (`hero:<identity card id>`): the identity card itself, every card whose set icon names it (`aspect:
 *   "hero:<id>"`, RRG 1.8 "Identity-Specific Card", p. 23), and its obligation (RRG 1.8 "Obligation", p. 30:
 *   "Identity-specific obligation cards are part of their associated identity's identity-specific set"; the data has
 *   `encounterSetIds: []` on an obligation and links it from the identity's `obligationCardId`, looked up among the
 *   identities in this game), and its nemesis set: FFG ruling June 25, 2026 (4) #1
 *   (marvel-champions-rulings-post-rrg-1-7.md): "Nemesis sets belong to that identity" (docs/phase7-wave5.md §4.1
 *   Q43). RRG 1.8 "Identity-Specific Card" (p. 23) lists identity-specific cards "along with obligation cards and
 *   nemesis encounter set cards" as if distinct; the ruling is the later clarification. A card is linked through the
 *   identity's `nemesisEncounterSetId`, the field setup sets the nemesis set aside by (`setup.ts`), looked up among
 *   the identities in this game like the obligation, so another identity's nemesis set is not this hero's set.
 * - **Scenario and modular sets** (`set:<encounter set id>`): an encounter card's `encounterSetIds` (a nemesis card
 *   keeps its own encounter set too), and a player card's `specificTo` scenario/campaign set (Taskmaster's Captive
 *   allies, the Hydra Campaign upgrades).
 *
 * Not the product (`setCode`): the RRG names the three sets, and the set icon is only the product of origin (RRG 1.8
 * "Set Icon", p. 39). A basic or aspect card, and a player card in no scenario set (Milano, `gmw` 16142), is in none of
 * the three, so only its own card counts as its set (`permanentProtectsFrom`).
 */
function permanentSetKeys(state: GameState, card: AnyCard): readonly string[] {
  const keys: string[] = [];
  if (card.type === "hero_identity") keys.push(`hero:${card.id}`);
  const aspect = "aspect" in card ? String(card.aspect) : "";
  if (aspect.startsWith("hero:")) keys.push(aspect);
  for (const player of state.players) {
    const identity = state.cardPool[player.identity.cardId];
    if (identity?.type !== "hero_identity") continue;
    if (card.type === "obligation" && identity.obligationCardId === card.id) keys.push(`hero:${identity.id}`);
    if ("encounterSetIds" in card && card.encounterSetIds.includes(identity.nemesisEncounterSetId))
      keys.push(`hero:${identity.id}`);
  }
  if ("encounterSetIds" in card) for (const setId of card.encounterSetIds) keys.push(`set:${setId}`);
  if ("specificTo" in card && card.specificTo) keys.push(`set:${card.specificTo.encounterSetId}`);
  return keys;
}

/**
 * Whether `sourceCardId` is of this card's own set for the Permanent keyword's exception (RRG 1.8 "Permanent", p. 32):
 * the card itself, or a card sharing one of its sets (`permanentSetKeys`). The comparison `permanentProtectsFrom` makes,
 * without its keyword check, for the defeat and leave-play protection (`effects.ts` `permanentStopsLeaving`,
 * docs/phase7-wave5.md §4.1 Q46). A source missing from the card pool is of no set.
 */
export function ofPermanentCardsSet(state: GameState, id: InstanceId, sourceCardId: CardId): boolean {
  const card = cardOf(state, id);
  if (!card) return false;
  if (card.id === sourceCardId) return true;
  const source = state.cardPool[sourceCardId];
  if (!source) return false;
  const own = new Set(permanentSetKeys(state, card));
  return permanentSetKeys(state, source).some((key) => own.has(key));
}

/**
 * Whether the Permanent keyword keeps a blank made by `sourceCardId` off this card (RRG 1.8 "Permanent", p. 32: "Effects
 * on cards not from this card's set cannot [...] blank any part of its text box"; docs/phase7-wave5.md §4.1 Q31). The
 * printed keyword is read from the card's showing face *before* any blank (`unblankedPrintedKeywordsOf`), since it
 * protects the text box it is printed in. A keyword granted by another card's effect or rule protects too (§4.1 Q45,
 * `keywords.ts` `hasGrantedPermanent`), read without this card's own text box and under a re-entrancy guard, so every
 * blank check can ask this without recursion. A facedown card or one treated as another type shows no printed keyword
 * and has no text to protect.
 *
 * A blank with no recorded source (made before sources were recorded) is not stopped, as before. A card is always of
 * its own set, so a permanent card's own ability may blank it.
 */
export function permanentProtectsFrom(
  state: GameState,
  id: InstanceId,
  sourceCardId: CardId | undefined,
  deps: EngineDeps = DEFAULT_DEPS,
): boolean {
  if (sourceCardId === undefined) return false;
  const card = cardOf(state, id);
  if (!card || card.id === sourceCardId) return false;
  const source = state.cardPool[sourceCardId];
  if (source) {
    const own = new Set(permanentSetKeys(state, card));
    if (permanentSetKeys(state, source).some((key) => own.has(key))) return false;
  }
  return (
    unblankedPrintedKeywordsOf(state, id).some((keyword) => keyword.name === "permanent") ||
    hasGrantedPermanent(state, id, deps)
  );
}

/**
 * A card's ability refs as live under the *lasting* blank only (`lastingBlankReaches`), not a constant blank rule: what
 * a card's constant rules are read from while the constant blank rules are themselves being worked out (`blankedSets`)
 * and while a granted Permanent keyword is being looked for (`keywords.ts` `hasGrantedPermanent`, §4.1 Q45). Fills no
 * per-state cache.
 */
export function refsLiveUnderLastingBlank(
  state: GameState,
  id: InstanceId,
  deps: EngineDeps,
): readonly AbilityReference[] {
  return lastingBlankReaches(state, id, deps) ? [] : unblankedAbilityRefs(state, id);
}

/**
 * Whether a lasting blank reaches this card right now: one targets it, the card does not print "cannot be treated as if
 * it were blank" (§3.31 of wave 5), and at least one such blank is from a card its Permanent keyword lets through.
 */
function lastingBlankReaches(state: GameState, id: InstanceId, deps: EngineDeps): boolean {
  if (!textBoxBlank(state, id) || textBoxCannotBeBlanked(state, id, deps)) return false;
  return state.lastingEffects.some(
    (effect) =>
      effect.kind === "blankTextBox" &&
      effect.targets.includes(id) &&
      !permanentProtectsFrom(state, id, effect.sourceCardId, deps),
  );
}

/**
 * Whether this card's printed text box is blank right now, from a lasting effect or a constant rule in play, unless it
 * cannot be blanked (§3.31 of wave 5) or its Permanent keyword stops that blank (§4.1 Q31); the constant kind already
 * leaves such a card out of `blankedSets`.
 */
export const textBoxBlankFor = (state: GameState, id: InstanceId, deps: EngineDeps = DEFAULT_DEPS): boolean =>
  lastingBlankReaches(state, id, deps) || blankedByConstantRules(state, deps).has(id);

/** Whether this card's printed keywords are blank: as `textBoxBlankFor`, less a rule "except for keywords" (§3.28). */
export const keywordsBlankFor = (state: GameState, id: InstanceId, deps: EngineDeps = DEFAULT_DEPS): boolean =>
  lastingBlankReaches(state, id, deps) || blankedSets(state, deps).keywords.has(id);

/**
 * The ability slots that are live on a card right now (active identity face, current stage).
 *
 * `deps` is what makes a *constant* class-wide blank (Tech Theft) visible; without it only the lasting kind is seen,
 * which is what every caller that has no registry to hand wants. Passing it costs one `WeakMap` lookup in a game
 * whose card pool has no such rule.
 */
export function activeAbilityRefs(
  state: GameState,
  id: InstanceId,
  deps: EngineDeps = DEFAULT_DEPS,
): readonly AbilityReference[] {
  const printed = unblankedAbilityRefs(state, id);
  if (printed.length === 0) return printed;
  if (textBoxBlankFor(state, id, deps)) return [];
  // "Ignore the Forced Interrupt on the main scheme" (`RuleSpec ignoreAbilities`, docs/phase7-wave8.md §3.21).
  const ignored = ignoredAbilities(state, deps).get(id);
  const refs = ignored ? printed.filter((ref) => !ignored.has(ref.id)) : printed;
  // An ability that works only from the victory display is off everywhere else (docs/phase7-wave7.md §3.50).
  const marked = victoryDisplayAbilityIds(deps);
  if (marked.size === 0 || state.victoryDisplay.includes(id) || !refs.some((ref) => marked.has(ref.id))) return refs;
  return refs.filter((ref) => !marked.has(ref.id));
}

const NO_IGNORED_ABILITIES: ReadonlyMap<InstanceId, ReadonlySet<string>> = new Map();
const IGNORE_RULE_IDS = new WeakMap<EngineDeps, ReadonlySet<string>>();
const IGNORED_BY_RULES = new WeakMap<GameState, WeakMap<EngineDeps, ReadonlyMap<InstanceId, ReadonlySet<string>>>>();

/**
 * The abilities `ignoreAbilities` rules in effect make absent, by the card in play that prints them (`RuleSpec
 * ignoreAbilities`; docs/phase7-wave8.md §3.21; RRG 1.8 "Ignore", p. 23). Rules come from constant abilities of cards
 * in play whose text box is not blank, from lasting rule grants and from the scenario. Each rule's `while` and `on` are
 * read with `DEFAULT_DEPS` (printed characteristics) and each source's abilities before any ignore is applied, so
 * matching cannot re-enter this function and two rules naming each other both apply. Cached per state like
 * `blankedSets`; a game whose registry has no such rule and that holds no such lasting or scenario rule pays one lookup.
 */
export function ignoredAbilities(state: GameState, deps: EngineDeps): ReadonlyMap<InstanceId, ReadonlySet<string>> {
  let ruleIds = IGNORE_RULE_IDS.get(deps);
  if (!ruleIds) {
    const ids = new Set<string>();
    for (const [id, definition] of Object.entries(deps.abilities)) {
      if (definition.trigger.kind !== "constant") continue;
      if ((definition.trigger.rules ?? []).some((rule) => rule.kind === "ignoreAbilities")) ids.add(id);
    }
    IGNORE_RULE_IDS.set(deps, ids);
    ruleIds = ids;
  }
  const isIgnore = (rule: RuleSpec): rule is Extract<RuleSpec, { kind: "ignoreAbilities" }> =>
    rule.kind === "ignoreAbilities";
  const lasting = state.lastingEffects.some((effect) => effect.kind === "ruleGrant" && isIgnore(effect.rule));
  const scenario = (state.scenarioRules.rules ?? []).some(isIgnore);
  if (ruleIds.size === 0 && !lasting && !scenario) return NO_IGNORED_ABILITIES;
  const perDeps =
    IGNORED_BY_RULES.get(state) ?? new WeakMap<EngineDeps, ReadonlyMap<InstanceId, ReadonlySet<string>>>();
  const cached = perDeps.get(deps);
  if (cached) return cached;
  const found = new Map<InstanceId, Set<string>>();
  const inPlay = cardsInPlay(state);
  const apply = (rule: Extract<RuleSpec, { kind: "ignoreAbilities" }>, context: EffectContext) => {
    if (rule.while && !evaluate(state, rule.while, context)) return;
    for (const id of inPlay) {
      if (!matchesQuery(state, id, rule.on, context)) continue;
      const ids = found.get(id) ?? new Set<string>();
      for (const abilityId of rule.abilities) ids.add(abilityId);
      found.set(id, ids);
    }
  };
  if (ruleIds.size > 0) {
    for (const sourceId of inPlay) {
      const carried = unblankedAbilityRefs(state, sourceId).filter((ref) => ruleIds.has(ref.id));
      // A blank text box has no rule to give (read only for a card that prints one).
      if (carried.length === 0 || textBoxBlankFor(state, sourceId, deps)) continue;
      for (const ref of carried) {
        const trigger = deps.abilities[ref.id]?.trigger;
        if (trigger?.kind !== "constant") continue;
        const context: EffectContext = {
          selfInstanceId: sourceId,
          controllerId: speakerOf(state, sourceId),
          event: null,
          bindings: {},
          deps: DEFAULT_DEPS,
        };
        for (const rule of trigger.rules ?? []) if (isIgnore(rule)) apply(rule, context);
      }
    }
  }
  for (const effect of state.lastingEffects) {
    if (effect.kind === "ruleGrant" && isIgnore(effect.rule))
      apply(effect.rule, lastingContext(effect.scope, DEFAULT_DEPS));
  }
  for (const rule of state.scenarioRules.rules ?? []) {
    if (isIgnore(rule))
      apply(rule, { selfInstanceId: null, controllerId: null, event: null, bindings: {}, deps: DEFAULT_DEPS });
  }
  perDeps.set(deps, found);
  IGNORED_BY_RULES.set(state, perDeps);
  return found;
}

/** Whether `abilityId` on the card in play `id` is ignored right now (`ignoredAbilities`). */
export const abilityIgnored = (state: GameState, deps: EngineDeps, id: InstanceId, abilityId: string): boolean =>
  ignoredAbilities(state, deps).get(id)?.has(abilityId) === true;

/** Ability ids in this registry marked `activeIn: "victoryDisplay"`. Memoized per registry object. */
const VICTORY_DISPLAY_ABILITY_IDS = new WeakMap<EngineDeps, ReadonlySet<string>>();
function victoryDisplayAbilityIds(deps: EngineDeps): ReadonlySet<string> {
  let ids = VICTORY_DISPLAY_ABILITY_IDS.get(deps);
  if (!ids) {
    const found = new Set<string>();
    for (const [id, definition] of Object.entries(deps.abilities)) {
      if (definition.activeIn === "victoryDisplay" && definition.trigger.kind === "constant") found.add(id);
    }
    VICTORY_DISPLAY_ABILITY_IDS.set(deps, found);
    ids = found;
  }
  return ids;
}

/**
 * "You" for a constant read from one of `constantSources`: a card in play's controller, and for a card in the victory
 * display (`AbilityDefinition.activeIn: "victoryDisplay"`, docs/phase7-wave7.md §3.50) its owner, whoever defeated it
 * and whoever controlled it when it left play. A card there has no controller: RRG 1.8 "Ownership and Control" (p. 31)
 * gives a player control of "the cards in their own out-of-play areas", and the victory display is "shared by all
 * players" ("Victory Display", p. 46), so ownership is the one tie to a player the card keeps. Null for an encounter
 * card there. `CardInstance.controllerId` is not read for it: a defeat leaves the last controller recorded.
 */
export function constantControllerOf(state: GameState, sourceId: InstanceId): PlayerId | null {
  if (!state.victoryDisplay.includes(sourceId)) return controllerOf(state, sourceId);
  return getInstance(state, sourceId)?.ownerId ?? null;
}

/**
 * The cards whose constant abilities are read: every card in play, then each card in the victory display that prints a
 * constant marked `activeIn: "victoryDisplay"` (docs/phase7-wave7.md §3.50), in the order they arrived there. A card an
 * eliminated player owns is left out: RRG 1.8 "Player Elimination" (p. 34) steps 4-5 put "each card owned by the
 * eliminated player" in their discard pile and remove it from the game. Nothing here depends on how the card arrived
 * (a defeat with Victory X, or an effect) or records it: the read is live, so the constant starts when the card is in
 * `GameState.victoryDisplay` and ends when it is not.
 */
export function constantSources(state: GameState, deps: EngineDeps): readonly InstanceId[] {
  const inPlay = cardsInPlay(state);
  const marked = victoryDisplayAbilityIds(deps);
  if (marked.size === 0 || state.victoryDisplay.length === 0) return inPlay;
  const displayed = state.victoryDisplay.filter((id) => {
    const owner = getInstance(state, id)?.ownerId ?? null;
    if (owner !== null && getPlayer(state, owner)?.eliminated) return false;
    return unblankedAbilityRefs(state, id).some((ref) => marked.has(ref.id));
  });
  return displayed.length === 0 ? inPlay : [...inPlay, ...displayed];
}

/**
 * The ability slots a constant scan reads from one of `constantSources`: a card in play's live abilities
 * (`activeAbilityRefs`), and for a card in the victory display only those marked for it, so its other text (a constant
 * meant for play, its When Defeated) does nothing there. No blank is applied to the latter: a blank is aimed at a card
 * in play, and a card that left play has "no memory of its previous state" (RRG 1.8 "Leaves Play", p. 27).
 */
export function constantAbilityRefs(
  state: GameState,
  sourceId: InstanceId,
  deps: EngineDeps,
): readonly AbilityReference[] {
  if (!state.victoryDisplay.includes(sourceId)) return activeAbilityRefs(state, sourceId, deps);
  const marked = victoryDisplayAbilityIds(deps);
  return marked.size === 0 ? [] : unblankedAbilityRefs(state, sourceId).filter((ref) => marked.has(ref.id));
}

/**
 * The ability slots of a card's live face with no text-box blank applied (`activeAbilityRefs` less the blank check).
 * A facedown card and a card treated as another type still have none: neither is a text box "treated as if it were
 * blank", so a `textBoxCannotBeBlanked` rule (§3.31 of wave 5) does not bring them back.
 */
function unblankedAbilityRefs(state: GameState, id: InstanceId): readonly AbilityReference[] {
  const card = cardOf(state, id);
  if (!card) return [];
  // A facedown card's own text is blank while it is facedown, and so is a card whose text box is treated as blank
  // (an ally treated as a minion "with a blank text box", docs/phase7-wave4.md §3.9).
  const instance = getInstance(state, id);
  if (instance?.facedownAs || instance?.treatedAs) return [];
  // An event's abilities resolve only by playing it (RRG 1.8 "Event", p. 19), which reads its printed text directly.
  // One sitting faceup on another card (an Arrow on Hawkeye's Quiver) has none of its own: offered as a card ability,
  // its effect ran without paying the event's cost or discarding it (2026-09-29 report).
  if (card.type === "event" && instance?.attachedTo) return [];
  const face = encounterFace(state, id);
  if (face) return face.abilities;
  if (card.type === "hero_identity") {
    const player = state.players.find((p) => p.identity.instanceId === id);
    if (!player) return [];
    return identityFace(state, player).face.abilities;
  }
  if (card.type === "villain") {
    return isVillain(state, id) ? villainStageOf(state, id).abilities : [];
  }
  if (card.type === "main_scheme") {
    const scheme = mainSchemeStateOf(state, id);
    // A stage whose A side is still the faceup one has no live B-side abilities (docs/phase7-wave8.md §4.1 Q56; RRG
    // 1.8 Appendix II step 12, p. 51). The A side's own abilities resolve through the frames pushed for them.
    return scheme && scheme.faceupSide !== "A" ? mainSchemeStageOf(state, scheme).abilities : [];
  }
  return "abilities" in card ? card.abilities : [];
}

/**
 * "Connection to the Worldmind does not count toward your hand size." (`nova` 28007; docs/phase7-wave5.md §3.18): a
 * printed constant read from the card in hand (`notCountedTowardHandSize`).
 */
export function countsTowardHandSize(state: GameState, id: InstanceId, deps: EngineDeps): boolean {
  const card = cardOf(state, id);
  if (!card) return true;
  return !printedAbilityRefs(card).some((ref) => {
    const trigger = deps.abilities[ref.id]?.trigger;
    return trigger?.kind === "constant" && trigger.notCountedTowardHandSize === true;
  });
}

/**
 * The cards in a player's hand that count toward their hand size (RRG 1.8 "Hand Size", p. 21): the end-of-phase discard
 * and draw, the mulligan's draw back up, and "draw up to your hand size". Every other hand count (`handCountOf`) still
 * counts every card in hand. docs/phase7-wave5.md §3.18.
 */
export const handCountTowardHandSize = (state: GameState, playerId: PlayerId, deps: EngineDeps): number =>
  (getPlayer(state, playerId)?.hand ?? []).filter((id) => countsTowardHandSize(state, id, deps)).length;

/** Ability slots printed on a card regardless of where the card is (for reveal/boost). */
export function printedAbilityRefs(card: AnyCard): readonly AbilityReference[] {
  if (card.type === "hero_identity")
    return [...heroFacesOf(card).flatMap((face) => face.abilities), ...card.alterEgo.abilities];
  if (card.type === "villain") return card.sides.flatMap((side) => side.stages.flatMap((stage) => stage.abilities));
  if (card.type === "main_scheme") {
    return card.stages.flatMap((stage) => [...stage.aSide.abilities, ...stage.abilities]);
  }
  return "abilities" in card ? card.abilities : [];
}

/** The A-side abilities of the main scheme's current stage (1A setup / NA When Revealed). */
export function mainSchemeASideRefs(state: GameState): readonly AbilityReference[] {
  return mainSchemeStage(state).aSide.abilities;
}

/**
 * RRG "Restricted": the limit is two per *player*, across every card they control. The cards with the keyword: what
 * text naming "restricted cards" sees, and what is discarded for the limit (docs/phase7-wave7.md §4.1 Q52 = B). What
 * the limit is compared with is `restrictedLoadOf`.
 */
export const restrictedCardsOf = (
  state: GameState,
  playerId: PlayerId,
  deps: EngineDeps = DEFAULT_DEPS,
): readonly InstanceId[] =>
  cardsInPlay(state).filter((id) => controllerOf(state, id) === playerId && hasKeyword(state, id, "restricted", deps));

/**
 * How much one card weighs on its controller's restricted limit (docs/phase7-wave7.md §3.82): the N of a printed
 * "Counts as N restricted cards." (`PlayerCard.restrictedWeight`), 1 for a card with the restricted keyword (RRG 1.8
 * "Restricted", p. 38), otherwise 0. The printed sentence is text-box text on the card's front: a facedown card, a
 * card showing its other face and a blank text box (RRG 1.8 "Blank", p. 10) do not have it.
 */
export function restrictedWeightOf(state: GameState, id: InstanceId, deps: EngineDeps = DEFAULT_DEPS): number {
  const card = cardOf(state, id);
  const instance = getInstance(state, id);
  const printed = card && "restrictedWeight" in card ? card.restrictedWeight : undefined;
  if (
    printed !== undefined &&
    !instance?.facedownAs &&
    !instance?.treatedAs &&
    !instance?.flipped &&
    !textBoxBlankFor(state, id, deps)
  ) {
    return printed;
  }
  return hasKeyword(state, id, "restricted", deps) ? 1 : 0;
}

/**
 * A player's restricted load, the number the restricted limit is compared with (docs/phase7-wave7.md §3.82): the sum
 * of `restrictedWeightOf` over the cards in play they control. The one count every restricted-limit check reads. A
 * facedown attachment is out of play (RRG 1.8 p. 23) and is not counted.
 */
export function restrictedLoadOf(state: GameState, playerId: PlayerId, deps: EngineDeps = DEFAULT_DEPS): number {
  let load = 0;
  for (const id of cardsInPlay(state)) {
    if (controllerOf(state, id) === playerId) load += restrictedWeightOf(state, id, deps);
  }
  return load;
}

/** `TargetQuery.statCompare`'s comparison. */
function compareStat(own: number, op: StatComparison["op"], against: number): boolean {
  switch (op) {
    case "lt":
      return own < against;
    case "le":
      return own <= against;
    case "eq":
      return own === against;
    case "ge":
      return own >= against;
    case "gt":
      return own > against;
  }
}
