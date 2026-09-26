import type { VillainSideLetter } from "@mc/content";
import type { EngineDeps } from "./abilities.js";
import type { EncounterDeckId, FrameId, InstanceId, PlayerId } from "./ids.js";
import {
  emit,
  moveCard,
  relocateCard,
  setStep,
  settlePlayerDecks,
  updateFrame,
  updateInstance,
  updatePlayer,
  type Ctx,
} from "./ctx.js";
import { hasKeyword, isPermanent, statusCapacity, usesKeyword } from "./keywords.js";
import {
  activeEncounterDeckId,
  discardZoneFor,
  encounterDeckOf,
  getInstance,
  heroFacesOf,
  mainSchemeStates,
  mustCard,
  mustCardOf,
  mustInstance,
  modeOnlyFlipped,
  mustPlayer,
  mustVillain,
} from "./query.js";
import type { HostStep, LeavePatch, LeaveRequest, TriggerEvent } from "./trigger-events.js";
import { nextInt, shuffle } from "./rng.js";
import {
  accelerationTokenRedirect,
  cannotLeavePlay,
  leavingPlayLoses,
  cannotReady,
  discardRedirectArea,
  mainSchemeForRedirect,
} from "./rules.js";
import { eventFrame, pushEvent } from "./resolve/frames.js";
import { moveCardsTo } from "./resolve/cards.js";
import { flipSeparatedCard } from "./separated-identity.js";
import { describeFrame, type StackFrame } from "./stack.js";
import { releaseTreatedBy } from "./treat-as.js";
import {
  cardsInPlay,
  controllerOf,
  gliderMainSchemeId,
  handCountTowardHandSize,
  matchesQuery,
  traitsOf,
  type EffectContext,
} from "./select.js";
import { hasCandidates, heard } from "./resolve/triggers.js";
import type { CardDestination, StatusName } from "./spec.js";
import type { GameOutcome, GameState, MainSchemeState, ZoneId } from "./state.js";
import type { LastingDuration, LastingEffect, LastingEffectBody } from "./lasting.js";

/**
 * Low-level state mutators. Nothing in this file opens a timing window or
 * pushes a stack frame — everything that abilities can react to lives in
 * `resolve/` so the ordering rules stay in one place.
 */

/**
 * Flips a player's identity. `voluntary` is the once-per-round player action;
 * a card effect doesn't use it up (RRG "Form, Change Form"). Damage, statuses,
 * attachments and ready state all stay (a separated identity's ready state
 * follows its physical card: `flipSeparatedCard`, docs/phase7-wave5.md §3.24).
 */
export function setForm(
  ctx: Ctx,
  playerId: PlayerId,
  to: "hero" | "alterEgo",
  voluntary: boolean,
  heroFormIndex = 0,
): TriggerEvent | null {
  const player = mustPlayer(ctx.state, playerId);
  const nextIndex = to === "hero" ? heroFormIndex : null;
  const fromIndex = player.identity.heroFormIndex;
  if (player.identity.form === to && fromIndex === nextIndex) return null;
  updatePlayer(ctx, playerId, (p) => ({
    ...p,
    identity: {
      ...p.identity,
      form: to,
      heroFormIndex: nextIndex,
      changedFormThisRound: p.identity.changedFormThisRound || voluntary,
    },
  }));
  // A separated identity flips its other card too (docs/phase7-wave5.md §3.24).
  if (player.identity.form !== to) flipSeparatedCard(ctx, playerId, to);
  // A three-sided identity (docs/phase7-wave2.md §3.2) logs which hero face; every other identity logs as before.
  const card = mustCard(ctx.state, player.identity.cardId);
  const faces = card.type === "hero_identity" ? heroFacesOf(card).length : 1;
  const face = faces > 1 ? { fromHeroFormIndex: fromIndex, heroFormIndex: nextIndex } : {};
  emit(ctx, { type: "formChanged", playerId, to, ...(voluntary ? {} : { byEffect: true }), ...face });
  return {
    kind: "formChanged",
    playerId,
    to,
    change: "identity",
    ...(faces > 1 ? { fromHeroForm: fromIndex, toHeroForm: nextIndex } : {}),
  };
}

/**
 * Swaps a progressing identity for its next version (`EffectSpec swapIdentity`, docs/phase7-wave5.md §3.23): the
 * identity instance and the set-aside instance of the next version trade card ids, so the identity keeps its damage,
 * counters, statuses, attachments, exhaustion and form (RRG 1.8 "Swap", p. 42: the dial "remains at the same value")
 * and the old version sits set aside in the new one's place. Returns false when there is no next version set aside.
 */
export function swapIdentity(ctx: Ctx, playerId: PlayerId): boolean {
  const player = mustPlayer(ctx.state, playerId);
  const fromCardId = player.identity.cardId;
  const card = mustCard(ctx.state, fromCardId);
  if (card.type !== "hero_identity" || !card.progressingIdentity) return false;
  const versions = card.progressingIdentity.versions;
  const toCardId = versions[versions.indexOf(fromCardId) + 1];
  if (!toCardId) return false;
  const setAsideId = player.setAside.find((id) => mustInstance(ctx.state, id).cardId === toCardId);
  if (!setAsideId) return false;
  const identityId = player.identity.instanceId;
  updateInstance(ctx, identityId, (i) => ({ ...i, cardId: toCardId }));
  updateInstance(ctx, setAsideId, (i) => ({ ...i, cardId: fromCardId }));
  updatePlayer(ctx, playerId, (p) => ({ ...p, identity: { ...p.identity, cardId: toCardId } }));
  emit(ctx, { type: "identitySwapped", playerId, instanceId: identityId, fromCardId, toCardId });
  return true;
}

export function endGame(ctx: Ctx, outcome: GameOutcome): void {
  if (ctx.state.outcome) return;
  ctx.state = { ...ctx.state, outcome, pendingChoice: null, stack: [] };
  setStep(ctx, { phase: "gameOver", kind: "gameOver" });
  emit(ctx, { type: "gameEnded", outcome });
}

export function shuffleZone(ctx: Ctx, zone: ZoneId, ids: readonly InstanceId[]): readonly InstanceId[] {
  const [order, rng] = shuffle(ids, ctx.state.rng);
  ctx.state = { ...ctx.state, rng };
  emit(ctx, { type: "deckShuffled", zone, order });
  return order;
}

export function exhaustCard(ctx: Ctx, id: InstanceId): void {
  updateInstance(ctx, id, (i) => ({ ...i, exhausted: true }));
  emit(ctx, { type: "cardExhausted", instanceId: id });
}

export function readyCard(ctx: Ctx, id: InstanceId, sourceInstanceId: InstanceId | null = null): void {
  const instance = mustInstance(ctx.state, id);
  if (!instance.exhausted) return;
  // "… cannot ready" (All Tied Up): RRG 1.8 "'Cannot'" (p. 11) is absolute. "… by player card effects" (Unnatural
  // Storm) reads what readies it.
  if (cannotReady(ctx.state, ctx.deps, id, sourceInstanceId)) return;
  updateInstance(ctx, id, (i) => ({ ...i, exhausted: false }));
  emit(ctx, { type: "cardReadied", instanceId: id });
}

export function healDamage(ctx: Ctx, targetId: InstanceId, amount: number): void {
  const target = mustInstance(ctx.state, targetId);
  const healed = Math.min(amount, target.damage);
  if (healed <= 0) return;
  updateInstance(ctx, targetId, (i) => ({ ...i, damage: i.damage - healed }));
  emit(ctx, { type: "damageHealed", targetInstanceId: targetId, amount: healed });
}

/**
 * RRG "Status Cards": one of each type, two for steady, none for stalwart. Returns whether a card was given — a
 * character already at capacity gets nothing ("if no tough status card was given this way", docs/phase7-wave4.md
 * §3.60).
 */
export function giveStatus(ctx: Ctx, id: InstanceId, status: StatusName): boolean {
  const instance = mustInstance(ctx.state, id);
  const capacity = statusCapacity(ctx.state, id, status, ctx.deps);
  if (instance.statuses[status] >= capacity) return false;
  const held = instance.statuses[status] + 1;
  updateInstance(ctx, id, (i) => ({ ...i, statuses: { ...i.statuses, [status]: held } }));
  emit(ctx, { type: "statusGiven", instanceId: id, status });
  return true;
}

export function removeStatus(ctx: Ctx, id: InstanceId, status: StatusName): void {
  const instance = mustInstance(ctx.state, id);
  if (instance.statuses[status] <= 0) return;
  updateInstance(ctx, id, (i) => ({ ...i, statuses: { ...i.statuses, [status]: 0 } }));
  emit(ctx, { type: "statusRemoved", instanceId: id, status, reason: "effect" });
}

/** RRG "Piercing": tough is discarded before the attack deals damage, so it prevents nothing. */
export function pierceTough(ctx: Ctx, id: InstanceId): void {
  const instance = mustInstance(ctx.state, id);
  if (instance.statuses.tough <= 0) return;
  updateInstance(ctx, id, (i) => ({ ...i, statuses: { ...i.statuses, tough: 0 } }));
  emit(ctx, { type: "statusRemoved", instanceId: id, status: "tough", reason: "piercing" });
}

export function addCounters(ctx: Ctx, id: InstanceId, counterType: string, amount: number): void {
  if (amount <= 0) return;
  updateInstance(ctx, id, (i) => ({
    ...i,
    counters: { ...i.counters, [counterType]: (i.counters[counterType] ?? 0) + amount },
  }));
  emit(ctx, { type: "counterAdded", instanceId: id, counterType, amount });
}

/** `EffectSpec moveCounters` for one card (docs/phase7-wave5.md §3.3): every counter of the type(s) goes to `to`. */
export function moveCounters(ctx: Ctx, from: InstanceId, to: InstanceId, counterType?: string): void {
  if (from === to) return;
  // Acceleration tokens (docs/phase7-wave5.md §3.4): a main scheme's are its `accelerationTokens`, any other card's its
  // `acceleration` counter; "Move … each acceleration token from here to the main scheme" moves them either way.
  if (counterType === undefined || counterType === ACCELERATION_COUNTER) {
    const fromScheme = mainSchemeStates(ctx.state).find((s) => s.instanceId === from);
    const toScheme = mainSchemeStates(ctx.state).find((s) => s.instanceId === to);
    const tokens = fromScheme
      ? fromScheme.accelerationTokens
      : (mustInstance(ctx.state, from).counters[ACCELERATION_COUNTER] ?? 0);
    if (tokens > 0 && (fromScheme || toScheme)) {
      if (fromScheme) updateMainSchemeState(ctx, from, (s) => ({ ...s, accelerationTokens: 0 }));
      else
        updateInstance(ctx, from, (i) => {
          const { [ACCELERATION_COUNTER]: _moved, ...rest } = i.counters;
          return { ...i, counters: rest };
        });
      if (toScheme)
        updateMainSchemeState(ctx, to, (s) => ({ ...s, accelerationTokens: s.accelerationTokens + tokens }));
      else
        updateInstance(ctx, to, (i) => ({
          ...i,
          counters: { ...i.counters, [ACCELERATION_COUNTER]: (i.counters[ACCELERATION_COUNTER] ?? 0) + tokens },
        }));
      emit(ctx, { type: "countersMoved", from, to, counterType: ACCELERATION_COUNTER, amount: tokens });
    }
  }
  const held = mustInstance(ctx.state, from).counters;
  for (const [type, amount] of Object.entries(held)) {
    if ((counterType !== undefined && type !== counterType) || amount <= 0) continue;
    updateInstance(ctx, from, (i) => {
      const { [type]: _moved, ...rest } = i.counters;
      return { ...i, counters: rest };
    });
    updateInstance(ctx, to, (i) => ({ ...i, counters: { ...i.counters, [type]: (i.counters[type] ?? 0) + amount } }));
    emit(ctx, { type: "countersMoved", from, to, counterType: type, amount });
  }
}

export function removeCounters(ctx: Ctx, id: InstanceId, counterType: string, amount: number): number {
  const instance = mustInstance(ctx.state, id);
  const removed = Math.min(amount, instance.counters[counterType] ?? 0);
  if (removed <= 0) return 0;
  updateInstance(ctx, id, (i) => ({
    ...i,
    counters: { ...i.counters, [counterType]: (i.counters[counterType] ?? 0) - removed },
  }));
  emit(ctx, { type: "counterRemoved", instanceId: id, counterType, amount: removed });
  // RRG "Uses (X 'type')": when the last counter is removed from the card, discard it — or, with Victory X, "add this
  // card to the victory display instead of discarding it" (RRG 1.8 "Victory X", p. 46; docs/phase7-wave3.md §3.4).
  const uses = usesKeyword(ctx.state, id, ctx.deps);
  if (uses && uses.counterType === counterType) {
    const left = mustInstance(ctx.state, id).counters[counterType] ?? 0;
    if (left <= 0) {
      if (hasKeyword(ctx.state, id, "victory", ctx.deps)) leavePlay(ctx, id, { kind: "victoryDisplay" });
      else discardFromPlay(ctx, id);
    }
  }
  return removed;
}

/**
 * The top card of an encounter deck (the active villain's unless named), resetting it first if it is empty.
 * RRG 1.8 "Encounter Deck" (p. 17): an empty encounter deck is reset from its discard pile and an acceleration
 * token is placed. The Wrecking Crew insert, "Multiple Villains and Encounter Decks": "When a villain's encounter
 * deck is empty, shuffle its discard pile back into its encounter deck and place an acceleration token" — only
 * that deck resets.
 */
export function drawEncounterCard(
  ctx: Ctx,
  deckId: EncounterDeckId = activeEncounterDeckId(ctx.state),
): InstanceId | null {
  const piles = encounterDeckOf(ctx.state, deckId);
  if (piles.deck.length === 0) {
    if (piles.discard.length === 0) return null;
    const order = shuffleZone(ctx, { kind: "encounterDeck", deckId }, piles.discard);
    ctx.state = {
      ...ctx.state,
      encounterDecks: { ...ctx.state.encounterDecks, [deckId]: { deck: order, discard: [] } },
    };
    addAccelerationToken(ctx);
  }
  return encounterDeckOf(ctx.state, deckId).deck[0] ?? null;
}

/**
 * Turns a villain to its other face on the same stage. Everything on the villain instance stays — damage, statuses,
 * attachments, boost cards, counters (Green Goblin insert, Risky Business "New Rules": "all attachment cards, status
 * cards, boost cards, damage, and other game elements associated with the villain remain as they are"; RRG 1.8
 * "Flip", p. 20).
 *
 * **Except the damage, when either face prints ∞ hit points** (docs/phase7-wave3.md §3.1): the dial is set to the new
 * face's hit points. RRG 1.8 "Flip" is silent on the dial, and the two products that print ∞ both reset it:
 * - The Mad Titan's Shadow rulebook, Hela (MC21 p. 20): "Flipping Hela from her Mystic side to her Wounded side and
 *   vice versa is resolved just like advancing to the next villain stage: her hit points are reset and any status
 *   cards attached to Hela remain attached."
 * - The Collector's ∞ face (`gmw` 16080b): "flip this card, then set Collector's hit point dial to his printed hit
 *   points." Resetting on the flip makes that second clause a no-op rather than leaving a window, between the two
 *   effects, in which the defeat sweep would see the old damage against the front face's hit points.
 * Onto an ∞ face the kept damage could never matter (the remaining hit points are ∞ whatever it is), so clearing it
 * there only keeps a stale number from resurfacing on the next flip.
 */
export function flipVillain(ctx: Ctx, id: InstanceId, to: VillainSideLetter): void {
  const villain = mustVillain(ctx.state, id);
  if (villain.side === to) return;
  const infinite = (side: VillainSideLetter): boolean => {
    const card = ctx.state.cardPool[villain.cardId];
    const face = card?.type === "villain" ? card.sides.find((s) => s.side === side) : undefined;
    return face?.stages[villain.stageIndex]?.infiniteHp === true;
  };
  const reset = infinite(villain.side) || infinite(to);
  ctx.state = { ...ctx.state, villains: ctx.state.villains.map((v) => (v.instanceId === id ? { ...v, side: to } : v)) };
  if (reset) updateInstance(ctx, id, (instance) => ({ ...instance, damage: 0 }));
  emit(ctx, {
    type: "villainFlipped",
    instanceId: id,
    from: villain.side,
    to,
    ...(reset ? { hitPointsReset: true } : {}),
  });
}

/**
 * Moves the active counter (The Wrecking Crew insert, "The Active Villain"). Only an undefeated villain can hold it.
 * `reason` says why it moved in the log: an ability, or the rule that replaces a defeated active villain.
 */
export function setActiveVillain(
  ctx: Ctx,
  to: InstanceId,
  reason: "effect" | "activeVillainDefeated" | "focusedScheme" | "activationOrder" | "noActiveVillain",
): void {
  const from = ctx.state.activeVillainId;
  if (from === to || mustVillain(ctx.state, to).defeated) return;
  ctx.state = { ...ctx.state, activeVillainId: to };
  emit(ctx, { type: "activeVillainChanged", from, to, reason });
}

/** Rewrites a main scheme's state wherever it lives: the central one, or a separate game area's (§3.1). */
export function updateMainSchemeState(
  ctx: Ctx,
  id: InstanceId,
  update: (scheme: MainSchemeState) => MainSchemeState,
): void {
  if (ctx.state.mainScheme.instanceId === id) {
    ctx.state = { ...ctx.state, mainScheme: update(ctx.state.mainScheme) };
    return;
  }
  if (ctx.state.extraMainSchemes?.some((scheme) => scheme.instanceId === id)) {
    ctx.state = {
      ...ctx.state,
      extraMainSchemes: ctx.state.extraMainSchemes.map((scheme) =>
        scheme.instanceId === id ? update(scheme) : scheme,
      ),
    };
    return;
  }
  ctx.state = {
    ...ctx.state,
    gameAreas: ctx.state.gameAreas.map((area) =>
      area.mainScheme?.instanceId === id ? { ...area, mainScheme: update(area.mainScheme) } : area,
    ),
  };
}

/**
 * Places one acceleration token, on the central main scheme unless a card names another stage
 * (`EffectSpec addAccelerationToken.target`). A constant `accelerationTokenDestination` rule may redirect it before
 * it lands ("place it here instead", The Master of Time 2B; docs/phase7-wave2.md §10.3) — read here so the
 * placement stays synchronous and the encounter-deck reset keeps its current ordering.
 *
 * A main scheme stage keeps its tokens in `MainSchemeState.accelerationTokens`; any other card in play holds them as its
 * `acceleration` counter (Tracking Prey, "place 1 acceleration token here"; RRG 1.8 "Acceleration Token", p. 5:
 * "Acceleration tokens placed on cards other than the main scheme still add threat to the main scheme during step one"
 * and "are removed from play when the card they are placed on leaves play"; docs/phase7-wave5.md §3.4). A target out of
 * play is left alone. `schemeInstanceId` is logged only when the token did not go to the central stage, so every
 * existing log line is byte-identical. "After an acceleration token is placed on this scheme" (Hapless Pedestrians 1B)
 * hears `accelerationTokenPlaced`, pushed only when an ability listens.
 */
export function addAccelerationToken(ctx: Ctx, requested?: InstanceId): void {
  // "When an acceleration token would be placed on 'the main scheme,' place it on the scheme with the glider counter"
  // (MC27 p. 17; FAQ, RRG 1.8 p. 62, for a player card's too; docs/phase7-wave5.md §3.3).
  const target = requested ?? gliderMainSchemeId(ctx.state, ctx.deps) ?? ctx.state.mainScheme.instanceId;
  const redirected = accelerationTokenRedirect(ctx.state, ctx.deps, target);
  const to = redirected ?? target;
  if (redirected !== null) emit(ctx, { type: "accelerationTokenRedirected", from: target, to });
  let total: number | null = null;
  updateMainSchemeState(ctx, to, (scheme) => {
    total = scheme.accelerationTokens + 1;
    return { ...scheme, accelerationTokens: total };
  });
  if (total === null) {
    if (!cardsInPlay(ctx.state).includes(to)) return;
    addCounters(ctx, to, ACCELERATION_COUNTER, 1);
  } else {
    const central = to === ctx.state.mainScheme.instanceId;
    emit(ctx, { type: "accelerationTokenAdded", total, ...(central ? {} : { schemeInstanceId: to }) });
  }
  const placed: TriggerEvent = { kind: "accelerationTokenPlaced", instanceId: to };
  if (heard(ctx.state, ctx.deps, placed)) pushEvent(ctx, placed);
}

/** The counter an acceleration token is on a card that is not a main scheme (docs/phase7-wave5.md §3.4). */
export const ACCELERATION_COUNTER = "acceleration";

export function removeAccelerationToken(ctx: Ctx): void {
  // RRG "Acceleration Token": tokens on the main scheme cannot be removed from play.
  if (ctx.state.mainScheme.accelerationTokens <= 0) return;
  ctx.state = {
    ...ctx.state,
    mainScheme: {
      ...ctx.state.mainScheme,
      accelerationTokens: ctx.state.mainScheme.accelerationTokens - 1,
    },
  };
  emit(ctx, { type: "accelerationTokenAdded", total: ctx.state.mainScheme.accelerationTokens });
}

export function dealEncounterCardTo(ctx: Ctx, playerId: PlayerId): InstanceId | null {
  const id = drawEncounterCard(ctx);
  if (!id) return null;
  updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
  moveCard(ctx, id, { kind: "dealtEncounter", playerId });
  return id;
}

/** RRG "Player Deck": an emptied deck reshuffles and costs that player a facedown encounter card. */
function resetPlayerDeck(ctx: Ctx, playerId: PlayerId): boolean {
  const player = mustPlayer(ctx.state, playerId);
  if (player.discard.length === 0) return false;
  const order = shuffleZone(ctx, { kind: "deck", playerId }, player.discard);
  updatePlayer(ctx, playerId, (p) => ({ ...p, deck: order, discard: [] }));
  emit(ctx, { type: "playerDeckReset", playerId });
  // Announced between frames by the flow (`TriggerEvent deckRanOut`, docs/phase7-wave4.md §3.11).
  ctx.state = {
    ...ctx.state,
    pendingDeckRunOuts: [...(ctx.state.pendingDeckRunOuts ?? []), { deck: "player", playerId }],
  };
  dealEncounterCardTo(ctx, playerId);
  return true;
}

/**
 * Resets `playerId`'s deck if it is empty and their discard pile is not (`settlePlayerDecks`, `ctx.ts`, runs it after
 * every move that could make that true). An eliminated player's zones are leaving the game, so never theirs.
 */
export function resetPlayerDeckIfEmpty(ctx: Ctx, playerId: PlayerId): boolean {
  const player = ctx.state.players.find((p) => p.playerId === playerId);
  if (!player || player.eliminated || player.deck.length > 0) return false;
  return resetPlayerDeck(ctx, playerId);
}

/**
 * How many times `playerId`'s deck has been reset so far in this command. A discard from the deck compares it before
 * and after each card: "If the player's deck empties while the player was discarding cards from their deck, no further
 * cards are discarded from the newly shuffled deck" (RRG 1.8 "Player Deck", p. 33).
 */
export const playerDeckResets = (ctx: Ctx, playerId: PlayerId): number =>
  ctx.events.filter((event) => event.type === "playerDeckReset" && event.playerId === playerId).length;

/**
 * The top card of a player's deck. A deck is reset the moment it empties (`settlePlayerDecks`), so it is only found
 * empty here when the discard pile was empty too, or in a state built before that rule (a save, a test's surgery): it
 * is reset here then. Null if deck and discard are both empty.
 */
export function takeTopOfDeck(ctx: Ctx, playerId: PlayerId): InstanceId | null {
  if (mustPlayer(ctx.state, playerId).deck.length === 0 && !resetPlayerDeck(ctx, playerId)) return null;
  return mustPlayer(ctx.state, playerId).deck[0] ?? null;
}

/**
 * "Discard the top card of your deck →" as a cost (`AbilityCost.discardFromDeck`; docs/phase7-wave3.md §3.33). A deck
 * this cost empties is reset at once (`settlePlayerDecks`; ruling, Apr 30, 2026 (3) answer 7), so its facedown
 * encounter card is dealt before the ability's effects resolve, and the discarding stops there (RRG 1.8 "Player Deck",
 * p. 33: "no further cards are discarded from the newly shuffled deck"). `planCost` has already refused a deck that
 * cannot supply every card. Each card moved is logged as `cardMoved`.
 */
export function discardFromDeckAsCost(ctx: Ctx, playerId: PlayerId, count: number): readonly InstanceId[] {
  const discarded: InstanceId[] = [];
  for (let i = 0; i < count; i++) {
    const top = takeTopOfDeck(ctx, playerId);
    if (!top) break;
    const resets = playerDeckResets(ctx, playerId);
    moveCard(ctx, top, { kind: "discard", playerId }, "top");
    discarded.push(top);
    if (playerDeckResets(ctx, playerId) > resets) break;
  }
  return discarded;
}

/**
 * Draws one card at a time. A deck the draw empties is reset at once, after the draw is logged, and the drawing goes on
 * from the new deck (RRG 1.8 "Player Deck", p. 33: "the player continues to draw cards up to the specified number").
 * A drawn obligation goes to the play area (`drawOne`) and still counts as one of the `count` cards drawn.
 */
export function drawCards(ctx: Ctx, playerId: PlayerId, count: number): void {
  for (let i = 0; i < count; i++) {
    if (!drawOne(ctx, playerId)) return;
  }
}

/**
 * Draws one card at a time until `playerId`'s hand holds `target()` cards: refilling to hand size. That is the
 * end-of-phase draw ("checking after each card is drawn whether they are at their hand size", RRG 1.8 "Hand Size",
 * p. 21) and "draw up to your hand size" effects. The setup draw and the mulligan are counted draws instead
 * (`flow.ts`; docs/campaign-mode-design.md Q20).
 * `target` is read again after every card, so a drawn Martial Law's "Your hand size is reduced by 1" counts from the
 * next card on. A drawn obligation is not in hand, so the drawing goes on past it (RRG 1.8 "Obligation", p. 30: "unless
 * they are refilling their hand to their hand size"). Every card drawn leaves deck and discard for good (a reset
 * reshuffles only the discard pile), so this stops at the latest when both are empty.
 */
export function drawUpTo(ctx: Ctx, playerId: PlayerId, target: () => number): void {
  // Cards that do not count toward hand size do not fill it (docs/phase7-wave5.md §3.18).
  while (handCountTowardHandSize(ctx.state, playerId, ctx.deps) < target()) {
    if (!drawOne(ctx, playerId)) return;
  }
}

/**
 * Draws the top card of `playerId`'s deck; false when there is none. An obligation in a player deck (The Rise of Red
 * Skull's expert campaign sets, MC10 p. 17) is drawn but never reaches the hand: "If a player draws an obligation card
 * from their player deck, they place that obligation into their play area" (RRG 1.8 "Obligation", p. 30). It is still
 * an encounter card (MC10 p. 17), so it enters play as a revealed obligation does (`enterPlayOnReveal`): faceup,
 * controlled by nobody (the play area holding it makes it that player's, `useAbility`'s obligation check), and
 * announced as entering play. It is placed, not revealed, so no "When Revealed" ability resolves.
 */
function drawOne(ctx: Ctx, playerId: PlayerId): boolean {
  const top = takeTopOfDeck(ctx, playerId);
  if (!top) return false;
  const obligation = mustCardOf(ctx.state, top).type === "obligation";
  const to: ZoneId = obligation ? { kind: "playArea", playerId } : { kind: "hand", playerId };
  const from = relocateCard(ctx, top, to);
  emit(ctx, { type: "cardDrawn", playerId, instanceId: top });
  if (obligation) {
    updateInstance(ctx, top, (i) => ({ ...i, faceup: true, controllerId: null }));
    emit(ctx, { type: "drawnObligationPlaced", playerId, instanceId: top });
  }
  // An encounter card drawn into the hand (Mysterio, docs/phase7-wave5.md §3.5) is recorded for the flow to announce.
  settlePlayerDecks(ctx, from, to, top);
  if (obligation) pushEvent(ctx, { kind: "cardEntersPlay", instanceId: top, playerId });
  return true;
}

export function discardFromHand(ctx: Ctx, playerId: PlayerId, id: InstanceId): void {
  moveCard(ctx, id, { kind: "discard", playerId }, "top");
  emit(ctx, { type: "cardDiscardedFromHand", playerId, instanceId: id });
}

/**
 * "Discard N cards at random from your hand", one card at a time with the game's seeded RNG, so a replay discards the
 * same cards. Stops early when no eligible card is left; a hand of one still discards it (ruling, Feb 28, 2026 (4)).
 * `exclude` keeps cards out of the pick (the card whose cost this is). Returns the discarded cards in order.
 */
export function discardRandomFromHand(
  ctx: Ctx,
  playerId: PlayerId,
  amount: number,
  exclude: readonly InstanceId[] = [],
): readonly InstanceId[] {
  const discarded: InstanceId[] = [];
  for (let i = 0; i < amount; i++) {
    const hand = mustPlayer(ctx.state, playerId).hand.filter((id) => !exclude.includes(id));
    if (hand.length === 0) break;
    const [index, rng] = nextInt(ctx.state.rng, hand.length);
    ctx.state = { ...ctx.state, rng };
    const picked = hand[index];
    if (!picked) break;
    discardFromHand(ctx, playerId, picked);
    discarded.push(picked);
  }
  return discarded;
}

/** Sends a card in play to the discard pile its `home` names (its owner's, or its encounter deck's). */
export function discardFromPlay(ctx: Ctx, id: InstanceId): void {
  leavePlay(ctx, id, discardZoneFor(ctx.state, id), "top", true);
}

/**
 * `discardFromPlay` for a card leaving play *with* another card and because of it (an attachment as its host leaves, a
 * villain removed or flipped): no "when this leaves play" window of its own before it moves (`leavePlayAtOnce`).
 */
export function discardAtOnce(ctx: Ctx, id: InstanceId): void {
  leavePlayAtOnce(ctx, id, discardZoneFor(ctx.state, id), "top", true);
}

/**
 * A **defeated** ally, minion, side scheme or player side scheme leaves play (RRG 1.8 "Defeat", p. 15: "If an ally,
 * minion, or side scheme is defeated, it is discarded"). RRG 1.8 "Victory X" (p. 46; docs/phase7-wave3.md §3.4):
 * - "A character or side scheme with the victory X keyword is placed in the victory display when it is defeated";
 * - "An attachment or upgrade with the victory X keyword is placed in the victory display when the card to which it is
 *   attached is defeated. (The card the attachment or upgrade was attached to is discarded as normal.)" — so those go
 *   first, before the host's own attachments are discarded with it.
 * Only a defeat does this: a card discarded any other way ("discard this side scheme") goes to its discard pile.
 *
 * "When X leaves play" interrupts (§4.1 Q17 of docs/phase7-wave5.md) see the whole defeat before anything moves, Victory
 * X attachments included: the defeat waits as one `LeaveRequest defeat`.
 */
export function defeatFromPlay(ctx: Ctx, id: InstanceId, insteadTo?: CardDestination): void {
  const instance = getInstance(ctx.state, id);
  if (!instance) return;
  const victory = hasKeyword(ctx.state, id, "victory", ctx.deps);
  const going: ZoneId["kind"] = victory
    ? "victoryDisplay"
    : insteadTo !== undefined
      ? destinationZoneKind(insteadTo)
      : leaveDestinationKind(ctx.state, ctx.deps, id, discardZoneFor(ctx.state, id).kind, true);
  const request: LeaveRequest = { kind: "defeat", ...(insteadTo !== undefined ? { insteadTo } : {}) };
  if (waitsForLeaveInterrupts(ctx, id, request, going)) return;
  for (const attachment of [...instance.attachments]) {
    if (hasKeyword(ctx.state, attachment, "victory", ctx.deps))
      leavePlayAtOnce(ctx, attachment, { kind: "victoryDisplay" });
  }
  if (victory) leavePlay(ctx, id, { kind: "victoryDisplay" });
  // "… instead of discarding it" (a defeat destination, docs/phase7-wave3.md §3.45) replaces only the discard.
  else if (insteadTo !== undefined) moveCardsTo(ctx, [id], insteadTo);
  else discardFromPlay(ctx, id);
}

const LISTENS_FOR_LEAVING_PLAY = new WeakMap<EngineDeps, boolean>();

/** Whether any ability in the registry triggers on `cardLeavesPlay` (docs/phase7-wave5.md §3.13); cached per registry. */
function listensForLeavingPlay(deps: EngineDeps): boolean {
  const cached = LISTENS_FOR_LEAVING_PLAY.get(deps);
  if (cached !== undefined) return cached;
  const listens = Object.values(deps.abilities).some((definition) => {
    const trigger = definition.trigger;
    if (!("on" in trigger) || !trigger.on) return false;
    const kinds = typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on;
    return kinds.includes("cardLeavesPlay");
  });
  LISTENS_FOR_LEAVING_PLAY.set(deps, listens);
  return listens;
}

/**
 * An attachment whose host is leaving play but that cannot leave play itself: permanent (RRG 1.8 "Permanent", p. 32:
 * it cannot "leave play … except by card abilities in the same set", and the host leaving is a game rule, "Attach To",
 * p. 8, not a card ability) or under a "cannot leave play" rule. docs/phase7-wave5.md §3.30.
 */
function staysInPlayWithoutHost(ctx: Ctx, id: InstanceId): boolean {
  return isPermanent(ctx.state, id, ctx.deps) || cannotLeavePlay(ctx.state, ctx.deps, id);
}

/**
 * A permanent encounter attachment with no player owner or controller, whose host leaves play: discarded to its
 * encounter discard pile, permanent notwithstanding (user ruling, docs/phase7-wave5.md §4.2 Q26; no printed card does
 * this yet). "Cannot leave play" stays absolute (RRG 1.8 "'Cannot'", p. 11). Player cards keep §3.30's unattach, and
 * player elimination re-resolves "attach to" instead (`eliminatePlayer`, ruling Mar 19, 2026 (3)).
 */
function discardedWithoutHost(ctx: Ctx, id: InstanceId): boolean {
  const instance = mustInstance(ctx.state, id);
  return instance.ownerId === null && instance.controllerId === null && !cannotLeavePlay(ctx.state, ctx.deps, id);
}

/**
 * "(Return this card to your play area.)" when its host leaves play (Wrist Navigator, `sm` 27189a; docs/phase7-wave5.md
 * §3.30). The card does not leave play: it keeps its state (counters, exhaustion) and its controller, and moves
 * unattached to its controller's play area (its owner's if it has no controller). A player card whose player was
 * eliminated stays in the villain's play area (player elimination itself re-resolves "attach to", `eliminatePlayer`).
 * A permanent encounter card with no player owner or controller does not come here: it is discarded
 * (`discardedWithoutHost`).
 */
function unattachInPlay(ctx: Ctx, id: InstanceId): void {
  const instance = mustInstance(ctx.state, id);
  const playerId = instance.controllerId ?? instance.ownerId;
  const player = playerId === null ? undefined : ctx.state.players.find((p) => p.playerId === playerId);
  const to: ZoneId =
    player !== undefined && !player.eliminated
      ? { kind: "playArea", playerId: player.playerId }
      : { kind: "villainArea" };
  moveCard(ctx, id, to);
}

/** What a leaving card is, read while it is still in play (`TriggerEvent cardLeavesPlay`, docs/phase7-wave5.md §3.13). */
function leavingSnapshot(state: GameState, deps: EngineDeps, id: InstanceId) {
  return {
    instanceId: id,
    cardId: mustInstance(state, id).cardId,
    controllerId: controllerOf(state, id),
    traits: traitsOf(state, id, deps),
  };
}

/**
 * RRG 1.8 "Double-Sided Card" (p. 17): "When a double-sided card would enter an out-of-play area other than the victory
 * display or set-aside area, it is removed from the game."
 */
function removedAsDoubleSided(state: GameState, id: InstanceId, requested: ZoneId["kind"]): boolean {
  const card = state.cardPool[mustInstance(state, id).cardId];
  // A card whose other face is emitted as its own card (`otherFaceId`, docs/phase7-wave4.md §1.7) is double-sided too.
  const doubleSided =
    card !== undefined && (("flipSide" in card && card.flipSide !== undefined) || card.otherFaceId !== undefined);
  const keepsCard = requested === "victoryDisplay" || requested === "setAside" || requested === "encounterSetAside";
  return doubleSided && !keepsCard;
}

/** Where a card leaving play for `requested` is going (double-sided removal, a discard redirect), read before it moves. */
function leaveDestinationKind(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  requested: ZoneId["kind"],
  discarded: boolean,
): ZoneId["kind"] {
  if (removedAsDoubleSided(state, id, requested)) return "removedFromGame";
  if (discarded && discardRedirectArea(state, deps, id) !== null) return "scenarioArea";
  return requested;
}

/** The zone kind a `moveCards` destination names (for a waiting `cardLeavesPlay`'s `to`, before the move). */
export function destinationZoneKind(destination: CardDestination): ZoneId["kind"] {
  if (typeof destination === "object") return "scenarioArea";
  switch (destination) {
    case "deckTop":
    case "deckBottom":
    case "deckShuffle":
      return "deck";
    case "separateDeckTop":
    case "separateDeckShuffle":
      return "separateDeck";
    case "scenarioDeckShuffle":
      return "scenarioDeck";
    case "encounterDeckShuffle":
      return "encounterDeck";
    default:
      return destination;
  }
}

/** Where a card in play that a `moveCards` effect moves to `destination` is going, read before it moves. */
export function moveDestinationKind(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  destination: CardDestination,
): ZoneId["kind"] {
  const discarded = destination === "discard" || destination === "separateDiscard";
  return leaveDestinationKind(state, deps, id, destinationZoneKind(destination), discarded);
}

type EventFrame = Extract<StackFrame, { kind: "event" }>;

/**
 * The `cardLeavesPlay` event with an interrupt window for `id` on the stack (§4.1 Q17 of docs/phase7-wave5.md), if any:
 * stage `interrupts` before it starts, `apply` while its interrupts resolve, `responses` while its apply step moves the
 * card (the apply step drops `leaving` once done, so a later leaving of the same card is a new one).
 */
function leavingFrameFor(state: GameState, id: InstanceId): EventFrame | undefined {
  return state.stack.find(
    (frame): frame is EventFrame =>
      frame.kind === "event" &&
      frame.event.kind === "cardLeavesPlay" &&
      frame.event.leaving !== undefined &&
      frame.event.instanceId === id,
  );
}

/**
 * "Interrupt: When X leaves play" resolves before the card moves, with it still in play (RRG 1.8 "Interrupt", p. 25;
 * ruling Jan 17, 2026 (1) #2: the "Leaves Play" bullets happen *as* it leaves; docs/phase7-wave5.md §4.1 Q17). When
 * an interrupt hears this card leaving, its `cardLeavesPlay` goes on the stack carrying `request`, the move waits for
 * its apply step (`applyLeavingPlay`), and this returns true: the caller stops, and anything it would do to the card
 * afterwards is part of `request`. With nothing listening it returns false and costs one cached registry lookup, so an
 * ordinary game moves the card at once and logs exactly what it did before.
 *
 * The attachments its move takes out of play with it wait too, each as a `withHost` leaving right after it (§4.1 Q32,
 * `leavingWithHost`), and an interrupt hearing only one of them is enough to make the card wait.
 *
 * Several cards waiting from one step go on the stack together, in the order they were asked, and share one interrupt
 * window and one response window (§4.1 Q33; `openLeavingInterrupts`). A card already leaving (its window open, or its
 * apply step moving it) does not wait again.
 */
export function waitsForLeaveInterrupts(
  ctx: Ctx,
  id: InstanceId,
  request: LeaveRequest,
  going: ZoneId["kind"],
): boolean {
  if (!listensForLeavingPlay(ctx.deps)) return false;
  if (!cardsInPlay(ctx.state).includes(id)) return false;
  // Blocked leaves are refused (and logged) by the caller's own path.
  if (isPermanent(ctx.state, id, ctx.deps) || cannotLeavePlay(ctx.state, ctx.deps, id)) return false;
  const already = leavingFrameFor(ctx.state, id);
  if (already) return already.stage === "interrupts";
  const event: TriggerEvent = {
    kind: "cardLeavesPlay",
    ...leavingSnapshot(ctx.state, ctx.deps, id),
    to: going,
    leaving: request,
  };
  const companions = leavingWithHost(ctx, id, request.kind === "defeat" ? "defeat" : "leaveNow");
  const interrupted = (e: TriggerEvent) => hasCandidates(ctx.state, ctx.deps, e, "interrupt");
  if (!interrupted(event) && !companions.some(interrupted)) return false;
  insertWaitingLeaves(ctx, [event, ...companions]);
  return true;
}

/**
 * A change to cards that are not leaving play themselves but take their attachments out of play with them — a villain
 * removed or set aside, a main scheme stage removed or flipped, a card flipped to another type — waits, as `step`, for
 * those attachments' "when this leaves play" interrupts, which resolve while everything is still in play, in one shared
 * window (docs/phase7-wave5.md §4.1 Q32–Q33). The first attachment's `withHost` leaving carries `step` and runs it when
 * it applies (`runHostStep`), calling the same function again, which then goes ahead because the attachments' leavings
 * are already on the stack. Returns true when the caller must stop. With no interrupt hearing any attachment it returns
 * false (a listener for the responses still hears them after the move, `pendingLeftPlay`).
 */
export function waitsForHostStep(ctx: Ctx, hostIds: readonly InstanceId[], step: HostStep): boolean {
  if (!listensForLeavingPlay(ctx.deps)) return false;
  const attachments = hostIds.flatMap((host) => getInstance(ctx.state, host)?.attachments ?? []);
  if (attachments.some((attachment) => leavingFrameFor(ctx.state, attachment) !== undefined)) return false;
  const companions = hostIds.flatMap((host) => leavingWithHost(ctx, host, "atOnce"));
  if (!companions.some((event) => hasCandidates(ctx.state, ctx.deps, event, "interrupt"))) return false;
  const [first, ...rest] = companions;
  if (first?.kind !== "cardLeavesPlay" || first.leaving?.kind !== "withHost") return false;
  insertWaitingLeaves(ctx, [{ ...first, leaving: { ...first.leaving, step } }, ...rest]);
  return true;
}

/**
 * Whether an interrupt hears one of the attachments that leave play with `hostId` when a change takes them out without
 * the host leaving through `leavePlay` (a villain's last stage defeated in a multi-villain game, §4.1 Q32): then the
 * change goes through an event whose interrupt window they can join (`leavingWithHostFrames`).
 */
export function attachmentsWaitForHost(ctx: Ctx, hostId: InstanceId): boolean {
  if (!listensForLeavingPlay(ctx.deps)) return false;
  return leavingWithHost(ctx, hostId, "atOnce").some((event) => hasCandidates(ctx.state, ctx.deps, event, "interrupt"));
}

/**
 * The `cardLeavesPlay` (with `leaving: withHost`) of each attachment on `hostId` that leaves play because the host
 * does, and that something hears (docs/phase7-wave5.md §4.1 Q32). `how` mirrors the path that will move them:
 * - `leaveNow`: the host leaves play (`leaveNow`'s attachment loop: a permanent or "cannot leave play" one stays, an
 *   unowned permanent encounter one is discarded, §4.2 Q26);
 * - `defeat`: the same, but a Victory X one goes to the victory display (`defeatFromPlay`);
 * - `atOnce`: `discardAtOnce` (a villain removed, a stage flipped), which skips a permanent or "cannot leave play" one.
 * An attachment already leaving on its own is not listed.
 */
export function leavingWithHost(
  ctx: Ctx,
  hostId: InstanceId,
  how: "leaveNow" | "defeat" | "atOnce",
): readonly TriggerEvent[] {
  if (!listensForLeavingPlay(ctx.deps)) return [];
  const events: TriggerEvent[] = [];
  for (const attachment of getInstance(ctx.state, hostId)?.attachments ?? []) {
    if (!ctx.state.instances[attachment] || leavingFrameFor(ctx.state, attachment)) continue;
    const blocked = staysInPlayWithoutHost(ctx, attachment);
    const discarded = () =>
      leaveDestinationKind(ctx.state, ctx.deps, attachment, discardZoneFor(ctx.state, attachment).kind, true);
    let to: ZoneId["kind"] | null;
    if (how === "defeat" && hasKeyword(ctx.state, attachment, "victory", ctx.deps))
      to = blocked ? null : "victoryDisplay";
    else if (how === "atOnce") to = blocked ? null : discarded();
    else to = !blocked || discardedWithoutHost(ctx, attachment) ? discarded() : null;
    if (to === null) continue;
    const event: TriggerEvent = {
      kind: "cardLeavesPlay",
      ...leavingSnapshot(ctx.state, ctx.deps, attachment),
      to,
      leaving: { kind: "withHost", host: hostId },
    };
    if (heard(ctx.state, ctx.deps, event)) events.push(event);
  }
  return events;
}

/**
 * Puts waiting `cardLeavesPlay` events on the stack, in order, under any already waiting from the same step (the run of
 * waiting leavings on top of the stack), where the first of them opens one interrupt window for all
 * (`openLeavingInterrupts`, docs/phase7-wave5.md §4.1 Q33).
 */
function insertWaitingLeaves(ctx: Ctx, events: readonly TriggerEvent[]): void {
  const frames = events.map((event) => eventFrame(ctx, event));
  const stack = ctx.state.stack;
  let at = 0;
  while (at < stack.length && isWaitingLeave(stack[at])) at++;
  ctx.state = { ...ctx.state, stack: [...stack.slice(0, at), ...frames, ...stack.slice(at)] };
  for (const frame of frames)
    emit(ctx, { type: "framePushed", frameId: frame.frameId, frame: frame.kind, description: describeFrame(frame) });
}

/** A `cardLeavesPlay` waiting for its interrupt window: on the stack, not yet started. */
export const isWaitingLeave = (frame: StackFrame | undefined): boolean =>
  frame?.kind === "event" &&
  frame.stage === "interrupts" &&
  frame.event.kind === "cardLeavesPlay" &&
  frame.event.leaving !== undefined;

/** A `withHost` leaving's card went `to` with its host (docs/phase7-wave5.md §4.1 Q32): its apply step reports it. */
function recordMovedWithHost(ctx: Ctx, frameId: FrameId, to: ZoneId["kind"]): void {
  updateFrame(ctx, frameId, (f) =>
    f.kind === "event" && f.event.kind === "cardLeavesPlay" && f.event.leaving?.kind === "withHost"
      ? { ...f, event: { ...f.event, leaving: { ...f.event.leaving, moved: to } } }
      : f,
  );
}

/** How `leavePlay` ended: the card moved, it waits for "when X leaves play" interrupts, or it stays in play. */
export type LeaveOutcome = "left" | "waiting" | "stayed";

/**
 * A card leaves play for `to` (discard, hand, deck, removed from game): its attachments are discarded (a permanent one
 * stays in play, `unattachInPlay`) and its in-play state (damage, threat, counters, statuses, exhaust, engagement) is
 * cleared. RRG "Permanent": a permanent card cannot leave play.
 *
 * When a "when X leaves play" interrupt hears it, the card waits in play for that window (`waitsForLeaveInterrupts`)
 * and this returns `"waiting"`; `patch` is what the caller sets on the card once it has left, applied then.
 */
export function leavePlay(
  ctx: Ctx,
  id: InstanceId,
  requested: ZoneId,
  position: "top" | "bottom" = "top",
  discarded = false,
  patch?: LeavePatch,
): LeaveOutcome {
  if (isPermanent(ctx.state, id, ctx.deps)) return "stayed";
  if (cannotLeavePlay(ctx.state, ctx.deps, id)) {
    emit(ctx, { type: "leavePlayBlocked", instanceId: id, reason: "cannotLeavePlay" });
    return "stayed";
  }
  const request: LeaveRequest = { kind: "zone", zone: requested, position, discarded, ...(patch ? { patch } : {}) };
  const going = leaveDestinationKind(ctx.state, ctx.deps, id, requested.kind, discarded);
  if (waitsForLeaveInterrupts(ctx, id, request, going)) return "waiting";
  leaveNow(ctx, id, requested, position, discarded);
  if (patch) applyLeavePatch(ctx, id, patch);
  return "left";
}

/**
 * What a `leavePlay` caller sets on the card once it has left (`LeavePatch`), applied with the move: after any "when it
 * leaves play" interrupt, which saw the card as it was. A new owner ("take it into your hand") also points its `home`
 * at the players' side and is logged (docs/phase7-wave5.md §4.1 Q35).
 */
export function applyLeavePatch(ctx: Ctx, id: InstanceId, patch: LeavePatch): void {
  const { ownerId, ...rest } = patch;
  if (ownerId !== undefined && mustInstance(ctx.state, id).ownerId !== ownerId) {
    updateInstance(ctx, id, (i) => ({ ...i, ownerId, home: { kind: "player" } }));
    emit(ctx, { type: "ownershipChanged", instanceId: id, playerId: ownerId });
  }
  updateInstance(ctx, id, (i) => ({ ...i, ...rest }));
}

/**
 * `leavePlay` without a "when this leaves play" window before the move, for a card leaving with another card and
 * because of it: an attachment or Victory X upgrade as its host leaves, a villain's attachments as it is removed or
 * flipped. RRG 1.8 "Leaves Play" (p. 27) discards them simultaneously with the host (ruling Jan 17, 2026 (1) #2), so
 * they do not wait for a window of their own while the host moves: when an interrupt hears them, their interrupts
 * resolved in the host's window, still in play (docs/phase7-wave5.md §4.1 Q32; their `withHost` leavings record the
 * move). Otherwise a listener hears them after the move (`pendingLeftPlay`).
 */
export function leavePlayAtOnce(
  ctx: Ctx,
  id: InstanceId,
  requested: ZoneId,
  position: "top" | "bottom" = "top",
  discarded = false,
): void {
  if (isPermanent(ctx.state, id, ctx.deps)) return;
  if (cannotLeavePlay(ctx.state, ctx.deps, id)) {
    emit(ctx, { type: "leavePlayBlocked", instanceId: id, reason: "cannotLeavePlay" });
    return;
  }
  leaveNow(ctx, id, requested, position, discarded, true);
}

/**
 * The move itself: the card leaves play now. `withHost`: it leaves because its host does (`leavePlayAtOnce`, the
 * attachment loop below), so a `withHost` leaving of its own on the stack is where the move is recorded (§4.1 Q32).
 */
function leaveNow(
  ctx: Ctx,
  id: InstanceId,
  requested: ZoneId,
  position: "top" | "bottom",
  discarded: boolean,
  withHost = false,
): void {
  // "If Odin leaves play, the players lose the game." (docs/phase7-wave4.md §3.8): read while it is still in play.
  const loses = leavingPlayLoses(ctx.state, ctx.deps, id);
  const instance = mustInstance(ctx.state, id);
  // "When/After X leaves play" (docs/phase7-wave5.md §3.13): what it was, read while it is still in play. Not recorded
  // while its own waiting `cardLeavesPlay` applies (that event's responses follow), nor when it leaves with its host and
  // has a `withHost` leaving whose interrupts resolved in the host's window (that event's responses follow, §4.1 Q32).
  // Recorded for the responses only when it leaves during that event's interrupts, a replacement's "… instead" (§4.1
  // Q17), and then announced once that event ends (§4.1 Q34).
  const leaving = leavingFrameFor(ctx.state, id);
  // A cancelled one ("… instead" left it attached) has no responses of its own: recorded as below.
  const movedWithHost =
    withHost &&
    leaving?.cancelled === false &&
    leaving.event.kind === "cardLeavesPlay" &&
    leaving.event.leaving?.kind === "withHost";
  const left =
    listensForLeavingPlay(ctx.deps) && leaving?.stage !== "responses" && !movedWithHost
      ? {
          ...leavingSnapshot(ctx.state, ctx.deps, id),
          ...(leaving?.stage === "apply" ? { interruptsResolved: true as const } : {}),
        }
      : null;
  const card = ctx.state.cardPool[instance.cardId];
  let to: ZoneId = removedAsDoubleSided(ctx.state, id, requested.kind) ? { kind: "removedFromGame" } : requested;
  // "When a card would be placed into a discard pile from play, put it faceup into The Collection instead"
  // (`discardFromPlayDestination`, docs/phase7-wave3.md §3.14). The discard is still attempted (RRG 1.8 FAQ "Rocket
  // Raccoon (#29A)", p. 61), so it is logged as one.
  const redirect = discarded && to === requested ? discardRedirectArea(ctx.state, ctx.deps, id) : null;
  if (discarded && to === requested)
    emit(ctx, { type: "cardDiscardedFromPlay", instanceId: id, cardId: instance.cardId });
  if (redirect !== null) to = { kind: "scenarioArea", name: redirect.area };
  for (const attachment of [...instance.attachments]) {
    if (!staysInPlayWithoutHost(ctx, attachment)) discardAtOnce(ctx, attachment);
    // Past the permanent keyword on purpose (§4.2 Q26): `leaveNow` itself, not `leavePlayAtOnce`.
    else if (discardedWithoutHost(ctx, attachment))
      leaveNow(ctx, attachment, discardZoneFor(ctx.state, attachment), "top", true, true);
    else unattachInPlay(ctx, attachment);
  }
  // RRG "Tuck": when a card leaves play, each card tucked under it is discarded.
  for (const tuckedId of [...instance.tucked]) {
    // Faceup first: a discard into an emptied deck's discard pile can reset that deck at once (`settlePlayerDecks`).
    updateInstance(ctx, tuckedId, (i) => ({ ...i, faceup: true }));
    moveCard(ctx, tuckedId, discardZoneFor(ctx.state, tuckedId), "top");
  }
  // Boost cards still on an enemy that leaves play mid-activation go with it (RRG 1.8 "Boost": they are discarded).
  for (const boostId of [...instance.boostCards]) moveCard(ctx, boostId, discardZoneFor(ctx.state, boostId), "top");
  moveCard(ctx, id, to, redirect !== null ? "bottom" : position);
  updateInstance(ctx, id, (i) => ({
    ...i,
    damage: 0,
    threat: 0,
    counters: {},
    statuses: { stunned: 0, confused: 0, tough: 0 },
    exhausted: false,
    engagedWith: null,
    // A facedown card is itself again once it leaves play, and a flipped card shows its front — or, for a mode-only
    // card, the face of the mode being played (docs/phase7-wave4.md §3.18).
    facedownAs: null,
    ...(i.treatedAs ? { treatedAs: null } : {}),
    faceup: redirect !== null ? true : i.facedownAs ? true : i.faceup,
    flipped: card !== undefined && modeOnlyFlipped(card, ctx.state.scenarioRules.difficulty ?? "standard"),
  }));
  // "While Karma is in play": a minion it took goes back when it leaves (docs/phase7-wave4.md §3.29).
  releaseTreatedBy(ctx, id);
  if (movedWithHost && leaving) recordMovedWithHost(ctx, leaving.frameId, to.kind);
  else if (left && leaving?.stage === "apply") {
    // It left during its own leaving's interrupt window: announced after that event ends (§4.1 Q34).
    const announced: TriggerEvent = { kind: "cardLeavesPlay", ...left, to: to.kind };
    updateFrame(ctx, leaving.frameId, (f) =>
      f.kind === "event" ? { ...f, announceAfter: [...(f.announceAfter ?? []), announced] } : f,
    );
  } else if (left) {
    ctx.state = {
      ...ctx.state,
      pendingLeftPlay: [...(ctx.state.pendingLeftPlay ?? []), { ...left, to: to.kind }],
    };
  }
  if (loses) endGame(ctx, { result: "loss", reason: "cardAbility" });
  if (redirect !== null) {
    pushEvent(ctx, { kind: "discardRedirected", instanceId: id, area: redirect.area });
    // Collector III's own "…, then place 1 threat on the main scheme" (`thenPlaceThreat`, docs/phase7-wave3.md §3.14):
    // one Forced Interrupt box, so the follow-up runs right after the redirect it belongs to, through the ordinary
    // interruptible `placeThreat` event rather than a second card's response to `discardRedirected`.
    if (redirect.thenPlaceThreat !== undefined) {
      const schemeInstanceId = mainSchemeForRedirect(ctx.state, ctx.deps, redirect);
      if (schemeInstanceId !== null) {
        pushEvent(ctx, {
          kind: "placeThreat",
          schemeInstanceId,
          amount: redirect.thenPlaceThreat,
          sourceInstanceId: redirect.sourceInstanceId,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Lasting effects (RRG "Lasting Effects")
// ---------------------------------------------------------------------------

export function addLastingEffect(ctx: Ctx, body: LastingEffectBody, duration: LastingDuration): LastingEffect {
  const effect = { ...body, id: `l${ctx.state.nextLastingSeq}`, duration } as LastingEffect;
  ctx.state = {
    ...ctx.state,
    lastingEffects: [...ctx.state.lastingEffects, effect],
    nextLastingSeq: ctx.state.nextLastingSeq + 1,
  };
  emit(ctx, { type: "lastingEffectAdded", effect });
  return effect;
}

export function endLastingEffect(
  ctx: Ctx,
  id: string,
  reason: "expired" | "consumed" | "sourceLeftPlay" | "fired",
): void {
  if (!ctx.state.lastingEffects.some((effect) => effect.id === id)) return;
  ctx.state = { ...ctx.state, lastingEffects: ctx.state.lastingEffects.filter((effect) => effect.id !== id) };
  emit(ctx, { type: "lastingEffectEnded", id, reason });
}

/** Removes every lasting effect whose duration ends at this boundary (delayed effects are fired by the caller). */
export function expireLastingEffects(ctx: Ctx, boundary: "endOfPhase" | "endOfRound" | "endOfTurn"): void {
  for (const effect of [...ctx.state.lastingEffects]) {
    if (effect.duration.kind === boundary && effect.kind !== "delayedEffects")
      endLastingEffect(ctx, effect.id, "expired");
  }
}

/**
 * "Until your next turn ends" (docs/phase7-wave2.md §22): `playerId` has just finished a turn, so every
 * `endOfPlayerTurn` effect waiting on one of theirs reaches its timing point — except one created during that very
 * turn, which was waiting for the turn *after* it (`skipRound`, the round that turn belongs to).
 */
export function expirePlayerTurnEffects(ctx: Ctx, playerId: PlayerId): void {
  for (const effect of [...ctx.state.lastingEffects]) {
    const duration = effect.duration;
    if (duration.kind !== "endOfPlayerTurn" || duration.playerId !== playerId) continue;
    if (duration.skipRound === ctx.state.round) continue;
    if (effect.kind === "delayedEffects") continue;
    endLastingEffect(ctx, effect.id, "expired");
  }
}

/**
 * "Increase the amount of damage *that event* deals" (Embiggen!): a bonus that lasts while one card resolves ends
 * when that card's play finishes, so a card returned to hand and replayed in the same phase does not keep it.
 */
export function expireCardResolutionEffects(ctx: Ctx, instanceId: InstanceId): void {
  for (const effect of [...ctx.state.lastingEffects]) {
    if (effect.duration.kind === "endOfCardResolution" && effect.duration.instanceId === instanceId) {
      endLastingEffect(ctx, effect.id, "expired");
    }
  }
}

/** "Until the end of this attack": the attack's event frame is finishing. */
export function expireEventLastingEffects(ctx: Ctx, frameId: string): void {
  for (const effect of [...ctx.state.lastingEffects]) {
    if (effect.duration.kind === "endOfEvent" && effect.duration.frameId === frameId)
      endLastingEffect(ctx, effect.id, "expired");
  }
}

/**
 * Total "reduce the cost of the next card you play" waiting for this player, against a specific card being priced.
 * A `cardFilter`-bearing reduction ("the next Avenger ally played this phase", Avengers Tower) only applies while
 * pricing a card it matches, and keeps waiting through any other card `cardInstanceId` names.
 */
export function costReductionFor(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  cardInstanceId: InstanceId,
): number {
  const context: EffectContext = { selfInstanceId: null, controllerId: playerId, event: null, bindings: {}, deps };
  return state.lastingEffects.reduce((sum, effect) => {
    if (effect.kind !== "costReduction" || effect.playerId !== playerId) return sum;
    if (effect.cardFilter && !matchesQuery(state, cardInstanceId, effect.cardFilter, context)) return sum;
    return sum + effect.amount;
  }, 0);
}

/**
 * A card's play has finished resolving: every lasting effect whose duration is "until this player plays a
 * (matching) card" reaches its timing point now. A `delayedEffects` body with that duration is returned rather than
 * run, so the caller can push it through the stack ("Discard this obligation after you play an event", Physical
 * Toll) — the same split `executeEndOfRound` uses for round-end delayed effects.
 *
 * Distinct from `consumeCostReductions`, which fires earlier (as the cost is paid) and only for `costReduction`
 * bodies, so the reduction/increase applies to the card that consumes it and to nothing played after it.
 */
export function endUntilCardPlayedEffects(
  ctx: Ctx,
  deps: EngineDeps,
  playerId: PlayerId,
  cardInstanceId: InstanceId,
): readonly Extract<LastingEffect, { kind: "delayedEffects" }>[] {
  const context: EffectContext = { selfInstanceId: null, controllerId: playerId, event: null, bindings: {}, deps };
  const fired: Extract<LastingEffect, { kind: "delayedEffects" }>[] = [];
  for (const effect of [...ctx.state.lastingEffects]) {
    const duration = effect.duration;
    if (duration.kind !== "untilCardPlayed" || duration.playerId !== playerId) continue;
    if (duration.cardFilter && !matchesQuery(ctx.state, cardInstanceId, duration.cardFilter, context)) continue;
    if (effect.kind === "delayedEffects") fired.push(effect);
    endLastingEffect(ctx, effect.id, effect.kind === "delayedEffects" ? "fired" : "expired");
  }
  return fired;
}

/** The player just played a card: every pending "next card" reduction that card matches is used up. */
export function consumeCostReductions(
  ctx: Ctx,
  deps: EngineDeps,
  playerId: PlayerId,
  cardInstanceId: InstanceId,
): void {
  const context: EffectContext = { selfInstanceId: null, controllerId: playerId, event: null, bindings: {}, deps };
  for (const effect of [...ctx.state.lastingEffects]) {
    if (effect.kind !== "costReduction" || effect.playerId !== playerId) continue;
    if (effect.cardFilter && !matchesQuery(ctx.state, cardInstanceId, effect.cardFilter, context)) continue;
    endLastingEffect(ctx, effect.id, "consumed");
  }
}
