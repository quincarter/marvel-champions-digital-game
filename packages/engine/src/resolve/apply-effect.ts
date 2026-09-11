/** Applying one non-interactive effect from an effects frame. */

import { type Ctx, emit, findFrame, moveCard, pushFrames, setFrame, updateFrame, updateInstance, updatePlayer } from "../ctx.js";
import {
  addAccelerationToken,
  addCounters,
  addLastingEffect,
  dealEncounterCardTo,
  discardFromHand,
  discardFromPlay,
  drawCards,
  drawEncounterCard,
  exhaustCard,
  giveStatus,
  healDamage,
  readyCard,
  removeAccelerationToken,
  removeCounters,
  removeStatus,
  setForm,
  shuffleZone,
  takeTopOfDeck,
} from "../effects.js";
import { EngineInvariantError } from "../errors.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { statusActive } from "../keywords.js";
import type { LastingDuration, LastingScope } from "../lasting.js";
import { cardOf, characterProfile, getInstance, getPlayer, mustInstance, mustPlayer } from "../query.js";
import { addPools, EMPTY_POOL, printedResources } from "../resources.js";
import { nextInt } from "../rng.js";
import {
  canAttack,
  cardsInPlay,
  categoriesOf,
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
import { moveCardsTo, selectCards, shuffleEncounterDeck } from "./cards.js";
import { checkDefeats } from "./defeat.js";
import { giveBoostCard } from "./enemy-activation.js";
import { applyEnterPlayKeywords, quickstrikeAttack } from "./enter-play.js";
import { addFrameVars, type Frame, pushEffects, pushEvents } from "./frames.js";
import { enterPlayOnReveal, revealFrame } from "./reveal.js";

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
      const amount = value(effect.amount);
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({
          kind: "dealDamage",
          targetInstanceId: id,
          amount,
          sourceInstanceId: frame.selfInstanceId,
          fromAttack: effect.fromAttack === true,
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
      const amount = value(effect.amount);
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
      if (!controller || !thwarter) return;
      const amount = value(effect.amount);
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
    case "atEndOfAttack": {
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
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        for (let i = 0; i < amount; i++) {
          const hand = mustPlayer(ctx.state, playerId).hand;
          if (hand.length === 0) break;
          const [index, rng] = nextInt(ctx.state.rng, hand.length);
          ctx.state = { ...ctx.state, rng };
          const picked = hand[index];
          if (picked) discardFromHand(ctx, playerId, picked);
        }
      }
      return;
    }
    case "revealTopOfEncounterDeck": {
      for (let i = 0; i < effect.count; i++) {
        const id = drawEncounterCard(ctx);
        if (!id) return;
        updateInstance(ctx, id, (instance) => ({ ...instance, faceup: true }));
        if (effect.then === "discard") moveCard(ctx, id, { kind: "encounterDiscard" }, "top");
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
      }
      return;
    }
    case "discardFromPlay":
      for (const id of targets(effect.target)) discardFromPlay(ctx, id);
      return;
    case "putIntoPlay": {
      const [controller] = resolvePlayers(ctx.state, effect.controller, context);
      if (!controller) return;
      const placed: InstanceId[] = [];
      for (const id of targets(effect.card)) {
        const card = cardOf(ctx.state, id);
        // Encounter cards other than minions enter where their type goes (villain area, host, play area).
        if (card && card.type !== "minion" && getInstance(ctx.state, id)?.ownerId === null && !cardsInPlay(ctx.state).includes(id)) {
          updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
          enterPlayOnReveal(ctx, id, controller);
          placed.push(id);
        }
      }
      const entering = targets(effect.card).filter((id) => !placed.includes(id));
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
      pushEvents(ctx, entered);
      return;
    }
    case "dealEncounterCard":
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        dealEncounterCardTo(ctx, playerId);
      }
      return;
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
    case "removeAccelerationToken":
      removeAccelerationToken(ctx);
      return;
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
        // Record what moved (and its printed resources) before it moves.
        const pool = ids.reduce((sum, id) => {
          const card = cardOf(ctx.state, id);
          return card ? addPools(sum, printedResources(card)) : sum;
        }, EMPTY_POOL);
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
      const attacking = effect.kind === "enemyAttack";
      const against = effect.against ? resolvePlayers(ctx.state, effect.against, context) : null;
      const events: TriggerEvent[] = [];
      for (const enemy of targets(effect.enemies)) {
        const categories = categoriesOf(ctx.state, enemy);
        if (!categories.includes("enemy") || !cardsInPlay(ctx.state).includes(enemy)) continue;
        if (enemy === ctx.state.villain.instanceId && ctx.state.villain.defeated) continue;
        const players = against ?? [getInstance(ctx.state, enemy)?.engagedWith ?? frame.controllerId].filter((p): p is PlayerId => p !== null);
        for (const playerId of players) {
          const player = getPlayer(ctx.state, playerId);
          if (!player || player.eliminated) continue;
          if (characterProfile(ctx.state, enemy, ctx.deps)?.missing.includes(attacking ? "atk" : "sch")) continue;
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
                  targetInstanceId: player.identity.instanceId,
                  ...(effect.kind === "enemyAttack" && effect.additionalResolution ? { additionalResolution: true } : {}),
                }
              : { kind: "enemyScheme", enemyInstanceId: enemy, playerId },
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
      const limit = ctx.state.encounterDeck.length + ctx.state.encounterDiscard.length;
      let found: InstanceId | null = null;
      for (let i = 0; i < limit && found === null; i++) {
        const id = drawEncounterCard(ctx);
        if (!id) break;
        updateInstance(ctx, id, (inst) => ({ ...inst, faceup: true }));
        moveCard(ctx, id, { kind: "encounterDiscard" }, "top");
        if (matchesQuery(ctx.state, id, effect.filter, context)) found = id;
      }
      const bind = effect.bind;
      updateFrame(ctx, frame.frameId, (f) =>
        f.kind === "effects" ? { ...f, bindings: { ...f.bindings, [bind]: found ? [found] : [] }, vars: { ...f.vars, [`${bind}.count`]: found ? 1 : 0 } } : f,
      );
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
          entered.push({ kind: "cardEntersPlay", instanceId: id, playerId });
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
      throw new EngineInvariantError(`${effect.kind} is handled before applyEffect`);
    case "reduceNextCardCost": {
      const amount = value(effect.amount);
      if (amount <= 0) return;
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        addLastingEffect(
          ctx,
          { kind: "costReduction", playerId, amount },
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
