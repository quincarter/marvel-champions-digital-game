import type { EncounterDeckId, InstanceId, PlayerId } from "./ids.js";
import { emit, moveCard, setStep, updateInstance, updatePlayer, type Ctx } from "./ctx.js";
import { hasKeyword, statusCapacity, usesKeyword } from "./keywords.js";
import { activeEncounterDeckId, discardZoneFor, encounterDeckOf, mustInstance, mustPlayer, mustVillain } from "./query.js";
import { shuffle } from "./rng.js";
import { cannotLeavePlay, cannotReady } from "./rules.js";
import type { StatusName } from "./spec.js";
import type { GameOutcome, GameState, ZoneId } from "./state.js";
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
export function setForm(ctx: Ctx, playerId: PlayerId, to: "hero" | "alterEgo", voluntary: boolean): void {
  const player = mustPlayer(ctx.state, playerId);
  if (player.identity.form === to) return;
  updatePlayer(ctx, playerId, (p) => ({
    ...p,
    identity: { ...p.identity, form: to, changedFormThisRound: p.identity.changedFormThisRound || voluntary },
  }));
  emit(ctx, { type: "formChanged", playerId, to, ...(voluntary ? {} : { byEffect: true }) });
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

export function readyCard(ctx: Ctx, id: InstanceId): void {
  const instance = mustInstance(ctx.state, id);
  if (!instance.exhausted) return;
  // "… cannot ready" (All Tied Up): RRG 1.8 "'Cannot'" (p. 11) is absolute.
  if (cannotReady(ctx.state, ctx.deps, id)) return;
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

/** RRG "Status Cards": one of each type, two for steady, none for stalwart. */
export function giveStatus(ctx: Ctx, id: InstanceId, status: StatusName): void {
  const instance = mustInstance(ctx.state, id);
  const capacity = statusCapacity(ctx.state, id, status, ctx.deps);
  if (instance.statuses[status] >= capacity) return;
  const held = instance.statuses[status] + 1;
  updateInstance(ctx, id, (i) => ({ ...i, statuses: { ...i.statuses, [status]: held } }));
  emit(ctx, { type: "statusGiven", instanceId: id, status });
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
  // RRG "Uses (X 'type')": when the last counter is removed from the card, discard it.
  const uses = usesKeyword(ctx.state, id, ctx.deps);
  if (uses && uses.counterType === counterType) {
    const left = mustInstance(ctx.state, id).counters[counterType] ?? 0;
    if (left <= 0) discardFromPlay(ctx, id);
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
export function drawEncounterCard(ctx: Ctx, deckId: EncounterDeckId = activeEncounterDeckId(ctx.state)): InstanceId | null {
  const piles = encounterDeckOf(ctx.state, deckId);
  if (piles.deck.length === 0) {
    if (piles.discard.length === 0) return null;
    const order = shuffleZone(ctx, { kind: "encounterDeck", deckId }, piles.discard);
    ctx.state = { ...ctx.state, encounterDecks: { ...ctx.state.encounterDecks, [deckId]: { deck: order, discard: [] } } };
    addAccelerationToken(ctx);
  }
  return encounterDeckOf(ctx.state, deckId).deck[0] ?? null;
}

/**
 * Turns a villain to its other face on the same stage. Everything on the villain instance stays — damage, statuses,
 * attachments, boost cards, counters (Green Goblin insert, Risky Business "New Rules": "all attachment cards, status
 * cards, boost cards, damage, and other game elements associated with the villain remain as they are"; RRG 1.8
 * "Flip", p. 20).
 */
export function flipVillain(ctx: Ctx, id: InstanceId, to: "A" | "B"): void {
  const villain = mustVillain(ctx.state, id);
  if (villain.side === to) return;
  ctx.state = { ...ctx.state, villains: ctx.state.villains.map((v) => (v.instanceId === id ? { ...v, side: to } : v)) };
  emit(ctx, { type: "villainFlipped", instanceId: id, from: villain.side, to });
}

/**
 * Moves the active counter (The Wrecking Crew insert, "The Active Villain"). Only an undefeated villain can hold it.
 * `reason` says why it moved in the log: an ability, or the rule that replaces a defeated active villain.
 */
export function setActiveVillain(ctx: Ctx, to: InstanceId, reason: "effect" | "activeVillainDefeated"): void {
  const from = ctx.state.activeVillainId;
  if (from === to || mustVillain(ctx.state, to).defeated) return;
  ctx.state = { ...ctx.state, activeVillainId: to };
  emit(ctx, { type: "activeVillainChanged", from, to, reason });
}

export function addAccelerationToken(ctx: Ctx): void {
  ctx.state = {
    ...ctx.state,
    mainScheme: {
      ...ctx.state.mainScheme,
      accelerationTokens: ctx.state.mainScheme.accelerationTokens + 1,
    },
  };
  emit(ctx, { type: "accelerationTokenAdded", total: ctx.state.mainScheme.accelerationTokens });
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
  dealEncounterCardTo(ctx, playerId);
  return true;
}

/**
 * The top card of a player's deck, resetting the deck first if it is empty (RRG
 * "Player Deck": reshuffle the discard pile and deal that player a facedown
 * encounter card). Null if deck and discard are both empty.
 */
export function takeTopOfDeck(ctx: Ctx, playerId: PlayerId): InstanceId | null {
  if (mustPlayer(ctx.state, playerId).deck.length === 0 && !resetPlayerDeck(ctx, playerId)) return null;
  return mustPlayer(ctx.state, playerId).deck[0] ?? null;
}

export function drawCards(ctx: Ctx, playerId: PlayerId, count: number): void {
  for (let i = 0; i < count; i++) {
    let player = mustPlayer(ctx.state, playerId);
    if (player.deck.length === 0 && !resetPlayerDeck(ctx, playerId)) return;
    player = mustPlayer(ctx.state, playerId);
    const top = player.deck[0];
    if (!top) return;
    moveCard(ctx, top, { kind: "hand", playerId });
    emit(ctx, { type: "cardDrawn", playerId, instanceId: top });
  }
}

export function discardFromHand(ctx: Ctx, playerId: PlayerId, id: InstanceId): void {
  moveCard(ctx, id, { kind: "discard", playerId }, "top");
  emit(ctx, { type: "cardDiscardedFromHand", playerId, instanceId: id });
}

/** Sends a card in play to the discard pile its `home` names (its owner's, or its encounter deck's). */
export function discardFromPlay(ctx: Ctx, id: InstanceId): void {
  leavePlay(ctx, id, discardZoneFor(ctx.state, id), "top", true);
}

/**
 * A card leaves play for `to` (discard, hand, deck, removed from game): its
 * attachments are discarded and its in-play state (damage, threat, counters,
 * statuses, exhaust, engagement) is cleared. RRG "Permanent": a permanent card
 * cannot leave play.
 */
export function leavePlay(ctx: Ctx, id: InstanceId, requested: ZoneId, position: "top" | "bottom" = "top", discarded = false): void {
  if (hasKeyword(ctx.state, id, "permanent", ctx.deps)) return;
  if (cannotLeavePlay(ctx.state, ctx.deps, id)) {
    emit(ctx, { type: "leavePlayBlocked", instanceId: id, reason: "cannotLeavePlay" });
    return;
  }
  const instance = mustInstance(ctx.state, id);
  // RRG 1.8 "Double-Sided Card" (p. 17): "When a double-sided card would enter an out-of-play area other than the
  // victory display or set-aside area, it is removed from the game."
  const card = ctx.state.cardPool[instance.cardId];
  const doubleSided = card !== undefined && "flipSide" in card && card.flipSide !== undefined;
  const keepsCard = requested.kind === "victoryDisplay" || requested.kind === "setAside" || requested.kind === "encounterSetAside";
  const to: ZoneId = doubleSided && !keepsCard ? { kind: "removedFromGame" } : requested;
  if (discarded && to === requested) emit(ctx, { type: "cardDiscardedFromPlay", instanceId: id, cardId: instance.cardId });
  for (const attachment of [...instance.attachments]) discardFromPlay(ctx, attachment);
  // RRG "Tuck": when a card leaves play, each card tucked under it is discarded.
  for (const tuckedId of [...instance.tucked]) {
    moveCard(ctx, tuckedId, discardZoneFor(ctx.state, tuckedId), "top");
    updateInstance(ctx, tuckedId, (i) => ({ ...i, faceup: true }));
  }
  // Boost cards still on an enemy that leaves play mid-activation go with it (RRG 1.8 "Boost": they are discarded).
  for (const boostId of [...instance.boostCards]) moveCard(ctx, boostId, discardZoneFor(ctx.state, boostId), "top");
  moveCard(ctx, id, to, position);
  updateInstance(ctx, id, (i) => ({
    ...i,
    damage: 0,
    threat: 0,
    counters: {},
    statuses: { stunned: 0, confused: 0, tough: 0 },
    exhausted: false,
    engagedWith: null,
    // A facedown card is itself again once it leaves play, and a flipped card shows its front.
    facedownAs: null,
    faceup: i.facedownAs ? true : i.faceup,
    flipped: false,
  }));
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

export function endLastingEffect(ctx: Ctx, id: string, reason: "expired" | "consumed" | "sourceLeftPlay" | "fired"): void {
  if (!ctx.state.lastingEffects.some((effect) => effect.id === id)) return;
  ctx.state = { ...ctx.state, lastingEffects: ctx.state.lastingEffects.filter((effect) => effect.id !== id) };
  emit(ctx, { type: "lastingEffectEnded", id, reason });
}

/** Removes every lasting effect whose duration ends at this boundary (delayed effects are fired by the caller). */
export function expireLastingEffects(ctx: Ctx, boundary: "endOfPhase" | "endOfRound"): void {
  for (const effect of [...ctx.state.lastingEffects]) {
    if (effect.duration.kind === boundary && effect.kind !== "delayedEffects") endLastingEffect(ctx, effect.id, "expired");
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
    if (effect.duration.kind === "endOfEvent" && effect.duration.frameId === frameId) endLastingEffect(ctx, effect.id, "expired");
  }
}

/** Total "reduce the cost of the next card you play" waiting for this player. */
export const costReductionFor = (state: GameState, playerId: PlayerId): number =>
  state.lastingEffects.reduce(
    (sum, effect) => (effect.kind === "costReduction" && effect.playerId === playerId ? sum + effect.amount : sum),
    0,
  );

/** The player just played a card: every pending "next card" reduction is used up. */
export function consumeCostReductions(ctx: Ctx, playerId: PlayerId): void {
  for (const effect of [...ctx.state.lastingEffects]) {
    if (effect.kind === "costReduction" && effect.playerId === playerId) endLastingEffect(ctx, effect.id, "consumed");
  }
}
