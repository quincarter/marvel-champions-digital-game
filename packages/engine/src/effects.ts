import type { VillainSideLetter } from "@mc/content";
import type { EngineDeps } from "./abilities.js";
import type { EncounterDeckId, InstanceId, PlayerId } from "./ids.js";
import {
  emit,
  moveCard,
  relocateCard,
  setStep,
  settlePlayerDecks,
  updateInstance,
  updatePlayer,
  type Ctx,
} from "./ctx.js";
import { hasKeyword, statusCapacity, usesKeyword } from "./keywords.js";
import {
  activeEncounterDeckId,
  discardZoneFor,
  encounterDeckOf,
  getInstance,
  heroFacesOf,
  mustCard,
  mustCardOf,
  mustInstance,
  modeOnlyFlipped,
  mustPlayer,
  mustVillain,
} from "./query.js";
import type { TriggerEvent } from "./trigger-events.js";
import { nextInt, shuffle } from "./rng.js";
import {
  accelerationTokenRedirect,
  cannotLeavePlay,
  leavingPlayLoses,
  cannotReady,
  discardRedirectArea,
  mainSchemeForRedirect,
} from "./rules.js";
import { pushEvent } from "./resolve/frames.js";
import { releaseTreatedBy } from "./treat-as.js";
import { matchesQuery, type EffectContext } from "./select.js";
import type { StatusName } from "./spec.js";
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
 * attachments and ready state all stay.
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
  reason: "effect" | "activeVillainDefeated" | "focusedScheme",
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
 * Only a main scheme stage holds acceleration tokens in this model; a target that is not one is left alone.
 * `schemeInstanceId` is logged only when the token did not go to the central stage, so every existing log line is
 * byte-identical.
 */
export function addAccelerationToken(ctx: Ctx, target: InstanceId = ctx.state.mainScheme.instanceId): void {
  const redirected = accelerationTokenRedirect(ctx.state, ctx.deps, target);
  const to = redirected ?? target;
  if (redirected !== null) emit(ctx, { type: "accelerationTokenRedirected", from: target, to });
  let total: number | null = null;
  updateMainSchemeState(ctx, to, (scheme) => {
    total = scheme.accelerationTokens + 1;
    return { ...scheme, accelerationTokens: total };
  });
  if (total === null) return;
  const central = to === ctx.state.mainScheme.instanceId;
  emit(ctx, { type: "accelerationTokenAdded", total, ...(central ? {} : { schemeInstanceId: to }) });
}

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
  while (mustPlayer(ctx.state, playerId).hand.length < target()) {
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
  settlePlayerDecks(ctx, from, to);
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
 * A **defeated** ally, minion, side scheme or player side scheme leaves play (RRG 1.8 "Defeat", p. 15: "If an ally,
 * minion, or side scheme is defeated, it is discarded"). RRG 1.8 "Victory X" (p. 46; docs/phase7-wave3.md §3.4):
 * - "A character or side scheme with the victory X keyword is placed in the victory display when it is defeated";
 * - "An attachment or upgrade with the victory X keyword is placed in the victory display when the card to which it is
 *   attached is defeated. (The card the attachment or upgrade was attached to is discarded as normal.)" — so those go
 *   first, before the host's own attachments are discarded with it.
 * Only a defeat does this: a card discarded any other way ("discard this side scheme") goes to its discard pile.
 */
export function defeatFromPlay(ctx: Ctx, id: InstanceId, insteadOfDiscard?: () => void): void {
  const instance = getInstance(ctx.state, id);
  if (!instance) return;
  for (const attachment of [...instance.attachments]) {
    if (hasKeyword(ctx.state, attachment, "victory", ctx.deps)) leavePlay(ctx, attachment, { kind: "victoryDisplay" });
  }
  if (hasKeyword(ctx.state, id, "victory", ctx.deps)) leavePlay(ctx, id, { kind: "victoryDisplay" });
  // "… instead of discarding it" (a defeat destination, docs/phase7-wave3.md §3.45) replaces only the discard.
  else if (insteadOfDiscard) insteadOfDiscard();
  else discardFromPlay(ctx, id);
}

/**
 * A card leaves play for `to` (discard, hand, deck, removed from game): its
 * attachments are discarded and its in-play state (damage, threat, counters,
 * statuses, exhaust, engagement) is cleared. RRG "Permanent": a permanent card
 * cannot leave play.
 */
export function leavePlay(
  ctx: Ctx,
  id: InstanceId,
  requested: ZoneId,
  position: "top" | "bottom" = "top",
  discarded = false,
): void {
  if (hasKeyword(ctx.state, id, "permanent", ctx.deps)) return;
  if (cannotLeavePlay(ctx.state, ctx.deps, id)) {
    emit(ctx, { type: "leavePlayBlocked", instanceId: id, reason: "cannotLeavePlay" });
    return;
  }
  // "If Odin leaves play, the players lose the game." (docs/phase7-wave4.md §3.8): read while it is still in play.
  const loses = leavingPlayLoses(ctx.state, ctx.deps, id);
  const instance = mustInstance(ctx.state, id);
  // RRG 1.8 "Double-Sided Card" (p. 17): "When a double-sided card would enter an out-of-play area other than the
  // victory display or set-aside area, it is removed from the game."
  const card = ctx.state.cardPool[instance.cardId];
  // A card whose other face is emitted as its own card (`otherFaceId`, docs/phase7-wave4.md §1.7) is double-sided too.
  const doubleSided =
    card !== undefined && (("flipSide" in card && card.flipSide !== undefined) || card.otherFaceId !== undefined);
  const keepsCard =
    requested.kind === "victoryDisplay" || requested.kind === "setAside" || requested.kind === "encounterSetAside";
  let to: ZoneId = doubleSided && !keepsCard ? { kind: "removedFromGame" } : requested;
  // "When a card would be placed into a discard pile from play, put it faceup into The Collection instead"
  // (`discardFromPlayDestination`, docs/phase7-wave3.md §3.14). The discard is still attempted (RRG 1.8 FAQ "Rocket
  // Raccoon (#29A)", p. 61), so it is logged as one.
  const redirect = discarded && to === requested ? discardRedirectArea(ctx.state, ctx.deps, id) : null;
  if (discarded && to === requested)
    emit(ctx, { type: "cardDiscardedFromPlay", instanceId: id, cardId: instance.cardId });
  if (redirect !== null) to = { kind: "scenarioArea", name: redirect.area };
  for (const attachment of [...instance.attachments]) discardFromPlay(ctx, attachment);
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
