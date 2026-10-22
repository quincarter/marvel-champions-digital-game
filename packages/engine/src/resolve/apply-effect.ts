/** Applying one non-interactive effect from an effects frame. */

import { imminentAttach, imminentAttachHeard, resolveImminentAttach } from "./imminent-attach.js";
import { placeCountersOrAnnounce } from "./counters-being-placed.js";
import { announceDeckTops } from "../deck-top.js";
import { discardTopOfEncounterDeck, encounterTopDiscardVars } from "../encounter-discard-cost.js";
import type { CardId, VillainSideLetter } from "@mc/content";
import { nextInt, shuffle } from "../rng.js";
import {
  type Ctx,
  emit,
  findFrame,
  moveCard,
  pushFrames,
  setFrame,
  updateFrame,
  updateInstance,
  updatePlayer,
} from "../ctx.js";
import {
  addAccelerationToken,
  addLastingEffect,
  applyLeavePatch,
  defeatFromPlay,
  discardFromHand,
  discardFromPlay,
  endGame,
  leavePlay,
  discardRandomFromHand,
  drawCards,
  drawUpTo,
  drawEncounterCard,
  encounterDealAwaitingInterrupt,
  exhaustCard,
  healDamage,
  removeAccelerationToken,
  removeCounters,
  moveCounters,
  discardEmptiedUsesCard,
  flipVillain,
  applyToughness,
  setVillainSide,
  removeStatus,
  discardStatusCards,
  type StatusDiscarded,
  type StatusGiver,
  setActiveVillain,
  shuffleZone,
  swapIdentity,
  playerDeckResets,
  recordDeckDiscard,
  recordEncounterDeckDiscard,
  takeTopOfDeck,
  settleAwaitingAttackEffects,
  turnToFlipSide,
  leavePlayAtOnce,
} from "../effects.js";
import { ANY_COUNTER, anyCounterPickOf, anyCounterTake, landingCounterType } from "../counter-types.js";
import { BORROWED_BOOST_ICONS_SLOT } from "../abilities.js";
import { EngineInvariantError } from "../errors.js";
import { boundCardTotals, recountDeckDiscardIcons } from "./deck-discard.js";
import { resolveTuck, tuckInsteadOfLeaving, tuckOrAnnounce } from "./tuck.js";
import { separateDeckInsteadOfLeaving } from "./leave-to-separate-deck.js";
import { dealHiddenPiles, gainFromHiddenPile, revealHiddenPile, seedHiddenPiles } from "./hidden-piles.js";
import { identifyMole } from "./accusation.js";
import { giveStatusOrAnnounce } from "./status-being-given.js";
import { listensForWouldDiscard, pickRandomFromHand, splitWouldDiscard } from "./would-discard.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { printedFormTypes, statusActive, usesKeyword } from "../keywords.js";
import { activationVarsOf } from "../defend-preview.js";
import { boostIconsFor, cardEffectBonus } from "../modifiers.js";
import type { AttachmentBound, LastingDuration, LastingEffectBody, LastingScope } from "../lasting.js";
import {
  activeEncounterDeckId,
  cardBackOf,
  cardOf,
  characterProfile,
  currentName,
  discardZoneFor,
  encounterDeckOf,
  getInstance,
  beforeStartingHandsDrawn,
  getPlayer,
  inAnyEncounterDiscard,
  isMinion,
  isPlayerCardType,
  isHostOnlyCard,
  isLooseVillainCard,
  locateCard,
  mainSchemeStateOf,
  maxHitPoints,
  mustInstance,
  mustPlayer,
  nextVillainInActivationOrder,
  nextVillainInRow,
  turnInProgress,
  endOfPlayerPhaseCanStart,
  villainOf,
  isScheme,
  playerCardOwnerOf,
} from "../query.js";
import {
  AFFECTED_SLOT,
  attachmentHolds,
  canAttack,
  cardsInPlay,
  categoriesOf,
  contextArea,
  controllerOf,
  DEFENDER_SLOT,
  type EffectContext,
  evaluate,
  cannotBeDefeatedAgain,
  focusedMainSchemeId,
  matchesQuery,
  resolvePlayers,
  isPlayerCard as isAPlayersCard,
  resolveRef,
  resolveValue,
  sourcePlayerOf,
} from "../select.js";
import type { DefeatPlacement, EffectSpec, PlayerRef, StatName } from "../spec.js";
import { type GameState, NO_STATUSES } from "../state.js";
import {
  basicPowerUseFrameId,
  currentActivationFrameId,
  currentThwartFrameId,
  type DeferredEffects,
  paidForFrameId,
  PLAY_NOTE_PREFIX,
  playFrameOf,
  type ReportTarget,
  type StackFrame,
} from "../stack.js";
import {
  cardFlippedEvent,
  type LeavePatch,
  type DeferredActivationBonus,
  type SchemeThreatDivert,
  type SchemeWouldPlaceThreat,
  type TriggerEvent,
} from "../trigger-events.js";
import { uniqueEntryBlocker } from "../unique.js";
import { resolveSetupOnEntry, settleEntryFaces, turnBeforeEntry, type TurnedForEntry } from "./put-into-play-setup.js";
import { campaignSeatNumber } from "../campaign-state.js";
import { campaignLogValueOf, recordCampaignRemoval, recordCampaignWrite } from "./campaign.js";
import { damageGroupFrame } from "./damage-group.js";
import { pushDefeats } from "./defeated-together.js";
import { advanceToSetAsideVillain, swapVillain } from "./villain-swap.js";
import { swapCards } from "./swap-cards.js";
import { applyFindCard, findToDeal, findToReveal, shuffleSearchedDecks } from "./find.js";
import {
  announcesAttaching,
  attachCardBy,
  canAttachTo,
  hideReverses,
  releaseControlOfCaptive,
  settleUpgradeControl,
} from "./attach.js";
import { flipToOtherFace } from "./other-face.js";
import {
  buildScenarioDeck,
  dealAsEncounterCards,
  isDealableCard,
  passEncounterCards,
  eachEncounterCard,
  moveCardsTo,
  selectCards,
  shuffleEncounterDeck,
  shuffleSeparateDeck,
} from "./cards.js";
import {
  boostIgnored,
  cannotActivate,
  cannotChangeForm,
  cannotEnterPlay,
  formOnlyFault,
  maxPerPlayerReached,
  cannotFlip,
  cannotThwart,
  canTakePlayerAttack,
  playerAttackInProgress,
  playersCannotDiscard,
  revealCannotBeCanceled,
  sustainedDamageAllowance,
  schemeActivationDestination,
} from "../rules.js";
import {
  addMainSchemeStageToVictoryDisplay,
  advanceMainSchemeStage,
  alreadyDefeated,
  checkDefeats,
  completeMainScheme,
  removeMainSchemeStages,
  revealNextVillainStage,
  shuffleMainSchemeStages,
  sitOutScenario,
} from "./defeat.js";
import {
  addVillains,
  createGameArea,
  createScenarioPlayArea,
  placeInScenarioPlayArea,
  flipMainSchemeStage,
  putMainSchemeStageIntoPlay,
  removeMainSchemeStage,
  removeVillains,
  setVillainsAside,
  revealMainSchemeStages,
} from "./game-areas.js";
import { emitSharedEvent, resolveInGroup } from "./pod.js";
import {
  announceDamagePrevented,
  readyOrAnnounce,
  redirectPendingDefeat,
  threatRemovalBlocked,
  thwartBlockedOn,
} from "./event.js";
import {
  abilityAttackDamage,
  abilityAttackOf,
  abilityAttackRoot,
  attackEffectCancelled,
  begunAttackAgainst,
  begunAttackTarget,
  hasBegunAttack,
  isAttackInstruction,
  noteAttackedByAbility,
  preventAbilityAttackDamage,
  resumeBegunAttack,
  retargetAbilityAttack,
  skipForCancelledAttack,
  skipRetargetedAway,
  skipRetargetedAwayFrom,
  skipUnattackable,
  withMovedAttackTarget,
} from "./attack-ability.js";
import { abilityRootFrameId, addSessionExtraThreat } from "./thwart-session.js";
import { readsDeck, replacesStatusOn } from "./target-validity.js";
import { isUnpreventableDamage } from "./unpreventable.js";
import { markPreThenUnresolved, UNRESOLVED_VAR } from "./then.js";
import { heard } from "./triggers.js";
import { announceStatusDiscarded } from "./status-discarded.js";
import {
  beingRevealed,
  BOOST_SOURCE_ZONES,
  boostAwaitingInterrupt,
  boostCardBeingGivenTo,
  dealBoostCardOrAnnounce,
  dealChosenBoostCard,
  declareDefenderByLabeledEffect,
  getsBoostCard,
  giveBoostCard,
} from "./enemy-activation.js";
import {
  checkRestrictedAfterFlip,
  enterPlay,
  engagedInPlayFrames,
  engagementHeardAfter,
  engagementOf,
  playerSideSchemeEntersPlay,
  engageInPlayMinion,
  quickstrikeFrame,
  rotateEngagement,
  teamworkFrame,
} from "./enter-play.js";
import { addFrameSlots, addFrameVars, eventFrame, type Frame, pushEffects, pushEvent, pushEvents } from "./frames.js";
import { insertConsequentialDamage, pushConsequentialDamage, setBasicPowerStat } from "../actions.js";
import { hostOnlyReleaseZone, takeControlAsOwnAlly, treatAsAlly } from "../treat-as.js";
import {
  enterPlayOnReveal,
  replaceRevealInProgress,
  revealFrame,
  putIntoPlayHostCandidates,
  revealNewFaceFrame,
  upgradeHostCandidates,
} from "./reveal.js";

/**
 * The frame binding holding the host a player chose for an upgrade a `putIntoPlay` is about to put into play
 * (`askPutIntoPlayHost` in `effects-frame.ts` asks, the effect reads it).
 */
export const putIntoPlayHostSlot = (id: InstanceId): string => `_putIntoPlay.host.${id}`;

/**
 * RRG 1.8 "Unique Icon" (pp. 45–46), the *put into play* half of the rule, quoted:
 *
 *   "A non-villain card in an out-of-play state that matches a card in play cannot enter
 *    play. If the out-of-play card is:
 *      - A player card, it cannot be played or put into play. Any effect that attempts to
 *        do so has no effect.
 *      - A non-villain encounter card, it is discarded and any effects of it entering play
 *        are ignored."
 *
 * So the two dispositions differ and neither is a failure the caller can see: a player card
 * (Make the Call reaching into a discard pile) is left exactly where it was and the rest of
 * the effect still resolves; a non-villain encounter card is discarded. A villain card is
 * exempt — the restriction is on the *entering* card being non-villain, and FFG's ruling on
 * the Ronan the Accuser minion vs. the Ronan the Accuser villain confirms a villain already
 * in play still blocks (that direction is the scan below, not this carve-out).
 *
 * Returns the ids that may proceed, and records every refusal in the game log.
 */
function admitUniqueEntry(
  ctx: Ctx,
  ids: readonly InstanceId[],
  forPlayer: PlayerId,
  /** The card whose ability puts them into play: not held against the linked card it brings in (`uniqueEntryBlocker`). */
  bringer: InstanceId | null,
): readonly InstanceId[] {
  const admitted: InstanceId[] = [];
  for (const id of ids) {
    const card = cardOf(ctx.state, id);
    // "[A title] cannot enter play during this game" (`RuleSpec cannotEnterPlay`, docs/phase7-wave8.md §3.43): the
    // effect does nothing to the card, whatever its type, and it stays where it was. A card in play is not entering.
    if (card && !cardsInPlay(ctx.state).includes(id) && cannotEnterPlay(ctx.state, ctx.deps, id, forPlayer)) {
      emit(ctx, { type: "putIntoPlayRefused", instanceId: id, playerId: forPlayer, reason: "cannotEnterPlay" });
      continue;
    }
    // A villain entering play is exempt; so is a card with no data to match on (`uniqueEntryBlocker`).
    const match = uniqueEntryBlocker(ctx.state, ctx.deps, id, forPlayer, bringer);
    if (!card || !match) {
      admitted.push(id);
      continue;
    }
    // A player card nobody owns yet is still a player card (a set-aside linked card, RRG 1.8 "Linked (Card Title)",
    // p. 27; docs/phase7-wave7.md §3.75): the attempt has no effect and it stays where it was.
    const isPlayerCard =
      playerCardOwnerOf(ctx.state, id) !== null || (isPlayerCardType(card) && cardBackOf(card) === "player");
    emit(ctx, {
      type: "uniqueEntryBlocked",
      instanceId: id,
      cardId: card.id,
      matchedInstanceId: match,
      disposition: isPlayerCard ? "noEffect" : "discarded",
    });
    // Already in the encounter discard (a `discardEncounterUntil` search left it there):
    // nothing to move, and a no-op `cardMoved` would only muddy the log.
    if (!isPlayerCard && !inAnyEncounterDiscard(ctx.state, id)) moveCard(ctx, id, discardZoneFor(ctx.state, id));
  }
  return admitted;
}

/**
 * RRG 1.8 "Max, Maximum" (p. 28): "'Max 1 per player' … restricts the number of copies of that card that each player
 * may control in play at a given time. A player cannot take control of another copy of a 'Max 1 per player' card they
 * already control." A limit on control, so an effect that puts the card into play under a player who already controls
 * a copy has no effect for that card, which stays where it was (owner decision, docs/phase7-wave9.md §4.1 Q37 = A;
 * "Play, Put into Play", p. 32, lifts only "restrictions or prohibitions regarding playing that card").
 *
 * An upgrade is controlled by its host's controller (p. 31), so it is refused only when the maximum leaves it no host
 * (`putIntoPlayHostCandidates`) where its "attach to" text alone would have given it one; with no host at all it is
 * left for the attach step to report (`noLegalHost`). A card already in play is not entering, and an encounter card is
 * no player's. Returns the ids that may proceed, and logs every refusal.
 */
function admitUnderPlayerMax(ctx: Ctx, ids: readonly InstanceId[], forPlayer: PlayerId): readonly InstanceId[] {
  const inPlay = cardsInPlay(ctx.state);
  return ids.filter((id) => {
    if (inPlay.includes(id)) return true;
    const refused =
      cardOf(ctx.state, id)?.type === "upgrade"
        ? upgradeHostCandidates(ctx.state, ctx.deps, id, forPlayer).length > 0 &&
          putIntoPlayHostCandidates(ctx.state, ctx.deps, id, forPlayer).length === 0
        : maxPerPlayerReached(ctx.state, id, forPlayer) !== null;
    if (refused) emit(ctx, { type: "putIntoPlayRefused", instanceId: id, playerId: forPlayer, reason: "maxPerPlayer" });
    return !refused;
  });
}

/**
 * RRG 1.8 "Play, Put into Play" (p. 32): "Cards with the text '[type] form only' can only be played or put into play by
 * a player whose identity is in the specified form." The player is the one the card would enter play under. A refused
 * card stays where it was, logged `putIntoPlayRefused { reason: "wrongForm" }`. A card already in play is not entering,
 * and one put into play facedown is exempt: its text is hidden (owner decision 2026-10-20, an engine interpretation; no
 * official source covers a "[type] form only" card put into play facedown). Returns the ids that may proceed.
 */
function admitFormOnly(ctx: Ctx, ids: readonly InstanceId[], forPlayer: PlayerId): readonly InstanceId[] {
  const inPlay = cardsInPlay(ctx.state);
  return ids.filter((id) => {
    if (inPlay.includes(id) || formOnlyFault(ctx.state, id, forPlayer) === null) return true;
    emit(ctx, { type: "putIntoPlayRefused", instanceId: id, playerId: forPlayer, reason: "wrongForm" });
    return false;
  });
}

/**
 * A player card nobody owns yet, with a player card back: an ally, support or upgrade set aside by the scenario or a
 * campaign, or a linked card set aside at setup (RRG 1.8 "Linked (Card Title)", p. 27). Put into play it enters as a
 * player's card does (RRG 1.8 "Play, Put into Play", p. 32: "in a play area or state that matches the rules of playing
 * the card"), so an upgrade is attached to the host a play would give it. Not a player side scheme, which with no owner
 * is the scenario's and no player controls it (docs/phase7-wave7.md §4.1 Q24); not a card with an encounter back, which
 * the scenario keeps owning (`enterPlayOnReveal`).
 */
function unownedPlayerCard(state: GameState, id: InstanceId): boolean {
  const card = cardOf(state, id);
  if (!card || getInstance(state, id)?.ownerId !== null) return false;
  return (card.type === "ally" || card.type === "support" || card.type === "upgrade") && cardBackOf(card) === "player";
}

/**
 * RRG 1.8 "Ownership and Control" (p. 31): the player who takes control of a player card nobody owns becomes its owner,
 * so it leaves play to that player's discard pile (as `enterPlayOnReveal` and `takeIntoHand` do).
 */
function takeOwnership(ctx: Ctx, id: InstanceId, playerId: PlayerId): void {
  if (!unownedPlayerCard(ctx.state, id)) return;
  updateInstance(ctx, id, (i) => ({ ...i, ownerId: playerId, home: { kind: "player" } }));
  emit(ctx, { type: "ownershipChanged", instanceId: id, playerId });
}

/**
 * A `minionEngaged` announcement (responses only) for a minion that entered play engaged with a player, when something
 * could respond to it. Its interrupts had their window with the minion's `cardEntersPlay` (`engagingAsItEnters`).
 */
export function engagedEvent(ctx: Ctx, id: InstanceId): readonly TriggerEvent[] {
  const event = engagementOf(ctx.state, id);
  return event && engagementHeardAfter(ctx, event) ? [event] : [];
}

/** A var on an effects frame counting `repeatWhile` repetitions (docs/phase7-wave4.md §3.54). */
const REPEAT_DEPTH_VAR = "repeatWhile.depth";
/** Repetitions `repeatWhile` allows before it stops: far past any printed "repeat this effect" (one per character). */
export const REPEAT_LIMIT = 50;

/** Every slot and bind name the effects (nested lists included) bind: what a repetition must start without. */
function boundNamesOf(effects: readonly EffectSpec[]): readonly string[] {
  const names = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    const record = value as Record<string, unknown>;
    if (typeof record.bind === "string") names.add(record.bind);
    if (typeof record.slot === "string" && record.kind !== "slot" && record.kind !== "superlative")
      names.add(record.slot);
    if (typeof record.name === "string" && record.kind === "setVar") names.add(record.name);
    for (const item of Object.values(record)) visit(item);
  };
  visit(effects);
  return [...names];
}

/**
 * The card whose ability makes a card leave play or be defeated from this frame, for the Permanent keyword's same-set
 * exception (RRG 1.8 "Permanent", p. 32; `effects.ts` `permanentStopsLeaving`, docs/phase7-wave5.md §4.1 Q46): the
 * frame's own card. A defeated card's leaving step is the game's rule, and carries the defeat's source instead (none
 * for a defeat at zero hit points or zero threat), since its own card is the defeated one. Plain card data, so a replay
 * reads the same.
 */
function leaveSourceOf(ctx: Ctx, frame: Frame<"effects">): CardId | undefined {
  if (frame.defeatedLeaving !== undefined) return frame.defeatedLeavingSource;
  return frame.selfInstanceId ? getInstance(ctx.state, frame.selfInstanceId)?.cardId : undefined;
}

/** The `countersPlaced` announcement (docs/phase7-wave6.md §3.2): `playerId` is the player resolving the ability. */
const countersPlaced = (
  targetInstanceId: InstanceId,
  counterType: string,
  amount: number,
  playerId: PlayerId | null,
): TriggerEvent => ({ kind: "countersPlaced", targetInstanceId, counterType, amount, playerId });

/**
 * Who removes the threat these effects remove (`TriggerEvent removeThreat.playerId`): the player using the ability when
 * a player uses it (`byPlayer`: every ability on a player card, and an action or an optional interrupt or response on
 * an encounter card), else the player the card whose effects these are acts for (`sourcePlayerOf`: its controller, or
 * the player an obligation or an attachment on a player card speaks to); nobody for any other encounter card's forced
 * ability.
 */
export function threatRemoverOf(ctx: Ctx, frame: Frame<"effects">): PlayerId | null {
  if (frame.byPlayer) return frame.controllerId;
  return sourcePlayerOf(ctx.state, { sourceInstanceId: frame.selfInstanceId });
}

/**
 * "Place that threat on …" answering a removal that is the first half of a move (`placeThreat.ofRemovedThreat`): the
 * tokens it places are the moved ones, so the move's pending placement loses them, and a placement left with none is
 * cancelled (it never happens: no "after threat is placed" window). FFG ruling Nov 21, 2025 (Beat Cop moving
 * threat off Show of Empathy, docs/rulings/post-rrg-1-6/16-november-2025.md): the interrupt "will trigger and change
 * the destination of the threat token". RRG 1.8 "Move" (p. 30).
 */
function redirectMovedThreat(ctx: Ctx, frame: Frame<"effects">, placed: number): void {
  const removal = frame.event;
  if (removal?.kind !== "removeThreat" || !removal.movePlacementFrameId || placed <= 0) return;
  const placement = findFrame(ctx.state, removal.movePlacementFrameId);
  if (placement?.kind !== "event" || placement.event.kind !== "placeThreat" || placement.cancelled) return;
  const left = Math.max(0, placement.event.amount - placed);
  setFrame(ctx, {
    ...placement,
    event: { ...placement.event, amount: left },
    ...(left === 0 ? { cancelled: true } : {}),
  });
}

/**
 * One `forEachPlayer` pass per player of `players`, resolving in that order: each pass is its own effects frame with
 * `scopedPlayerId` = that player, sharing the parent frame's source, bindings and vars.
 *
 * With `bind`, each pass hands what it set or changed back to `frame` under `<bind>.` as it finishes (vars summed,
 * slots joined: `returnBindingsPrefix`; `returnChangedFrom` keeps the ability's own vars from coming back once per
 * pass), and starts without the `<bind>.` names.
 */
export function pushEachPlayerPass(
  ctx: Ctx,
  frame: Frame<"effects">,
  effects: readonly EffectSpec[],
  players: readonly PlayerId[],
  bind?: string,
): void {
  const prefix = bind === undefined ? null : `${bind}.`;
  const own = <T>(record: Readonly<Record<string, T>>): Readonly<Record<string, T>> =>
    prefix === null ? record : Object.fromEntries(Object.entries(record).filter(([key]) => !key.startsWith(prefix)));
  // Pushed in reverse so the first player's pass resolves first.
  for (const playerId of [...players].reverse()) {
    pushEffects(ctx, {
      effects,
      selfInstanceId: frame.selfInstanceId,
      abilityId: frame.abilityId,
      instruction: frame.instruction,
      controllerId: frame.controllerId,
      event: frame.event,
      eventFrameId: frame.eventFrameId,
      bindings: own(frame.bindings),
      vars: own(frame.vars),
      scopedPlayerId: playerId,
      ...(bind !== undefined
        ? {
            returnBindingsTo: frame.frameId,
            returnBindingsPrefix: bind,
            returnChangedFrom: { vars: own(frame.vars), bindings: own(frame.bindings) },
          }
        : {}),
    });
  }
}

export function applyEffect(ctx: Ctx, effect: EffectSpec, context: EffectContext, frame: Frame<"effects">): void {
  // Announcements pushed only when an ability listens, so a game with no listener resolves as before.
  const pushHeard = (events: readonly TriggerEvent[]): void => {
    const listened = events.filter((event) => heard(ctx.state, ctx.deps, event));
    if (listened.length > 0) pushEvents(ctx, listened);
  };
  const targets = (ref: Parameters<typeof resolveRef>[1]): readonly InstanceId[] =>
    resolveRef(ctx.state, ref, context).filter((id) => getInstance(ctx.state, id) !== undefined);
  const value = (spec: Parameters<typeof resolveValue>[1]): number => resolveValue(ctx.state, spec, context, ctx.deps);
  const reportTo = (bind: string | undefined): ReportTarget | null =>
    bind ? { frameId: frame.frameId, prefix: bind } : null;
  // The player an effect's `by` names as doing it: undefined without one, null when it names nobody ("the player who
  // defeated this scheme" when no player did), and the effect then happens with no player (docs/phase7-wave7.md §4.1 Q2).
  const namedBy = (by: PlayerRef | undefined): PlayerId | null | undefined =>
    by === undefined ? undefined : (resolvePlayers(ctx.state, by, context)[0] ?? null);

  // RRG 1.8 "Labeled Ability" (p. 26): "When a player resolves an ability labeled '(thwart),' that ability is
  // considered to be a thwart made by that player's identity." So threat a "(thwart)" ability removes from a scheme is
  // that identity's thwart, whether or not it uses the hero's THW (owner decision, 2026-10-03): it resolves exactly as
  // the `thwart` effect does. Patrol and `cannotThwart` stop it on the main scheme (RRG 1.8 "Patrol", p. 32),
  // `modifyThwart` adds to it and "after you thwart" answers it. The ability is one thwart however many instances of
  // threat it removes (RRG 1.8 "Thwart", p. 44; `resolve/thwart-session.ts`). An unlabeled ability's removal stays a
  // plain removal.
  // Only a scheme is thwarted: threat the same ability removes from a card that is not a scheme is tokens taken off
  // it, a plain removal below (docs/phase7-wave9.md §3.7 (a)). An instruction aimed at both kinds at once is read by
  // its schemes; no card is written that way.
  if (
    effect.kind === "removeThreat" &&
    context.thwartLabeled &&
    !(targets(effect.target).length > 0 && targets(effect.target).every((id) => !isScheme(ctx.state, id)))
  ) {
    applyEffect(
      ctx,
      {
        kind: "thwart",
        target: effect.target,
        amount: effect.amount,
        ...(effect.ignoreCrisis ? { ignoreCrisis: true } : {}),
        ...(effect.bind !== undefined ? { bind: effect.bind } : {}),
      },
      context,
      frame,
    );
    return;
  }
  switch (effect.kind) {
    case "dealDamage": {
      // "Increase the amount of damage that event deals by 2" (Embiggen!): every instance this card deals (RRG 1.8
      // "Event", p. 19; FAQ "Embiggen (#10)", p. 59), but not damage its player takes (`taken`, wave 6 §3.41, Q21).
      // Nor an instruction that is itself additional damage of an earlier instance (`additional`, owner ruling Q53).
      const increased = !effect.taken && !effect.additional;
      const bonus = increased ? cardEffectBonus(ctx.state, ctx.deps, frame.selfInstanceId, "damage") : 0;
      // `perTarget`: the amount is read for each target, that target bound to `AFFECTED_SLOT`; a target owed none is
      // dealt no damage.
      const amountFor = (id: InstanceId): number =>
        resolveValue(
          ctx.state,
          effect.amount,
          { ...context, bindings: { ...context.bindings, [AFFECTED_SLOT]: [id] } },
          ctx.deps,
        );
      const shared = effect.perTarget ? 0 : value(effect.amount);
      // An "(attack)" ability is one attack (RRG 1.8 "Attack (Player Ability Type)", p. 10; owner ruling Q47): once
      // its attack has dealt its own damage, damage the ability deals to an enemy is that attack's, and the enemy is
      // attacked (`attack-ability.ts`). `fromAttack: false` says otherwise for one instruction; damage its player
      // takes (`taken`) and damage that names another dealer (`sourceFromEvent`) are never the attack's.
      // Each enemy the instruction names is attacked as it resolves, so guard is read for it now (owner ruling Q49):
      // one the identity may not attack is skipped. A label-only attack (Q48) reads it whether or not its attack is
      // open, since an instruction whose every enemy is guarded opens none.
      const ability = isAttackInstruction(effect) ? abilityAttackOf(ctx.state, ctx.deps, frame) : undefined;
      const attack = ability?.waiting;
      const named = targets(effect.target);
      const attacked: Extract<TriggerEvent, { kind: "characterAttacked" }>[] = [];
      // An attack whose window moved it off an enemy onto another character ("change the target of this attack to a
      // friendly character") deals the damage this instruction aims at that enemy to that character, which is the
      // one attacked (`attackRetarget`; `attack-ability.ts`, "A target changed in the attack's window").
      // An attack moved as a whole onto one character no longer attacks the other enemies named (`skipRetargetedAway`).
      const aimed = ability
        ? skipUnattackable(
            ctx,
            ability,
            frame.selfInstanceId,
            skipRetargetedAwayFrom(ctx, ability, frame.selfInstanceId, named),
          )
        : named;
      // "N unpreventable damage" (§H3.3). Damage an interrupt moves to another character ("deal that damage to X
      // instead", `sourceFromEvent`) is still that damage, so it stays unpreventable: owner question Q103 at A
      // (`unpreventable.ts`). Only a redirect written with `sourceFromEvent` carries it; a script that re-deals the
      // amount without it deals plain damage. Under B the redirect would not change the damage at all.
      const unpreventable =
        effect.unpreventable === true ||
        (effect.sourceFromEvent === true &&
          context.event?.kind === "dealDamage" &&
          isUnpreventableDamage(context.event));
      const events = withMovedAttackTarget(ctx, attack, frame.selfInstanceId, aimed)
        .map((to) => ({ ...to, base: effect.perTarget ? amountFor(to.named) : shared }))
        .filter(({ base }) => !effect.perTarget || base > 0)
        .map(({ dealtTo: id, moved, base }): Extract<TriggerEvent, { kind: "dealDamage" }> => {
          const ofAttack = attack ? abilityAttackDamage(ctx.state, ctx.deps, attack, id, moved) : null;
          if (ofAttack) attacked.push(ofAttack.attacked);
          return {
            kind: "dealDamage",
            targetInstanceId: id,
            amount: base + bonus + (increased ? (ofAttack?.extra ?? 0) : 0),
            sourceInstanceId:
              (effect.sourceFromEvent && context.event?.kind === "dealDamage"
                ? context.event.sourceInstanceId
                : null) ?? frame.selfInstanceId,
            fromAttack: effect.fromAttack === true,
            ...(effect.ignoreTough || unpreventable ? { ignoreTough: true } : {}),
            ...(unpreventable ? { unpreventable: true as const } : {}),
            ...(namedBy(effect.by) === null ? { noPlayer: true } : {}),
            ...ofAttack?.damage,
            // "Deal damage … equal to your ATK" as an attack's damage (docs/phase7-wave10.md §3.17).
            ...(effect.usesAtk && (effect.fromAttack === true || ofAttack) ? { usedStat: "atk" as const } : {}),
          };
        });
      if (attack) noteAttackedByAbility(ctx, attack.frameId, attacked);
      // The ability's attack used ATK once an instruction built from it has dealt damage as that attack (§3.17).
      if (attack && events.some((event) => event.usedStat === "atk")) {
        updateFrame(ctx, attack.frameId, (f) =>
          f.kind === "event" && f.event.kind === "attack" && f.event.usedStat === undefined
            ? { ...f, event: { ...f.event, usedStat: "atk" } }
            : f,
        );
      }
      // One effect dealing damage to several characters ("each character", "two enemies") deals it simultaneously:
      // ruling, June 2, 2026 (2) answer 1 ("Damage is dealt simultaneously; resolve damage steps for both enemies at
      // the same time"), with RRG 1.8 "Damage" (p. 14) giving the steps. So every target is dealt its damage before
      // any defeat is checked, through the same group indirect damage uses (docs/phase7-wave3.md §4 Q1).
      if (events.length > 1) {
        pushFrames(ctx, [damageGroupFrame(ctx, events, reportTo(effect.bind))]);
        return;
      }
      pushEvents(ctx, events, reportTo(effect.bind));
      return;
    }
    case "heal": {
      const amount = value(effect.amount);
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({
          kind: "healDamage",
          targetInstanceId: id,
          amount,
          sourceInstanceId: frame.selfInstanceId,
        })),
        reportTo(effect.bind),
      );
      return;
    }
    case "placeThreat": {
      const amount = value(effect.amount);
      if (effect.ofRemovedThreat) redirectMovedThreat(ctx, frame, amount * targets(effect.target).length);
      // Replacing a placement: still that threat, placed by the same card for the same activation (`replacesEvent`).
      const replaced = frame.replacesEvent?.kind === "placeThreat" ? frame.replacesEvent : undefined;
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({
          kind: "placeThreat",
          schemeInstanceId: id,
          amount,
          sourceInstanceId: replaced ? replaced.sourceInstanceId : frame.selfInstanceId,
          ...(replaced?.parentFrameId ? { parentFrameId: replaced.parentFrameId } : {}),
        })),
        reportTo(effect.bind),
      );
      return;
    }
    case "removeThreat": {
      // "Increase the amount of threat that event removes by 2" (Shrink): every instance this card removes.
      const amount = value(effect.amount) + cardEffectBonus(ctx.state, ctx.deps, frame.selfInstanceId, "threatRemoved");
      const by = namedBy(effect.by);
      // Replacing a removal: still that threat, removed by the same card for the same thwart (`replacesEvent`).
      const replaced = frame.replacesEvent?.kind === "removeThreat" ? frame.replacesEvent : undefined;
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({
          kind: "removeThreat",
          schemeInstanceId: id,
          amount,
          sourceInstanceId: replaced ? replaced.sourceInstanceId : frame.selfInstanceId,
          ...(replaced?.parentFrameId ? { parentFrameId: replaced.parentFrameId } : {}),
          playerId: by === undefined ? threatRemoverOf(ctx, frame) : by,
          ...(effect.ignoreCrisis ? { ignoreCrisis: true } : {}),
          ...(by === null ? { noPlayer: true } : {}),
        })),
        reportTo(effect.bind),
      );
      return;
    }
    case "attack": {
      const controller = frame.controllerId;
      const [attacker] = targets(effect.attacker ?? { kind: "identityOf", player: { kind: "controller" } });
      if (!controller || !attacker) return;
      let amount = value(effect.amount);
      // RRG "Move": moved damage is healed from the source and dealt to the destination; no source, no move. Only read
      // here: the damage is healed off the source below, once it is known that an attack is made to deal it.
      const [moveFrom] = effect.moveDamageFrom ? targets(effect.moveDamageFrom) : [];
      if (effect.moveDamageFrom) {
        amount = Math.min(amount, moveFrom ? mustInstance(ctx.state, moveFrom).damage : 0);
        if (!moveFrom || amount <= 0) return;
      }
      // RRG 1.8 "Stun" (p. 41): "If a stunned identity or ally attempts to attack or use an attack ability, discard
      // the stunned card instead. Costs associated with the attack attempt … must still be paid." An ability that
      // creates several attacks spends the stun on the first of them only — FAQ "Dance of Death (#4)" (p. 59):
      // "Because Dance of Death creates three separate attacks, a stun status card on Black Widow will only prevent
      // the first attack. The second and third attack can be performed as normal." An "(attack)"-labeled ability
      // never reaches here: its label cancels the whole ability first (`labelCancels`), which is the RRG's rule for
      // labeled abilities and is what Dance of Death's missing label distinguishes it from.
      // An "(attack)" ability's attack by its controller's identity belongs to the ability, and waits for it to finish
      // (RRG 1.8 "Attack (Player Ability Type)", p. 10; `attack-ability.ts`).
      const attackOf = abilityAttackRoot(ctx.state, ctx.deps, frame, attacker);
      // An attack the ability began as it began resolving (RRG 1.8 "Labeled Ability", p. 26; owner decision,
      // 2026-10-08, row 73) was attempted then, so a stunned card received since does not replace it (interpretation,
      // `attack-ability.ts`): this instruction only deals the damage of an attack already under way.
      if (!hasBegunAttack(ctx.state, attackOf, attacker) && statusActive(ctx.state, attacker, "stunned", ctx.deps)) {
        announceStatusDiscarded(ctx, discardStatusCards(ctx, attacker, "stunned", "cancelledAttack"));
        return;
      }
      // RRG "Attack (Player Ability Type)": attacks can target any enemy unless guard prevents it.
      // An attack the ability began with, moved in its window onto another enemy, is an attack on that enemy
      // (`attackedInstead`, docs/phase7-wave9.md §3.4): guard is read for it, not for the enemy it was moved off.
      // Once the ability's attack was moved as a whole onto one character, it attacks no other enemy
      // (`skipRetargetedAway`; docs/phase7-wave9.md §4.1 Q4 = A).
      const attackable = skipRetargetedAway(
        ctx,
        attackOf,
        attacker,
        frame.selfInstanceId,
        targets(effect.target),
      ).filter((id) => canAttack(ctx.state, attacker, begunAttackAgainst(ctx.state, attackOf, attacker, id), ctx.deps));
      // Once an attack of that ability was cancelled, the ability's one attack makes no more (owner decision,
      // 2026-10-08, row 65).
      const cancelled = attackOf !== undefined && attackEffectCancelled(ctx.state, ctx.deps, frame);
      if (cancelled) {
        skipForCancelledAttack(ctx, { attackerId: attacker, frameId: frame.frameId }, frame.selfInstanceId, attackable);
      }
      const attacked = cancelled ? [] : attackable;
      if (moveFrom) {
        // No attack is made (it was cancelled, or every enemy named is guarded), so nothing is moved: the damage stays
        // on the source. Before 2026-10-09 it was healed first and then dealt to nobody.
        if (attacked.length === 0) return;
        // RRG 1.8 "Heal" (p. 22): moving damage off a character heals it, so one that cannot be healed is no valid
        // source and the move is not made (`RuleSpec cannotBeHealed`, docs/phase7-wave6.md §3.12).
        amount = healDamage(ctx, moveFrom, amount, frame.selfInstanceId);
        if (amount <= 0) return;
      }
      // "Increase the amount of damage that event deals by 2" (Embiggen!): an "(attack)" event's damage is an instance
      // too, like `dealDamage` above (RRG 1.8 "Event", p. 19; FAQ "Embiggen (#10)", p. 59). Added after a move is capped,
      // so it raises the damage dealt without healing more from the source.
      amount += cardEffectBonus(ctx.state, ctx.deps, frame.selfInstanceId, "damage");
      // The attack the ability began with is this instruction's attack on one of its enemies: the same event, put back
      // at its damage step with that target and this amount, with no second interrupt window (`resumeBegunAttack`).
      // Any other enemy the instruction names gets its own event, as it always has, resolved after it. Its damage goes
      // to the target its window left it with (`begun.target`: a retarget made there is kept).
      const begun = attackOf === undefined ? undefined : begunAttackTarget(ctx.state, attackOf, attacker, attacked);
      const pushed = pushEvents(
        ctx,
        attacked
          .filter((id) => id !== begun?.instead)
          .map((id) => ({
            kind: "attack",
            attackerInstanceId: attacker,
            targetInstanceId: id,
            playerId: controller,
            amount,
            basic: false,
            overkill: effect.overkill === true,
            ...(effect.keywords && effect.keywords.length > 0 ? { keywords: effect.keywords } : {}),
            ...(effect.usesAtk ? { usedStat: "atk" as const } : {}),
            sourceInstanceId: frame.selfInstanceId,
            ...(frame.abilityId !== undefined ? { sourceAbilityId: frame.abilityId } : {}),
          })),
        reportTo(effect.bind),
      );
      if (attackOf !== undefined) {
        for (const id of pushed) updateFrame(ctx, id, (f) => (f.kind === "event" ? { ...f, attackOf } : f));
        if (begun !== undefined) {
          const made = {
            amount,
            overkill: effect.overkill === true,
            keywords: effect.keywords ?? [],
            usesAtk: effect.usesAtk === true,
          };
          resumeBegunAttack(ctx, attackOf, attacker, begun.target, made, reportTo(effect.bind));
        }
      }
      return;
    }
    case "treatAsAlly": {
      // Karma (docs/phase7-wave4.md §3.29): the effect's controller takes each target minion, as an ally, for as long as
      // this card is in play (`releaseTreatedBy` when it leaves).
      const controller = frame.controllerId;
      const source = frame.selfInstanceId;
      if (!controller || !source || !cardsInPlay(ctx.state).includes(source)) return;
      for (const id of targets(effect.target)) {
        treatAsAlly(ctx, id, {
          traits: effect.traits,
          thwFromSch: effect.thwFromSch === true,
          consequential: effect.consequential,
          source,
          controller,
        });
      }
      return;
    }
    case "takeControl": {
      // docs/phase7-wave11-scenarios.md §S3.8 (Black Cat): only a minion its own constant treats as an ally right now.
      const controller = frame.controllerId;
      if (!controller) return;
      for (const id of targets(effect.target)) takeControlAsOwnAlly(ctx, id, controller);
      return;
    }
    case "friendlyCharacterAttacks": {
      // docs/phase7-wave4.md §3.26 (Old Rivals). A friendly character: a hero-form identity or an ally a player controls.
      const inPlay = cardsInPlay(ctx.state);
      const [attacker] = targets(effect.attacker).filter((id) => {
        if (!inPlay.includes(id) || controllerOf(ctx.state, id) === null) return false;
        const categories = categoriesOf(ctx.state, id);
        return categories.includes("hero") || categories.includes("ally");
      });
      const [playerId] = resolvePlayers(ctx.state, effect.player, context);
      const player = playerId ? getPlayer(ctx.state, playerId) : undefined;
      const noAttack = () => {
        if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.made`]: 0 });
      };
      if (!attacker || !player || player.eliminated) return noAttack();
      if (characterProfile(ctx.state, attacker, ctx.deps)?.missing.includes("atk")) return noAttack();
      if (statusActive(ctx.state, attacker, "stunned", ctx.deps)) {
        announceStatusDiscarded(ctx, discardStatusCards(ctx, attacker, "stunned", "cancelledAttack"));
        return noAttack();
      }
      const consequential = pushConsequentialDamage(ctx, attacker, "attack");
      pushEvent(
        ctx,
        {
          kind: "attack",
          attackerInstanceId: attacker,
          targetInstanceId: player.identity.instanceId,
          playerId: controllerOf(ctx.state, attacker)!,
          basic: false,
          // "Resolve her ATK against you": the attack deals the attacker's ATK (docs/phase7-wave10.md §3.17).
          usedStat: "atk",
          sourceInstanceId: frame.selfInstanceId,
          ...(frame.abilityId !== undefined ? { sourceAbilityId: frame.abilityId } : {}),
        },
        reportTo(effect.bind) ?? consequential,
      );
      return;
    }
    case "enemyAttacksEnemy": {
      // docs/phase7-wave3.md §3.23 / §4 Q12: an attack, not an activation. The checks that decide whether the attack
      // happens at all are here, the damage itself in the event's apply step (`resolve/event.ts`).
      const inPlay = cardsInPlay(ctx.state);
      const [attacker] = targets(effect.attacker).filter((id) => inPlay.includes(id));
      const [target] = targets(effect.target).filter((id) => id !== attacker && inPlay.includes(id));
      if (!attacker || !target) return;
      if (!categoriesOf(ctx.state, attacker).includes("enemy") || !categoriesOf(ctx.state, target).includes("enemy"))
        return;
      // RRG 1.8 "Stun" (p. 41): "When this character would attack, remove each stunned status card from it instead."
      // This is an attack, so a stunned attacker spends its stun, even though it is not an activation.
      if (statusActive(ctx.state, attacker, "stunned", ctx.deps)) {
        announceStatusDiscarded(ctx, discardStatusCards(ctx, attacker, "stunned", "cancelledAttack"));
        return;
      }
      pushEvents(
        ctx,
        [
          {
            kind: "enemyAttacksEnemy",
            attackerInstanceId: attacker,
            targetInstanceId: target,
            sourceInstanceId: frame.selfInstanceId,
            ...(effect.boost && frame.controllerId ? { boostPlayerId: frame.controllerId } : {}),
          },
        ],
        reportTo(effect.bind),
      );
      return;
    }
    case "thwart": {
      const controller = frame.controllerId;
      const [thwarter] = targets(effect.thwarter ?? { kind: "identityOf", player: { kind: "controller" } });
      if (!controller || !thwarter || cannotThwart(ctx.state, ctx.deps, controller, undefined, thwarter)) return;
      // A scheme this player cannot thwart (`cannotThwart` with `schemes`, Life-Size Decoy) is not thwarted at all: no
      // thwart event, so no "after … thwarts", for it. With none left, nothing is attempted, as under an unscoped rule.
      const aimed = targets(effect.target);
      const schemes = aimed.filter((id) => !cannotThwart(ctx.state, ctx.deps, controller, id, thwarter));
      for (const id of aimed.filter((id) => !schemes.includes(id))) {
        emit(ctx, { type: "threatRemovalBlocked", schemeInstanceId: id, reason: "rule" });
      }
      if (aimed.length > 0 && schemes.length === 0) return;
      // RRG 1.8 "Confuse, Confused" (p. 13): "If a confused identity or ally attempts to thwart or use a thwart ability,
      // discard the confused card instead", and "that character is not considered to have thwarted" — so no threat is
      // removed, no "after … thwarts" window opens, and an ally takes no consequential damage (RRG 1.8 "Ally", p. 7).
      // The confused character is the one named as thwarting (`thwarter`, else the controller's identity), like the
      // stunned attacker above; one thwart effect is one attempt, whatever its number of schemes. Costs were paid when
      // the ability was used. An "(thwart)"-labeled ability by a confused identity never reaches here: its label
      // cancels the whole ability first (`labelCancels`, RRG 1.8 "Labeled Ability", p. 26), removing the card once.
      if (statusActive(ctx.state, thwarter, "confused", ctx.deps)) {
        announceStatusDiscarded(ctx, discardStatusCards(ctx, thwarter, "confused", "cancelledSchemeOrThwart"));
        return;
      }
      // A scheme this thwart cannot remove threat from right now (a crisis icon, an engaged patrol minion) is not
      // thwarted either (`thwartBlockedOn`): no thwart event of amount 0 for it. Read after the confused check: a
      // confused character may attempt a thwart with no valid target (RRG 1.8 "Confuse, Confused", p. 13).
      const thwartable = schemes.filter((id) => {
        const blocked = thwartBlockedOn(
          ctx.state,
          ctx.deps,
          {
            thwarterInstanceId: thwarter,
            playerId: controller,
            ...(effect.ignoreCrisis ? { ignoreCrisis: true } : {}),
            ...(effect.ignorePatrol ? { ignorePatrol: true } : {}),
          },
          id,
        );
        if (blocked) emit(ctx, { type: "threatRemovalBlocked", schemeInstanceId: id, reason: blocked });
        return blocked === null;
      });
      // A "(thwart)" event's threat removal is an instance too (RRG 1.8 "Thwart", p. 44).
      const amount = value(effect.amount) + cardEffectBonus(ctx.state, ctx.deps, frame.selfInstanceId, "threatRemoved");
      // Each scheme is an instance of the one thwart a "(thwart)" ability makes by its controller's identity (RRG 1.8
      // "Thwart", p. 44): tied to the ability's frame, which answers "after you thwart" once (`thwart-session.ts`).
      const ofAbility =
        context.thwartLabeled && thwarter === mustPlayer(ctx.state, controller).identity.instanceId
          ? { abilityFrameId: abilityRootFrameId(ctx.state, frame) }
          : {};
      pushEvents(
        ctx,
        thwartable.map((id) => ({
          kind: "thwart",
          thwarterInstanceId: thwarter,
          schemeInstanceId: id,
          playerId: controller,
          amount,
          basic: false,
          ...(effect.ignoreCrisis ? { ignoreCrisis: true } : {}),
          ...(effect.ignorePatrol ? { ignorePatrol: true } : {}),
          sourceInstanceId: frame.selfInstanceId,
          ...ofAbility,
        })),
        reportTo(effect.bind),
      );
      return;
    }
    case "modifyThwart": {
      // "That thwart removes 1 additional threat" (§3.55): only a thwart in progress, the innermost activation. Read
      // by `applyPlayerThwart`, which adds it to the thwart's removal: each of them, for a "(thwart)" ability that
      // removes several instances of threat.
      const activation = currentActivationFrameId(ctx.state.stack);
      const thwartFrame = activation ? findFrame(ctx.state, activation) : undefined;
      // A cancelled (or replaced) thwart removes nothing, so there is nothing to add to.
      if (thwartFrame?.kind !== "event" || thwartFrame.event.kind !== "thwart" || thwartFrame.cancelled) return;
      const extra = Math.max(0, value(effect.extraThreat));
      if (extra <= 0) return;
      addFrameVars(ctx, thwartFrame.frameId, { extraThreat: extra });
      // A "(thwart)" ability's other instances of threat removal get it too (RRG 1.8 "Thwart", p. 44; §4.1 Q78).
      addSessionExtraThreat(ctx, thwartFrame.event, extra);
      emit(ctx, {
        type: "thwartModified",
        schemeInstanceId: thwartFrame.event.schemeInstanceId,
        thwarterInstanceId: thwartFrame.event.thwarterInstanceId,
        extraThreat: extra,
        total: (thwartFrame.vars.extraThreat ?? 0) + extra,
        sourceInstanceId: frame.selfInstanceId ?? null,
      });
      return;
    }
    case "modifyAttack": {
      const activation = currentActivationFrameId(ctx.state.stack);
      if (!activation) return;
      const delta: Record<string, number> = {};
      if (effect.overkill) delta.overkill = 1;
      // "The attack gains piercing": one var per keyword on the activation's own event frame, read when it deals
      // damage (`attackKeywordsOf`). `overkill` has always used this var name, so `keywords: ["overkill"]` is the same.
      for (const keyword of effect.keywords ?? []) delta[keyword] = 1;
      if (effect.preventAllDamage) {
        delta.preventAllDamage = 1;
        // Where what it stops is recorded (`bind`), and the rest of an "(attack)" ability's one attack (§3.4, Q4 = A).
        preventAbilityAttackDamage(ctx, activation, effect.bind);
      }
      // "Prevent N damage from this attack" (§3.81): a budget `applyDamage` spends on the attacked character's damage.
      if (effect.preventDamage) {
        const budget = Math.max(0, value(effect.preventDamage));
        if (budget > 0) {
          delta.preventDamage = budget;
          // Who prevents it, for "after [card] prevents damage" (the first card to add to the budget is named).
          if (frame.selfInstanceId) addFrameSlots(ctx, activation, { damagePreventer: [frame.selfInstanceId] });
        }
      }
      if (effect.atkBonus) delta.atkBonus = value(effect.atkBonus);
      // Read only by a player attack (`applyPlayerAttack`, docs/phase7-wave6.md §3.29).
      if (effect.extraDamage) delta.extraDamage = value(effect.extraDamage);
      if (effect.threatBonus) {
        const bonus = value(effect.threatBonus);
        const activationFrame = findFrame(ctx.state, activation);
        const scheming =
          activationFrame?.kind === "event" && activationFrame.event.kind === "enemyScheme"
            ? activationFrame.event
            : null;
        // "Interrupt (thwart): … reduce the amount of threat placed on the scheme by 1" (Emergency): a "(thwart)"
        // ability that lowers what a scheme activation places is a thwart of that scheme by its controller's identity
        // though it removes no threat (RRG 1.8 "Labeled Ability", p. 26; owner decision, 2026-10-03). The reduction is
        // the thwart event's own effect, so cancelling that thwart, or a rule that forbids it, stops the reduction.
        if (context.thwartLabeled && bonus < 0 && scheming && frame.controllerId) {
          pushEvent(ctx, {
            kind: "thwart",
            thwarterInstanceId: mustPlayer(ctx.state, frame.controllerId).identity.instanceId,
            schemeInstanceId: schemeActivationDestination(
              ctx.state,
              ctx.deps,
              scheming.enemyInstanceId,
              scheming.playerId,
            ),
            playerId: frame.controllerId,
            amount: 0,
            basic: false,
            sourceInstanceId: frame.selfInstanceId,
            abilityFrameId: abilityRootFrameId(ctx.state, frame),
            reducesThreatPlaced: { activationFrameId: activation, amount: -bonus },
          });
        } else delta.threatBonus = bonus;
      }
      // "This activation removes threat instead of placing it" (§3.35): read at the scheme's place-threat step, which
      // removes the threat as this card's (§4.1 Q17), so the card (else its controller's identity) is recorded.
      if (effect.removesThreat) {
        delta.removesThreat = 1;
        const remover =
          frame.selfInstanceId ??
          (frame.controllerId ? mustPlayer(ctx.state, frame.controllerId).identity.instanceId : null);
        if (remover) addFrameSlots(ctx, activation, { threatRemover: [remover] });
        // A "(thwart)" ability's (Psychic Manipulation): the removal is a thwart by its controller's identity.
        if (context.thwartLabeled && frame.controllerId) {
          addFrameSlots(ctx, activation, {
            threatThwarter: [mustPlayer(ctx.state, frame.controllerId).identity.instanceId],
          });
        }
      }
      // "Damage from that attack is dealt to the chosen enemy instead of you" (§3.36): a different enemy in play, read
      // at the attack's damage step. Or an ally in play: "deal that damage to [this ally]", from an interrupt at the
      // damage step (`TriggerEvent enemyAttackDamageStep`). A scheme activation ignores it.
      if (effect.damageTo) {
        const attackFrame = ctx.state.stack.find((f) => f.frameId === activation);
        const attacker =
          attackFrame?.kind === "event" && attackFrame.event.kind === "enemyAttack"
            ? attackFrame.event.enemyInstanceId
            : null;
        const inPlay = cardsInPlay(ctx.state);
        const [character] = targets(effect.damageTo).filter((id) => {
          const categories = categoriesOf(ctx.state, id);
          return (
            id !== attacker && inPlay.includes(id) && (categories.includes("enemy") || categories.includes("ally"))
          );
        });
        if (attacker && character) addFrameSlots(ctx, activation, { damageTo: [character] });
      }
      // "That attack removes threat from the main scheme instead of dealing damage" (`removesThreatFrom`): the scheme,
      // the card whose removal it is and, for a "(thwart)" ability, the thwarting identity, read at the attack's
      // damage step. A scheme activation ignores it; the first effect to name a scheme keeps it.
      if (effect.removesThreatFrom) {
        const attackFrame = ctx.state.stack.find((f) => f.frameId === activation);
        const isAttack = attackFrame?.kind === "event" && attackFrame.event.kind === "enemyAttack";
        const inPlay = cardsInPlay(ctx.state);
        const [scheme] = targets(effect.removesThreatFrom.scheme).filter(
          (id) => inPlay.includes(id) && categoriesOf(ctx.state, id).includes("scheme"),
        );
        if (isAttack && scheme && (attackFrame.slots.removesThreatFrom ?? []).length === 0) {
          const identity = frame.controllerId ? mustPlayer(ctx.state, frame.controllerId).identity.instanceId : null;
          const remover = frame.selfInstanceId ?? identity;
          addFrameSlots(ctx, activation, {
            removesThreatFrom: [scheme],
            ...(remover ? { threatInsteadRemover: [remover] } : {}),
            ...((effect.removesThreatFrom.thwart || context.thwartLabeled) && identity
              ? { threatInsteadThwarter: [identity] }
              : {}),
          });
        }
      }
      if (effect.defenseUsesAtk) {
        delta.defenseUsesAtk = 1;
        // The basic defense being made against this attack is now powered by ATK (docs/phase7-wave8.md §4.1 Q54).
        setBasicPowerStat(ctx, null, "defense", "atk");
      }
      // From the activation's next boost card on (`stepBoostCard`); one already counted keeps its count.
      if (effect.boostIconsEach) delta.boostIconsEach = value(effect.boostIconsEach);
      const extra =
        effect.extraBoostCards === undefined
          ? 0
          : typeof effect.extraBoostCards === "number"
            ? effect.extraBoostCards
            : Math.max(0, value(effect.extraBoostCards));
      const procedure = ctx.state.stack.find(
        (f): f is Frame<"enemyAttack"> | Frame<"enemyScheme"> =>
          (f.kind === "enemyAttack" || f.kind === "enemyScheme") && f.eventFrameId === activation,
      );
      if (effect.noBoost) delta.noBoost = 1;
      // "Do not give X a boost card for this activation" (§3.15) also withholds every additional one, whichever effect
      // asks for it and in whichever order the interrupts resolve.
      const withheld =
        effect.noBoost === true ||
        procedure?.noBoost === true ||
        (activationVarsOf(ctx.state, activation).noBoost ?? 0) > 0;
      if (withheld) {
        // Nothing to deal.
      } else if (extra > 0 && procedure && procedure.stage !== "giveBoost") {
        // Boost cards are already being flipped: the extra card joins the pile and is flipped too. Each passes its "would
        // be given" window first when an ability could react (docs/phase7-wave11-scenarios.md E23), in order.
        const enemyId = procedure.enemyInstanceId;
        if (getsBoostCard(ctx.state, ctx.deps, enemyId) && boostAwaitingInterrupt(ctx, enemyId)) {
          pushEvents(
            ctx,
            Array.from({ length: extra }, () => boostCardBeingGivenTo(ctx, enemyId)),
          );
        } else for (let i = 0; i < extra; i++) giveBoostCard(ctx, enemyId);
      } else if (extra > 0) {
        delta.extraBoost = extra;
      }
      addFrameVars(ctx, activation, delta);
      return;
    }
    case "shuffleInSetAsideModularSet": {
      const sets = ctx.state.setAsideModularSets ?? [];
      if (sets.length === 0) {
        if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.made`]: 0 });
        return;
      }
      const [pick, rng] = nextInt(ctx.state.rng, sets.length);
      const chosen = sets[pick]!;
      ctx.state = { ...ctx.state, rng, setAsideModularSets: sets.filter((_, index) => index !== pick) };
      if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.made`]: 1 });
      // Only the cards still set aside: one an ability already took out ("search … the set-aside area") stays where it is.
      const still = chosen.instanceIds.filter((id) => ctx.state.encounterSetAside.includes(id));
      const reveal = effect.reveal;
      const revealed = reveal ? still.filter((id) => matchesQuery(ctx.state, id, reveal, context)) : [];
      const place: EffectSpec = {
        kind: "placeSetAsideModularSet",
        encounterSetId: chosen.encounterSetId,
        instanceIds: still.filter((id) => !revealed.includes(id)),
        placement: effect.placement ?? "shuffleIn",
      };
      if (revealed.length === 0) {
        applyEffect(ctx, place, context, frame);
        return;
      }
      // "Reveal its SHOW environment" (docs/phase7-wave6.md §3.62): the first player reveals it, with the full reveal
      // procedure, from the set-aside area and not from the encounter deck (§3.64: `source` "elsewhere", so its "if this
      // card was revealed from the encounter deck, it gains surge" is false; MojoMania insert p. 18). The rest of the
      // set moves once that reveal has resolved, as the text orders it: its step waits under the reveal on the stack.
      const playerId = ctx.state.firstPlayerId;
      pushEffects(ctx, {
        effects: [place],
        selfInstanceId: frame.selfInstanceId,
        abilityId: frame.abilityId,
        instruction: frame.instruction,
        controllerId: frame.controllerId,
        event: frame.event,
        eventFrameId: frame.eventFrameId,
        scopedPlayerId: frame.scopedPlayerId,
      });
      const frames: StackFrame[] = [];
      for (const id of revealed) {
        // Parked with the revealing player's dealt cards while it resolves, as `revealCard` parks a card it reveals.
        updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
        moveCard(ctx, id, { kind: "dealtEncounter", playerId }, "top");
        frames.push(revealFrame(ctx, playerId, id, undefined, "elsewhere"));
      }
      pushFrames(ctx, frames);
      return;
    }
    case "placeSetAsideModularSet": {
      // A card that left the set-aside area while the set's revealed card resolved stays where it went.
      const ids = effect.instanceIds.filter((id) => ctx.state.encounterSetAside.includes(id));
      if (effect.placement === "shuffleIn") {
        moveCardsTo(ctx, ids, "encounterDeckShuffle");
        emit(ctx, {
          type: "setAsideModularSetShuffledIn",
          encounterSetId: effect.encounterSetId,
          instanceIds: ids,
          placement: "shuffleIn",
        });
        return;
      }
      // "Shuffle the rest of that modular set and place it on top of the encounter deck" (Wheel of Genres, Stopped):
      // shuffled on its own with the game's seeded RNG, the encounter deck beneath left in its order.
      const [order, rng] = shuffle(ids, ctx.state.rng);
      ctx.state = { ...ctx.state, rng };
      const deckId = activeEncounterDeckId(ctx.state);
      for (const id of [...order].reverse()) {
        moveCard(ctx, id, { kind: "encounterDeck", deckId }, "top");
        updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
      }
      emit(ctx, {
        type: "setAsideModularSetShuffledIn",
        encounterSetId: effect.encounterSetId,
        instanceIds: order,
        placement: "shuffledOnTop",
      });
      return;
    }
    case "retargetAttack": {
      const inPlay = cardsInPlay(ctx.state);
      if (effect.attack === "player") {
        // docs/phase7-wave7.md §3.66: the same `attack` event with another target. Its apply step reads the target
        // from the frame, so the damage, `characterAttacked` (retaliate, "after … attacks") and the `attack.target`
        // slot all follow, and the consequential damage waiting under it is untouched.
        const attack = playerAttackInProgress(ctx.state.stack);
        if (!attack) return;
        const [character] = targets(effect.character).filter(
          (id) =>
            inPlay.includes(id) &&
            categoriesOf(ctx.state, id).includes("character") &&
            canTakePlayerAttack(ctx.state, ctx.deps, attack, id),
        );
        const from = attack.event.targetInstanceId;
        // An attack that has named no enemy yet (a label-only attack begun before its first instruction,
        // `beginLabelAttack`) has no target to move: its instructions name the characters it attacks.
        if (!character || from === null || character === from) return;
        // An "(attack)" ability's attack (`attackOf`) also has damage dealt by the ability's instructions, which name
        // the enemy it was made against: the frame remembers the move for them (`attackRetarget`, `attack-ability.ts`).
        // A second move keeps the enemy the attack was first moved off.
        const moved = { from: attack.attackRetarget?.from ?? from, to: character };
        setFrame(ctx, {
          ...attack,
          event: { ...attack.event, targetInstanceId: character },
          ...(attack.attackOf !== undefined ? { attackRetarget: moved } : {}),
        });
        // One "(attack)" ability is one attack: the character moved onto is its only target (§4.1 Q4 = A of wave 9).
        retargetAbilityAttack(ctx, attack, moved);
        emit(ctx, {
          type: "playerAttackRetargeted",
          attackerInstanceId: attack.event.attackerInstanceId,
          fromInstanceId: from,
          targetInstanceId: character,
          playerId: attack.event.playerId,
        });
        return;
      }
      const [character] = targets(effect.character).filter(
        (id) => inPlay.includes(id) && categoriesOf(ctx.state, id).includes("character"),
      );
      // A minion has no controller: an attack moved onto one is against the player it is engaged with (ruling
      // July 25, 2025, answer 2, docs/rulings/post-rrg-1-6/12-july-2025.md: Mister Sinister attacks the engaged Hope
      // Summers minion, and a player can defend;
      // extended to any engaged minion, an engine interpretation).
      const playerId = character
        ? (controllerOf(ctx.state, character) ?? mustInstance(ctx.state, character).engagedWith)
        : null;
      if (!character || !playerId) return;
      const attack = ctx.state.stack.find(
        (f): f is Frame<"event"> => f.kind === "event" && f.event.kind === "enemyAttack" && !f.cancelled,
      );
      if (!attack || attack.event.kind !== "enemyAttack") return;
      const procedure = ctx.state.stack.find(
        (f): f is Frame<"enemyAttack"> => f.kind === "enemyAttack" && f.eventFrameId === attack.frameId,
      );
      // Once a defender is declared the attack has its target; "he attacks X" happens as the attack is initiated.
      if ((attack.slots[DEFENDER_SLOT] ?? []).length > 0 || (procedure && procedure.defenderInstanceId !== null))
        return;
      const retargeted = { targetInstanceId: character, targetPlayerId: playerId, attackedPlayerId: playerId };
      setFrame(ctx, { ...attack, event: { ...attack.event, ...retargeted } });
      if (procedure) setFrame(ctx, { ...procedure, ...retargeted });
      emit(ctx, {
        type: "attackRetargeted",
        enemyInstanceId: attack.event.enemyInstanceId,
        targetInstanceId: character,
        playerId,
      });
      return;
    }
    case "resolveAttackAgainst": {
      const attack = ctx.state.stack.find(
        (f): f is Frame<"event"> => f.kind === "event" && f.event.kind === "attack" && !f.cancelled && !f.attackWaiting,
      );
      if (!attack || attack.event.kind !== "attack") return;
      const original = attack.event;
      const inPlay = cardsInPlay(ctx.state);
      if (!inPlay.includes(original.attackerInstanceId)) return;
      const { results: _results, ...body } = original;
      pushEvents(
        ctx,
        targets(effect.targets)
          .filter(
            (id) =>
              id !== original.targetInstanceId &&
              inPlay.includes(id) &&
              canAttack(ctx.state, original.attackerInstanceId, id, ctx.deps),
          )
          .map((id) => ({ ...body, targetInstanceId: id, additionalResolution: true as const })),
      );
      return;
    }
    case "declareDefender": {
      const inPlay = cardsInPlay(ctx.state);
      const [defender] = targets(effect.character).filter(
        (id) => inPlay.includes(id) && categoriesOf(ctx.state, id).includes("character"),
      );
      // From a "(defense)" ability the label and this declaration are one defense (FAQ "Mutant Protectors", p. 63).
      const labeled =
        frame.abilityId !== undefined && ctx.deps.abilities[frame.abilityId]?.label?.includes("defense") === true;
      declareDefenderByLabeledEffect(
        ctx,
        defender ?? null,
        effect.exhaust === true,
        labeled ? frame.controllerId : null,
      );
      return;
    }
    case "modifyBasicPower": {
      if (effect.useStat === "thw") useThwForBasicAttack(ctx, frame);
      if (!effect.amount) return;
      // "Get +N to that power for this use": which power is read off the `basicPowerUsing` event this effect is
      // resolving inside (docs/phase7-wave2.md §17.4), so one effect serves every basic power a card names at once.
      const using = ctx.state.stack.find(
        (f): f is Frame<"event"> => f.kind === "event" && f.event.kind === "basicPowerUsing",
      );
      if (!using || using.event.kind !== "basicPowerUsing") return;
      // The stat powering this use, not the power's name: a basic thwart made with ATK is raised through ATK (RRG 1.8
      // "Assault", p. 8: "Abilities that increase a character's 'basic power' can be used to increase that character's
      // ATK when that character thwarts a scheme with assault"; docs/phase7-wave8.md §4.1 Q54). A card that prints the
      // stat ("+2 THW for that thwart") names it with `stat`.
      const stat: StatName = effect.stat ?? using.event.stat;
      // "For this use": the activation the power belongs to (its own `attack`/`thwart` event, or the enemy attack a
      // basic defense answers), which is on the stack beneath this window and ends when that use does. A basic recovery
      // is neither an attack nor an activation: its use is its own `basicRecovery` event (docs/phase7-wave6.md §3.40),
      // which reads REC as it applies, so the bonus is timed to that frame and never to an attack further down.
      const user = using.event.characterInstanceId;
      const activation = basicPowerUseFrameId(ctx.state.stack, using.event.power, user);
      if (!activation) return;
      addLastingEffect(
        ctx,
        {
          kind: "statModifier",
          stat,
          amount: effect.amount,
          targets: [user],
          affects: null,
          scope: {
            selfInstanceId: frame.selfInstanceId,
            controllerId: frame.controllerId,
            vars: frame.vars,
            bindings: frame.bindings,
          },
        },
        { kind: "endOfEvent", frameId: activation },
      );
      return;
    }
    case "setDefeatDestination": {
      // docs/phase7-wave3.md §3.45: "return it to its owner's hand instead of discarding it", from an interrupt to the
      // defeat. The defeat still happens; `applyDefeat` sends the card here instead of its discard pile.
      // An enemy's boost cards (docs/phase7-wave10.md §3.10): the first card named in play, read now for the player
      // resolving this; with none the defeat keeps the destination it had.
      let to: DefeatPlacement;
      if (typeof effect.to === "object" && "kind" in effect.to) {
        const inPlay = cardsInPlay(ctx.state);
        const [holder] = targets(effect.to.enemy).filter((id) => inPlay.includes(id));
        if (holder === undefined) return;
        to = { boostCardOf: holder };
      } else to = effect.to;
      const target = frame.eventFrameId ? findFrame(ctx.state, frame.eventFrameId) : undefined;
      if (target?.kind === "event") {
        if (target.event.kind !== "characterDefeated" || target.cancelled) return;
        setFrame(ctx, { ...target, event: { ...target.event, destination: to } });
        return;
      }
      // The defeated card's own When Defeated ability: its leaving step waits below (RRG 1.8 p. 48).
      if (frame.event?.kind === "characterDefeated" && frame.event.instanceId === frame.selfInstanceId)
        redirectPendingDefeat(ctx, frame.event.instanceId, to);
      return;
    }
    case "cancelConsequentialDamage": {
      // docs/phase7-wave3.md §3.21: the waiting consequential damage event of each character, cancelled before it applies.
      const characters = targets(effect.character);
      let cancelled = 0;
      for (const pending of ctx.state.stack) {
        if (
          pending.kind === "event" &&
          pending.stage === "interrupts" &&
          pending.event.kind === "dealDamage" &&
          pending.event.consequential === true &&
          characters.includes(pending.event.targetInstanceId)
        ) {
          updateFrame(ctx, pending.frameId, (f) => (f.kind === "event" ? { ...f, cancelled: true } : f));
          cancelled++;
        }
      }
      if (cancelled === 0) markPreThenUnresolved(ctx, frame.frameId, "nothingToCancel");
      return;
    }
    case "modifyConsequentialDamage": {
      // docs/phase7-wave6.md §3.31: the waiting consequential damage of each character's current attack or thwart.
      const characters = targets(effect.character);
      const delta = value(effect.amount);
      const pendingFor = new Set<InstanceId>();
      for (const pending of [...ctx.state.stack]) {
        if (
          pending.kind === "event" &&
          pending.stage === "interrupts" &&
          pending.event.kind === "dealDamage" &&
          pending.event.consequential === true &&
          characters.includes(pending.event.targetInstanceId)
        ) {
          // A cancelled one counts too: "takes no consequential damage" is not undone by a later increase.
          pendingFor.add(pending.event.targetInstanceId);
          if (pending.cancelled) continue;
          const from = pending.event.amount;
          const to = Math.max(0, from + delta);
          if (to === from) continue;
          updateFrame(ctx, pending.frameId, (f) =>
            f.kind === "event" && f.event.kind === "dealDamage" ? { ...f, event: { ...f.event, amount: to } } : f,
          );
          emit(ctx, { type: "consequentialDamageModified", instanceId: pending.event.targetInstanceId, from, to });
        }
      }
      // An increase on a character whose consequential damage is 0 (Havok, `storm` 36014): no event was pushed with the
      // power, so one is created beneath its attack or thwart in progress (`insertConsequentialDamage`).
      if (delta > 0) {
        for (const character of characters) {
          if (pendingFor.has(character)) continue;
          const made = insertConsequentialDamage(ctx, character, delta);
          if (made) emit(ctx, { type: "consequentialDamageModified", instanceId: character, ...made });
        }
      }
      return;
    }
    case "cancelBoostIcons":
    case "cancelBoostAbility": {
      // An enemy activation's boost card, or a villainous ally's or hero's own (§S3.7, `resolve/villainous.ts`).
      const procedure = ctx.state.stack.find(
        (f): f is Frame<"enemyAttack"> | Frame<"enemyScheme"> | Frame<"characterBoost"> =>
          (f.kind === "enemyAttack" || f.kind === "enemyScheme" || f.kind === "characterBoost") && Boolean(f.boost),
      );
      const boost = procedure?.boost;
      const report = (made: number, amount?: number): void => {
        // RRG 1.8 "'Then'" (p. 44): a cancel with nothing to cancel did not resolve (FAQ "Attacrobatics (#6)", p. 59:
        // a card with no boost icons is no target for cancelling them).
        if (made === 0) markPreThenUnresolved(ctx, frame.frameId, "nothingToCancel");
        if (effect.bind)
          addFrameVars(ctx, frame.frameId, {
            [`${effect.bind}.made`]: made,
            ...(amount !== undefined ? { [`${effect.bind}.amount`]: amount } : {}),
          });
      };
      if (!procedure || !boost) return report(0);
      // An ignored boost icon or "Boost" ability is not "in effect or present" (RRG 1.8 "Ignore", p. 23;
      // docs/phase7-wave7.md §3.67), so there is none to cancel and what depends on the cancel does not happen
      // ("Cancel", p. 11).
      if (
        boost.ignored ||
        (procedure.kind !== "characterBoost" &&
          boostIgnored(ctx.state, ctx.deps, procedure.enemyInstanceId, procedure.eventFrameId))
      )
        return report(0);
      if (effect.kind === "cancelBoostAbility") {
        // Its ability resolves as soon as the turned-faceup interrupts close, before the responses (RRG 1.8 p. 5);
        // after that there is nothing to cancel.
        if (boost.step !== "window" || boost.abilityCancelled) return report(0);
        setFrame(ctx, { ...procedure, boost: { ...boost, abilityCancelled: true } });
        return report(1);
      }
      // The card's own "you", as at its count (`stepBoostCard`): an attack's defending player, a scheme's player.
      const activatedAgainst = procedure.kind === "enemyAttack" ? procedure.targetPlayerId : procedure.playerId;
      // (A villainous character's card: its controller, `characterBoost.playerId`.)
      const icons = boost.iconsCancelled ? 0 : boostIconsFor(ctx.state, ctx.deps, boost.instanceId, activatedAgainst);
      if (icons <= 0) return report(0);
      setFrame(ctx, { ...procedure, boost: { ...boost, iconsCancelled: true } });
      // Later windows on the same card see no icons left to cancel.
      const turned = ctx.state.stack.find(
        (f) =>
          f.kind === "event" &&
          f.event.kind === "boostCardTurnedFaceup" &&
          f.event.boostInstanceId === boost.instanceId,
      );
      if (turned?.kind === "event" && turned.event.kind === "boostCardTurnedFaceup")
        setFrame(ctx, { ...turned, event: { ...turned.event, boostIcons: 0 } });
      emit(ctx, { type: "boostCancelled", instanceId: boost.instanceId, scope: "icons" });
      return report(1, icons);
    }
    case "discardBoostCard": {
      // docs/phase7-wave4.md §3.35 (Defiance): "discard it instead" of turning it faceup and applying it. Defiance answers
      // the card's facedown "would be turned faceup" window (`turning`, issue #348); a faceup card's `window` is kept for
      // an ability that discards a card already turned up. An enemy activation's boost card, or a villainous ally's or
      // hero's own (§S3.7, `resolve/villainous.ts`).
      const procedure = ctx.state.stack.find(
        (f): f is Frame<"enemyAttack"> | Frame<"enemyScheme"> | Frame<"characterBoost"> =>
          (f.kind === "enemyAttack" || f.kind === "enemyScheme" || f.kind === "characterBoost") && Boolean(f.boost),
      );
      const boost = procedure?.boost;
      const made = (n: number): void => {
        if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.made`]: n });
      };
      if (
        !procedure ||
        !boost ||
        (boost.step !== "window" && boost.step !== "turning") ||
        locateCard(ctx.state, boost.instanceId)?.kind !== "boost"
      ) {
        return made(0);
      }
      setFrame(ctx, { ...procedure, boost: { ...boost, iconsCancelled: true, abilityCancelled: true } });
      const turned = ctx.state.stack.find(
        (f) =>
          f.kind === "event" &&
          f.event.kind === "boostCardTurnedFaceup" &&
          f.event.boostInstanceId === boost.instanceId,
      );
      if (turned?.kind === "event" && turned.event.kind === "boostCardTurnedFaceup")
        setFrame(ctx, { ...turned, event: { ...turned.event, boostIcons: 0 } });
      moveCard(ctx, boost.instanceId, discardZoneFor(ctx.state, boost.instanceId), "top");
      emit(ctx, { type: "boostCancelled", instanceId: boost.instanceId, scope: "discarded" });
      return made(1);
    }
    case "adjustBoostCount":
    case "replaceBoostCount": {
      // The boost card the current activation is counting (docs/phase7-wave2.md §3.6), or still resolving its own
      // "Boost:" ability (`step === "ability"`, before the count step is reached — docs/phase7-wave3.md's `gmw`
      // Badoon Warlord/Badoon Lieutenant, "[star] Boost: If this activation is an attack/scheme, this card gets +2
      // boost icons for this activation": a card's own Boost ability modifying its own count has to run while its
      // effects are still on the stack, which is before the frame's `boost.step` becomes `"count"`. `countAdjust`
      // is carried on the same procedure/boost object either way, so setting it early is equivalent to setting it
      // at the count step itself.
      //
      // The innermost count in progress, which is the first one found from the top of the stack: a card effect's
      // count (`countBoostIcons`, an event frame with no enemy) records the change on its own event, so a count made
      // while an activation's boost card is resolving never changes that boost card's count, nor the reverse. Such an
      // event is at `apply` while its interrupt window is open (`executeEventFrame` moves it on before the window);
      // the counts of the same effect still waiting beneath it are at `interrupts`. A villainous ally's or hero's boost
      // card resolving its own Boost ability is a `characterBoost` frame (§S3.7, `resolve/villainous.ts`).
      const counting = ctx.state.stack.find(
        (f): f is Frame<"event"> | Frame<"enemyAttack"> | Frame<"enemyScheme"> | Frame<"characterBoost"> =>
          f.kind === "event"
            ? f.event.kind === "boostIconsCounting" && f.event.enemyInstanceId === null && f.stage === "apply"
            : f.kind === "characterBoost"
              ? f.boost?.step === "ability"
              : (f.kind === "enemyAttack" || f.kind === "enemyScheme") &&
                (f.boost?.step === "count" || f.boost?.step === "ability" || f.boost?.step === "responses"),
      );
      // Inside a borrowed Boost ability: the boost cards whose count its gained icons join (often none).
      const borrowedFor = effect.kind === "adjustBoostCount" ? context.bindings[BORROWED_BOOST_ICONS_SLOT] : undefined;
      if (counting?.kind === "event") {
        const event = counting.event;
        if (event.kind !== "boostIconsCounting") return;
        // A card effect's count is of no activation's boost card: a borrowed ability's icons never join it.
        if (borrowedFor) return;
        if (effect.kind === "adjustBoostCount") {
          const countAdjust = (event.countAdjust ?? 0) + value(effect.delta);
          setFrame(ctx, { ...counting, event: { ...event, countAdjust } });
        } else {
          const [card] = resolveRef(ctx.state, effect.card, context);
          if (card) setFrame(ctx, { ...counting, event: { ...event, countFrom: card } });
        }
        return;
      }
      const procedure = counting;
      const boost = procedure?.boost;
      if (!procedure || !boost) return;
      if (effect.kind === "adjustBoostCount") {
        // Icons a borrowed Boost ability gains (docs/phase7-wave10.md §3.11, question 10) join this count only when
        // its `resolveSpecials` named this boost card (`borrowedBoostIcons: "joinActivation"`); by default none.
        if (borrowedFor && !borrowedFor.includes(boost.instanceId)) return;
        setFrame(ctx, {
          ...procedure,
          boost: { ...boost, countAdjust: (boost.countAdjust ?? 0) + value(effect.delta) },
        });
      } else {
        const [card] = resolveRef(ctx.state, effect.card, context);
        if (card) setFrame(ctx, { ...procedure, boost: { ...boost, countFrom: card } });
      }
      return;
    }
    case "countBoostIcons": {
      const bind = effect.bind;
      const events: TriggerEvent[] = [];
      let uncontested = 0;
      for (const id of resolveRef(ctx.state, effect.cards, context)) {
        const event: TriggerEvent = {
          kind: "boostIconsCounting",
          enemyInstanceId: null,
          cardInstanceId: id,
          playerId: context.controllerId,
        };
        if (!isAPlayersCard(ctx.state, id) && heard(ctx.state, ctx.deps, event)) events.push(event);
        else uncontested += boostIconsFor(ctx.state, ctx.deps, id);
      }
      // Set, not added: this count replaces a total the discard bound under the same name. Each announced card then
      // adds its own count as its event resolves (`reportResults`).
      updateFrame(ctx, frame.frameId, (f) =>
        f.kind === "effects" ? { ...f, vars: { ...f.vars, [`${bind}.boostIcons`]: uncontested } } : f,
      );
      if (events.length > 0) pushEvents(ctx, events, { frameId: frame.frameId, prefix: bind });
      return;
    }
    case "atEndOfAttack":
    case "atEndOfActivation":
    case "atEndOfThwart": {
      const activation =
        effect.kind === "atEndOfThwart"
          ? currentThwartFrameId(ctx.state.stack)
          : currentActivationFrameId(ctx.state.stack);
      if (!activation) return;
      const deferred: DeferredEffects = {
        effects: effect.effects,
        selfInstanceId: frame.selfInstanceId,
        controllerId: frame.controllerId,
        bindings: frame.bindings,
        vars: frame.vars,
        ...(effect.kind !== "atEndOfActivation" ? { delayed: true as const } : {}),
      };
      updateFrame(ctx, activation, (f) => (f.kind === "event" ? { ...f, endEffects: [...f.endEffects, deferred] } : f));
      return;
    }
    case "draw": {
      const amount = value(effect.amount);
      const drawn = resolvePlayers(ctx.state, effect.player, context).flatMap((playerId) =>
        drawCards(ctx, playerId, amount),
      );
      // "Draw 1 card. If that card …" (`bind`): the cards drawn, and how many, for the rest of the ability.
      if (effect.bind !== undefined) {
        addFrameSlots(ctx, frame.frameId, { [effect.bind]: drawn });
        addFrameVars(ctx, frame.frameId, { [`${effect.bind}.count`]: drawn.length });
      }
      return;
    }
    case "discardFromHand": {
      // Only the `random` form lands here; the choosing form stops for a choice per player in `effects-frame.ts`.
      const amount = value(effect.amount);
      const filter = effect.filter;
      const waiting: TriggerEvent[] = [];
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        // A filter narrows the pool the random pick draws from, by excluding everything that doesn't match.
        const excluded = filter
          ? mustPlayer(ctx.state, playerId).hand.filter((id) => !matchesQuery(ctx.state, id, filter, context))
          : [];
        if (!listensForWouldDiscard(ctx.deps)) {
          discardRandomFromHand(ctx, playerId, amount, excluded);
          continue;
        }
        // With an ability that hears "would discard a card you control" in the game (docs/phase7-wave9.md §4.1 Q20):
        // the cards are picked first, then each is discarded, or announced when that ability hears it.
        const split = splitWouldDiscard(
          ctx,
          pickRandomFromHand(ctx, playerId, amount, excluded),
          { sourceInstanceId: frame.selfInstanceId, sourceCardId: leaveSourceOf(ctx, frame) },
          { kind: "hand", random: true },
        );
        for (const id of split.now) discardFromHand(ctx, playerId, id);
        waiting.push(...split.waiting);
      }
      if (waiting.length > 0) pushEvents(ctx, waiting);
      return;
    }
    case "revealTopOfEncounterDeck": {
      eachEncounterCard(ctx, frame, effect.count, () => {
        const id = drawEncounterCard(ctx);
        if (!id) return;
        updateInstance(ctx, id, (instance) => ({ ...instance, faceup: true }));
        if (effect.then === "discard") moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
      });
      return;
    }
    case "exhaust":
      for (const id of targets(effect.target)) exhaustCard(ctx, id, frame.selfInstanceId);
      return;
    case "ready":
      for (const id of targets(effect.target)) {
        readyOrAnnounce(ctx, id, {
          readierId: frame.controllerId,
          sourceInstanceId: frame.selfInstanceId,
          costPaid: effect.readyCostPaid === true,
        });
      }
      return;
    case "giveStatus": {
      // Whose effect placed it (`TriggerEvent statusPlaced`, docs/phase7-wave7.md §3.27).
      // A replacement is not a placement: its card is not announced as placed (`StatusGiver.replacing`; ruling May 10,
      // 2024, post-RRG 1.5 #181, which names Mister Sinister; other "status placed" triggers follow it by analogy, an
      // engine interpretation).
      const by: StatusGiver = {
        sourceInstanceId: frame.selfInstanceId,
        playerId: threatRemoverOf(ctx, frame),
        ...(effect.replacing !== undefined ? { replacing: true as const } : {}),
      };
      // docs/phase7-wave4.md §3.60: "If no tough status card was given this way" reads `<bind>.amount`. A card that
      // waits for its "would gain a status card" window (docs/phase7-wave9.md §3.33) counts once it lands.
      const countOn = effect.bind ? { frameId: frame.frameId, name: `${effect.bind}.amount` } : undefined;
      let receivers = targets(effect.target);
      if (effect.replacing !== undefined) {
        // A replacement is one effect: only a target holding the card to replace and with room for the new one is
        // replaced, the rest are left as they were (`replacesStatusOn`; ruling Jun 20, 2024, post-RRG 1.5 #215).
        const replacing = effect.replacing;
        receivers = receivers.filter((id) => replacesStatusOn(ctx.state, ctx.deps, id, replacing, effect.status));
        // The replaced card is discarded and announced as such (docs/phase7-wave6.md §3.5): the RRG uses "remove" and
        // "discard" for the same thing (RRG 1.8 "Tough", p. 44; "Stunned", p. 41), and #181 speaks only to placing.
        announceStatusDiscarded(
          ctx,
          receivers.flatMap((id) => removeStatus(ctx, id, replacing, 1)),
        );
      }
      const gives = receivers.map((instanceId) => ({ instanceId, count: 1 }));
      // A card that is not given (no room, or replaced in its window) marks this frame's pre-"then" text unresolved.
      const given = giveStatusOrAnnounce(ctx, gives, effect.status, by, countOn, frame.frameId);
      if (countOn) addFrameVars(ctx, frame.frameId, { [countOn.name]: given });
      return;
    }
    case "removeStatus": {
      const discarded = targets(effect.target).flatMap((id) => removeStatus(ctx, id, effect.status, effect.count));
      // docs/phase7-wave6.md §3.6: "If you discarded no tough status cards this way" reads `<bind>.amount`. Set before
      // the discards' response window is pushed, so the effects after this one read it whenever they resolve.
      if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.amount`]: discarded.length });
      announceStatusDiscarded(ctx, discarded);
      return;
    }
    case "addCounters": {
      const amount = value(effect.amount);
      const upTo = effect.upTo === undefined ? null : value(effect.upTo);
      const placements = targets(effect.target).map((id) => {
        // "(to a maximum of X)" is local to this effect (ruling, Mar 30, 2026 (1); docs/phase7-wave3.md §3.10).
        // An all-purpose counter takes the type its new card defines (docs/phase7-wave9.md §3.6).
        const counterType = landingCounterType(ctx.state, id, effect.counterType, ctx.deps);
        const held = getInstance(ctx.state, id)?.counters[counterType] ?? 0;
        const count = upTo === null ? amount : Math.max(0, Math.min(amount, upTo - held));
        return { instanceId: id, counterType, count };
      });
      // Each is placed at once and announced, or waits for its "would be placed" window (docs/phase7-wave9.md §3.55);
      // a placement that waits raises `<bind>.amount` itself if it lands.
      const countOn = effect.bind ? { frameId: frame.frameId, name: `${effect.bind}.amount` } : undefined;
      const placed = placeCountersOrAnnounce(ctx, placements, frame.controllerId, countOn);
      if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.amount`]: placed });
      return;
    }
    case "defeat": {
      // docs/phase7-wave3.md §3.9: a defeat by effect, whatever the remaining hit points; `applyDefeat` honors
      // `byEffect`, and the rules that stop a defeat (cannotBeDefeated, permanent) still do.
      const inPlay = cardsInPlay(ctx.state);
      const defeatingPlayer = frame.controllerId;
      // In an "(attack)" ability a player uses, the enemies this defeats are attacked by the identity and the defeat is
      // that attack's (RRG 1.8 "Attack (Player Ability Type)", p. 10; `attack-ability.ts`, "A defeat instruction"):
      // guard is read for each, and a cancelled attack defeats no enemy.
      const ability = abilityAttackOf(ctx.state, ctx.deps, frame);
      const attack = ability?.waiting;
      const attacked: Extract<TriggerEvent, { kind: "characterAttacked" }>[] = [];
      const named = targets(effect.target)
        .filter((id) => inPlay.includes(id) && categoriesOf(ctx.state, id).includes("character"))
        // "Cannot be defeated again" (FAQ "Malice (#199)", RRG 1.8 p. 64): no defeat, so no window for one either.
        .filter((id) => !cannotBeDefeatedAgain(ctx.state, id))
        // Nor for a card already defeated, in play only until its When Defeated abilities resolve (`alreadyDefeated`).
        .filter((id) => !alreadyDefeated(ctx.state, id));
      const defeats = (ability ? skipUnattackable(ctx, ability, frame.selfInstanceId, named) : named).map((id) => {
        const ofAttack = attack ? abilityAttackDamage(ctx.state, ctx.deps, attack, id) : null;
        if (ofAttack) attacked.push(ofAttack.attacked);
        return {
          kind: "characterDefeated" as const,
          instanceId: id,
          byEffect: true as const,
          ...(effect.ignoreWhenDefeated === true ? { ignoreWhenDefeated: true as const } : {}),
          ...(defeatingPlayer ? { defeatedByPlayerId: defeatingPlayer } : {}),
          ...(frame.selfInstanceId ? { sourceInstanceId: frame.selfInstanceId } : {}),
          ...(attack && ofAttack
            ? {
                sourceInstanceId: attack.event.attackerInstanceId,
                viaInstanceId: frame.selfInstanceId,
                fromAttack: true as const,
                parentFrameId: attack.frameId,
              }
            : {}),
        };
      });
      if (attack) noteAttackedByAbility(ctx, attack.frameId, attacked);
      // Several allies and minions defeated by this one effect are defeated together (docs/phase7-wave5.md §4.1 Q49).
      pushDefeats(ctx, defeats);
      return;
    }
    case "removeCounters": {
      // With an ability listening ("When/After the last invocation counter is removed", docs/phase7-wave4.md §3.15), each
      // removal is an event whose apply step removes them; otherwise they go at once, as before.
      // `counterType` omitted: "discard all counters from [target]" (Green Gobbler, `spiderham` 30026) — every
      // counter type currently on that target is fully removed, not just one named type, so there is no single
      // `amount` to read; each type present is its own removal (and its own possible listener/"Uses" discard).
      const events: TriggerEvent[] = [];
      // `bind`: `<bind>.amount` in all and `<bind>.amount.<instanceId>` per card, counted as they are removed.
      const record = (id: InstanceId, removed: number): void => {
        if (effect.bind && removed > 0)
          addFrameVars(ctx, frame.frameId, {
            [`${effect.bind}.amount`]: removed,
            [`${effect.bind}.amount.${id}`]: removed,
          });
      };
      // RRG 1.8 "'Then'" (p. 44): "remove N counters" from a card holding fewer than N (none included) removes what is
      // there and leaves the text before a "then" not fully resolved. "Remove all counters" names no number to fall
      // short of.
      const asked = effect.amount === undefined ? undefined : value(effect.amount);
      for (const id of targets(effect.target)) {
        const instance = getInstance(ctx.state, id);
        if (!instance) continue;
        // "Any": the counters taken from this card across its types, the player's pick where there was one to make
        // (docs/phase7-wave9.md §3.6); each stored type is then removed by name, as below.
        const any =
          effect.counterType === ANY_COUNTER
            ? anyCounterTake(
                ctx.state,
                id,
                effect.amount === undefined ? undefined : value(effect.amount),
                anyCounterPickOf(frame.vars, frame.frameId, frame.cursor, id),
                ctx.deps,
              ).byType
            : null;
        const counterTypes = any
          ? any.map(([counterType]) => counterType)
          : effect.counterType
            ? [effect.counterType]
            : Object.keys(instance.counters);
        let going = 0;
        for (const counterType of counterTypes) {
          const held = instance.counters[counterType] ?? 0;
          const taken = any?.find(([type]) => type === counterType)?.[1];
          const removing = taken !== undefined ? taken : asked !== undefined ? Math.min(asked, held) : held;
          going += Math.max(0, removing);
          if (removing <= 0) continue;
          const event: TriggerEvent = {
            kind: "countersRemoved",
            instanceId: id,
            counterType,
            amount: removing,
            remaining: held - removing,
          };
          if (heard(ctx.state, ctx.deps, event)) events.push(event);
          else record(id, removeCounters(ctx, id, counterType, removing));
        }
        if (asked !== undefined && going < asked) markPreThenUnresolved(ctx, frame.frameId, "countersNotRemoved", id);
      }
      // A heard removal reports as its event resolves (`countersRemoved`'s apply step, `resolve/event.ts`).
      if (events.length > 0) pushEvents(ctx, events, reportTo(effect.bind));
      return;
    }
    case "attach": {
      const [host] = targets(effect.to);
      // RRG 1.8 "Attach To" (p. 8): a card attaches to a game element in play. "Reveal that minion. Attach Old Grudge
      // to it." with the minion's reveal cancelled (discarded) has nothing to attach to.
      if (!host || !cardsInPlay(ctx.state).includes(host)) return;
      // Any card in play may be the host: an enemy, another player's identity in either form or ally (docs/phase7-
      // wave6.md §3.49). A card that "cannot be unattached" (the Power Stone, docs/phase7-wave3.md §3.19) or a host that
      // "cannot have cards attached" (Odin, docs/phase7-wave4.md §3.8) leaves the card where it was (`attachCard`).
      // "After you attach …" (`TriggerEvent cardAttached`): each card that landed, once the effect has attached them all.
      // A card attached from out of play enters play by it: that announcement is always made (`attachCardBy`).
      // `as: "captive"`: the attached ally is then under no player's control (docs/phase7-wave9.md §3.19).
      // "When … would be attached" (docs/phase7-wave9.md §3.49): a plain attach an interrupt hears waits for that
      // window, and so does every card after it, so the cards land in the order the effect named them.
      const plain = effect.facedown !== true && effect.as === undefined;
      const waiting: TriggerEvent[] = [];
      // A "[type] form only" card attached from out of play enters play by it, so the form check of a put into play
      // applies (RRG 1.8 "Play, Put into Play", p. 32; `admitFormOnly`, which passes a card already in play).
      const cards =
        effect.facedown === true || !context.controllerId
          ? targets(effect.card)
          : admitFormOnly(ctx, targets(effect.card), context.controllerId);
      const attached = cards
        .flatMap((id) => {
          // "(Players cannot look at the reverse sides)" (docs/phase7-wave9.md §3.54): hidden before it is attached,
          // so a "would be attached" window that makes this attach wait holds a card that is already hidden.
          if (effect.hideReverse) hideReverses(ctx, id);
          if (plain && getInstance(ctx.state, id)?.attachedTo !== host && canAttachTo(ctx.state, ctx.deps, id, host)) {
            const imminent = imminentAttach(id, host, context.controllerId ?? null, "ability", frame.selfInstanceId);
            if (waiting.length > 0 || imminentAttachHeard(ctx, imminent)) {
              waiting.push(imminent);
              return [];
            }
          }
          const events = attachCardBy(
            ctx,
            id,
            host,
            context.controllerId ?? null,
            effect.facedown === true,
            effect.as === "heldMinion",
          );
          if (effect.as === "captive") releaseControlOfCaptive(ctx, id, host);
          return events;
        })
        .filter((event) => announcesAttaching(event, (e) => heard(ctx.state, ctx.deps, e)));
      if (attached.length + waiting.length > 0) pushEvents(ctx, [...attached, ...waiting]);
      return;
    }
    case "engage": {
      // RRG 1.8 "Engage" (p. 18): an ability telling a player to engage a minion counts as that minion engaging them,
      // and a minion already engaged with that player cannot engage them again.
      const [playerId] = resolvePlayers(ctx.state, effect.player, context);
      if (!playerId) return;
      // Each engagement's interrupts, then its responses, then its quickstrike attack (`engagedInPlayFrames`); the
      // first minion's resolve first. A minion an environment holds comes off its host (docs/phase7-wave9.md §3.21).
      const engaged: StackFrame[] = [];
      for (const id of targets(effect.minion)) {
        if (!engageInPlayMinion(ctx, id, playerId)) continue;
        engaged.push(...engagedInPlayFrames(ctx, id));
      }
      pushFrames(ctx, engaged);
      return;
    }
    case "rotateEngagement": {
      // docs/phase7-wave9.md §3.24: the minions move at once, then each one's engagement resolves in turn.
      pushFrames(
        ctx,
        rotateEngagement(ctx).flatMap((id) => engagedInPlayFrames(ctx, id)),
      );
      return;
    }
    case "setRemainingHitPoints": {
      // "Set his hit point dial to 1 instead": the dial is remaining hit points (RRG 1.8 "Hit Points", p. 22), so
      // sustained damage becomes maximum hit points minus that. Not a heal, so no heal event (§3.13).
      const remaining = Math.max(0, value(effect.amount));
      const reset: TriggerEvent[] = [];
      for (const id of targets(effect.target)) {
        const max = maxHitPoints(ctx.state, id, ctx.deps);
        // A character with ∞ hit points has no dial to set (RRG 1.8 "Hit Points", p. 22); card text sets it only after
        // flipping to a face that prints a number ("flip this card, then set Collector's hit point dial").
        if (max === undefined || !Number.isFinite(max)) continue;
        const damage = Math.max(0, max - remaining);
        updateInstance(ctx, id, (instance) => ({ ...instance, damage }));
        emit(ctx, { type: "hitPointsSet", instanceId: id, remaining: Math.min(remaining, max), damage });
        // Set to its maximum, the dial is reset (docs/phase7-wave6.md §3.67): "After MaGog's hit points are reset".
        // "Reset his hit points to 10" is a reset at any number (docs/phase7-wave9.md §3.5), below the maximum too.
        if (damage === 0 || effect.reset) reset.push({ kind: "hitPointsReset", instanceId: id });
      }
      pushHeard(reset);
      return;
    }
    case "modifyCardEffect": {
      const damage = effect.damage ? value(effect.damage) : 0;
      const threatRemoved = effect.threatRemoved ? value(effect.threatRemoved) : 0;
      // A note on the card's play (docs/phase7-wave6.md §3.52), read by `Predicate playNote`; written before the bonus,
      // and even when the bonus is 0 ("removed at least 1 counter" is a fact about the payment, not the damage).
      if (effect.note) {
        const noted = value(effect.note.value);
        const key = `${PLAY_NOTE_PREFIX}${effect.note.name}`;
        for (const id of targets(effect.card)) {
          const play = playFrameOf(ctx.state.stack, id);
          if (!play) continue;
          const total = (play.vars[key] ?? 0) + noted;
          setFrame(ctx, { ...play, vars: { ...play.vars, [key]: total } });
          emit(ctx, { type: "playNoted", instanceId: id, name: effect.note.name, value: noted, total });
        }
      }
      if (damage === 0 && threatRemoved === 0) return;
      for (const id of targets(effect.card)) {
        addLastingEffect(
          ctx,
          { kind: "cardEffectBonus", sourceInstanceId: id, damage, threatRemoved },
          { kind: "endOfCardResolution", instanceId: id },
        );
      }
      return;
    }
    case "modifyCardEffectsUntil": {
      const damage = effect.damage ? value(effect.damage) : 0;
      const threatRemoved = effect.threatRemoved ? value(effect.threatRemoved) : 0;
      if (damage === 0 && threatRemoved === 0) return;
      if (effect.until === "endOfTurn" && !turnInProgress(ctx.state)) return;
      addLastingEffect(
        ctx,
        {
          kind: "cardEffectBonusFor",
          cards: effect.cards,
          scope: {
            selfInstanceId: frame.selfInstanceId,
            controllerId: frame.controllerId,
            vars: frame.vars,
            bindings: frame.bindings,
          },
          damage,
          threatRemoved,
        },
        { kind: effect.until },
      );
      return;
    }
    case "createScenarioArea":
      // docs/phase7-wave3.md §3.14: an empty area, so its count and the client read 0 rather than nothing.
      if (!ctx.state.scenarioAreas?.[effect.name])
        ctx.state = { ...ctx.state, scenarioAreas: { ...ctx.state.scenarioAreas, [effect.name]: [] } };
      return;
    case "createScenarioPlayArea":
      createScenarioPlayArea(ctx, effect.name, effect.closed);
      return;
    case "dealHiddenPiles":
      dealHiddenPiles(ctx, effect);
      return;
    case "seedHiddenPiles":
      seedHiddenPiles(ctx, effect);
      return;
    case "gainFromHiddenPile": {
      // docs/phase7-wave9.md §3.29 (a): the gained cards are faceup for every player, so they may be counted.
      const gained = gainFromHiddenPile(ctx, effect.pile, value(effect.count));
      if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.count`]: gained.length });
      return;
    }
    case "revealHiddenPile": {
      const revealed = revealHiddenPile(ctx, effect.pile);
      if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.count`]: revealed.length });
      return;
    }
    case "identifyMole":
      identifyMole(ctx, effect);
      return;
    case "discardFromPlay": {
      const source = leaveSourceOf(ctx, frame);
      for (const id of targets(effect.target)) {
        if (effect.defeated === true) defeatFromPlay(ctx, id, effect.insteadTo, source);
        // "Players cannot discard attachments that are attached to friendly characters." (§3.44 of wave 4.)
        else if (frame.byPlayer && playersCannotDiscard(ctx.state, ctx.deps, id)) {
          emit(ctx, { type: "discardRefused", instanceId: id });
        } else discardFromPlay(ctx, id, source);
      }
      return;
    }
    case "resolveSetups": {
      const [controller] = resolvePlayers(ctx.state, effect.controller, context);
      if (!controller) return;
      const inPlay = cardsInPlay(ctx.state);
      // Nothing of this effect is on the stack to resolve first: the step goes straight on top.
      const cards = targets(effect.cards).filter((id) => inPlay.includes(id));
      resolveSetupOnEntry(ctx, ctx.state.stack.length, cards, controller);
      return;
    }
    case "putIntoPlay": {
      const [controller] = resolvePlayers(ctx.state, effect.controller, context);
      if (!controller) return;
      // `otherFace` / `resolveSetup` (docs/phase7-wave11-scenarios.md §S3.15): the frames the entries push sit above
      // the Setup abilities, so what was on the stack before this effect is the line between them.
      const heldStack = ctx.state.stack.length;
      const inPlayBefore = new Set(cardsInPlay(ctx.state));
      const fresh = (ids: readonly InstanceId[]): InstanceId[] => ids.filter((id) => !inPlayBefore.has(id));
      const turned: TurnedForEntry[] = [];
      // Turned before the card moves, so its entry reads the face it enters on.
      const beforeEntry = (id: InstanceId): void => {
        if (effect.otherFace !== true || effect.facedown === true || inPlayBefore.has(id)) return;
        const turn = turnBeforeEntry(ctx, id);
        if (turn) turned.push(turn);
      };
      const afterEntry = (entered: readonly InstanceId[]): void => {
        settleEntryFaces(ctx, turned, controller);
        if (effect.resolveSetup === true && effect.facedown !== true)
          resolveSetupOnEntry(ctx, heldStack, fresh(entered), controller);
      };
      // An in-play scenario area nobody controls (the mission area, docs/phase7-wave8.md §3.33).
      if (effect.into) {
        const area = effect.into.scenarioPlayArea;
        const named = targets(effect.card);
        const alreadyInPlay = named.filter((id) => cardsInPlay(ctx.state).includes(id));
        // The unique rule is about entering play (RRG 1.8 "Unique Icon", pp. 45–46): a card moved there was in play.
        const admitted = admitUniqueEntry(
          ctx,
          admitFormOnly(
            ctx,
            named.filter((id) => !alreadyInPlay.includes(id)),
            controller,
          ),
          controller,
          frame.selfInstanceId,
        );
        const entered: InstanceId[] = [];
        const there: InstanceId[] = [];
        for (const id of named) {
          if (!alreadyInPlay.includes(id) && !admitted.includes(id)) continue;
          beforeEntry(id);
          const outcome = placeInScenarioPlayArea(ctx, id, area);
          if (outcome === "noSuchArea" || outcome === "cardType") {
            emit(ctx, { type: "putIntoPlayRefused", instanceId: id, playerId: controller, reason: outcome });
            continue;
          }
          there.push(id);
          if (outcome === "entered") entered.push(id);
        }
        if (effect.bind) {
          const slot = effect.bind;
          updateFrame(ctx, frame.frameId, (f) =>
            f.kind === "effects"
              ? {
                  ...f,
                  bindings: { ...f.bindings, [slot]: there },
                  vars: { ...f.vars, [`${slot}.count`]: there.length },
                }
              : f,
          );
        }
        // Announced like any entry (`enterPlayOnReveal`): the enter-play keywords are that event's apply step.
        for (const id of entered) enterPlay(ctx, id, controller);
        afterEntry(entered);
        return;
      }
      const named =
        effect.facedown === true ? targets(effect.card) : admitFormOnly(ctx, targets(effect.card), controller);
      const unmatched = admitUniqueEntry(ctx, named, controller, frame.selfInstanceId);
      // A card put into play facedown shows no title, so it is no copy of anything ("copies … by title", p. 28).
      const admitted = effect.facedown === true ? unmatched : admitUnderPlayerMax(ctx, unmatched, controller);
      const placed: InstanceId[] = [];
      for (const id of admitted) {
        const card = cardOf(ctx.state, id);
        // Encounter cards other than minions enter where their type goes (villain area, host, play area). A player
        // card nobody owns yet (`unownedPlayerCard`) enters as a player's card does, below.
        if (
          card &&
          card.type !== "minion" &&
          playerCardOwnerOf(ctx.state, id) === null &&
          !unownedPlayerCard(ctx.state, id) &&
          !cardsInPlay(ctx.state).includes(id)
        ) {
          updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
          beforeEntry(id);
          enterPlayOnReveal(ctx, id, controller);
          placed.push(id);
        } else if (card?.type === "player_side_scheme") {
          // A player's own player side scheme: the villain's play area, under `controller`'s control, with its
          // starting threat, as when it is played (docs/phase7-wave7.md §3.43).
          beforeEntry(id);
          playerSideSchemeEntersPlay(ctx, id, controller);
          placed.push(id);
        }
      }
      // A player's upgrade enters play as playing it would (RRG 1.8 "Play, Put into Play", p. 32: "cards that are put
      // into play must do so in a play area or state that matches the rules of playing the card"): on the host a play
      // would give it (`upgradeHostCandidates`), chosen by its controller when several are legal (`putIntoPlayHosts`,
      // answered before this step). With no legal host it "remains in its prior state or game area" (RRG 1.8 "Attach
      // To", p. 8) and has not entered play.
      const attached: InstanceId[] = [];
      for (const id of admitted) {
        // Put into play facedown: a facedown card shows no type and no "attach to" text, so it stays loose (below).
        if (effect.facedown === true) break;
        if (placed.includes(id) || cardOf(ctx.state, id)?.type !== "upgrade" || cardsInPlay(ctx.state).includes(id))
          continue;
        const hosts = putIntoPlayHostCandidates(ctx.state, ctx.deps, id, controller);
        const [picked] = frame.bindings[putIntoPlayHostSlot(id)] ?? [];
        const host = picked !== undefined && hosts.includes(picked) ? picked : hosts[0];
        placed.push(id);
        if (host === undefined) {
          emit(ctx, { type: "putIntoPlayRefused", instanceId: id, playerId: controller, reason: "noLegalHost" });
          continue;
        }
        updateInstance(ctx, id, (i) => ({ ...i, controllerId: controller, faceup: true }));
        takeOwnership(ctx, id, controller);
        beforeEntry(id);
        moveCard(ctx, id, { kind: "attachment", hostInstanceId: host });
        // RRG 1.8 p. 31: on a card another player controls, that player controls it from the moment it is attached.
        settleUpgradeControl(ctx, id, controller);
        attached.push(id);
      }
      // The host answers are spent: a later step of this frame asks again.
      if (admitted.some((id) => frame.bindings[putIntoPlayHostSlot(id)]))
        updateFrame(ctx, frame.frameId, (f) => {
          if (f.kind !== "effects") return f;
          const spent = new Set(admitted.map((id) => putIntoPlayHostSlot(id)));
          return { ...f, bindings: Object.fromEntries(Object.entries(f.bindings).filter(([key]) => !spent.has(key))) };
        });
      const entering = admitted.filter((id) => !placed.includes(id));
      for (const id of entering) {
        // A minion belongs to the encounter side even while it sits in a player's area.
        const isMinion = cardOf(ctx.state, id)?.type === "minion";
        takeOwnership(ctx, id, controller);
        beforeEntry(id);
        moveCard(ctx, id, { kind: "playArea", playerId: controller });
        updateInstance(ctx, id, (instance) => ({
          ...instance,
          controllerId: isMinion ? null : controller,
          engagedWith: isMinion ? controller : instance.engagedWith,
          faceup: true,
        }));
      }
      const entered: TriggerEvent[] = admitted
        .filter((id) => attached.includes(id) || entering.includes(id))
        .map((id) => ({
          kind: "cardEntersPlay",
          instanceId: id,
          playerId: attached.includes(id) ? (controllerOf(ctx.state, id) ?? controller) : controller,
        }));
      const frames: StackFrame[] = entered.map((event) => eventFrame(ctx, event));
      for (const id of entering) {
        const quickstrike = quickstrikeFrame(ctx, id);
        if (quickstrike) frames.push(quickstrike);
      }
      // Teamwork (trait) after quickstrike, checked as it resolves (docs/phase7-wave6.md §3.1, `resolveTeamwork`).
      for (const id of entering) {
        const teamwork = teamworkFrame(ctx, id);
        if (teamwork) frames.push(teamwork);
      }
      // After the keywords: "After you engage a minion" (ruling, Jan 17, 2026 (3) answer 2).
      for (const id of entering) frames.push(...engagedEvent(ctx, id).map((event) => eventFrame(ctx, event)));
      // "If no minion was put into play this way" (docs/phase7-wave4.md §3.59): only what is in play now entered.
      if (effect.bind) {
        const inPlay = cardsInPlay(ctx.state);
        const entered_ = admitted.filter((id) => inPlay.includes(id));
        const slot = effect.bind;
        updateFrame(ctx, frame.frameId, (f) =>
          f.kind === "effects"
            ? {
                ...f,
                bindings: { ...f.bindings, [slot]: entered_ },
                vars: { ...f.vars, [`${slot}.count`]: entered_.length },
              }
            : f,
        );
      }
      pushFrames(ctx, frames);
      afterEntry(admitted.filter((id) => cardsInPlay(ctx.state).includes(id)));
      return;
    }
    case "putIntoPlayAsHost": {
      const [playerId] = resolvePlayers(ctx.state, effect.engagedWith, context);
      const [id] = targets(effect.card);
      const [attachment] = targets(effect.attachment);
      const bound = (entered: readonly InstanceId[]): void => {
        const slot = effect.bind;
        if (slot === undefined) return;
        updateFrame(ctx, frame.frameId, (f) =>
          f.kind === "effects"
            ? {
                ...f,
                bindings: { ...f.bindings, [slot]: entered },
                vars: { ...f.vars, [`${slot}.count`]: entered.length },
              }
            : f,
        );
      };
      bound([]);
      if (!playerId || id === undefined) return;
      // Only a card that can be in play as nothing else, out of play: an identity card no player is using, or a
      // set-aside villain card that is not one of the game's villains.
      const looseVillain = isLooseVillainCard(ctx.state, id);
      if (
        !isHostOnlyCard(ctx.state, id) ||
        cardsInPlay(ctx.state).includes(id) ||
        (looseVillain && !ctx.state.encounterSetAside.includes(id))
      ) {
        emit(ctx, { type: "putIntoPlayRefused", instanceId: id, playerId, reason: "cardType" });
        return;
      }
      if (admitUniqueEntry(ctx, [id], playerId, frame.selfInstanceId).length === 0) return;
      // "Side A faceup": `flipped` is the side other than its starting one (`looseVillainStage`).
      const villainCard = looseVillain ? ctx.state.cardPool[mustInstance(ctx.state, id).cardId] : undefined;
      const flipped =
        villainCard?.type === "villain" &&
        effect.villainSide !== undefined &&
        effect.villainSide !== (villainCard.startingSide ?? "A");
      moveCard(ctx, id, { kind: "playArea", playerId });
      updateInstance(ctx, id, (i) => ({
        ...i,
        controllerId: null,
        engagedWith: playerId,
        faceup: true,
        ...(looseVillain ? { flipped } : {}),
      }));
      const attached =
        attachment === undefined ? [] : attachCardBy(ctx, attachment, id, context.controllerId ?? playerId);
      if (!isMinion(ctx.state, id)) {
        // Nothing treats it as a minion (the attachment was refused, or has no such rule): the card cannot stay in
        // play as nothing, so it goes as it does when that attachment leaves (`hostOnlyReleaseZone`: an identity card
        // is removed from the game, §4.1 Q39 = A; a villain card goes back to the set-aside area).
        emit(ctx, { type: "putIntoPlayRefused", instanceId: id, playerId, reason: "noLegalHost" });
        leavePlayAtOnce(ctx, id, hostOnlyReleaseZone(ctx.state, id));
        return;
      }
      bound([id]);
      // Announced as the minion it now is (§4.1 Q43 = A), in the order `putIntoPlay` announces a minion.
      const entered: TriggerEvent[] = [{ kind: "cardEntersPlay", instanceId: id, playerId }];
      const frames: StackFrame[] = entered.map((event) => eventFrame(ctx, event));
      const quickstrike = quickstrikeFrame(ctx, id);
      if (quickstrike) frames.push(quickstrike);
      const teamwork = teamworkFrame(ctx, id);
      if (teamwork) frames.push(teamwork);
      frames.push(...engagedEvent(ctx, id).map((event) => eventFrame(ctx, event)));
      frames.push(
        ...attached
          .filter((event) => announcesAttaching(event, (e) => heard(ctx.state, ctx.deps, e)))
          .map((event) => eventFrame(ctx, event)),
      );
      pushFrames(ctx, frames);
      return;
    }
    case "dealEncounterCard":
      // Dealing asks the first player for the order when several players receive cards (`executeDealEncounterCards`).
      throw new EngineInvariantError("dealEncounterCard is handled before applyEffect");
    case "dealAsEncounterCard": {
      const [playerId] = resolvePlayers(ctx.state, effect.player, context);
      if (!playerId) return;
      // "Finds X and deals him to themself" (docs/phase7-wave8.md §3.75): the find itself, one card, logged, its decks
      // to shuffle once the card is out of them (RRG 1.8 "Find", p. 19; "Search", p. 39), as `revealCard` does.
      const find = effect.cards.kind === "find" ? findToDeal(ctx, effect.cards, context) : null;
      if (find && find.found.length === 0) markPreThenUnresolved(ctx, frame.frameId, "findFoundNothing");
      const naming = find ? find.found : targets(effect.cards);
      // "When a player would be dealt an encounter card" hears a named card's deal too (docs/phase7-wave9.md §3.45).
      // When an ability could react to any of them, every card is dealt by its own event, in `cards` order, so the
      // order the player is dealt them in does not depend on which windows opened.
      const sourceCardId = leaveSourceOf(ctx, frame);
      const awaited = naming
        .filter((id) => isDealableCard(ctx.state, id))
        .map((instanceId): TriggerEvent & { kind: "encounterCardBeingDealt" } => ({
          kind: "encounterCardBeingDealt",
          playerId,
          source: "ability",
          sourceInstanceId: frame.selfInstanceId,
          named: { instanceId, frameId: frame.frameId, ...(sourceCardId !== undefined ? { sourceCardId } : {}) },
        }));
      const hears = awaited.some(
        (event) =>
          encounterDealAwaitingInterrupt(ctx, playerId, "ability", event.sourceInstanceId, event.named) !== null,
      );
      if (hears) {
        for (const id of naming) {
          if (!isDealableCard(ctx.state, id)) markPreThenUnresolved(ctx, frame.frameId, "cardNotDealt", id);
        }
        // A deck searched for the card is shuffled once its deal is settled, made or not.
        const last = awaited.length - 1;
        pushEvents(
          ctx,
          awaited.map((event, index) =>
            find && index === last ? { ...event, named: { ...event.named!, searched: find.searched } } : event,
          ),
        );
        return;
      }
      const dealt = dealAsEncounterCards(ctx, naming, playerId, sourceCardId);
      // A named card that was not dealt (it cannot leave play, or is not a card that can be dealt) leaves the text
      // before a "then" unresolved (RRG 1.8 "'Then'", p. 44).
      for (const id of naming) if (!dealt.includes(id)) markPreThenUnresolved(ctx, frame.frameId, "cardNotDealt", id);
      if (find) shuffleSearchedDecks(ctx, find.searched);
      return;
    }
    case "passEncounterCard": {
      const naming = targets(effect.cards);
      const [from] = resolvePlayers(ctx.state, effect.from, context);
      const [to] = resolvePlayers(ctx.state, effect.to, context);
      const passed = from && to ? passEncounterCards(ctx, naming, from, to) : [];
      // RRG 1.8 "'Then'" (p. 44): a named card that stayed where it was leaves the text before a "then" unresolved.
      for (const id of naming) if (!passed.includes(id)) markPreThenUnresolved(ctx, frame.frameId, "cardNotPassed", id);
      return;
    }
    case "revealEncounterCard": {
      const frames: StackFrame[] = [];
      const players = resolvePlayers(ctx.state, effect.player, context);
      // A card whose move reset the encounter deck pauses the effect (`eachEncounterCard`): the response to the reset
      // and the reveals so far resolve, and the next player's card then comes from the new deck.
      eachEncounterCard(ctx, frame, players.length, (index) => {
        const playerId = players[index];
        const id = playerId ? drawEncounterCard(ctx) : null;
        if (!playerId || !id) return;
        // Out of the deck while it resolves, like `revealCard` below, so a When Revealed that shuffles it back into
        // the encounter deck is a move the reveal's finish can see (docs/phase7-wave4.md §3.45).
        updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
        moveCard(ctx, id, { kind: "dealtEncounter", playerId }, "top");
        frames.push(revealFrame(ctx, playerId, id));
      });
      pushFrames(ctx, frames);
      return;
    }
    case "giveBoostCard": {
      const count = effect.count ? Math.max(0, value(effect.count)) : 1;
      // Any card in play the text names holds it (RRG 1.8 "Boost, Boost Icon", p. 11: "dealt a boost card … remains
      // facedown on that enemy until that enemy activates"). Any enemy qualifies, villainous or not: the card text names
      // the recipient, and the villainous gate is only about the activation's automatic card (`giveBoostCard`). A card
      // that never activates ("place 1 facedown boost card on your identity", Venom, docs/phase7-wave5.md §3.6) holds
      // it until `moveBoostCards` moves it or the card leaves play.
      const inPlay = cardsInPlay(ctx.state);
      if (effect.card) {
        // A chosen card (docs/phase7-wave6.md §3.16): one card goes to one place, so the first holder in play takes
        // every card named; nothing named out of play, nothing given.
        const [holderId] = targets(effect.enemy).filter((id) => inPlay.includes(id));
        if (!holderId) return;
        const named: InstanceId[] = [];
        for (const id of targets(effect.card)) {
          const zone = locateCard(ctx.state, id)?.kind;
          // "Give this card to that villain as a facedown boost card" on a card being revealed (docs/phase7-wave8.md
          // §3.79): it is given from in front of the player it was dealt to, and its reveal then finds it moved and
          // does not discard it (`resolve/reveal.ts`, "finish").
          const given = zone !== undefined && (BOOST_SOURCE_ZONES.has(zone) || beingRevealed(ctx.state, id));
          if (!given || inPlay.includes(id)) continue;
          named.push(id);
        }
        // "When an enemy would be given a facedown boost card" (docs/phase7-wave11-scenarios.md E23): when an ability
        // could react to any of them, each card is given by its own event, in order, so the order does not depend on
        // which windows opened. A replaced give leaves no pre-"then" text unresolved (engine reading, authority step 5:
        // unlike `dealAsEncounterCard`, no printed card gives a boost card before a "then").
        const awaited = named.map((id) =>
          boostAwaitingInterrupt(ctx, holderId, { outsideActivation: true, named: id }),
        );
        if (awaited.some((event) => event !== null)) {
          pushEvents(
            ctx,
            named.map(
              (id, i) => awaited[i] ?? boostCardBeingGivenTo(ctx, holderId, { outsideActivation: true, named: id }),
            ),
          );
          return;
        }
        for (const id of named) dealChosenBoostCard(ctx, holderId, id);
        return;
      }
      const holders = targets(effect.enemy).filter((id) => inPlay.includes(id));
      // A give waiting in its "would be given" window pauses the effect until it resolves (E23).
      eachEncounterCard(ctx, frame, holders.length * count, (index) => {
        const holderId = holders[Math.floor(index / count)];
        if (holderId) return dealBoostCardOrAnnounce(ctx, holderId, true);
      });
      return;
    }
    case "moveBoostCards": {
      // "Move each facedown boost card from your identity to Venom" (docs/phase7-wave5.md §3.6): in the order they were
      // dealt, onto the first card `to` names in play. There they wait like a boost card dealt outside the enemy's own
      // activation (RRG 1.8 "Boost, Boost Icon", p. 11), so an activation not yet at its flip step resolves them.
      const inPlay = cardsInPlay(ctx.state);
      const [to] = targets(effect.to).filter((id) => inPlay.includes(id));
      if (!to) return;
      for (const from of targets(effect.from).filter((id) => inPlay.includes(id) && id !== to)) {
        const facedown = mustInstance(ctx.state, from).boostCards.filter((id) => !mustInstance(ctx.state, id).faceup);
        for (const id of facedown) {
          moveCard(ctx, id, { kind: "boost", hostInstanceId: to });
          emit(ctx, { type: "boostCardMoved", instanceId: id, fromInstanceId: from, toInstanceId: to });
        }
      }
      return;
    }
    case "addAccelerationToken": {
      const count = effect.count ? Math.max(0, value(effect.count)) : 1;
      // "Place 1 acceleration token here for each side scheme in play": `target` absent is the central main scheme.
      const schemes: readonly (InstanceId | undefined)[] = effect.target ? targets(effect.target) : [undefined];
      for (const scheme of schemes) for (let i = 0; i < count; i++) addAccelerationToken(ctx, scheme);
      return;
    }
    case "flipCard": {
      const inPlay = cardsInPlay(ctx.state);
      const frames: StackFrame[] = [];
      const turned: InstanceId[] = [];
      for (const id of targets(effect.target)) {
        if (!inPlay.includes(id)) continue;
        // "You cannot flip …" (`cannotFlip`, docs/phase7-wave7.md §3.64): this card stays; the others still flip.
        if (cannotFlip(ctx.state, ctx.deps, id)) {
          emit(ctx, { type: "flipBlocked", instanceId: id });
          continue;
        }
        const card = cardOf(ctx.state, id);
        const villain = villainOf(ctx.state, id);
        if (villain && card?.type === "villain") {
          // "Flip" names the other face of a two-faced card. A three-sided villain has two others, so card text names the
          // face by form instead (`changeVillainForm`; docs/phase7-wave2.md §6.9).
          if (card.sides.length !== 2) continue;
          const other = card.sides.find((side) => side.side !== villain.side);
          // Both faces of a double-sided stage card list the same stages (docs/phase7-wave1.md §1.3).
          if (!other?.stages[villain.stageIndex]) continue;
          flipVillain(ctx, id, other.side);
          // Her new face is revealed (FAQ "Dial M for Mojo (#35)"; docs/phase7-wave6.md §3.65, §4.1 Q36), and its
          // toughness resolves as on a stage revealed by a defeat (`villainFaceRevealedByFlip`).
          villainFaceRevealedByFlip(ctx, id);
          frames.push(revealNewFaceFrame(ctx, id));
        } else if (mainSchemeStateOf(ctx.state, id)) {
          // A main scheme stage with its other face emitted as its own card (docs/phase7-wave5.md §3.3): "Flip this
          // card" turns it to that face without revealing it.
          // "waiting": its attachments' leave interrupts first; the flip and its `cardFlipped` follow (wave 5 §4.1 Q32).
          const flipped = flipMainSchemeStage(ctx, id, false, ctx.state.firstPlayerId, context.controllerId);
          if (flipped === false || flipped === "waiting") continue;
        } else if (card?.otherFaceId !== undefined) {
          // docs/phase7-wave4.md §3.10. Its new face goes to "you" (the first player, for a side scheme's When Defeated).
          // `controller`: "put [its other face] into play under any player's control" (docs/phase7-wave9.md §3.17).
          const [named] = effect.controller ? resolvePlayers(ctx.state, effect.controller, context) : [];
          const playerId = named ?? context.controllerId ?? ctx.state.firstPlayerId;
          const turnedOver = flipToOtherFace(
            ctx,
            id,
            playerId,
            ctx.deps,
            effect.reveal === true,
            context.controllerId,
            effect.keepCounters,
          );
          if (turnedOver !== true) continue;
          // "Flip this card and reveal [its other face]": it pushed the reveal and the `cardFlipped` under it.
          if (effect.reveal) continue;
        } else if (card && "flipSide" in card && card.flipSide) {
          turnToFlipSide(ctx, id);
          turned.push(id);
          if (effect.reveal) {
            // "Flip this card and reveal it" (docs/phase7-wave7.md §3.14, §3.34): the card text asks for the reveal a
            // flip alone is not. No card type with a `flipSide` is a scheme, so no starting threat is placed here; a
            // side scheme's other face is a card of its own (`flipToOtherFace`).
            frames.push(revealNewFaceFrame(ctx, id, context.controllerId ?? ctx.state.firstPlayerId));
          }
        } else {
          continue;
        }
        // The flip names the player whose effect it was (docs/phase7-wave8.md §3.6).
        frames.push(eventFrame(ctx, cardFlippedEvent(id, context.controllerId)));
      }
      pushFrames(ctx, frames);
      // A face now showing that is restricted can take its controller past the limit (RRG 1.8 "Restricted", p. 38:
      // "if a player ever controls more than two"; docs/phase7-wave7.md §3.64, §4.1 Q38): asked before the flip's
      // responses, once every card of this effect has flipped.
      for (const id of turned) checkRestrictedAfterFlip(ctx, id);
      return;
    }
    case "changeAdditionalForm": {
      // docs/phase7-wave4.md §3.1; RRG 1.8 "Form, Change Form" (p. 21).
      const events: TriggerEvent[] = [];
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        const player = getPlayer(ctx.state, playerId);
        if (
          !player ||
          player.eliminated ||
          cannotChangeForm(ctx.state, ctx.deps, playerId, effect.formType, context.selfInstanceId)
        ) {
          continue;
        }
        const owned = cardsInPlay(ctx.state).filter(
          (id) => controllerOf(ctx.state, id) === playerId && printedFormTypes(ctx.state, id).includes(effect.formType),
        );
        const printedNames = (id: InstanceId): readonly string[] => {
          const card = cardOf(ctx.state, id);
          if (!card) return [];
          return "flipSide" in card && card.flipSide ? [card.name, card.flipSide.name] : [card.name];
        };
        const named = effect.to ? targets(effect.to).filter((id) => owned.includes(id)) : [];
        const target =
          named[0] ??
          (effect.toName !== undefined
            ? owned.find((id) => printedNames(id).includes(effect.toName as string))
            : owned.length === 1 && printedNames(owned[0] as InstanceId).length === 2
              ? owned[0]
              : undefined);
        if (target === undefined) continue;
        const card = cardOf(ctx.state, target);
        const instance = mustInstance(ctx.state, target);
        if (card && "flipSide" in card && card.flipSide && !instance.facedownAs) {
          // A double-sided form card (a mass form upgrade): the change is a flip, unless the named face already shows.
          if (effect.toName !== undefined && currentName(ctx.state, target) === effect.toName) continue;
          // A flip shows the other face: nothing of the card stays hidden (docs/phase7-wave9.md §3.54).
          updateInstance(ctx, target, ({ reverseHidden: _shown, ...i }) => ({ ...i, flipped: !i.flipped }));
          emit(ctx, { type: "cardFlipped", instanceId: target, flipped: !instance.flipped });
          events.push(cardFlippedEvent(target, playerId));
        } else {
          if (!instance.facedownAs) continue; // Already in that form: nothing changes and nothing triggers.
          // One form of a type at a time (§4 Q1): the one showing turns facedown as this one turns faceup.
          for (const other of owned) {
            if (other === target || mustInstance(ctx.state, other).facedownAs) continue;
            const otherCard = cardOf(ctx.state, other);
            if (otherCard && "flipSide" in otherCard && otherCard.flipSide) continue;
            turnFacedown(ctx, other);
          }
          updateInstance(ctx, target, (i) => ({ ...i, faceup: true, facedownAs: null }));
          emit(ctx, { type: "cardTurnedFaceup", instanceId: target });
        }
        const formName = currentName(ctx.state, target) ?? "";
        emit(ctx, { type: "additionalFormChanged", playerId, formType: effect.formType, formName, instanceId: target });
        events.push({
          kind: "formChanged",
          playerId,
          to: player.identity.form,
          change: "additional",
          formType: effect.formType,
          formName,
          formCardInstanceId: target,
        });
      }
      pushEvents(ctx, events);
      return;
    }
    case "turnFacedown": {
      const inPlay = cardsInPlay(ctx.state);
      for (const id of targets(effect.target)) {
        if (inPlay.includes(id) && !mustInstance(ctx.state, id).facedownAs) turnFacedown(ctx, id);
      }
      return;
    }
    case "changeVillainForm": {
      // "Change Apocalypse to [Giant] form" (Staggering Strength; The Age of Apocalypse): the face of the same stage card
      // whose traits include the form. RRG 1.8 "Flip" (p. 20): "A foldable, 'three-sided' card is considered to have
      // flipped any time the faceup side of the card changes", so it is a flip, with the same new-face reveal and
      // `cardFlipped` as `flipCard`. Already in that form: nothing changes and nothing triggers. `reveal: false`: the
      // scenario's rules make the change no reveal (MC45 p. 19; docs/phase7-wave8.md §3.26), so only the flip is raised.
      const inPlay = cardsInPlay(ctx.state);
      const frames: StackFrame[] = [];
      for (const id of targets(effect.villain)) {
        const card = cardOf(ctx.state, id);
        const villain = villainOf(ctx.state, id);
        if (!inPlay.includes(id) || !villain || card?.type !== "villain") continue;
        const face = card.sides.find((side) =>
          side.stages[villain.stageIndex]?.traits.includes(effect.toFaceWithTrait),
        );
        if (!face || face.side === villain.side) continue;
        flipVillain(ctx, id, face.side);
        if (effect.reveal !== false) {
          villainFaceRevealedByFlip(ctx, id);
          frames.push(revealNewFaceFrame(ctx, id));
        }
        frames.push(eventFrame(ctx, cardFlippedEvent(id, context.controllerId)));
      }
      pushFrames(ctx, frames);
      return;
    }
    case "setVillainSide": {
      // docs/phase7-wave11-scenarios.md §S3.4: the face the villain is put into play on, not a flip.
      const inPlay = cardsInPlay(ctx.state);
      for (const id of targets(effect.villain)) {
        const card = cardOf(ctx.state, id);
        const villain = villainOf(ctx.state, id);
        if (!inPlay.includes(id) || !villain || villain.defeated || card?.type !== "villain") continue;
        // Only the faces of the villain's current stage card: every face of a stage card lists the same stages.
        const faces = card.sides.filter((side) => side.stages[villain.stageIndex] !== undefined).map((s) => s.side);
        let to: VillainSideLetter | undefined = effect.side === "random" ? undefined : effect.side;
        if (to === undefined) {
          const [pick, rng] = nextInt(ctx.state.rng, faces.length);
          ctx.state = { ...ctx.state, rng };
          to = faces[pick];
        }
        if (to === undefined || !faces.includes(to)) continue;
        setVillainSide(ctx, id, to, effect.side === "random");
      }
      return;
    }
    case "revealNextVillainStage": {
      for (const id of targets(effect.villain)) revealNextVillainStage(ctx, id);
      return;
    }
    case "setActiveVillain": {
      const [to] = targets(effect.villain).filter((id) => villainOf(ctx.state, id)?.defeated === false);
      if (!to) return;
      // The counter leaving a defeated villain is the insert's replacement rule, not an ability moving it.
      const reason = villainOf(ctx.state, ctx.state.activeVillainId)?.defeated ? "activeVillainDefeated" : "effect";
      setActiveVillain(ctx, to, reason);
      return;
    }
    case "removeAccelerationToken": {
      // One token, from the first card `from` names (a chosen holder); none named is none removed.
      if (!effect.from) return removeAccelerationToken(ctx);
      const [holder] = targets(effect.from);
      if (holder) removeAccelerationToken(ctx, holder);
      return;
    }
    case "skipNextVillainPhase":
      // docs/phase7-wave11-hero-packs.md H3.7: read at the next player phase's end (`flow.ts` `finishPlayerPhase`).
      ctx.state = { ...ctx.state, villainPhasesToSkip: (ctx.state.villainPhasesToSkip ?? 0) + 1 };
      return;
    case "grantAdditionalMulligans": {
      // MC27 p. 22 node 5 (docs/phase7-wave5.md §3.27): read by the mulligan step (§3.26) when it reaches the player.
      const amount = Math.max(0, Math.trunc(effect.amount));
      if (amount === 0) return;
      for (const player of ctx.state.players) {
        if (player.eliminated) continue;
        const extraMulligans = (player.extraMulligans ?? 0) + amount;
        updatePlayer(ctx, player.playerId, (p) => ({ ...p, extraMulligans }));
        emit(ctx, { type: "additionalMulligansGranted", playerId: player.playerId, extraMulligans });
      }
      return;
    }
    case "sitOutScenario":
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) sitOutScenario(ctx, playerId);
      return;
    case "countTowardStartingHand": {
      // Legal only before RRG 1.8 Appendix II step 14 (docs/phase7-wave8.md §3.44): later there is no draw to count toward.
      if (!beforeStartingHandsDrawn(ctx.state)) return;
      const amount = Math.trunc(resolveValue(ctx.state, effect.amount, context, ctx.deps));
      if (amount <= 0) return;
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        const player = getPlayer(ctx.state, playerId);
        if (!player || player.eliminated) continue;
        const credit = (player.startingHandCredit ?? 0) + amount;
        updatePlayer(ctx, playerId, (p) => ({ ...p, startingHandCredit: credit }));
        emit(ctx, { type: "startingHandCredited", playerId, amount, credit });
      }
      return;
    }
    case "advanceMainScheme": {
      // "The main scheme" of this effect's area unless named; `to` names the stage (docs/phase7-wave2.md §3.4).
      const [scheme] = effect.scheme ? targets(effect.scheme) : resolveRef(ctx.state, { kind: "mainScheme" }, context);
      // What the new stage records as having advanced it (docs/phase7-wave7.md §3.12): the completion the engine is
      // finishing, or this ability's card.
      const by = effect.completion
        ? "completion"
        : ({ cause: "cardEffect", sourceInstanceId: context.selfInstanceId ?? null } as const);
      if (scheme) advanceMainSchemeStage(ctx, scheme, effect.to, by);
      return;
    }
    case "shuffleMainSchemeStages": {
      // "Shuffle all copies of main scheme 2A and stack them under this scheme" (docs/phase7-wave6.md §3.18).
      const [scheme] = resolveRef(ctx.state, { kind: "mainScheme" }, context);
      if (scheme) shuffleMainSchemeStages(ctx, scheme, effect.fromStageIndex, effect.stageNumber);
      return;
    }
    case "removeMainSchemeStages": {
      // "Remove 1 random stage 2 from the game" (docs/phase7-wave7.md §3.28): stages of the main scheme deck that are
      // not showing. The stage in play is `removeMainSchemeStage`'s, and only in a separate game area.
      const [scheme] = resolveRef(ctx.state, { kind: "mainScheme" }, context);
      const removed = scheme ? removeMainSchemeStages(ctx, scheme, effect.stageNumber, value(effect.random)) : 0;
      const bind = effect.bind;
      if (bind !== undefined)
        updateFrame(ctx, frame.frameId, (f) =>
          f.kind === "effects" ? { ...f, vars: { ...f.vars, [`${bind}.count`]: removed } } : f,
        );
      return;
    }
    case "addMainSchemeStageToVictoryDisplay": {
      const [scheme] = resolveRef(ctx.state, effect.scheme ?? { kind: "mainScheme" }, context);
      if (scheme) addMainSchemeStageToVictoryDisplay(ctx, scheme);
      return;
    }
    case "completeMainScheme":
      for (const scheme of targets(effect.scheme)) completeMainScheme(ctx, scheme);
      return;
    case "endGame":
      endGame(
        ctx,
        effect.result === "win"
          ? { result: "win", reason: "villainDefeated" }
          : effect.reason === "cardAbility"
            ? {
                result: "loss",
                reason: "cardAbility",
                // The card whose ability this is. An effect resolving with no card behind it has only the scenario to
                // name, and the main scheme is the scenario's own card.
                sourceInstanceId: context.selfInstanceId ?? ctx.state.mainScheme.instanceId,
              }
            : { result: "loss", reason: effect.reason ?? "mainSchemeCompleted" },
      );
      return;
    case "addVillain": {
      const actor = context.scopedPlayerId ?? context.controllerId ?? ctx.state.firstPlayerId;
      const added = addVillains(
        ctx,
        targets(effect.villain),
        contextArea(ctx.state, context),
        effect.reveal ?? false,
        actor,
        effect.row,
        effect.inPlay,
      );
      // "If no villain was put into play this way" (docs/phase7-wave5.md §3.1).
      if (effect.bind) {
        const slot = effect.bind;
        updateFrame(ctx, frame.frameId, (f) =>
          f.kind === "effects"
            ? {
                ...f,
                bindings: { ...f.bindings, [slot]: added.entered },
                vars: { ...f.vars, [`${slot}.count`]: added.entered.length },
              }
            : f,
        );
      }
      pushFrames(ctx, added.frames);
      return;
    }
    case "moveCounters": {
      const [to] = targets(effect.to);
      if (!to) return;
      // Counters moved onto `to` are placed there (docs/phase7-wave6.md §3.2): one announcement per card they came
      // from and type they arrived as (docs/phase7-wave9.md §3.6: two types that both became the destination's are one
      // placement of that type).
      const events: TriggerEvent[] = [];
      const amount = effect.amount === undefined ? undefined : value(effect.amount);
      const emptied: InstanceId[] = [];
      for (const from of targets(effect.from)) {
        const pick =
          effect.counterType === ANY_COUNTER
            ? anyCounterPickOf(frame.vars, frame.frameId, frame.cursor, from)
            : undefined;
        const moved = moveCounters(ctx, from, to, effect.counterType, {
          ...(amount === undefined ? {} : { amount }),
          ...(pick ? { pick } : {}),
        });
        const arrived = new Map<string, number>();
        for (const counters of moved)
          arrived.set(counters.counterType, (arrived.get(counters.counterType) ?? 0) + counters.amount);
        for (const [counterType, count] of arrived)
          events.push(countersPlaced(to, counterType, count, frame.controllerId));
        const usesType = usesKeyword(ctx.state, from, ctx.deps)?.counterType;
        if (moved.some((counters) => counters.fromCounterType === usesType)) emptied.push(from);
      }
      // RRG 1.8 "Uses" (p. 46): a uses card left with none of its counters is discarded, once the move is done.
      for (const from of emptied) discardEmptiedUsesCard(ctx, from);
      pushHeard(events);
      return;
    }
    case "discardTokens":
      for (const id of targets(effect.target)) {
        const instance = getInstance(ctx.state, id);
        if (!instance || (instance.damage === 0 && instance.threat === 0)) continue;
        updateInstance(ctx, id, (i) => ({ ...i, damage: 0, threat: 0 }));
        emit(ctx, { type: "tokensDiscarded", instanceId: id, damage: instance.damage, threat: instance.threat });
      }
      return;
    case "setVillainAside":
      setVillainsAside(ctx, targets(effect.villain));
      return;
    case "moveActiveCounter": {
      if (effect.to === "nextInRow") {
        // One place along the row from the villain that holds the counter, whichever villain's activation asked
        // (docs/phase7-wave8.md §3.8, §4.1 Q5 = A: the owner's decision on The Horsemen of Apocalypse 1B, `aoa` 45085b).
        const held = villainOf(ctx.state, ctx.state.activeVillainId)?.defeated === false;
        const next = nextVillainInRow(ctx.state, held ? ctx.state.activeVillainId : null);
        if (next) setActiveVillain(ctx, next, "nextInRow");
        return;
      }
      // MC27 p. 15 and its p. 21 FAQ: a lone villain keeps the counter.
      const next = nextVillainInActivationOrder(ctx.state, ctx.state.activeVillainId);
      if (next) setActiveVillain(ctx, next, "activationOrder");
      return;
    }
    case "removeVillain":
      removeVillains(ctx, targets(effect.villain));
      return;
    case "removeMainSchemeStage":
      for (const scheme of targets(effect.scheme)) removeMainSchemeStage(ctx, scheme);
      return;
    case "revealMainSchemeStage": {
      if (!ctx.state.scenarioRules.separateGameAreas) return;
      const players = resolvePlayers(ctx.state, effect.player, context);
      pushFrames(ctx, revealMainSchemeStages(ctx, players, effect.stageNumber, effect.removeUnused ?? false));
      return;
    }
    case "detach": {
      // "The first player detaches Odin from the main scheme and takes control of him" (Hall of Nastrond, `mts` 21141;
      // Find the Senator, `mut_gen` 32065a; docs/phase7-wave4.md §3.8). The card stays in play: it moves from its host to
      // its new controller's play area, which is not leaving or entering play.
      const [playerId] = resolvePlayers(ctx.state, effect.controller, context);
      if (!playerId) return;
      for (const id of targets(effect.card)) {
        const instance = getInstance(ctx.state, id);
        if (!instance || instance.attachedTo === null) continue;
        const from = instance.controllerId;
        moveCard(ctx, id, { kind: "playArea", playerId });
        updateInstance(ctx, id, (i) => ({ ...i, controllerId: playerId }));
        emit(ctx, { type: "cardDetached", instanceId: id, from: instance.attachedTo });
        if (from !== playerId)
          emit(ctx, { type: "controllerChanged", instanceId: id, from, to: playerId, reason: "effect" });
      }
      return;
    }
    case "swapVillain":
      for (const id of targets(effect.villain))
        if (villainOf(ctx.state, id)) swapVillain(ctx, id, { pool: effect.with, dial: effect.dial });
      return;
    case "competitiveOnly":
      return;
    case "raiseMoment": {
      // docs/phase7-wave8.md §3.39: one moment per player named, each the "you" of their own, in player order. Logged
      // always; on the stack only when an ability could answer (`heard`), so an unanswered moment changes nothing else.
      // §3.71: the slots it carries are copied off this frame now, with their vars, so an answer reads them once the
      // frame is gone and no answer changes what the next one reads.
      const carry = effect.carry ?? [];
      const carried =
        carry.length === 0
          ? {}
          : {
              carried: Object.fromEntries(carry.map((slot) => [slot, [...(frame.bindings[slot] ?? [])]])),
              carriedVars: Object.fromEntries(
                Object.entries(frame.vars).filter(([key]) =>
                  carry.some((slot) => key === slot || key.startsWith(`${slot}.`)),
                ),
              ),
            };
      const raised = resolvePlayers(ctx.state, effect.player, context).map(
        (playerId): Extract<TriggerEvent, { kind: "momentRaised" }> => ({
          kind: "momentRaised",
          name: effect.name,
          playerId,
          sourceInstanceId: frame.selfInstanceId,
          ...carried,
        }),
      );
      for (const { kind: _, ...moment } of raised) emit(ctx, { type: "momentRaised", ...moment });
      pushHeard(raised);
      return;
    }
    case "sharedEvent":
      emitSharedEvent(ctx, effect.event, value(effect.amount), effect.cause);
      return;
    case "inGroup":
      resolveInGroup(ctx, frame, effect);
      return;
    case "swapCards": {
      // docs/phase7-wave6.md §3.47: each ref names one card, or the swap cannot be completed (RRG 1.8 p. 42).
      const a = targets(effect.a);
      const b = targets(effect.b);
      const one = (ids: readonly InstanceId[]) => (ids.length === 1 ? ids[0] : undefined);
      swapCards(ctx, one(a), one(b), leaveSourceOf(ctx, frame), frame.frameId, {
        placePreviousThreat: effect.placePreviousThreat === true,
        sourceInstanceId: frame.selfInstanceId,
      });
      return;
    }
    case "swapIdentity":
      // docs/phase7-wave5.md §3.23: a progressing identity's next version.
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) swapIdentity(ctx, playerId);
      return;
    case "advanceToSetAsideVillain": {
      for (const id of targets(effect.villain)) {
        if (!villainOf(ctx.state, id)) continue;
        const frames = advanceToSetAsideVillain(ctx, id, frame.event);
        if (frames) pushFrames(ctx, frames);
      }
      return;
    }
    case "putMainSchemeStageIntoPlay":
      pushFrames(ctx, putMainSchemeStageIntoPlay(ctx, effect.stageNumber, effect.name, ctx.state.firstPlayerId));
      return;
    case "createGameArea": {
      const player = context.scopedPlayerId ?? context.controllerId;
      if (!player) return;
      for (const scheme of targets(effect.scheme)) createGameArea(ctx, scheme, player);
      return;
    }
    case "joinGameArea":
      throw new EngineInvariantError("joinGameArea is handled before applyEffect");
    case "atEndOfPhase":
      addLastingEffect(
        ctx,
        {
          kind: "delayedEffects",
          effects: effect.effects,
          scope: {
            selfInstanceId: frame.selfInstanceId,
            controllerId: frame.controllerId,
            vars: frame.vars,
            bindings: frame.bindings,
          },
        },
        { kind: "endOfPhase" },
      );
      return;
    case "moveThreat": {
      // A card a slot still names after it left play is neither a source nor a destination: a scheme put into play
      // and then discarded for the player side scheme limit takes no threat (docs/phase7-wave7.md §3.49).
      const schemesInPlay = cardsInPlay(ctx.state);
      const [from] = targets(effect.from).filter((id) => schemesInPlay.includes(id));
      const destinations = targets(effect.to).filter((id) => schemesInPlay.includes(id));
      // A move places a fixed number of tokens on one card and cannot be split: when "the main scheme" is both of
      // Tower Defense's, the threat goes to just the one with Focused Defense (ruling Oct 10, 2025, answer 2, on
      // Manipulated M.U.S.I.C., docs/rulings/post-rrg-1-6/15-october-2025.md; applied to every move with several
      // candidate schemes, an engine interpretation). A player card's "the main scheme" is already the scheme its
      // controller chose by now, so this only decides encounter cards' moves (MC21 p. 10).
      const focused = destinations.length > 1 ? focusedMainSchemeId(ctx.state, ctx.deps) : null;
      const to = focused && destinations.includes(focused) ? focused : destinations[0];
      const available = from ? mustInstance(ctx.state, from).threat : 0;
      const amount = Math.min(available, effect.amount ? Math.max(0, value(effect.amount)) : available);
      // RRG 1.8 "Move" (p. 30): no move to the current placement, and none without a valid source and destination.
      const remover = threatRemoverOf(ctx, frame);
      const blocked = from
        ? threatRemovalBlocked(
            ctx.state,
            ctx.deps,
            from,
            frame.selfInstanceId,
            false,
            false,
            null,
            null,
            false,
            false,
            remover,
          )
        : null;
      if (!from || !to || from === to || amount <= 0 || blocked) {
        if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.made`]: 0 });
        return;
      }
      // Removed from the source, then placed on the destination; only the placement reports to `bind`. The removal
      // names the placement, so an interrupt that sends "that threat" elsewhere takes it out of the move (ruling Nov
      // 21, 2025; `placeThreat.ofRemovedThreat`).
      const placement = eventFrame(
        ctx,
        { kind: "placeThreat", schemeInstanceId: to, amount, sourceInstanceId: frame.selfInstanceId },
        reportTo(effect.bind),
      );
      pushFrames(ctx, [
        eventFrame(ctx, {
          kind: "removeThreat",
          schemeInstanceId: from,
          amount,
          sourceInstanceId: frame.selfInstanceId,
          playerId: remover,
          movePlacementFrameId: placement.frameId,
        }),
        placement,
      ]);
      return;
    }
    case "if": {
      const branch = evaluate(ctx.state, effect.condition, context) ? effect.then : (effect.otherwise ?? []);
      pushEffects(ctx, {
        effects: branch,
        selfInstanceId: frame.selfInstanceId,
        abilityId: frame.abilityId,
        instruction: frame.instruction,
        controllerId: frame.controllerId,
        event: frame.event,
        eventFrameId: frame.eventFrameId,
        bindings: frame.bindings,
        vars: frame.vars,
        scopedPlayerId: frame.scopedPlayerId,
        returnBindingsTo: frame.frameId,
        byPlayer: frame.byPlayer === true,
        // A defeated card's leaving step checks its face with an `if` (`leaveAfterWhenDefeated`; §4.1 Q46).
        ...(frame.defeatedLeaving !== undefined ? { defeatedLeaving: frame.defeatedLeaving } : {}),
        ...(frame.defeatedLeavingSource !== undefined ? { defeatedLeavingSource: frame.defeatedLeavingSource } : {}),
        ...(frame.replacesEvent !== undefined ? { replacesEvent: frame.replacesEvent } : {}),
      });
      return;
    }
    case "then": {
      // RRG 1.8 "'Then'" (p. 44): the post-"then" text resolves only if the text before it fully resolved.
      if ((frame.vars[UNRESOLVED_VAR] ?? 0) > 0) {
        emit(ctx, { type: "thenSkipped" });
        return;
      }
      pushEffects(ctx, {
        effects: effect.effects,
        selfInstanceId: frame.selfInstanceId,
        abilityId: frame.abilityId,
        instruction: frame.instruction,
        controllerId: frame.controllerId,
        event: frame.event,
        eventFrameId: frame.eventFrameId,
        bindings: frame.bindings,
        vars: frame.vars,
        scopedPlayerId: frame.scopedPlayerId,
        returnBindingsTo: frame.frameId,
        byPlayer: frame.byPlayer === true,
      });
      return;
    }
    case "afterResolving": {
      // docs/phase7-wave7.md §3.68: written on the play, read by its `discardEvent` stage (`resolve/play-card.ts`).
      for (const id of targets(effect.card)) {
        const play = playFrameOf(ctx.state.stack, id);
        if (!play || play.stage === "done" || play.afterResolving === effect.to) continue;
        if (cardOf(ctx.state, id)?.type !== "event") continue;
        setFrame(ctx, { ...play, afterResolving: effect.to });
        emit(ctx, { type: "playDestinationSet", instanceId: id, to: effect.to });
      }
      return;
    }
    case "cancelTriggeringEvent": {
      const triggering = frame.eventFrameId ? findFrame(ctx.state, frame.eventFrameId) : undefined;
      // Nothing left to cancel: the event is gone or already cancelled (RRG 1.8 "'Then'", p. 44).
      if (!frame.eventFrameId || triggering?.kind !== "event" || triggering.cancelled) {
        markPreThenUnresolved(ctx, frame.frameId, "nothingToCancel");
        return;
      }
      // A cancelled enemy attack still ends (FFG ruling Feb 15, 2024, Ruling 148: Grasping Tendrils cancelling Rhino's
      // attack, Charge is still discarded "at the end of this attack"). RRG 1.8 "Cancel" (p. 11) agrees: the cancelled
      // ability "is still regarded as initiated", and its "abilities dependent on the canceled effect cannot trigger"
      // keeps new triggers (damage, "after … attacks") from answering it, not delayed effects already created. So its
      // held "at the end of this attack" effects resolve (`endedEarly`, `resolve/event.ts`).
      const endsAnyway = triggering.event.kind === "enemyAttack" || triggering.event.kind === "enemyAttacksEnemy";
      updateFrame(ctx, frame.eventFrameId, (target) =>
        target.kind === "event"
          ? { ...target, cancelled: true, ...(endsAnyway ? { endedEarly: true as const } : {}) }
          : target,
      );
      // RRG 1.8 "Cancel" (p. 11): cancelling the "when you play this card" event cancels *the card's* effects —
      // "Only the effects are prevented from initiating, and do not resolve", while "the card is still considered
      // played, and it is discarded". The play frame carries the flag the way a reveal frame carries
      // `effectsCancelled` for an encounter card, so this is one rule rather than a per-card branch.
      if (frame.event?.kind === "cardBeingPlayed") {
        const played = frame.event.instanceId;
        const play = ctx.state.stack.find((f) => f.kind === "playCard" && f.instanceId === played);
        if (play?.kind === "playCard") setFrame(ctx, { ...play, effectsCancelled: true });
      }
      return;
    }
    case "preventDamage":
    case "preventThreat": {
      const kind = effect.kind === "preventDamage" ? "dealDamage" : "placeThreat";
      const target = frame.eventFrameId ? findFrame(ctx.state, frame.eventFrameId) : undefined;
      if (target?.kind !== "event" || target.event.kind !== kind || target.cancelled) return;
      // Unpreventable damage cannot be prevented (§H3.3): such an interrupt is not offered against it
      // (`interruptBarredByUnpreventable`), and one that resolves against it anyway prevents nothing.
      if (isUnpreventableDamage(target.event)) return;
      const pending = target.event.amount;
      const prevented = effect.amount === undefined ? pending : Math.min(pending, Math.max(0, value(effect.amount)));
      if (prevented <= 0) return;
      // Prevented damage is still dealt (RRG 1.8 "Prevent", p. 35): the event keeps the amount dealt beside the amount
      // left to take, so "after X deals damage" still has its answer when this prevents all of it.
      setFrame(ctx, {
        ...target,
        event:
          target.event.kind === "dealDamage"
            ? { ...target.event, amount: pending - prevented, dealt: target.event.dealt ?? pending }
            : { ...target.event, amount: pending - prevented },
      });
      if (target.event.kind === "dealDamage") {
        emit(ctx, {
          type: "damagePrevented",
          targetInstanceId: target.event.targetInstanceId,
          amount: prevented,
          reason: "effect",
        });
        if (effect.kind === "preventDamage" && effect.bind)
          addFrameVars(ctx, frame.frameId, { [`${effect.bind}.amount`]: prevented });
        announceDamagePrevented(ctx, {
          kind: "damagePrevented",
          targetInstanceId: target.event.targetInstanceId,
          amount: prevented,
          preventerInstanceId: frame.selfInstanceId,
          fromAttack: target.event.fromAttack,
          sourceInstanceId: target.event.sourceInstanceId,
        });
      } else if (target.event.kind === "placeThreat") {
        emit(ctx, { type: "threatPrevented", schemeInstanceId: target.event.schemeInstanceId, amount: prevented });
      }
      return;
    }
    case "reduceDamageTo": {
      const target = frame.eventFrameId ? findFrame(ctx.state, frame.eventFrameId) : undefined;
      // Unpreventable damage cannot be reduced either (§H3.3): this reduces nothing, as for `preventDamage`.
      const pending =
        target?.kind === "event" &&
        target.event.kind === "dealDamage" &&
        !target.cancelled &&
        !isUnpreventableDamage(target.event)
          ? target.event
          : null;
      const cap = Math.max(0, value(effect.amount));
      const reduced = pending ? Math.max(0, pending.amount - cap) : 0;
      if (effect.bind)
        addFrameVars(ctx, frame.frameId, {
          [`${effect.bind}.amount`]: reduced,
          [`${effect.bind}.made`]: reduced > 0 ? 1 : 0,
        });
      if (!pending || target?.kind !== "event" || reduced <= 0) return;
      // Reduced like a prevention: the amount left to take goes down, the amount dealt stays (RRG 1.8 "Prevent", p. 35).
      setFrame(ctx, { ...target, event: { ...pending, amount: cap, dealt: pending.dealt ?? pending.amount } });
      emit(ctx, { type: "damageCapped", targetInstanceId: pending.targetInstanceId, amount: reduced });
      return;
    }
    case "reduceDamage": {
      // The mirror of `increaseDamage`: the damage dealt goes down, and the amount taken with it (RRG 1.8 "Damage",
      // p. 14); ruling August 26, 2026 - Ruling 2 (Metal Bracer can leave 0 damage dealt).
      const target = frame.eventFrameId ? findFrame(ctx.state, frame.eventFrameId) : undefined;
      if (target?.kind !== "event" || target.event.kind !== "dealDamage" || target.cancelled) return;
      if (isUnpreventableDamage(target.event)) return;
      const { amount: pending, dealt } = target.event;
      const reduced = Math.min(dealt ?? pending, Math.max(0, value(effect.amount)));
      if (reduced <= 0) return;
      setFrame(ctx, {
        ...target,
        event: {
          ...target.event,
          amount: Math.max(0, pending - reduced),
          ...(dealt !== undefined ? { dealt: dealt - reduced } : {}),
        },
      });
      emit(ctx, { type: "damageReduced", targetInstanceId: target.event.targetInstanceId, amount: reduced });
      return;
    }
    case "increaseDamage": {
      // The mirror of `preventDamage` (docs/phase7-wave4.md §3.52): the interrupted damage event's own amount grows.
      const target = frame.eventFrameId ? findFrame(ctx.state, frame.eventFrameId) : undefined;
      if (target?.kind !== "event" || target.event.kind !== "dealDamage" || target.cancelled) return;
      const added = value(effect.amount);
      if (added <= 0) return;
      const { dealt } = target.event;
      setFrame(ctx, {
        ...target,
        event: {
          ...target.event,
          amount: target.event.amount + added,
          // Already partly prevented: the increase is dealt on top of what was dealt before the prevention.
          ...(dealt !== undefined ? { dealt: dealt + added } : {}),
        },
      });
      emit(ctx, { type: "damageIncreased", targetInstanceId: target.event.targetInstanceId, amount: added });
      return;
    }
    case "repeatWhile": {
      // "Repeat this effect" (docs/phase7-wave4.md §3.54): the effects, then `while` read in the same frame (it sees
      // what they bound); a repetition starts with those bindings cleared, so "that character" is always its own.
      const depth = frame.vars[REPEAT_DEPTH_VAR] ?? 0;
      if (depth >= REPEAT_LIMIT) return;
      const own = boundNamesOf(effect.effects);
      const isOwn = (key: string) => own.some((name) => key === name || key.startsWith(`${name}.`));
      pushEffects(ctx, {
        effects: [...effect.effects, { kind: "if", condition: effect.while, then: [effect] }],
        selfInstanceId: frame.selfInstanceId,
        abilityId: frame.abilityId,
        instruction: frame.instruction,
        controllerId: frame.controllerId,
        event: frame.event,
        eventFrameId: frame.eventFrameId,
        bindings: Object.fromEntries(Object.entries(frame.bindings).filter(([key]) => !isOwn(key))),
        vars: {
          ...Object.fromEntries(Object.entries(frame.vars).filter(([key]) => !isOwn(key))),
          [REPEAT_DEPTH_VAR]: depth + 1,
        },
        scopedPlayerId: frame.scopedPlayerId,
        byPlayer: frame.byPlayer === true,
      });
      return;
    }
    case "repeatTimes": {
      // "For each …, choose" (RRG 1.8 "'For Each'", p. 20): the count is read once, here; each pass is a frame of its
      // own holding the bindings as they are now, so a pass never sees what an earlier one chose and the game state
      // updates between passes (a minion one pass defeats is no target for the next).
      const times = Math.min(value(effect.times), REPEAT_LIMIT);
      for (let pass = 0; pass < times; pass++) {
        pushEffects(ctx, {
          effects: effect.effects,
          selfInstanceId: frame.selfInstanceId,
          abilityId: frame.abilityId,
          instruction: frame.instruction,
          controllerId: frame.controllerId,
          event: frame.event,
          eventFrameId: frame.eventFrameId,
          bindings: frame.bindings,
          vars: frame.vars,
          scopedPlayerId: frame.scopedPlayerId,
          byPlayer: frame.byPlayer === true,
        });
      }
      return;
    }
    case "replaceTuckHost": {
      // RRG 1.8 "Replacement Effect" (p. 37): the replaced tuck "is no longer considered imminent", so its event is
      // cancelled (no further interrupt answers it, and its apply step tucks nothing) and the card is tucked under
      // the other host now, by the same ability, source and face. Now, so the text after it reads the host with the
      // card under it ("Then, if there are 2 tucked cards here"). It is the same tuck sent elsewhere, not a second
      // one: no `cardBeingTucked` is announced for it.
      const pending = frame.eventFrameId ? findFrame(ctx.state, frame.eventFrameId) : undefined;
      const [to] = targets(effect.to);
      if (pending?.kind !== "event" || pending.event.kind !== "cardBeingTucked" || pending.cancelled || !to) {
        markPreThenUnresolved(ctx, frame.frameId, "tuckNotReplaced");
        return;
      }
      const tuck = pending.event;
      setFrame(ctx, { ...pending, cancelled: true });
      resolveTuck(ctx, tuck, to);
      return;
    }
    case "replaceAttachHost": {
      // RRG 1.8 "Replacement Effect" (p. 37): the replaced attach "is no longer considered imminent", so its event is
      // cancelled (no further interrupt answers it, and its apply step attaches nothing) and the card is attached to
      // the other host now, the way the replaced attach would have been made. It is the same attach sent elsewhere:
      // no "would be attached" window opens for it.
      const pending = frame.eventFrameId ? findFrame(ctx.state, frame.eventFrameId) : undefined;
      const [to] = targets(effect.to);
      const attach =
        pending?.kind === "event" && !pending.cancelled && pending.event.kind === "cardAttached"
          ? pending.event
          : undefined;
      if (
        pending?.kind !== "event" ||
        attach?.imminent === undefined ||
        to === undefined ||
        to === attach.hostInstanceId ||
        !canAttachTo(ctx.state, ctx.deps, attach.instanceId, to)
      ) {
        markPreThenUnresolved(ctx, frame.frameId, "attachNotReplaced");
        return;
      }
      setFrame(ctx, { ...pending, cancelled: true });
      const landed = resolveImminentAttach(ctx, attach, to);
      // "Text on that card that refers to 'the villain' refers to [this card] instead": while it stays there.
      if (landed && effect.villainAlias) updateInstance(ctx, attach.instanceId, (i) => ({ ...i, villainAlias: to }));
      return;
    }
    case "replaceLeaveDestination": {
      // docs/phase7-wave9.md §3.20: the leaving this interrupt answers ends under the named card. What made the card
      // leave still did (it left play; a defeated one was defeated); only where it goes is replaced.
      if ("separateDeck" in effect.to) {
        // docs/phase7-wave11.md §3.3: the bottom of its owner's separate deck, attachments leaving with a host
        // included.
        const sent =
          frame.eventFrameId !== null &&
          frame.eventFrameId !== undefined &&
          separateDeckInsteadOfLeaving(ctx, frame.eventFrameId, effect.to.separateDeck);
        if (!sent) markPreThenUnresolved(ctx, frame.frameId, "leaveNotReplaced");
        return;
      }
      const [to] = targets(effect.to.tuckedUnder);
      const source = frame.selfInstanceId !== null ? getInstance(ctx.state, frame.selfInstanceId) : undefined;
      const replaced =
        frame.eventFrameId !== null &&
        frame.eventFrameId !== undefined &&
        to !== undefined &&
        tuckInsteadOfLeaving(ctx, frame.eventFrameId, to, {
          sourceInstanceId: source ? frame.selfInstanceId : null,
          sourceCardId: source?.cardId,
          facedown: false,
        });
      if (!replaced) markPreThenUnresolved(ctx, frame.frameId, "leaveNotReplaced");
      return;
    }
    case "replaceTriggeringEvent": {
      if (!frame.eventFrameId) return;
      updateFrame(ctx, frame.eventFrameId, (target) =>
        target.kind === "event" ? { ...target, cancelled: true } : target,
      );
      pushEffects(ctx, {
        effects: effect.with,
        selfInstanceId: frame.selfInstanceId,
        abilityId: frame.abilityId,
        instruction: frame.instruction,
        controllerId: frame.controllerId,
        event: frame.event,
        eventFrameId: null,
        bindings: frame.bindings,
        vars: frame.vars,
        ...(frame.event ? { replacesEvent: frame.event } : {}),
      });
      return;
    }
    case "cancelWhenRevealed":
    case "cancelRevealedCard": {
      // From a "would reveal" interrupt too (Spider-Tingle, 31020): the reveal frame is beneath it, not yet faceup.
      const revealing =
        frame.event?.kind === "encounterCardRevealing" || frame.event?.kind === "encounterCardBeingRevealed"
          ? frame.event.instanceId
          : null;
      const reveal = ctx.state.stack.find(
        (f): f is Frame<"reveal"> => f.kind === "reveal" && f.instanceId === revealing,
      );
      const all = effect.kind === "cancelRevealedCard";
      // Nothing to cancel, or it cannot be cancelled: the text before a "then" did not resolve (RRG 1.8 "'Then'", p. 44).
      // "This effect cannot be canceled." (RRG 1.8 "'Cannot'", p. 11: "cannot" is absolute.) The cancel's costs stay paid.
      if (
        !reveal ||
        revealCannotBeCanceled(ctx.state, ctx.deps, reveal.instanceId) ||
        reveal.effectsCancelled ||
        (!all && reveal.whenRevealedCancelled)
      ) {
        markPreThenUnresolved(ctx, frame.frameId, "nothingToCancel", reveal?.instanceId);
        return;
      }
      setFrame(ctx, all ? { ...reveal, effectsCancelled: true } : { ...reveal, whenRevealedCancelled: true });
      emit(ctx, { type: "revealCancelled", instanceId: reveal.instanceId, scope: all ? "allEffects" : "whenRevealed" });
      return;
    }
    case "placeDamage": {
      const amount = value(effect.amount);
      if (amount <= 0) return;
      for (const id of targets(effect.target)) {
        // "Magneto cannot have more than N sustained damage" holds placed damage too (`maxSustainedDamage`,
        // docs/phase7-wave6.md §3.3; RRG 1.8 "'Cannot'", p. 11, is absolute).
        const allowance = sustainedDamageAllowance(ctx.state, ctx.deps, id);
        const placed = allowance === null ? amount : Math.min(amount, allowance);
        if (placed < amount) emit(ctx, { type: "damageCapped", targetInstanceId: id, amount: amount - placed });
        if (placed <= 0) continue;
        updateInstance(ctx, id, (i) => ({ ...i, damage: i.damage + placed }));
        emit(ctx, {
          type: "damagePlaced",
          targetInstanceId: id,
          amount: placed,
          sourceInstanceId: frame.selfInstanceId,
        });
      }
      checkDefeats(ctx);
      return;
    }
    case "bindTargets": {
      const ids = targets(effect.target);
      updateFrame(ctx, frame.frameId, (f) =>
        f.kind === "effects" ? { ...f, bindings: { ...f.bindings, [effect.slot]: ids } } : f,
      );
      return;
    }
    case "modifyStatUntil":
    case "grantTraitUntil":
    case "grantKeywordUntil": {
      const reach = {
        targets: effect.target ? targets(effect.target) : null,
        affects: effect.affects ?? null,
      };
      let duration: LastingDuration;
      if (typeof effect.until === "object") {
        // "For its next basic thwart or attack action this phase" (Psychic Kicker; docs/phase7-wave6.md §3.39): waits on
        // the fixed target's next matching basic power (`startNextBasicPowerEffects`).
        duration = { kind: "nextBasicPower", characterIds: reach.targets ?? [], powers: effect.until.powers };
      } else if (effect.until === "endOfAttack") {
        const activation = currentActivationFrameId(ctx.state.stack);
        if (!activation) return;
        duration = { kind: "endOfEvent", frameId: activation };
      } else {
        // "Until the end of this turn" outside a turn cannot be initiated (RRG 1.8 "Lasting Effects", p. 26; §13).
        if (effect.until === "endOfTurn" && !turnInProgress(ctx.state)) return;
        if (effect.until === "endOfPlayerPhase" && !endOfPlayerPhaseCanStart(ctx.state)) return;
        duration = { kind: effect.until };
      }
      const scope: LastingScope = {
        selfInstanceId: frame.selfInstanceId,
        controllerId: frame.controllerId,
        vars: frame.vars,
        bindings: frame.bindings,
      };
      if (effect.kind === "grantTraitUntil") {
        // "You gain each of the attached character's TRAITS" (docs/phase7-wave6.md §3.50): the characters are fixed now,
        // their traits read live (§4.1 Q28; RRG 1.8 "Lasting Effects", p. 26: lasting effects "update whenever the
        // game state updates"). "For as long as Touched stays on that character" (Q28) is `whileAttached`.
        let bound: AttachmentBound | undefined;
        if (effect.whileAttached) {
          const card = targets(effect.whileAttached.card)[0];
          const host = targets(effect.whileAttached.to)[0];
          if (card === undefined || host === undefined) return;
          bound = { card, host };
          if (!attachmentHolds(ctx.state, bound)) return;
        }
        let body: LastingEffectBody;
        if (effect.traitsOf !== undefined) {
          const copiedFrom = targets(effect.traitsOf);
          if (copiedFrom.length === 0) return;
          body = { kind: "traitGrant", copiedFrom, scope, ...reach };
        } else {
          body = { kind: "traitGrant", trait: effect.trait, scope, ...reach };
        }
        addLastingEffect(ctx, body, duration, bound);
        return;
      }
      addLastingEffect(
        ctx,
        effect.kind === "modifyStatUntil"
          ? { kind: "statModifier", stat: effect.stat, amount: effect.amount, scope, ...reach }
          : { kind: "keywordGrant", keyword: effect.keyword, scope, ...reach },
        duration,
      );
      return;
    }
    case "applyRuleUntil": {
      const scope: LastingScope = {
        selfInstanceId: frame.selfInstanceId,
        controllerId: frame.controllerId,
        vars: frame.vars,
        bindings: frame.bindings,
      };
      /**
       * A player-scoped rule's own `player` ref is **resolved now and frozen** into the lasting effect, one effect
       * per player it names. A lasting effect is read long after its ability finished, with no triggering event and
       * often no source card (docs/phase7-wave2.md §22), so a ref that depends on either — `eventPlayer` on an
       * obligation's "When Revealed", `scoped` inside `forEachPlayer` — would quietly resolve to nobody and the
       * restriction would do nothing at all. Freezing it also makes the restriction inspectable in the game state:
       * the effect names the player it binds.
       */
      const players = "player" in effect.rule ? resolvePlayers(ctx.state, effect.rule.player, context) : [null];
      for (const rulePlayerId of players) {
        let duration: LastingDuration;
        if (effect.until === "endOfNextTurn") {
          // "Until your next turn ends": whose turn, and whether a turn of theirs is already under way — one that
          // is under way is not their *next* one (§22).
          const [playerId] = effect.player
            ? resolvePlayers(ctx.state, effect.player, context)
            : [rulePlayerId ?? frame.controllerId];
          if (!playerId) continue;
          const step = ctx.state.step;
          const ownTurnNow = step.phase === "player" && step.kind === "turn" && step.activePlayerId === playerId;
          duration = { kind: "endOfPlayerTurn", playerId, ...(ownTurnNow ? { skipRound: ctx.state.round } : {}) };
        } else if (effect.until === "endOfAttack") {
          // spec.ts `applyRuleUntil`: "that attack" is the one in progress, or the one this frame's next
          // `enemyAttack` initiates (retimed there by `settleAwaitingAttackEffects`).
          if (effect.attack === "initiated") duration = { kind: "awaitingAttack", frameId: frame.frameId };
          else {
            const activation = currentActivationFrameId(ctx.state.stack);
            if (!activation) return;
            duration = { kind: "endOfEvent", frameId: activation };
          }
        } else if (effect.until === "endOfPaidFor") {
          // "That attack" (Ruby Quartz Visor; spec.ts `applyRuleUntil`): the ability or card this payment paid for,
          // already pushed beneath the payment's effects.
          const paidFor = paidForFrameId(ctx.state.stack, frame.bindings["paidFor"]?.[0] ?? null);
          if (!paidFor) return;
          duration = { kind: "endOfPaidFor", frameId: paidFor };
        } else {
          // "Until the end of this turn" outside a turn cannot be initiated (RRG 1.8 "Lasting Effects", p. 26; §13.3).
          if (effect.until === "endOfTurn" && !turnInProgress(ctx.state)) return;
          if (effect.until === "endOfPlayerPhase" && !endOfPlayerPhaseCanStart(ctx.state)) return;
          duration = { kind: effect.until };
        }
        const rule =
          rulePlayerId && "player" in effect.rule
            ? { ...effect.rule, player: { kind: "id" as const, playerId: rulePlayerId } }
            : effect.rule;
        addLastingEffect(ctx, { kind: "ruleGrant", rule, scope }, duration);
      }
      return;
    }
    case "eachTimeUntil": {
      // docs/phase7-wave3.md §3.17: resolved by `eachTimeEffectsFor` at each matching event's response step.
      if (effect.until === "endOfTurn" && !turnInProgress(ctx.state)) return;
      addLastingEffect(
        ctx,
        {
          kind: "eachTime",
          on: effect.on,
          effects: effect.effects,
          scope: {
            selfInstanceId: frame.selfInstanceId,
            controllerId: frame.controllerId,
            vars: frame.vars,
            bindings: frame.bindings,
          },
        },
        { kind: effect.until },
      );
      return;
    }
    case "blankTextBox": {
      const ids = targets(effect.target);
      const activation = effect.until === "endOfAttack" ? currentActivationFrameId(ctx.state.stack) : null;
      if (ids.length === 0 || (effect.until === "endOfAttack" && !activation)) return;
      if (effect.until === "endOfTurn" && !turnInProgress(ctx.state)) return;
      if (effect.until === "endOfPlayerPhase" && !endOfPlayerPhaseCanStart(ctx.state)) return;
      const duration: LastingDuration = activation
        ? { kind: "endOfEvent", frameId: activation }
        : effect.until === "endOfRound" ||
            effect.until === "endOfTurn" ||
            effect.until === "nextVillainPhaseBegins" ||
            effect.until === "endOfPlayerPhase"
          ? { kind: effect.until }
          : { kind: "endOfPhase" };
      // Which card made the blank, for the Permanent keyword's same-set exception (docs/phase7-wave5.md §4.1 Q31).
      const sourceCardId = frame.selfInstanceId ? getInstance(ctx.state, frame.selfInstanceId)?.cardId : undefined;
      const source = sourceCardId ? { sourceCardId } : {};
      addLastingEffect(ctx, { kind: "blankTextBox", targets: ids, ...source }, duration);
      return;
    }
    case "atEndOfRound":
      addLastingEffect(
        ctx,
        {
          kind: "delayedEffects",
          effects: effect.effects,
          scope: {
            selfInstanceId: frame.selfInstanceId,
            controllerId: frame.controllerId,
            vars: frame.vars,
            bindings: frame.bindings,
          },
        },
        { kind: "endOfRound" },
      );
      return;
    case "findCard":
      // docs/phase7-wave6.md §3.48: "find X" anywhere in the game, moved by `moveCards` / `attach` below.
      applyFindCard(ctx, effect, context, frame, applyEffect);
      return;
    case "moveCards": {
      const inPlayNow = cardsInPlay(ctx.state);
      // "Players cannot discard attachments that are attached to friendly characters." (§3.44 of wave 4.)
      const ids = selectCards(ctx, effect.cards, context).filter((id) => {
        const refused =
          effect.to === "discard" &&
          frame.byPlayer === true &&
          inPlayNow.includes(id) &&
          playersCannotDiscard(ctx.state, ctx.deps, id);
        if (refused) emit(ctx, { type: "discardRefused", instanceId: id });
        return !refused;
      });
      if (effect.bind) {
        // Record what moved (and its printed resources / boost icons) before it moves. "… takes 1 damage for each
        // boost icon discarded this way" (Hit Squad, `cap` pack): the printed count plus any "gets +1 boost icon if …"
        // modifier (§3.9's `boostIconsFor`), summed across every card this bind moved. A star icon is not a boost icon
        // (RRG 1.8 "Boost, Boost Icon", p. 11), so it is its own total over the same cards; a card printing both pips
        // and a star adds to both.
        const bind = effect.bind;
        const totals = boundCardTotals(ctx, bind, ids, frame.bindings);
        updateFrame(ctx, frame.frameId, (f) =>
          f.kind === "effects" ? { ...f, bindings: { ...f.bindings, [bind]: ids }, vars: { ...f.vars, ...totals } } : f,
        );
      }
      if (effect.assignOwnerTo) {
        const [owner] = resolvePlayers(ctx.state, effect.assignOwnerTo, context);
        if (owner) {
          for (const id of ids) {
            // The card is that player's for the rest of the game (docs/phase7-wave6.md §4 Q14: a Captive ally shuffled
            // into a player's deck by the campaign), whatever its back: its home is the players' side, so it is
            // discarded to that player's discard pile (`discardZoneFor`), and the new owner is logged.
            if (getInstance(ctx.state, id)?.ownerId === null) {
              updateInstance(ctx, id, (i) => ({ ...i, ownerId: owner, controllerId: owner, home: { kind: "player" } }));
              emit(ctx, { type: "ownershipChanged", instanceId: id, playerId: owner });
            }
          }
        }
      }
      const [into] = effect.into ? resolvePlayers(ctx.state, effect.into, context) : [];
      if (effect.into && !into) return;
      // A card this discards from a player's deck is announced as that (docs/phase7-wave7.md §3.55), discarded by this
      // frame's card, and counted in `bind`, even once a response takes it away unless `takenAwayNotCounted` (§4.1 Q32).
      const boundOn = effect.bind
        ? {
            boundOn: {
              frameId: frame.frameId,
              slot: effect.bind,
              ...(effect.takenAwayNotCounted ? { takenAwayNotCounted: true as const } : {}),
            },
          }
        : {};
      const sourceCardId = leaveSourceOf(ctx, frame);
      // A card of a hand or a deck this would discard is announced first when an ability hears that ("when … would
      // discard a card you control", docs/phase7-wave9.md §4.1 Q20; `resolve/would-discard.ts`): its discard waits
      // for that window, behind the cards moved now, and a replaced one leaves the bound set.
      const { now, waiting } =
        effect.to === "discard"
          ? splitWouldDiscard(
              ctx,
              ids,
              { sourceInstanceId: frame.selfInstanceId, sourceCardId },
              { kind: "moveCards", ...boundOn },
            )
          : { now: ids, waiting: [] };
      moveCardsTo(ctx, now, effect.to, into, sourceCardId, { sourceInstanceId: frame.selfInstanceId, ...boundOn });
      if (effect.shuffleEvenIfEmpty && effect.to === "encounterDeckShuffle" && now.length === 0)
        shuffleEncounterDeck(ctx);
      // An icon of a card this discarded from a deck may count more than once (docs/phase7-wave7.md §3.56).
      if (effect.bind) recountDeckDiscardIcons(ctx, frame.frameId, effect.bind);
      if (waiting.length > 0) pushEvents(ctx, waiting);
      return;
    }
    case "shuffleDeck":
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        if (effect.separateDeck !== undefined) {
          if (mustPlayer(ctx.state, playerId).separateDecks[effect.separateDeck])
            shuffleSeparateDeck(ctx, playerId, effect.separateDeck);
          continue;
        }
        const order = shuffleZone(ctx, { kind: "deck", playerId }, mustPlayer(ctx.state, playerId).deck);
        updatePlayer(ctx, playerId, (p) => ({ ...p, deck: order }));
        announceDeckTops(ctx);
      }
      return;
    case "changeForm":
      throw new EngineInvariantError("changeForm is handled before applyEffect");
    case "drawUpTo":
      // Every printed "draw up to" reads "up to your hand size" (Split Personality, Grand Strategy, MC16's setup), so
      // it refills: a drawn obligation does not count toward it (`drawUpTo`).
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        drawUpTo(ctx, playerId, () => value(effect.amount));
      }
      return;
    case "forEachPlayer":
      // `order: "firstPlayerChooses"` is asked by the effects frame (`executeForEachPlayerOrdered`) before it lands here.
      pushEachPlayerPass(ctx, frame, effect.effects, resolvePlayers(ctx.state, effect.players, context), effect.bind);
      return;
    case "enemyAttack":
    case "enemyScheme":
    case "enemyActivation": {
      if (effect.after === "currentActivation") {
        const activation = currentActivationFrameId(ctx.state.stack);
        if (activation) {
          // Queued behind the activation in progress: its end-of-event effects run after its response window, so its
          // Retaliate and responses resolve first (ruling, Feb 28, 2026 (1) answer 2).
          const { after, ...now } = effect;
          void after;
          const deferred: DeferredEffects = {
            effects: [now],
            selfInstanceId: frame.selfInstanceId,
            controllerId: frame.controllerId,
            bindings: frame.bindings,
            vars: frame.vars,
          };
          updateFrame(ctx, activation, (f) =>
            f.kind === "event" ? { ...f, endEffects: [...f.endEffects, deferred] } : f,
          );
          return;
        }
      }
      // "X activates against you" (§4.1 Q67): attack or scheme by the player's form now, as the villain phase does
      // (`activateEnemy`, RRG 1.8 "Activation", p. 6).
      const attacksAgainst = (player: { readonly identity: { readonly form: string } }): boolean =>
        effect.kind === "enemyActivation" ? player.identity.form === "hero" : effect.kind === "enemyAttack";
      const against = effect.against ? resolvePlayers(ctx.state, effect.against, context) : null;
      const inPlayNow = cardsInPlay(ctx.state);
      const [character] =
        effect.kind === "enemyAttack" && effect.targetCharacter
          ? targets(effect.targetCharacter).filter(
              (id) => inPlayNow.includes(id) && categoriesOf(ctx.state, id).includes("character"),
            )
          : [];
      const characterController = character ? controllerOf(ctx.state, character) : null;
      const noBoost = effect.boost === false ? { noBoost: true } : {};
      // "Place 1 threat from that activation here instead of on the main scheme if …" (docs/phase7-wave9.md §3.9):
      // the card and the amount are fixed now and travel with each scheme this effect initiates; its place-threat
      // step reads the condition in this ability's scope.
      const divertTo = effect.kind === "enemyScheme" && effect.divert ? targets(effect.divert.to)[0] : undefined;
      const divertAmount =
        effect.kind === "enemyScheme" && effect.divert
          ? typeof effect.divert.amount === "number"
            ? effect.divert.amount
            : value(effect.divert.amount)
          : 0;
      const divert: { readonly divert?: SchemeThreatDivert } =
        effect.kind === "enemyScheme" && effect.divert && divertTo && divertAmount > 0
          ? {
              divert: {
                amount: divertAmount,
                toInstanceId: divertTo,
                ...(effect.divert.if ? { if: effect.divert.if } : {}),
                selfInstanceId: frame.selfInstanceId,
                controllerId: frame.controllerId,
                bindings: frame.bindings,
                vars: frame.vars,
              },
            }
          : {};
      // "If this activation would place any threat on the main scheme, …" (`enemyScheme.wouldPlaceThreat`): the
      // effects travel with each scheme this effect initiates, in this ability's scope as it is now.
      const wouldPlace: { readonly wouldPlaceThreat?: SchemeWouldPlaceThreat } =
        effect.kind === "enemyScheme" && effect.wouldPlaceThreat && effect.wouldPlaceThreat.length > 0
          ? {
              wouldPlaceThreat: {
                effects: effect.wouldPlaceThreat,
                selfInstanceId: frame.selfInstanceId,
                controllerId: frame.controllerId,
                ...(frame.abilityId !== undefined ? { abilityId: frame.abilityId } : {}),
                bindings: frame.bindings,
                vars: frame.vars,
              },
            }
          : {};
      // `statBonusTiming: "afterInterrupts"` (FFG ruling #147, Feb 15 2024): the bonus travels unevaluated, in this
      // ability's scope as it is now, and is read once the activation's interrupts have resolved.
      const deferAtk = effect.kind !== "enemyScheme" && effect.statBonusTiming === "afterInterrupts" && effect.atkBonus;
      const deferSch = effect.kind !== "enemyAttack" && effect.statBonusTiming === "afterInterrupts" && effect.schBonus;
      const deferredBonus: DeferredActivationBonus | null =
        deferAtk || deferSch
          ? {
              ...(deferAtk ? { atkBonus: deferAtk } : {}),
              ...(deferSch ? { schBonus: deferSch } : {}),
              selfInstanceId: frame.selfInstanceId,
              controllerId: frame.controllerId,
              bindings: frame.bindings,
              vars: frame.vars,
              ...(effect.kind === "enemyAttack" && effect.additionalResolution
                ? { shared: `${frame.frameId}#${frame.cursor}` }
                : {}),
            }
          : null;
      const deferred = deferredBonus ? { deferredBonus } : {};
      const events: TriggerEvent[] = [];
      // Each activation's "when [enemy] activates" announcement, pushed in its place when an ability listens.
      const announces: Extract<TriggerEvent, { kind: "enemyActivating" }>[] = [];
      const discarded: StatusDiscarded[] = [];
      let cancelledByStatus = 0;
      let firstCancelled: InstanceId | null = null;
      for (const enemy of targets(effect.enemies)) {
        const categories = categoriesOf(ctx.state, enemy);
        if (!categories.includes("enemy") || !cardsInPlay(ctx.state).includes(enemy)) continue;
        if (villainOf(ctx.state, enemy)?.defeated) continue;
        const players =
          effect.kind === "enemyAttack" && effect.targetCharacter
            ? [characterController].filter((p): p is PlayerId => p !== null)
            : (against ??
              [getInstance(ctx.state, enemy)?.engagedWith ?? frame.controllerId].filter(
                (p): p is PlayerId => p !== null,
              ));
        for (const playerId of players) {
          const player = getPlayer(ctx.state, playerId);
          if (!player || player.eliminated) continue;
          const attacking = attacksAgainst(player);
          // "Cannot activate" (docs/phase7-wave6.md §3.34): no activation begins and no status card is spent. Like a
          // status-cancelled one, it did not happen for a "Then".
          if (cannotActivate(ctx.state, ctx.deps, enemy)) {
            emit(ctx, {
              type: "activationBlocked",
              enemyInstanceId: enemy,
              activation: attacking ? "attack" : "scheme",
              playerId,
            });
            cancelledByStatus++;
            firstCancelled ??= enemy;
            continue;
          }
          // Status first, then initiate even with a "—" stat (see `activateEnemy`, FAQ "Norman Osborn (#1A)", p. 58).
          const status = attacking ? "stunned" : "confused";
          if (statusActive(ctx.state, enemy, status, ctx.deps)) {
            // RRG "Stun"/"Confuse": the status is discarded instead; the enemy did not attack/scheme.
            discarded.push(
              ...discardStatusCards(ctx, enemy, status, attacking ? "cancelledAttack" : "cancelledSchemeOrThwart"),
            );
            cancelledByStatus++;
            firstCancelled ??= enemy;
            continue;
          }
          const kind = attacking ? "attack" : "scheme";
          announces.push({
            kind: "enemyActivating",
            enemyInstanceId: enemy,
            activation: kind,
            playerId,
            cardCaused: {
              kind: effect.kind === "enemyActivation" ? "byForm" : kind,
              ...(character ? { targetInstanceId: character } : {}),
              ...(effect.kind === "enemyAttack" && effect.additionalResolution ? { additionalResolution: true } : {}),
              ...noBoost,
              ...(attacking ? {} : divert),
              ...(attacking ? {} : wouldPlace),
              ...deferred,
              vars: {},
            },
          });
          events.push(
            attacking
              ? {
                  kind: "enemyAttack",
                  enemyInstanceId: enemy,
                  attackedPlayerId: playerId,
                  targetPlayerId: playerId,
                  targetInstanceId: character ?? player.identity.instanceId,
                  ...(effect.kind === "enemyAttack" && effect.additionalResolution
                    ? { additionalResolution: true }
                    : {}),
                  ...noBoost,
                  ...(deferAtk ? deferred : {}),
                }
              : {
                  kind: "enemyScheme",
                  enemyInstanceId: enemy,
                  playerId,
                  ...noBoost,
                  ...divert,
                  ...wouldPlace,
                  ...(deferSch ? deferred : {}),
                },
          );
        }
      }
      // "Green Goblin attacks with +X ATK" / "schemes with +X SCH": evaluated once, now, and carried by each
      // activation this effect initiates, so it applies to exactly those and never leaks into a later one.
      // "That attack gains overkill" (§3.51): each keyword is the same activation var `modifyAttack` sets.
      // "Give the villain 1 additional boost card for that activation" / "each boost card turned faceup during that
      // activation gets +1 boost icon" (§4.1 Q66): the same seeding, so an activation that never happens deals and
      // changes nothing, and none lingers for the next one.
      const extraBoost =
        effect.extraBoostCards === undefined
          ? 0
          : typeof effect.extraBoostCards === "number"
            ? effect.extraBoostCards
            : Math.max(0, value(effect.extraBoostCards));
      const boostScoped = {
        ...(extraBoost > 0 ? { extraBoost } : {}),
        ...(effect.boostIconsEach ? { boostIconsEach: value(effect.boostIconsEach) } : {}),
      };
      // An attack reads only `atkBonus` and the keywords, a scheme only `schBonus`, so an `enemyActivation` seeds all
      // three and each activation it starts reads its own.
      const bonus = {
        ...(effect.kind !== "enemyScheme" && effect.atkBonus && !deferAtk ? { atkBonus: value(effect.atkBonus) } : {}),
        ...(effect.kind !== "enemyScheme"
          ? Object.fromEntries((effect.keywords ?? []).map((keyword) => [keyword, 1]))
          : {}),
        ...(effect.kind !== "enemyAttack" && effect.schBonus && !deferSch ? { schBonus: value(effect.schBonus) } : {}),
        ...boostScoped,
      };
      // RRG 1.8 "'Then'" (p. 44): "X attacks you. Then, …" waits on the attack. One that a status cancelled, or that
      // could not be initiated at all, did not resolve; one initiated here reports back whether it happened. "Each X
      // attacks" with no X is vacuously resolved (engine reading), so only a named enemy with no activation marks it.
      const initiated = events.length;
      const vacuous = cancelledByStatus === 0 && initiated === 0 && effect.enemies.kind === "each";
      if (!vacuous && (cancelledByStatus > 0 || initiated === 0))
        markPreThenUnresolved(ctx, frame.frameId, "activationDidNotHappen", firstCancelled ?? undefined);
      // RRG 1.8 "Activation" (p. 6): an attack or scheme a card ability causes is "also considered" an activation, so
      // "when [enemy] activates against you" interrupts it (owner ruling, docs/phase7-wave5.md §4.1 Q67). Announced as
      // the villain phase announces its own (`activateEnemy`), only when an ability listens; the announcement carries
      // what this effect fixed, and `continueActivation` initiates the attack or scheme after the interrupts.
      const lastAttack = events.map((e) => e.kind).lastIndexOf("enemyAttack");
      const batch = events.map((event, index): TriggerEvent => {
        const announce = announces[index];
        // The same attack resolved against another player (`additionalResolution`) is not another activation.
        if (!announce?.cardCaused || announce.cardCaused.additionalResolution) return event;
        if (!heard(ctx.state, ctx.deps, announce)) return event;
        return {
          ...announce,
          cardCaused: {
            ...announce.cardCaused,
            vars: bonus,
            ...(index === lastAttack ? { settlesAwaitingAttack: true } : {}),
          },
        };
      });
      const pushed = pushEvents(
        ctx,
        batch,
        { frameId: frame.frameId, prefix: effect.bind ?? null, gatesThen: true },
        bonus,
      );
      // "The Lizard attacks you. You cannot play events until after that attack resolves." (`applyRuleUntil` with
      // `attack: "initiated"`): the rule waiting on this frame is now scoped to the attack, the last one if several.
      // An announced attack settles it as it is initiated (`CardCausedActivation.settlesAwaitingAttack`).
      if ((effect.kind === "enemyAttack" || lastAttack >= 0) && batch[lastAttack]?.kind !== "enemyActivating")
        settleAwaitingAttackEffects(ctx, frame.frameId, pushed[lastAttack] ?? null);
      // Pushed last, so the discards' shared response window resolves before the activations the statuses did not stop.
      announceStatusDiscarded(ctx, discarded);
      return;
    }
    case "selectCards": {
      const ids = selectCards(ctx, effect.cards, context);
      const slot = effect.slot;
      // A search that found nothing (RRG 1.8 "'Then'", p. 44): "search … for X and put it into play …, then …".
      if (ids.length === 0 && readsDeck(effect.cards)) markPreThenUnresolved(ctx, frame.frameId, "searchFoundNothing");
      updateFrame(ctx, frame.frameId, (f) =>
        f.kind === "effects"
          ? { ...f, bindings: { ...f.bindings, [slot]: ids }, vars: { ...f.vars, [`${slot}.count`]: ids.length } }
          : f,
      );
      return;
    }
    case "revealCard": {
      const [playerId] = resolvePlayers(ctx.state, effect.player, context);
      // "Find X and reveal it" (docs/phase7-wave8.md §3.1): the find itself, one card, logged, its decks to shuffle.
      const find = playerId && effect.cards.kind === "find" ? findToReveal(ctx, effect.cards, context) : null;
      const revealing = find ? find.found : playerId ? targets(effect.cards) : [];
      // "Reveal that minion, then …" with no minion found (RRG 1.8 "'Then'", p. 44).
      if (revealing.length === 0) markPreThenUnresolved(ctx, frame.frameId, "revealFoundNothing");
      if (!playerId) return;
      if (effect.instead) {
        // "Reveal [that card] instead" (docs/phase7-wave9.md §3.41): the reveal this interrupt answers ends unresolved
        // and its window closes, as `replaceTriggeringEvent` closes one (RRG 1.8 "Replacement Effect", p. 36).
        const replaced = frame.event?.kind === "encounterCardRevealing" ? frame.event.instanceId : null;
        if (!replaceRevealInProgress(ctx, replaced, revealing)) {
          markPreThenUnresolved(ctx, frame.frameId, "nothingToCancel", replaced ?? undefined);
          return;
        }
        if (frame.eventFrameId)
          updateFrame(ctx, frame.eventFrameId, (target) =>
            target.kind === "event" ? { ...target, cancelled: true } : target,
          );
      }
      const inPlay = new Set(cardsInPlay(ctx.state));
      // "Reveal and attach … here" (`heldBy`, docs/phase7-wave9.md §4.1 Q26): the reveal places its minion on this card.
      const [holder] = effect.heldBy ? targets(effect.heldBy) : [];
      // "Treating each [per player] on it as 1" (docs/phase7-wave10-hero-packs.md H3.5): carried by each reveal.
      const reading = effect.perPlayerAs !== undefined ? { perPlayerAs: effect.perPlayerAs } : {};
      const frames: StackFrame[] = [];
      for (const id of revealing) {
        // A card faceup in play is revealed where it is and does not enter play (RRG 1.8 "Find", p. 19; ruling June 25,
        // 2026 (5); `Frame<"reveal">.foundInPlay`, `resolve/reveal.ts`). A facedown one is not in play as itself.
        if (inPlay.has(id) && getInstance(ctx.state, id)?.faceup === true) {
          frames.push({ ...revealFrame(ctx, playerId, id, frame.frameId, "elsewhere"), foundInPlay: true, ...reading });
          continue;
        }
        // Park it with the revealing player's dealt cards while it resolves (out of the deck/discard it came from).
        updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
        // A card a swap already put there (`instead`) is revealed from where it is.
        const parked = locateCard(ctx.state, id);
        if (parked?.kind !== "dealtEncounter" || parked.playerId !== playerId)
          moveCard(ctx, id, { kind: "dealtEncounter", playerId }, "top");
        // A reveal whose effects are cancelled reports back (`preThenOf`, `resolve/reveal.ts`).
        frames.push({
          ...revealFrame(ctx, playerId, id, frame.frameId, effect.fromEncounterDeck ? "encounterDeck" : "elsewhere"),
          ...(holder ? { heldBy: holder } : {}),
          ...reading,
        });
      }
      // Each deck the find looked through is shuffled once the card is out of it, as `findCard` does (RRG 1.8
      // "Search", p. 39), found or not (docs/phase7-wave6.md §4.1 Q77); a card found in an open area searched none.
      if (find) shuffleSearchedDecks(ctx, find.searched);
      pushFrames(ctx, frames);
      return;
    }
    case "takeIntoHand": {
      const [playerId] = resolvePlayers(ctx.state, effect.player, context);
      if (!playerId) return;
      for (const id of selectCards(ctx, effect.cards, context)) {
        const instance = getInstance(ctx.state, id);
        const card = cardOf(ctx.state, id);
        if (!instance || !card || !("deckLimit" in card)) continue;
        const patch: LeavePatch = {
          faceup: true,
          controllerId: playerId,
          // `keepOwner`: another player's card stays its owner's in this hand (RRG 1.8 "Ownership and Control", p. 31).
          ...(instance.ownerId !== playerId && (effect.keepOwner !== true || instance.ownerId === null)
            ? { ownerId: playerId }
            : {}),
        };
        // The new owner comes with the move, after any "when it leaves play" interrupt, which sees the card as it was;
        // `leavePlay` applies `patch` once the card has left, now or after its interrupts (wave 5 §4.1 Q17, Q35), and
        // not at all when the card stays in play (Permanent or "cannot leave play"): a card that did not move keeps its
        // owner and controller.
        if (cardsInPlay(ctx.state).includes(id)) {
          leavePlay(ctx, id, { kind: "hand", playerId }, "top", false, patch, leaveSourceOf(ctx, frame));
          continue;
        }
        moveCard(ctx, id, { kind: "hand", playerId });
        applyLeavePatch(ctx, id, patch);
      }
      return;
    }
    case "buildScenarioDeck":
      buildScenarioDeck(ctx, effect.name, effect.from);
      return;
    case "shuffleEncounterDeck":
      shuffleEncounterDeck(ctx);
      return;
    case "discardEncounterUntil": {
      // Finding nothing does not mark the text before a "then" unresolved: RRG 1.8 "Encounter Deck" (p. 17), "If the
      // encounter deck is emptied this way, that card ability is considered to be fulfilled." A following "Reveal that
      // minion" with no minion does (`revealCard`, `revealFoundNothing`).
      // Bounded by the number of encounter cards, so a deck with no match can't loop forever.
      const deckId = activeEncounterDeckId(ctx.state);
      const piles = encounterDeckOf(ctx.state, deckId);
      const limit = piles.deck.length + piles.discard.length;
      let found: InstanceId | null = null;
      for (let i = 0; i < limit && found === null; i++) {
        // RRG 1.8 "Encounter Deck" (p. 17): "discard cards from the encounter deck until the discard condition is met
        // or the encounter deck is empty. … Do not continue the discard effect with the newly shuffled encounter deck."
        // The same stop `discardEncounterCards` makes. The deck resets at the discard that empties it
        // (`resetEncounterDeckIfEmpty`, docs/phase7-wave6.md §3.60), so the last card is known before it moves.
        const id = drawEncounterCard(ctx, deckId);
        if (!id) break;
        const last = encounterDeckOf(ctx.state, deckId).deck.length === 1;
        updateInstance(ctx, id, (inst) => ({ ...inst, faceup: true }));
        moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
        // Each card passed over is a discard from the deck too (docs/phase7-wave9.md §3.43 (b)); only the match is in
        // `bind`, which drops it if a response to its discard takes it away (docs/phase7-wave7.md §4.1 Q32).
        recordEncounterDeckDiscard(ctx, deckId, id, {
          sourceInstanceId: frame.selfInstanceId,
          how: "effect",
          boundOn: { frameId: frame.frameId, slot: effect.bind },
        });
        if (matchesQuery(ctx.state, id, effect.filter, context)) found = id;
        if (last) break;
      }
      const bind = effect.bind;
      updateFrame(ctx, frame.frameId, (f) =>
        f.kind === "effects"
          ? {
              ...f,
              bindings: { ...f.bindings, [bind]: found ? [found] : [] },
              vars: { ...f.vars, [`${bind}.count`]: found ? 1 : 0 },
            }
          : f,
      );
      return;
    }
    case "discardDeckUntil": {
      // RRG 1.8 "Player Deck" (p. 33), read on its own rather than carried over from the encounter deck (p. 17): "if
      // the player's deck empties while the player was discarding cards from their deck, no further cards are
      // discarded from the newly shuffled deck". A deck that was already empty when the effect began is reset first
      // (`takeTopOfDeck`) and the discarding happens from the new deck — the same split `discardEncounterCards` makes.
      const bind = effect.bind;
      const bindAll = effect.bindAll;
      // One player per "your deck"; several ("each player") each search their own deck, in player order, and every
      // match lands in the one slot, so `<bind>.count` is how many were found.
      const found: InstanceId[] = [];
      // Every card discarded, in order, the match of each player the last of that player's (§3.71).
      const discarded: InstanceId[] = [];
      let searched = 0;
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        const player = getPlayer(ctx.state, playerId);
        if (!player || player.eliminated) continue;
        searched++;
        // Bounded by the cards that exist, so a deck with no match can't loop forever.
        const limit = player.deck.length + player.discard.length;
        for (let i = 0; i < limit; i++) {
          const id = takeTopOfDeck(ctx, playerId);
          if (!id) break;
          const resets = playerDeckResets(ctx, playerId);
          // The log already carries each move as `cardMoved`, the same record `discardEncounterUntil` leaves.
          moveCard(ctx, id, { kind: "discard", playerId }, "top");
          // Each card passed over is a discard from the deck too (docs/phase7-wave7.md §3.55, §4.1 Q31); only the
          // match is in `bind`, and all of them are in `bindAll`.
          discarded.push(id);
          recordDeckDiscard(ctx, playerId, id, {
            sourceInstanceId: frame.selfInstanceId,
            boundOn: { frameId: frame.frameId, slot: bind, ...(bindAll !== undefined ? { also: [bindAll] } : {}) },
          });
          if (matchesQuery(ctx.state, id, effect.filter, context)) {
            found.push(id);
            break;
          }
          // This discard emptied the deck, which was reset at once (`settlePlayerDecks`): stop.
          if (playerDeckResets(ctx, playerId) > resets) break;
        }
      }
      updateFrame(ctx, frame.frameId, (f) => {
        if (f.kind !== "effects") return f;
        // `f.bindings` now says which cards this frame discarded from a deck (`recordDeckDiscard`), which the icon
        // totals read (`countedResourcesOf`).
        const all = bindAll === undefined ? null : { [bindAll]: discarded };
        return {
          ...f,
          bindings: { ...f.bindings, [bind]: found, ...all },
          vars: {
            ...f.vars,
            [`${bind}.count`]: found.length,
            ...(bindAll === undefined ? {} : boundCardTotals(ctx, bindAll, discarded, { ...f.bindings, ...all })),
          },
        };
      });
      // "Discard … until you discard an X, then add that card to your hand" with no X (RRG 1.8 "'Then'", p. 44): each
      // player who searched must have found one.
      if (found.length < searched) markPreThenUnresolved(ctx, frame.frameId, "discardUntilFoundNothing");
      return;
    }
    case "discardEncounterCards": {
      // RRG 1.8 "Encounter Deck" (p. 17): discard until the count is met or the deck is emptied *by this effect*, and
      // then "do not continue the discard effect with the newly shuffled encounter deck". The deck resets at the
      // discard that empties it (`resetEncounterDeckIfEmpty`, docs/phase7-wave6.md §3.60), with that card in the new
      // deck, so the last card is known before it moves.
      // The loop is the one a discard cost uses too (`discardTopOfEncounterDeck`, docs/phase7-wave9.md §3.43 (a)).
      //
      // "… for each boost icon discarded this way" (Power Drain, Lightning Bolt, Shock Therapy): summed across every
      // card this discard actually reached, so a discard cut short by the empty-deck rule above counts only what it
      // got. Each card's icons are read the moment it is discarded, before it moves, exactly as `moveCards` does.
      // "For each star icon in the boost area discarded this way" (Slipping Sanity, `scw`) is counted over exactly the
      // same cards, separately: RRG 1.8 "Boost, Boost Icon" (p. 11), "A star icon is not itself considered a boost
      // icon". Printed data, never the ability registry (§18.6).
      const taken = discardTopOfEncounterDeck(ctx, Math.max(0, value(effect.count)), {
        sourceInstanceId: frame.selfInstanceId,
        how: "effect",
        ...(effect.bind ? { boundOn: { frameId: frame.frameId, slot: effect.bind } } : {}),
      });
      const discarded = taken.discarded;
      const bind = effect.bind;
      if (bind) {
        updateFrame(ctx, frame.frameId, (f) =>
          f.kind === "effects"
            ? {
                ...f,
                bindings: { ...f.bindings, [bind]: discarded },
                vars: { ...f.vars, ...encounterTopDiscardVars(bind, taken) },
              }
            : f,
        );
      }
      const each = effect.forEachDiscarded;
      if (each) {
        // "Each time a card is discarded this way": one pass per discarded card, in discard order. Every discard
        // happens first; no wave 1 card reads the deck between two of them.
        for (const id of [...discarded].reverse()) {
          pushEffects(ctx, {
            effects: each.effects,
            selfInstanceId: frame.selfInstanceId,
            abilityId: frame.abilityId,
            instruction: frame.instruction,
            controllerId: frame.controllerId,
            event: frame.event,
            eventFrameId: frame.eventFrameId,
            bindings: { ...frame.bindings, [each.slot]: [id] },
            vars: frame.vars,
            scopedPlayerId: frame.scopedPlayerId,
          });
        }
      }
      return;
    }
    case "tuckCards": {
      const [host] = targets(effect.under);
      if (!host) return;
      const tucking: InstanceId[] = [];
      // "When Defeated: Tuck this card under …" (docs/phase7-wave11-scenarios.md §S3.10): the card resolving its own
      // When Defeated is still in play and leaves after it (RRG 1.8 "When Defeated Abilities", p. 48), so the tuck
      // takes the place of the defeat's discard at its leaving step, already waiting (`DefeatPlacement tuckedUnder`).
      const defeated =
        frame.event?.kind === "characterDefeated" && frame.event.instanceId === frame.selfInstanceId
          ? frame.event.instanceId
          : null;
      let deferred = 0;
      for (const id of selectCards(ctx, effect.cards, context)) {
        if (
          id === defeated &&
          id !== host &&
          cardsInPlay(ctx.state).includes(id) &&
          redirectPendingDefeat(ctx, id, { tuckedUnder: host })
        ) {
          deferred++;
          continue;
        }
        // "After the villain is defeated, put it under here" (docs/phase7-wave7.md §3.7): only a villain's defeated last
        // stage is a card that can go under another. A villain still in play, one whose defeated stage revealed its
        // next, keeps its place: the stage that fell was removed from the game (RRG 1.8 "Villain Defeat", p. 47).
        const villain = villainOf(ctx.state, id);
        if (villain && !villain.defeated) continue;
        // Its attachments, boost cards and tucked cards were discarded as it was defeated (`removeDefeatedVillain`).
        // What is left on the card goes back to the supply here: under the host it is a new copy with no memory of
        // its state (RRG 1.8 "Leaves Play", p. 27), and nothing on it carries to the next villain, whose title is
        // another's (RRG 1.8 "Villain Defeat", p. 47).
        if (villain)
          updateInstance(ctx, id, (i) => ({ ...i, damage: 0, statuses: NO_STATUSES, counters: {}, exhausted: false }));
        tucking.push(id);
      }
      // The cards it names are out of its reach (removed from the game, or gone from the zone it takes them from): the
      // tuck did not resolve, so a "Then" after it is not attempted (RRG 1.8 "'Then'", p. 44).
      if (tucking.length === 0 && deferred === 0 && effect.cards.kind === "ref" && targets(effect.cards.ref).length > 0)
        markPreThenUnresolved(ctx, frame.frameId, "tuckNamedNoCard");
      // Each tuck opens its "would be tucked" window when an ability hears it (docs/phase7-wave9.md §3.40 (a)).
      tuckOrAnnounce(ctx, tucking, host, {
        sourceInstanceId: frame.selfInstanceId,
        sourceCardId: leaveSourceOf(ctx, frame),
        facedown: effect.facedown === true,
        effectFrameId: frame.frameId,
      });
      return;
    }
    case "putIntoPlayFacedown": {
      const count = effect.count ? value(effect.count) : 1;
      const entered: TriggerEvent[] = [];
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        for (let i = 0; i < count; i++) {
          const id = takeTopOfDeck(ctx, playerId);
          if (!id) break;
          moveCard(ctx, id, { kind: "playArea", playerId });
          // Engaged with that player like any minion; it belongs to the encounter side while facedown.
          updateInstance(ctx, id, (inst) => ({
            ...inst,
            faceup: false,
            controllerId: null,
            engagedWith: playerId,
            facedownAs: effect.as,
          }));
          emit(ctx, { type: "cardPutIntoPlayFacedown", instanceId: id, playerId, as: effect.as.kind });
          entered.push({ kind: "cardEntersPlay", instanceId: id, playerId }, ...engagedEvent(ctx, id));
        }
      }
      pushEvents(ctx, entered);
      checkDefeats(ctx);
      return;
    }
    case "gainSurge": {
      const revealOf = (id: InstanceId | null) =>
        ctx.state.stack.find((f): f is Frame<"reveal"> => f.kind === "reveal" && f.instanceId === id);
      if (effect.target === undefined) {
        const reveal = revealOf(frame.selfInstanceId);
        if (reveal) setFrame(ctx, { ...reveal, surgeGained: true });
        return;
      }
      // "It gains surge" (`target`): another card, for the reveal it is in the middle of.
      for (const id of targets(effect.target)) {
        const reveal = revealOf(id);
        if (!reveal || reveal.surgeGained) continue;
        setFrame(ctx, { ...reveal, surgeGained: true });
        emit(ctx, { type: "surgeGranted", instanceId: id, playerId: reveal.playerId });
      }
      return;
    }
    case "setVar":
      // docs/phase7-wave4.md §3.46: a snapshot for a later comparison in the same ability.
      addFrameVars(ctx, frame.frameId, { [effect.name]: value(effect.value) });
      return;
    case "chooseCards":
    case "lookAt":
    case "chooseOne":
    case "forEachCard":
    case "forEachCardPass":
    case "choosePlayer":
    case "chooseNumber":
    case "chooseCardType":
    case "accuse":
    case "searchCollection":
    case "reportFact":
    case "basicPowerBy":
    case "resolveSpecials":
    case "pairCards":
    case "assignDamage":
    case "dealIndirectDamage":
    case "divideDamageEvenly":
    case "reorderCards":
      throw new EngineInvariantError(`${effect.kind} is handled before applyEffect`);
    case "reduceNextCardCost": {
      // "To 0" (docs/phase7-wave10-hero-packs.md H3.10): the amount is not read.
      const amount = effect.toZero ? 0 : value(effect.amount);
      // Signed: a positive amount reduces, a negative one increases ("costs N additional resources"). 0 does nothing.
      if (amount === 0 && !effect.toZero) return;
      if (effect.duration === "turn" && !turnInProgress(ctx.state)) return;
      const toZero = effect.toZero ? { toZero: true as const } : {};
      if (effect.cards) {
        // One reduction for each card named, bound to that card (H3.11). "The next card that player plays" is a
        // timing point of a player, not of a card, so that duration makes nothing here (the DSL validator refuses it).
        if (effect.duration === "untilPlayed") return;
        const until =
          effect.duration === "phase" ? "endOfPhase" : effect.duration === "turn" ? "endOfTurn" : "endOfRound";
        const [maker] = resolvePlayers(ctx.state, effect.player, context);
        for (const id of targets(effect.cards)) {
          const playerId = maker ?? getInstance(ctx.state, id)?.ownerId;
          if (!playerId) continue;
          addLastingEffect(
            ctx,
            { kind: "costReduction", playerId, amount, cardInstanceId: id, ...toZero },
            { kind: until },
          );
        }
        return;
      }
      const filter = effect.cardFilter ? { cardFilter: effect.cardFilter } : {};
      // By destination, and for whoever plays next (docs/phase7-wave8.md §3.35): one effect, not one per player.
      const where = {
        ...(effect.into ? { into: effect.into } : {}),
        ...(effect.anyPlayer ? { anyPlayer: true as const } : {}),
      };
      const players = resolvePlayers(ctx.state, effect.player, context);
      for (const playerId of effect.anyPlayer ? players.slice(0, 1) : players) {
        addLastingEffect(
          ctx,
          { kind: "costReduction", playerId, amount, ...filter, ...where, ...toZero },
          effect.duration === "untilPlayed"
            ? { kind: "untilCardPlayed", playerId, ...filter }
            : {
                kind:
                  effect.duration === "phase" ? "endOfPhase" : effect.duration === "turn" ? "endOfTurn" : "endOfRound",
              },
        );
      }
      return;
    }
    case "afterNextCardPlayed": {
      const filter = effect.cardFilter ? { cardFilter: effect.cardFilter } : {};
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        addLastingEffect(
          ctx,
          {
            kind: "delayedEffects",
            effects: effect.effects,
            scope: {
              selfInstanceId: frame.selfInstanceId,
              controllerId: frame.controllerId,
              vars: frame.vars,
              bindings: frame.bindings,
            },
          },
          { kind: "untilCardPlayed", playerId, ...filter },
        );
      }
      return;
    }
    case "chooseTarget":
      throw new EngineInvariantError("chooseTarget is handled before applyEffect");
    case "spendResources":
      throw new EngineInvariantError("spendResources is handled before applyEffect");
    case "recordInCampaignLog": {
      // Nothing outside a campaign: the same campaign card, dropped into a standalone game, simply has no log to
      // write to (its deck legality is `validateDeck`'s job, design §8, not this effect's).
      if (!ctx.state.campaign) return;
      const logValue = campaignLogValueOf(ctx, effect.value, context);
      if (!logValue) return;
      // One value, written into each addressed column. A *different* value per seat is `forEachPlayer` around this
      // effect, which is how every other per-player effect in the DSL says it.
      const seatNumbers = effect.seat
        ? resolvePlayers(ctx.state, effect.seat, context).map((id) => campaignSeatNumber(ctx.state, id))
        : [null];
      for (const seatNumber of seatNumbers) {
        if (effect.seat && seatNumber === null) continue;
        recordCampaignWrite(ctx, { field: effect.field, seatNumber, mode: effect.mode, value: logValue });
      }
      return;
    }
    case "removeFromCampaign": {
      if (!ctx.state.campaign) return;
      for (const id of selectCards(ctx, effect.cards, context)) recordCampaignRemoval(ctx, id);
      return;
    }
  }
}

/**
 * "That character uses their THW instead of their ATK" (Befuddle; `modifyBasicPower.useStat`, docs/phase7-wave6.md
 * §3.32): the basic attack being made — the event this effect interrupts, else the attack in progress — is marked
 * `useThw` on its own event frame, which `applyPlayerAttack` reads when it computes the damage.
 */
function useThwForBasicAttack(ctx: Ctx, frame: Frame<"effects">): void {
  const isBasicAttack = (f: StackFrame | undefined): f is Frame<"event"> =>
    f?.kind === "event" && f.event.kind === "attack" && f.event.basic === true;
  const triggering = frame.eventFrameId ? findFrame(ctx.state, frame.eventFrameId) : undefined;
  const activation = currentActivationFrameId(ctx.state.stack);
  const current = activation ? findFrame(ctx.state, activation) : undefined;
  const attack = isBasicAttack(triggering) ? triggering : isBasicAttack(current) ? current : undefined;
  if (!attack) return;
  setFrame(ctx, { ...attack, vars: { ...attack.vars, useThw: 1 } });
  if (attack.event.kind === "attack") setBasicPowerStat(ctx, attack.event.attackerInstanceId, "attack", "thw");
}

/**
 * A card in play turns facedown as nothing in particular (`FacedownRole` `blank`), keeping its controller: no title,
 * text, keywords or abilities until it turns faceup or leaves play (docs/phase7-wave4.md §3.1).
 */
/**
 * A villain's new face revealed by a flip (`flipCard`, `changeVillainForm`) resolves its toughness keyword, as a stage
 * revealed by a defeat does (`defeatVillainStage`): MC60 p. 26 FAQ, when Typhoid Mary (B) flips, "the ability or
 * keyword on her new faceup side resolves" (docs/phase7-wave11-scenarios.md §S3.4). RRG 1.8 "Toughness" (p. 45) speaks
 * only of entering play and is silent on a flip; the product's FAQ answers, and this engine reads it for every villain
 * whose flip is a reveal (FAQ "Dial M for Mojo (#35)"). Placed before the reveal's frames, as at a stage advance; a
 * villain that already holds its tough status card gets no second one (`canTakeStatus`). A change of form that is no
 * reveal (`changeVillainForm` `reveal: false`) resolves nothing of the new face, toughness included.
 */
function villainFaceRevealedByFlip(ctx: Ctx, id: InstanceId): void {
  applyToughness(ctx, id);
}

function turnFacedown(ctx: Ctx, id: InstanceId): void {
  updateInstance(ctx, id, (i) => ({ ...i, faceup: false, facedownAs: { kind: "blank", traits: [] } }));
  emit(ctx, { type: "cardTurnedFacedown", instanceId: id });
}
