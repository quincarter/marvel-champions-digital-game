/** Applying one non-interactive effect from an effects frame. */

import { type Ctx, emit, findFrame, moveCard, pushFrames, setFrame, updateFrame, updateInstance, updatePlayer } from "../ctx.js";
import {
  addAccelerationToken,
  addCounters,
  addLastingEffect,
  discardFromPlay,
  discardRandomFromHand,
  drawCards,
  drawEncounterCard,
  exhaustCard,
  giveStatus,
  healDamage,
  readyCard,
  removeAccelerationToken,
  removeCounters,
  flipVillain,
  removeStatus,
  setActiveVillain,
  setForm,
  shuffleZone,
  takeTopOfDeck,
} from "../effects.js";
import { EngineInvariantError } from "../errors.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { statusActive } from "../keywords.js";
import { boostIconsFor, cardEffectBonus } from "../modifiers.js";
import type { LastingDuration, LastingScope } from "../lasting.js";
import {
  activeEncounterDeckId,
  cardOf,
  characterProfile,
  discardZoneFor,
  encounterDeckOf,
  getInstance,
  getPlayer,
  inAnyEncounterDiscard,
  isMinion,
  maxHitPoints,
  mustInstance,
  mustPlayer,
  villainOf,
} from "../query.js";
import { addPools, EMPTY_POOL, printedResources } from "../resources.js";
import {
  canAttack,
  cardsInPlay,
  categoriesOf,
  controllerOf,
  type EffectContext,
  evaluate,
  matchesQuery,
  resolvePlayers,
  resolveRef,
  resolveValue,
} from "../select.js";
import type { EffectSpec } from "../spec.js";
import { currentActivationFrameId, type DeferredEffects, type ReportTarget, type StackFrame } from "../stack.js";
import type { TriggerEvent } from "../trigger-events.js";
import { matchingCardInPlay } from "../unique.js";
import { moveCardsTo, selectCards, shuffleEncounterDeck } from "./cards.js";
import { cannotChangeForm, cannotThwart } from "../rules.js";
import { advanceMainSchemeStage, checkDefeats } from "./defeat.js";
import { threatRemovalBlocked } from "./event.js";
import { heard } from "./triggers.js";
import { giveBoostCard } from "./enemy-activation.js";
import { applyEnterPlayKeywords, quickstrikeAttack } from "./enter-play.js";
import { addFrameVars, eventFrame, type Frame, gameAbilityFrames, pushEffects, pushEvents } from "./frames.js";
import { enterPlayOnReveal, revealFrame } from "./reveal.js";

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
function admitUniqueEntry(ctx: Ctx, ids: readonly InstanceId[]): readonly InstanceId[] {
  const admitted: InstanceId[] = [];
  for (const id of ids) {
    const card = cardOf(ctx.state, id);
    // A villain entering play is exempt; so is a card with no data to match on.
    if (!card || card.type === "villain") {
      admitted.push(id);
      continue;
    }
    // `ignore` keeps a card already in play from matching itself.
    const match = matchingCardInPlay(ctx.state, card, new Set([id]));
    if (!match) {
      admitted.push(id);
      continue;
    }
    const isPlayerCard = getInstance(ctx.state, id)?.ownerId !== null;
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

/** A `minionEngaged` announcement for a minion now engaged with a player, when something could respond to it. */
export function engagedEvent(ctx: Ctx, id: InstanceId): readonly TriggerEvent[] {
  const playerId = getInstance(ctx.state, id)?.engagedWith;
  if (!playerId || !isMinion(ctx.state, id)) return [];
  const event: TriggerEvent = { kind: "minionEngaged", minionInstanceId: id, playerId };
  return heard(ctx.state, ctx.deps, event) ? [event] : [];
}

export function applyEffect(
  ctx: Ctx,
  effect: EffectSpec,
  context: EffectContext,
  frame: Frame<"effects">,
): void {
  const targets = (ref: Parameters<typeof resolveRef>[1]): readonly InstanceId[] =>
    resolveRef(ctx.state, ref, context).filter((id) => getInstance(ctx.state, id) !== undefined);
  const value = (spec: Parameters<typeof resolveValue>[1]): number => resolveValue(ctx.state, spec, context, ctx.deps);
  const reportTo = (bind: string | undefined): ReportTarget | null => (bind ? { frameId: frame.frameId, prefix: bind } : null);

  switch (effect.kind) {
    case "dealDamage": {
      // "Increase the amount of damage that event deals by 2" (Embiggen!): every instance this card deals (RRG 1.8
      // "Event", p. 19; FAQ "Embiggen (#10)", p. 59).
      const amount = value(effect.amount) + cardEffectBonus(ctx.state, frame.selfInstanceId, "damage");
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({
          kind: "dealDamage",
          targetInstanceId: id,
          amount,
          sourceInstanceId: frame.selfInstanceId,
          fromAttack: effect.fromAttack === true,
          ...(effect.ignoreTough ? { ignoreTough: true } : {}),
        })),
        reportTo(effect.bind),
      );
      return;
    }
    case "heal": {
      const amount = value(effect.amount);
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({ kind: "healDamage", targetInstanceId: id, amount })),
        reportTo(effect.bind),
      );
      return;
    }
    case "placeThreat": {
      const amount = value(effect.amount);
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({
          kind: "placeThreat",
          schemeInstanceId: id,
          amount,
          sourceInstanceId: frame.selfInstanceId,
        })),
        reportTo(effect.bind),
      );
      return;
    }
    case "removeThreat": {
      // "Increase the amount of threat that event removes by 2" (Shrink): every instance this card removes.
      const amount = value(effect.amount) + cardEffectBonus(ctx.state, frame.selfInstanceId, "threatRemoved");
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({
          kind: "removeThreat",
          schemeInstanceId: id,
          amount,
          sourceInstanceId: frame.selfInstanceId,
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
      if (effect.moveDamageFrom) {
        // RRG "Move": moved damage is healed from the source and dealt to the destination; no source, no move.
        const [from] = targets(effect.moveDamageFrom);
        amount = Math.min(amount, from ? mustInstance(ctx.state, from).damage : 0);
        if (!from || amount <= 0) return;
        healDamage(ctx, from, amount);
      }
      // "Increase the amount of damage that event deals by 2" (Embiggen!): an "(attack)" event's damage is an instance
      // too, like `dealDamage` above (RRG 1.8 "Event", p. 19; FAQ "Embiggen (#10)", p. 59). Added after a move is capped,
      // so it raises the damage dealt without healing more from the source.
      amount += cardEffectBonus(ctx.state, frame.selfInstanceId, "damage");
      // RRG 1.8 "Stun" (p. 41): "If a stunned identity or ally attempts to attack or use an attack ability, discard
      // the stunned card instead. Costs associated with the attack attempt … must still be paid." An ability that
      // creates several attacks spends the stun on the first of them only — FAQ "Dance of Death (#4)" (p. 59):
      // "Because Dance of Death creates three separate attacks, a stun status card on Black Widow will only prevent
      // the first attack. The second and third attack can be performed as normal." An "(attack)"-labeled ability
      // never reaches here: its label cancels the whole ability first (`labelCancels`), which is the RRG's rule for
      // labeled abilities and is what Dance of Death's missing label distinguishes it from.
      if (statusActive(ctx.state, attacker, "stunned", ctx.deps)) {
        updateInstance(ctx, attacker, (i) => ({ ...i, statuses: { ...i.statuses, stunned: 0 } }));
        emit(ctx, { type: "statusRemoved", instanceId: attacker, status: "stunned", reason: "cancelledAttack" });
        return;
      }
      // RRG "Attack (Player Ability Type)": attacks can target any enemy unless guard prevents it.
      const attacked = targets(effect.target).filter((id) => canAttack(ctx.state, attacker, id, ctx.deps));
      pushEvents(
        ctx,
        attacked.map((id) => ({
          kind: "attack",
          attackerInstanceId: attacker,
          targetInstanceId: id,
          playerId: controller,
          amount,
          basic: false,
          overkill: effect.overkill === true,
          sourceInstanceId: frame.selfInstanceId,
        })),
        reportTo(effect.bind),
      );
      return;
    }
    case "thwart": {
      const controller = frame.controllerId;
      const [thwarter] = targets(effect.thwarter ?? { kind: "identityOf", player: { kind: "controller" } });
      if (!controller || !thwarter || cannotThwart(ctx.state, ctx.deps, controller)) return;
      // A "(thwart)" event's threat removal is an instance too (RRG 1.8 "Thwart", p. 44).
      const amount = value(effect.amount) + cardEffectBonus(ctx.state, frame.selfInstanceId, "threatRemoved");
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({
          kind: "thwart",
          thwarterInstanceId: thwarter,
          schemeInstanceId: id,
          playerId: controller,
          amount,
          basic: false,
          sourceInstanceId: frame.selfInstanceId,
        })),
        reportTo(effect.bind),
      );
      return;
    }
    case "modifyAttack": {
      const activation = currentActivationFrameId(ctx.state.stack);
      if (!activation) return;
      const delta: Record<string, number> = {};
      if (effect.overkill) delta.overkill = 1;
      if (effect.atkBonus) delta.atkBonus = value(effect.atkBonus);
      if (effect.threatBonus) delta.threatBonus = value(effect.threatBonus);
      const extra = effect.extraBoostCards ?? 0;
      const procedure = ctx.state.stack.find(
        (f): f is Frame<"enemyAttack"> | Frame<"enemyScheme"> =>
          (f.kind === "enemyAttack" || f.kind === "enemyScheme") && f.eventFrameId === activation,
      );
      if (extra > 0 && procedure && procedure.stage !== "giveBoost") {
        // Boost cards are already being flipped: the extra card joins the pile and is flipped too.
        for (let i = 0; i < extra; i++) giveBoostCard(ctx, procedure.enemyInstanceId);
      } else if (extra > 0) {
        delta.extraBoost = extra;
      }
      addFrameVars(ctx, activation, delta);
      return;
    }
    case "cancelBoostIcons":
    case "cancelBoostAbility": {
      const procedure = ctx.state.stack.find(
        (f): f is Frame<"enemyAttack"> | Frame<"enemyScheme"> => (f.kind === "enemyAttack" || f.kind === "enemyScheme") && Boolean(f.boost),
      );
      const boost = procedure?.boost;
      const report = (made: number, amount?: number): void => {
        if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.made`]: made, ...(amount !== undefined ? { [`${effect.bind}.amount`]: amount } : {}) });
      };
      if (!procedure || !boost) return report(0);
      if (effect.kind === "cancelBoostAbility") {
        // Its ability resolves as soon as the turned-faceup windows close; after that there is nothing to cancel.
        if (boost.step !== "window" || boost.abilityCancelled) return report(0);
        setFrame(ctx, { ...procedure, boost: { ...boost, abilityCancelled: true } });
        return report(1);
      }
      const icons = boost.iconsCancelled ? 0 : boostIconsFor(ctx.state, ctx.deps, boost.instanceId);
      if (icons <= 0) return report(0);
      setFrame(ctx, { ...procedure, boost: { ...boost, iconsCancelled: true } });
      // Later windows on the same card see no icons left to cancel.
      const turned = ctx.state.stack.find((f) => f.kind === "event" && f.event.kind === "boostCardTurnedFaceup" && f.event.boostInstanceId === boost.instanceId);
      if (turned?.kind === "event" && turned.event.kind === "boostCardTurnedFaceup") setFrame(ctx, { ...turned, event: { ...turned.event, boostIcons: 0 } });
      emit(ctx, { type: "boostCancelled", instanceId: boost.instanceId, scope: "icons" });
      return report(1, icons);
    }
    case "atEndOfAttack":
    case "atEndOfActivation": {
      const activation = currentActivationFrameId(ctx.state.stack);
      if (!activation) return;
      const deferred: DeferredEffects = {
        effects: effect.effects,
        selfInstanceId: frame.selfInstanceId,
        controllerId: frame.controllerId,
        bindings: frame.bindings,
        vars: frame.vars,
      };
      updateFrame(ctx, activation, (f) => (f.kind === "event" ? { ...f, endEffects: [...f.endEffects, deferred] } : f));
      return;
    }
    case "draw": {
      const amount = value(effect.amount);
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        drawCards(ctx, playerId, amount);
      }
      return;
    }
    case "discardFromHand": {
      const amount = value(effect.amount);
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) discardRandomFromHand(ctx, playerId, amount);
      return;
    }
    case "revealTopOfEncounterDeck": {
      for (let i = 0; i < effect.count; i++) {
        const id = drawEncounterCard(ctx);
        if (!id) return;
        updateInstance(ctx, id, (instance) => ({ ...instance, faceup: true }));
        if (effect.then === "discard") moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
      }
      return;
    }
    case "exhaust":
      for (const id of targets(effect.target)) exhaustCard(ctx, id);
      return;
    case "ready":
      for (const id of targets(effect.target)) readyCard(ctx, id);
      return;
    case "giveStatus":
      for (const id of targets(effect.target)) giveStatus(ctx, id, effect.status);
      return;
    case "removeStatus":
      for (const id of targets(effect.target)) removeStatus(ctx, id, effect.status);
      return;
    case "addCounters": {
      const amount = value(effect.amount);
      for (const id of targets(effect.target)) addCounters(ctx, id, effect.counterType, amount);
      return;
    }
    case "removeCounters": {
      const amount = value(effect.amount);
      for (const id of targets(effect.target)) removeCounters(ctx, id, effect.counterType, amount);
      return;
    }
    case "attach": {
      const [host] = targets(effect.to);
      if (!host) return;
      for (const id of targets(effect.card)) {
        moveCard(ctx, id, { kind: "attachment", hostInstanceId: host });
        // "Attach 1 card from your hand facedown here" (Bruno Carrelli): no title, traits, keywords or abilities
        // while it is facedown; it is itself again when it leaves play (`leavePlay`).
        if (effect.facedown) updateInstance(ctx, id, (i) => ({ ...i, faceup: false, facedownAs: { kind: "blank", traits: [] } }));
      }
      return;
    }
    case "engage": {
      // RRG 1.8 "Engage" (p. 18): an ability telling a player to engage a minion counts as that minion engaging them,
      // and a minion already engaged with that player cannot engage them again.
      const [playerId] = resolvePlayers(ctx.state, effect.player, context);
      if (!playerId) return;
      const engaged: TriggerEvent[] = [];
      for (const id of targets(effect.minion)) {
        const instance = getInstance(ctx.state, id);
        if (!instance || !isMinion(ctx.state, id) || instance.engagedWith === playerId) continue;
        moveCard(ctx, id, { kind: "playArea", playerId });
        updateInstance(ctx, id, (i) => ({ ...i, engagedWith: playerId, controllerId: null }));
        engaged.push(...engagedEvent(ctx, id));
      }
      pushEvents(ctx, engaged);
      return;
    }
    case "setRemainingHitPoints": {
      // "Set his hit point dial to 1 instead": the dial is remaining hit points (RRG 1.8 "Hit Points", p. 22), so
      // sustained damage becomes maximum hit points minus that. Not a heal, so no heal event (§3.13).
      const remaining = Math.max(0, value(effect.amount));
      for (const id of targets(effect.target)) {
        const max = maxHitPoints(ctx.state, id, ctx.deps);
        if (max === undefined) continue;
        const damage = Math.max(0, max - remaining);
        updateInstance(ctx, id, (instance) => ({ ...instance, damage }));
        emit(ctx, { type: "hitPointsSet", instanceId: id, remaining: Math.min(remaining, max), damage });
      }
      return;
    }
    case "modifyCardEffect": {
      const damage = effect.damage ? value(effect.damage) : 0;
      const threatRemoved = effect.threatRemoved ? value(effect.threatRemoved) : 0;
      if (damage === 0 && threatRemoved === 0) return;
      for (const id of targets(effect.card)) {
        addLastingEffect(ctx, { kind: "cardEffectBonus", sourceInstanceId: id, damage, threatRemoved }, { kind: "endOfCardResolution", instanceId: id });
      }
      return;
    }
    case "discardFromPlay":
      for (const id of targets(effect.target)) discardFromPlay(ctx, id);
      return;
    case "putIntoPlay": {
      const [controller] = resolvePlayers(ctx.state, effect.controller, context);
      if (!controller) return;
      const admitted = admitUniqueEntry(ctx, targets(effect.card));
      const placed: InstanceId[] = [];
      for (const id of admitted) {
        const card = cardOf(ctx.state, id);
        // Encounter cards other than minions enter where their type goes (villain area, host, play area).
        if (card && card.type !== "minion" && getInstance(ctx.state, id)?.ownerId === null && !cardsInPlay(ctx.state).includes(id)) {
          updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
          enterPlayOnReveal(ctx, id, controller);
          placed.push(id);
        }
      }
      const entering = admitted.filter((id) => !placed.includes(id));
      for (const id of entering) {
        // A minion belongs to the encounter side even while it sits in a player's area.
        const isMinion = cardOf(ctx.state, id)?.type === "minion";
        moveCard(ctx, id, { kind: "playArea", playerId: controller });
        updateInstance(ctx, id, (instance) => ({
          ...instance,
          controllerId: isMinion ? null : controller,
          engagedWith: isMinion ? controller : instance.engagedWith,
          faceup: true,
        }));
        applyEnterPlayKeywords(ctx, id);
      }
      const entered: TriggerEvent[] = entering.map((id) => ({
        kind: "cardEntersPlay",
        instanceId: id,
        playerId: controller,
      }));
      for (const id of entering) {
        const quickstrike = quickstrikeAttack(ctx.state, id);
        if (quickstrike) entered.push(quickstrike);
      }
      // After the keywords: "After you engage a minion" (ruling, Jan 17, 2026 (3) answer 2).
      for (const id of entering) entered.push(...engagedEvent(ctx, id));
      pushEvents(ctx, entered);
      return;
    }
    case "dealEncounterCard":
      // Dealing asks the first player for the order when several players receive cards (`executeDealEncounterCards`).
      throw new EngineInvariantError("dealEncounterCard is handled before applyEffect");
    case "revealEncounterCard": {
      const frames: StackFrame[] = [];
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        const id = drawEncounterCard(ctx);
        if (id) frames.push(revealFrame(ctx, playerId, id));
      }
      pushFrames(ctx, frames);
      return;
    }
    case "addAccelerationToken":
      addAccelerationToken(ctx);
      return;
    case "flipCard": {
      const inPlay = cardsInPlay(ctx.state);
      const frames: StackFrame[] = [];
      for (const id of targets(effect.target)) {
        if (!inPlay.includes(id)) continue;
        const card = cardOf(ctx.state, id);
        const villain = villainOf(ctx.state, id);
        if (villain && card?.type === "villain") {
          const other = card.sides.find((side) => side.side !== villain.side);
          // Both faces of a double-sided stage card list the same stages (docs/phase7-wave1.md §1.3).
          if (!other?.stages[villain.stageIndex]) continue;
          flipVillain(ctx, id, other.side);
          frames.push(...gameAbilityFrames(ctx, id, ["whenRevealed"], null, undefined, ctx.state.firstPlayerId));
        } else if (card && "flipSide" in card && card.flipSide) {
          const flipped = !mustInstance(ctx.state, id).flipped;
          updateInstance(ctx, id, (i) => ({ ...i, flipped }));
          emit(ctx, { type: "cardFlipped", instanceId: id, flipped });
        } else {
          continue;
        }
        frames.push(eventFrame(ctx, { kind: "cardFlipped", instanceId: id }));
      }
      pushFrames(ctx, frames);
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
    case "removeAccelerationToken":
      removeAccelerationToken(ctx);
      return;
    case "advanceMainScheme":
      advanceMainSchemeStage(ctx);
      return;
    case "moveThreat": {
      const [from] = targets(effect.from);
      const [to] = targets(effect.to);
      const available = from ? mustInstance(ctx.state, from).threat : 0;
      const amount = Math.min(available, effect.amount ? Math.max(0, value(effect.amount)) : available);
      // RRG 1.8 "Move" (p. 30): no move to the current placement, and none without a valid source and destination.
      const blocked = from ? threatRemovalBlocked(ctx.state, ctx.deps, from, frame.selfInstanceId) : null;
      if (!from || !to || from === to || amount <= 0 || blocked) {
        if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.made`]: 0 });
        return;
      }
      // Removed from the source, then placed on the destination; only the placement reports to `bind`.
      pushFrames(ctx, [
        eventFrame(ctx, { kind: "removeThreat", schemeInstanceId: from, amount, sourceInstanceId: frame.selfInstanceId }),
        eventFrame(ctx, { kind: "placeThreat", schemeInstanceId: to, amount, sourceInstanceId: frame.selfInstanceId }, reportTo(effect.bind)),
      ]);
      return;
    }
    case "if": {
      const branch = evaluate(ctx.state, effect.condition, context)
        ? effect.then
        : (effect.otherwise ?? []);
      pushEffects(ctx, {
        effects: branch,
        selfInstanceId: frame.selfInstanceId,
        controllerId: frame.controllerId,
        event: frame.event,
        eventFrameId: frame.eventFrameId,
        bindings: frame.bindings,
        vars: frame.vars,
        scopedPlayerId: frame.scopedPlayerId,
      });
      return;
    }
    case "cancelTriggeringEvent": {
      if (!frame.eventFrameId) return;
      updateFrame(ctx, frame.eventFrameId, (target) =>
        target.kind === "event" ? { ...target, cancelled: true } : target,
      );
      return;
    }
    case "preventDamage":
    case "preventThreat": {
      const kind = effect.kind === "preventDamage" ? "dealDamage" : "placeThreat";
      const target = frame.eventFrameId ? findFrame(ctx.state, frame.eventFrameId) : undefined;
      if (target?.kind !== "event" || target.event.kind !== kind || target.cancelled) return;
      const pending = target.event.amount;
      const prevented = effect.amount === undefined ? pending : Math.min(pending, Math.max(0, value(effect.amount)));
      if (prevented <= 0) return;
      setFrame(ctx, { ...target, event: { ...target.event, amount: pending - prevented } });
      if (target.event.kind === "dealDamage") {
        emit(ctx, { type: "damagePrevented", targetInstanceId: target.event.targetInstanceId, amount: prevented, reason: "effect" });
      } else if (target.event.kind === "placeThreat") {
        emit(ctx, { type: "threatPrevented", schemeInstanceId: target.event.schemeInstanceId, amount: prevented });
      }
      return;
    }
    case "replaceTriggeringEvent": {
      if (!frame.eventFrameId) return;
      updateFrame(ctx, frame.eventFrameId, (target) => (target.kind === "event" ? { ...target, cancelled: true } : target));
      pushEffects(ctx, {
        effects: effect.with,
        selfInstanceId: frame.selfInstanceId,
        controllerId: frame.controllerId,
        event: frame.event,
        eventFrameId: null,
        bindings: frame.bindings,
        vars: frame.vars,
      });
      return;
    }
    case "cancelWhenRevealed":
    case "cancelRevealedCard": {
      const revealing = frame.event?.kind === "encounterCardRevealing" ? frame.event.instanceId : null;
      const reveal = ctx.state.stack.find((f): f is Frame<"reveal"> => f.kind === "reveal" && f.instanceId === revealing);
      if (!reveal) return;
      const all = effect.kind === "cancelRevealedCard";
      setFrame(ctx, all ? { ...reveal, effectsCancelled: true } : { ...reveal, whenRevealedCancelled: true });
      emit(ctx, { type: "revealCancelled", instanceId: reveal.instanceId, scope: all ? "allEffects" : "whenRevealed" });
      return;
    }
    case "placeDamage": {
      const amount = value(effect.amount);
      if (amount <= 0) return;
      for (const id of targets(effect.target)) {
        updateInstance(ctx, id, (i) => ({ ...i, damage: i.damage + amount }));
        emit(ctx, { type: "damagePlaced", targetInstanceId: id, amount, sourceInstanceId: frame.selfInstanceId });
      }
      checkDefeats(ctx);
      return;
    }
    case "bindTargets": {
      const ids = targets(effect.target);
      updateFrame(ctx, frame.frameId, (f) => (f.kind === "effects" ? { ...f, bindings: { ...f.bindings, [effect.slot]: ids } } : f));
      return;
    }
    case "modifyStatUntil":
    case "grantTraitUntil": {
      let duration: LastingDuration;
      if (effect.until === "endOfAttack") {
        const activation = currentActivationFrameId(ctx.state.stack);
        if (!activation) return;
        duration = { kind: "endOfEvent", frameId: activation };
      } else {
        duration = { kind: effect.until };
      }
      const reach = {
        targets: effect.target ? targets(effect.target) : null,
        affects: effect.affects ?? null,
      };
      const scope: LastingScope = {
        selfInstanceId: frame.selfInstanceId,
        controllerId: frame.controllerId,
        vars: frame.vars,
        bindings: frame.bindings,
      };
      addLastingEffect(
        ctx,
        effect.kind === "modifyStatUntil"
          ? { kind: "statModifier", stat: effect.stat, amount: effect.amount, scope, ...reach }
          : { kind: "traitGrant", trait: effect.trait, scope, ...reach },
        duration,
      );
      return;
    }
    case "blankTextBox": {
      const ids = targets(effect.target);
      const activation = effect.until === "endOfAttack" ? currentActivationFrameId(ctx.state.stack) : null;
      if (ids.length === 0 || (effect.until === "endOfAttack" && !activation)) return;
      const duration: LastingDuration = activation ? { kind: "endOfEvent", frameId: activation } : { kind: effect.until === "endOfRound" ? "endOfRound" : "endOfPhase" };
      addLastingEffect(ctx, { kind: "blankTextBox", targets: ids }, duration);
      return;
    }
    case "atEndOfRound":
      addLastingEffect(
        ctx,
        {
          kind: "delayedEffects",
          effects: effect.effects,
          scope: { selfInstanceId: frame.selfInstanceId, controllerId: frame.controllerId, vars: frame.vars, bindings: frame.bindings },
        },
        { kind: "endOfRound" },
      );
      return;
    case "moveCards": {
      const ids = selectCards(ctx, effect.cards, context);
      if (effect.bind) {
        // Record what moved (and its printed resources / boost icons) before it moves.
        const pool = ids.reduce((sum, id) => {
          const card = cardOf(ctx.state, id);
          return card ? addPools(sum, printedResources(card)) : sum;
        }, EMPTY_POOL);
        // "… takes 1 damage for each boost icon discarded this way" (Hit Squad, `cap` pack): the printed count plus
        // any "gets +1 boost icon if …" modifier (§3.9's `boostIconsFor`), summed across every card this bind moved.
        const boostIcons = ids.reduce((sum, id) => sum + boostIconsFor(ctx.state, ctx.deps, id), 0);
        const bind = effect.bind;
        updateFrame(ctx, frame.frameId, (f) =>
          f.kind === "effects"
            ? {
                ...f,
                bindings: { ...f.bindings, [bind]: ids },
                vars: {
                  ...f.vars,
                  [`${bind}.count`]: ids.length,
                  [`${bind}.physical`]: pool.physical,
                  [`${bind}.mental`]: pool.mental,
                  [`${bind}.energy`]: pool.energy,
                  [`${bind}.wild`]: pool.wild,
                  [`${bind}.boostIcons`]: boostIcons,
                },
              }
            : f,
        );
      }
      moveCardsTo(ctx, ids, effect.to);
      return;
    }
    case "shuffleDeck":
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        const order = shuffleZone(ctx, { kind: "deck", playerId }, mustPlayer(ctx.state, playerId).deck);
        updatePlayer(ctx, playerId, (p) => ({ ...p, deck: order }));
      }
      return;
    case "changeForm": {
      const changed: TriggerEvent[] = [];
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        if (cannotChangeForm(ctx.state, ctx.deps, playerId)) continue;
        const current = mustPlayer(ctx.state, playerId).identity.form;
        const to = effect.to ?? (current === "hero" ? "alterEgo" : "hero");
        if (to === current) continue;
        setForm(ctx, playerId, to, false);
        changed.push({ kind: "formChanged", playerId, to });
      }
      pushEvents(ctx, changed);
      return;
    }
    case "drawUpTo":
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        const missing = value(effect.amount) - mustPlayer(ctx.state, playerId).hand.length;
        if (missing > 0) drawCards(ctx, playerId, missing);
      }
      return;
    case "forEachPlayer": {
      const players = resolvePlayers(ctx.state, effect.players, context);
      // Pushed in reverse so the first player's pass resolves first.
      for (const playerId of [...players].reverse()) {
        pushEffects(ctx, {
          effects: effect.effects,
          selfInstanceId: frame.selfInstanceId,
          controllerId: frame.controllerId,
          event: frame.event,
          eventFrameId: frame.eventFrameId,
          bindings: frame.bindings,
          vars: frame.vars,
          scopedPlayerId: playerId,
        });
      }
      return;
    }
    case "enemyAttack":
    case "enemyScheme": {
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
          updateFrame(ctx, activation, (f) => (f.kind === "event" ? { ...f, endEffects: [...f.endEffects, deferred] } : f));
          return;
        }
      }
      const attacking = effect.kind === "enemyAttack";
      const against = effect.against ? resolvePlayers(ctx.state, effect.against, context) : null;
      const inPlayNow = cardsInPlay(ctx.state);
      const [character] =
        effect.kind === "enemyAttack" && effect.targetCharacter
          ? targets(effect.targetCharacter).filter((id) => inPlayNow.includes(id) && categoriesOf(ctx.state, id).includes("character"))
          : [];
      const characterController = character ? controllerOf(ctx.state, character) : null;
      const noBoost = effect.boost === false ? { noBoost: true } : {};
      const events: TriggerEvent[] = [];
      for (const enemy of targets(effect.enemies)) {
        const categories = categoriesOf(ctx.state, enemy);
        if (!categories.includes("enemy") || !cardsInPlay(ctx.state).includes(enemy)) continue;
        if (villainOf(ctx.state, enemy)?.defeated) continue;
        const players =
          effect.kind === "enemyAttack" && effect.targetCharacter
            ? [characterController].filter((p): p is PlayerId => p !== null)
            : (against ?? [getInstance(ctx.state, enemy)?.engagedWith ?? frame.controllerId].filter((p): p is PlayerId => p !== null));
        for (const playerId of players) {
          const player = getPlayer(ctx.state, playerId);
          if (!player || player.eliminated) continue;
          // Status first, then initiate even with a "—" stat (see `activateEnemy`, FAQ "Norman Osborn (#1A)", p. 58).
          const status = attacking ? "stunned" : "confused";
          if (statusActive(ctx.state, enemy, status, ctx.deps)) {
            // RRG "Stun"/"Confuse": the status is discarded instead; the enemy did not attack/scheme.
            updateInstance(ctx, enemy, (i) => ({ ...i, statuses: { ...i.statuses, [status]: 0 } }));
            emit(ctx, { type: "statusRemoved", instanceId: enemy, status, reason: attacking ? "cancelledAttack" : "cancelledSchemeOrThwart" });
            continue;
          }
          events.push(
            attacking
              ? {
                  kind: "enemyAttack",
                  enemyInstanceId: enemy,
                  attackedPlayerId: playerId,
                  targetPlayerId: playerId,
                  targetInstanceId: character ?? player.identity.instanceId,
                  ...(effect.kind === "enemyAttack" && effect.additionalResolution ? { additionalResolution: true } : {}),
                  ...noBoost,
                }
              : { kind: "enemyScheme", enemyInstanceId: enemy, playerId, ...noBoost },
          );
        }
      }
      pushEvents(ctx, events, reportTo(effect.bind));
      return;
    }
    case "selectCards": {
      const ids = selectCards(ctx, effect.cards, context);
      const slot = effect.slot;
      updateFrame(ctx, frame.frameId, (f) =>
        f.kind === "effects" ? { ...f, bindings: { ...f.bindings, [slot]: ids }, vars: { ...f.vars, [`${slot}.count`]: ids.length } } : f,
      );
      return;
    }
    case "revealCard": {
      const [playerId] = resolvePlayers(ctx.state, effect.player, context);
      if (!playerId) return;
      const frames: StackFrame[] = [];
      for (const id of targets(effect.cards)) {
        // Park it with the revealing player's dealt cards while it resolves (out of the deck/discard it came from).
        updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
        moveCard(ctx, id, { kind: "dealtEncounter", playerId }, "top");
        frames.push(revealFrame(ctx, playerId, id));
      }
      pushFrames(ctx, frames);
      return;
    }
    case "shuffleEncounterDeck":
      shuffleEncounterDeck(ctx);
      return;
    case "discardEncounterUntil": {
      // Bounded by the number of encounter cards, so a deck with no match can't loop forever.
      const deckId = activeEncounterDeckId(ctx.state);
      const piles = encounterDeckOf(ctx.state, deckId);
      const limit = piles.deck.length + piles.discard.length;
      let found: InstanceId | null = null;
      for (let i = 0; i < limit && found === null; i++) {
        const id = drawEncounterCard(ctx, deckId);
        if (!id) break;
        updateInstance(ctx, id, (inst) => ({ ...inst, faceup: true }));
        moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
        if (matchesQuery(ctx.state, id, effect.filter, context)) found = id;
      }
      const bind = effect.bind;
      updateFrame(ctx, frame.frameId, (f) =>
        f.kind === "effects" ? { ...f, bindings: { ...f.bindings, [bind]: found ? [found] : [] }, vars: { ...f.vars, [`${bind}.count`]: found ? 1 : 0 } } : f,
      );
      return;
    }
    case "discardEncounterCards": {
      // RRG 1.8 "Encounter Deck" (p. 17): discard until the count is met or the deck is emptied *by this effect*, and
      // then "do not continue the discard effect with the newly shuffled encounter deck". A deck that was already
      // empty when the effect began is reset first (with its acceleration token), as any draw from it would be.
      const deckId = activeEncounterDeckId(ctx.state);
      const count = Math.max(0, value(effect.count));
      const discarded: InstanceId[] = [];
      for (let i = 0; i < count; i++) {
        if (discarded.length > 0 && encounterDeckOf(ctx.state, deckId).deck.length === 0) break;
        const id = drawEncounterCard(ctx, deckId);
        if (!id) break;
        updateInstance(ctx, id, (instance) => ({ ...instance, faceup: true }));
        // Each card goes to its own deck's discard pile (its `home`), not necessarily the deck it came from.
        moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
        discarded.push(id);
      }
      const bind = effect.bind;
      if (bind) {
        updateFrame(ctx, frame.frameId, (f) =>
          f.kind === "effects"
            ? { ...f, bindings: { ...f.bindings, [bind]: discarded }, vars: { ...f.vars, [`${bind}.count`]: discarded.length } }
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
      for (const id of selectCards(ctx, effect.cards, context)) {
        moveCard(ctx, id, { kind: "tucked", hostInstanceId: host });
        updateInstance(ctx, id, (i) => ({ ...i, faceup: effect.facedown !== true }));
      }
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
          updateInstance(ctx, id, (inst) => ({ ...inst, faceup: false, controllerId: null, engagedWith: playerId, facedownAs: effect.as }));
          emit(ctx, { type: "cardPutIntoPlayFacedown", instanceId: id, playerId, as: effect.as.kind });
          entered.push({ kind: "cardEntersPlay", instanceId: id, playerId }, ...engagedEvent(ctx, id));
        }
      }
      pushEvents(ctx, entered);
      checkDefeats(ctx);
      return;
    }
    case "gainSurge": {
      const reveal = ctx.state.stack.find((f): f is Frame<"reveal"> => f.kind === "reveal" && f.instanceId === frame.selfInstanceId);
      if (reveal) setFrame(ctx, { ...reveal, surgeGained: true });
      return;
    }
    case "chooseCards":
    case "chooseOne":
    case "choosePlayer":
    case "resolveSpecials":
    case "assignDamage":
    case "dealIndirectDamage":
    case "reorderCards":
      throw new EngineInvariantError(`${effect.kind} is handled before applyEffect`);
    case "reduceNextCardCost": {
      const amount = value(effect.amount);
      if (amount <= 0) return;
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        addLastingEffect(
          ctx,
          { kind: "costReduction", playerId, amount, ...(effect.cardFilter ? { cardFilter: effect.cardFilter } : {}) },
          { kind: effect.duration === "phase" ? "endOfPhase" : "endOfRound" },
        );
      }
      return;
    }
    case "chooseTarget":
      throw new EngineInvariantError("chooseTarget is handled before applyEffect");
    case "spendResources":
      throw new EngineInvariantError("spendResources is handled before applyEffect");
  }
}
