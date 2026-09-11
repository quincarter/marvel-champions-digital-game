import type { InstanceId, PlayerId } from "./ids.js";
import { emit, moveCard, setStep, updateInstance, updatePlayer, type Ctx } from "./ctx.js";
import { hasKeyword, statusCapacity, usesKeyword } from "./keywords.js";
import { mustInstance, mustPlayer } from "./query.js";
import { shuffle } from "./rng.js";
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

/** RRG "Encounter Deck": resetting an empty encounter deck adds an acceleration token. */
export function drawEncounterCard(ctx: Ctx): InstanceId | null {
  if (ctx.state.encounterDeck.length === 0) {
    if (ctx.state.encounterDiscard.length === 0) return null;
    const order = shuffleZone(ctx, { kind: "encounterDeck" }, ctx.state.encounterDiscard);
    ctx.state = { ...ctx.state, encounterDeck: order, encounterDiscard: [] };
    addAccelerationToken(ctx);
  }
  return ctx.state.encounterDeck[0] ?? null;
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

/** Sends a card in play to its owner's discard (encounter discard for encounter cards). */
export function discardFromPlay(ctx: Ctx, id: InstanceId): void {
  const instance = mustInstance(ctx.state, id);
  const to: ZoneId = instance.ownerId
    ? { kind: "discard", playerId: instance.ownerId }
    : { kind: "encounterDiscard" };
  leavePlay(ctx, id, to, "top", true);
}

/**
 * A card leaves play for `to` (discard, hand, deck, removed from game): its
 * attachments are discarded and its in-play state (damage, threat, counters,
 * statuses, exhaust, engagement) is cleared. RRG "Permanent": a permanent card
 * cannot leave play.
 */
export function leavePlay(ctx: Ctx, id: InstanceId, to: ZoneId, position: "top" | "bottom" = "top", discarded = false): void {
  if (hasKeyword(ctx.state, id, "permanent", ctx.deps)) return;
  const instance = mustInstance(ctx.state, id);
  if (discarded) emit(ctx, { type: "cardDiscardedFromPlay", instanceId: id, cardId: instance.cardId });
  for (const attachment of [...instance.attachments]) discardFromPlay(ctx, attachment);
  // RRG "Tuck": when a card leaves play, each card tucked under it is discarded.
  for (const tuckedId of [...instance.tucked]) {
    const owner = mustInstance(ctx.state, tuckedId).ownerId;
    moveCard(ctx, tuckedId, owner ? { kind: "discard", playerId: owner } : { kind: "encounterDiscard" }, "top");
    updateInstance(ctx, tuckedId, (i) => ({ ...i, faceup: true }));
  }
  moveCard(ctx, id, to, position);
  updateInstance(ctx, id, (i) => ({
    ...i,
    damage: 0,
    threat: 0,
    counters: {},
    statuses: { stunned: 0, confused: 0, tough: 0 },
    exhausted: false,
    engagedWith: null,
    // A facedown card is itself again once it leaves play.
    facedownAs: null,
    faceup: i.facedownAs ? true : i.faceup,
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
