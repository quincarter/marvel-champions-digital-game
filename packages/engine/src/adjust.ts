/**
 * Manual adjustments (`Command adjust`, issue #791): a player corrects the game state by hand from the pause menu,
 * after a bug or a misclick.
 *
 * **Not an RRG rule.** Like `concede`, this is a digital-implementation affordance, so its behavior is our decision,
 * written down here rather than implied. One policy runs through every kind:
 *
 * - **The adjustment itself is not a game event.** It opens no interrupt or response window of its own: placing damage
 *   here is not damage dealt (no toughness, retaliate, "after X takes damage"), threat placed or removed here is no
 *   scheme or thwart (no crisis, patrol, acceleration, "after threat is placed"), a status card removed here is not
 *   announced as discarded, and a form change here has no "when/after you change form" window. A correction should put
 *   the table where it should have been, not set off card text a second time.
 * - **Player-action limits and costs are skipped.** The once-per-round form change and its costs, "cannot be healed",
 *   "cannot ready", crisis and patrol: they govern what a player may *do*, and this is a repair, not a play.
 * - **The game's standing rules still follow from the new state**, because the engine keeps them as invariants and
 *   would apply them anyway: a character at zero hit points is defeated (its When Defeated and its leave-play windows
 *   resolve as for any defeat), a side scheme left with no threat is defeated, a main scheme at its target threat is
 *   completed, a uses card emptied of its counters is discarded, a vulnerable character given a stun or confuse is
 *   discarded, and a card discarded from play goes through `discardFromPlay` (its "when this leaves play" interrupts,
 *   its attachments with it; a "cannot leave play" card stays and the refusal is logged, and discarding a permanent
 *   card is refused outright). Status card
 *   capacity (one of each, steady two, stalwart none), counter limits and sustained damage caps hold too: giving a
 *   status card a character cannot hold is refused, and placed damage or counters stop at the cap, as the
 *   state checks between frames would otherwise shed them again.
 * - **Drawing is drawing** (`drawCards`): an emptied deck resets with its encounter card, a drawn obligation enters
 *   play, and "after this card enters your hand" answers, exactly as a card effect's draw does.
 *
 * Every adjustment logs `manualAdjustment` first, then the ordinary events of what it changed. A refused adjustment is
 * an `EngineError` and changes nothing.
 */

import type { Adjustment, Command } from "./commands.js";
import { emit, pushFrames, updateInstance, type Ctx } from "./ctx.js";
import {
  addCounters,
  discardFromHand,
  discardFromPlay,
  drawCards,
  exhaustCard,
  giveStatus,
  permanentStopsLeaving,
  removeCounters,
  removeStatus,
  setForm,
} from "./effects.js";
import { engineError, type EngineError } from "./errors.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { getInstance, getPlayer, heroFacesOf, mainSchemeStateOf, mustCardOf } from "./query.js";
import { checkDefeats, checkOneMainScheme } from "./resolve/defeat.js";
import { eventFrame } from "./resolve/frames.js";
import { notDefeatedWithoutThreat, sustainedDamageAllowance } from "./rules.js";
import { cardsInPlay, categoriesOf } from "./select.js";

type AdjustCommand = Command & { type: "adjust" };

export function adjust(ctx: Ctx, command: AdjustCommand): EngineError | null {
  const fault = seatFault(ctx, command.playerId, command);
  if (fault) return fault;
  const { adjustment } = command;
  const invalid = adjustmentFault(ctx, adjustment, command);
  if (invalid) return invalid;
  emit(ctx, { type: "manualAdjustment", playerId: command.playerId, adjustment });
  return applyAdjustment(ctx, adjustment, command);
}

/** A seat that may act: at the table and not eliminated (RRG 1.8 "Player Elimination", p. 33), as for `concede`. */
function seatFault(ctx: Ctx, playerId: PlayerId, command: AdjustCommand): EngineError | null {
  const player = getPlayer(ctx.state, playerId);
  if (!player) return engineError("unknown_player", `${playerId} is not at this table`, command);
  if (player.eliminated) return engineError("not_active_player", `${playerId} is out of the game`, command);
  return null;
}

const inPlay = (ctx: Ctx, id: InstanceId): boolean => cardsInPlay(ctx.state).includes(id);

/** Why `amount` cannot be an adjustment's amount: a whole number, not 0. */
const amountFault = (amount: number, command: AdjustCommand): EngineError | null =>
  Number.isInteger(amount) && amount !== 0
    ? null
    : engineError("invalid_choice", "the amount must be a whole number other than 0", command);

/** The checks that need no change to the state: the target exists, is where the kind needs it, and the amount is sane. */
function adjustmentFault(ctx: Ctx, adjustment: Adjustment, command: AdjustCommand): EngineError | null {
  if (adjustment.kind === "draw") {
    if (!Number.isInteger(adjustment.count) || adjustment.count <= 0)
      return engineError("invalid_choice", "draw a whole number of cards, at least 1", command);
    return seatFault(ctx, adjustment.playerId, command);
  }
  if (adjustment.kind === "changeForm") return seatFault(ctx, adjustment.playerId, command);
  const id = adjustment.instanceId;
  if (!getInstance(ctx.state, id)) return engineError("unknown_instance", `no card ${id}`, command);
  const categories = categoriesOf(ctx.state, id);
  switch (adjustment.kind) {
    case "discardFromHand":
      return handHolding(ctx, id)
        ? null
        : engineError("card_not_in_zone", "that card is not in a player's hand", command);
    case "discardFromPlay":
      if (!inPlay(ctx, id)) return engineError("card_not_in_zone", "that card is not in play", command);
      if (categories.includes("identity") || categories.includes("villain") || mainSchemeStateOf(ctx.state, id))
        return engineError("no_valid_target", "an identity, a villain or a main scheme cannot be discarded", command);
      return null;
    case "damage":
      if (!inPlay(ctx, id) || !categories.includes("character"))
        return engineError("no_valid_target", "damage goes on a character in play", command);
      return amountFault(adjustment.amount, command);
    case "threat":
      if (!inPlay(ctx, id) || !categories.includes("scheme"))
        return engineError("no_valid_target", "threat goes on a main or side scheme in play", command);
      return amountFault(adjustment.amount, command);
    case "counters":
      if (!inPlay(ctx, id)) return engineError("card_not_in_zone", "that card is not in play", command);
      if (adjustment.counterType.length === 0)
        return engineError("invalid_choice", "name the type of counter", command);
      return amountFault(adjustment.amount, command);
    case "status":
      if (!inPlay(ctx, id) || !categories.includes("character"))
        return engineError("no_valid_target", "status cards go on a character in play", command);
      return null;
    case "exhaust":
    case "ready":
      return inPlay(ctx, id) ? null : engineError("card_not_in_zone", "that card is not in play", command);
  }
}

/** The player whose hand holds `id`, or null. */
function handHolding(ctx: Ctx, id: InstanceId): PlayerId | null {
  return ctx.state.players.find((player) => player.hand.includes(id))?.playerId ?? null;
}

function applyAdjustment(ctx: Ctx, adjustment: Adjustment, command: AdjustCommand): EngineError | null {
  switch (adjustment.kind) {
    case "draw":
      drawCards(ctx, adjustment.playerId, adjustment.count);
      return null;
    case "discardFromHand":
      discardFromHand(ctx, handHolding(ctx, adjustment.instanceId)!, adjustment.instanceId);
      return null;
    case "discardFromPlay":
      // No source card: the game's own discard. A permanent card can't be discarded (RRG 1.8 "Permanent", p. 32); any
      // other refusal ("cannot leave play") is logged as `leavePlayBlocked` by the discard itself.
      // A refused discard is refused here, so a command that changes nothing never marks a game adjusted.
      if (permanentStopsLeaving(ctx.state, ctx.deps, adjustment.instanceId, undefined)) {
        return engineError("no_valid_target", "a permanent card can't be discarded", command);
      }
      discardFromPlay(ctx, adjustment.instanceId);
      return null;
    case "damage":
      return adjustDamage(ctx, adjustment.instanceId, adjustment.amount, command);
    case "threat":
      return adjustThreat(ctx, adjustment.instanceId, adjustment.amount, command);
    case "counters": {
      const { instanceId, counterType, amount } = adjustment;
      if (amount > 0) {
        if (addCounters(ctx, instanceId, counterType, amount) > 0) return null;
        return engineError("limit_reached", `that card cannot hold more ${counterType} counters`, command);
      }
      if (removeCounters(ctx, instanceId, counterType, -amount) > 0) return null;
      return engineError("no_valid_target", `that card has no ${counterType} counters`, command);
    }
    case "status":
      return adjustStatus(ctx, adjustment, command);
    case "exhaust": {
      if (getInstance(ctx.state, adjustment.instanceId)!.exhausted)
        return engineError("already_exhausted", "that card is already exhausted", command);
      exhaustCard(ctx, adjustment.instanceId);
      return null;
    }
    case "ready": {
      if (!getInstance(ctx.state, adjustment.instanceId)!.exhausted)
        return engineError("no_valid_target", "that card is already ready", command);
      // Directly rather than `readyCard`: a "cannot ready" rule limits effects, not a repair. A constant that keeps the
      // card exhausted ("exhaust each ally you control") exhausts it again between frames, as it would have.
      updateInstance(ctx, adjustment.instanceId, (i) => ({ ...i, exhausted: false }));
      emit(ctx, { type: "cardReadied", instanceId: adjustment.instanceId });
      return null;
    }
    case "changeForm":
      return adjustForm(ctx, adjustment, command);
  }
}

/**
 * Damage placed (not dealt: RRG 1.8 "Damage", p. 14, so no toughness, retaliate or damage windows) or removed. A
 * sustained damage cap still holds placed damage, as `placeDamage` does. Removal is not healing, so "cannot be healed"
 * does not stop it, and it is logged as `damageHealed` for the client's dial. A character placed at zero hit points is
 * defeated by the ordinary sweep (`checkDefeats`), with no defeating player or card.
 */
function adjustDamage(ctx: Ctx, id: InstanceId, amount: number, command: AdjustCommand): EngineError | null {
  if (amount < 0) {
    const removed = Math.min(-amount, getInstance(ctx.state, id)!.damage);
    if (removed <= 0) return engineError("no_valid_target", "that character has no damage", command);
    updateInstance(ctx, id, (i) => ({ ...i, damage: i.damage - removed }));
    emit(ctx, { type: "damageHealed", targetInstanceId: id, amount: removed });
    return null;
  }
  const allowance = sustainedDamageAllowance(ctx.state, ctx.deps, id);
  const placed = allowance === null ? amount : Math.min(amount, allowance);
  if (placed < amount) emit(ctx, { type: "damageCapped", targetInstanceId: id, amount: amount - placed });
  if (placed <= 0) return engineError("limit_reached", "that character cannot take more damage", command);
  updateInstance(ctx, id, (i) => ({ ...i, damage: i.damage + placed }));
  emit(ctx, { type: "damagePlaced", targetInstanceId: id, amount: placed, sourceInstanceId: null });
  checkDefeats(ctx);
  return null;
}

/**
 * Threat placed or removed with no source card. A main scheme at its target threat is completed (RRG 1.8 "Main
 * Scheme", p. 27); a side scheme left with no threat is defeated (RRG 1.8 "Defeat", p. 15) unless it is permanent or a
 * `notDefeatedWithoutThreat` rule holds it, exactly as `applyRemoveThreat` decides, with no defeating player.
 */
function adjustThreat(ctx: Ctx, id: InstanceId, amount: number, command: AdjustCommand): EngineError | null {
  if (amount > 0) {
    updateInstance(ctx, id, (i) => ({ ...i, threat: i.threat + amount }));
    emit(ctx, { type: "threatPlaced", schemeInstanceId: id, amount, sourceInstanceId: null });
    if (mainSchemeStateOf(ctx.state, id)) checkOneMainScheme(ctx, id);
    return null;
  }
  const removed = Math.min(-amount, getInstance(ctx.state, id)!.threat);
  if (removed <= 0) return engineError("no_valid_target", "that scheme has no threat", command);
  updateInstance(ctx, id, (i) => ({ ...i, threat: i.threat - removed }));
  emit(ctx, { type: "threatRemoved", schemeInstanceId: id, amount: removed, sourceInstanceId: null, noPlayer: true });
  const after = getInstance(ctx.state, id)!;
  if (after.threat > 0 || !categoriesOf(ctx.state, id).includes("sideScheme")) return null;
  if (permanentStopsLeaving(ctx.state, ctx.deps, id, undefined)) return null;
  if (notDefeatedWithoutThreat(ctx.state, ctx.deps, id)) {
    // Watched, so it is defeated the moment the rule stops covering it (`checkSchemeProtectionEnded`).
    const held = ctx.state.heldAtNoThreat ?? [];
    if (!held.includes(id)) ctx.state = { ...ctx.state, heldAtNoThreat: [...held, id] };
    return null;
  }
  emit(ctx, { type: "schemeDefeated", instanceId: id, cardId: after.cardId });
  pushFrames(ctx, [
    eventFrame(ctx, { kind: "schemeDefeated", instanceId: id, defeatedByPlayerId: null, sourceInstanceId: null }),
  ]);
  return null;
}

/**
 * One status card given or removed. Giving goes through `giveStatus`, so the character's capacity (steady, stalwart, a
 * "cannot be stunned" rule) holds and a vulnerable character is discarded; a give it refuses is an error. It has no
 * source and no player, and is marked `replacing` so `giveStatus` records no `statusPlaced` announcement: that flag's
 * meaning is "this landing is not a placement", which is true of a repair too. Removal takes one card and announces no
 * "status discarded" window.
 */
function adjustStatus(
  ctx: Ctx,
  adjustment: Extract<Adjustment, { kind: "status" }>,
  command: AdjustCommand,
): EngineError | null {
  const { instanceId, status, present } = adjustment;
  if (present) {
    if (giveStatus(ctx, instanceId, status, { sourceInstanceId: null, playerId: null, replacing: true })) return null;
    return engineError("no_valid_target", `that character cannot take another ${status} status card`, command);
  }
  if (removeStatus(ctx, instanceId, status, 1).length > 0) return null;
  return engineError("no_valid_target", `that character has no ${status} status card`, command);
}

/**
 * The identity turns to its other form with `setForm(…, voluntary = false)`: the round's form change is neither needed
 * nor used up, no form-change cost is paid, and "cannot change form" does not stop it. No `formChanging` interrupt and
 * no `formChanged` response window: the announcement `setForm` returns is dropped. A separated identity's other card
 * flips too (`setForm`).
 */
function adjustForm(
  ctx: Ctx,
  adjustment: Extract<Adjustment, { kind: "changeForm" }>,
  command: AdjustCommand,
): EngineError | null {
  const identity = getPlayer(ctx.state, adjustment.playerId)!.identity;
  const card = mustCardOf(ctx.state, identity.instanceId);
  const faces = card.type === "hero_identity" ? heroFacesOf(card).length : 1;
  let to: "hero" | "alterEgo";
  let heroForm = 0;
  if (adjustment.to === undefined) {
    if (identity.form === "alterEgo" && faces > 1)
      return engineError("no_valid_target", "choose which hero form to change to", command);
    to = identity.form === "hero" ? "alterEgo" : "hero";
  } else if (adjustment.to === "alterEgo") {
    if (identity.form === "alterEgo") return engineError("no_valid_target", "already in alter-ego form", command);
    to = "alterEgo";
  } else {
    heroForm = adjustment.to.heroForm;
    if (!Number.isInteger(heroForm) || heroForm < 0 || heroForm >= faces)
      return engineError("no_valid_target", `no hero form ${heroForm}`, command);
    if (identity.form === "hero" && identity.heroFormIndex === heroForm)
      return engineError("no_valid_target", "already in that hero form", command);
    to = "hero";
  }
  // Engine-specific exception to "no windows of its own": a separated identity whose flip waits on an attachment's
  // leave-play interrupt (`separatedFlipWaits`) flips later through `runHostStep`, which opens the usual form-change
  // response window. Rare, and the flip itself is still the one asked for.
  setForm(ctx, adjustment.playerId, to, false, heroForm);
  return null;
}
