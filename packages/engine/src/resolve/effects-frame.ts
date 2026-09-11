/** Stepping through an effects frame, including the effects that stop for a player choice. */

import type { EngineDeps } from "../abilities.js";
import { paymentOptions, paymentsFromOptionIds, payPayment, priceOrNull } from "../actions.js";
import type { ChoiceOption } from "../choices.js";
import { type Ctx, emit, popFrame, pushFrames, requestChoice, setFrame } from "../ctx.js";
import { discardFromHand } from "../effects.js";
import { type InstanceId, instanceId as asInstanceId } from "../ids.js";
import { cardOf, getPlayer, mustCardOf, playerOrder } from "../query.js";
import { combineRequirements, satisfies } from "../resources.js";
import {
  activeAbilityRefs,
  cardsInPlay,
  categoriesOf,
  controllerOf,
  type EffectContext,
  evaluate,
  resolvePlayers,
  resolveRef,
  resolveValue,
  selectTargets,
} from "../select.js";
import type { EffectSpec } from "../spec.js";
import type { TriggerCandidate } from "../stack.js";
import { effectChoiceAuthority, simultaneousOrderer } from "../villain/authority.js";
import { applyEffect } from "./apply-effect.js";
import { selectCards } from "./cards.js";
import { abilityFrame, type Frame, pushEffects, pushEvents } from "./frames.js";
import { candidateOption } from "./window.js";

const contextOf = (frame: Frame<"effects">, deps: EngineDeps): EffectContext => ({
  deps,
  scopedPlayerId: frame.scopedPlayerId,
  selfInstanceId: frame.selfInstanceId,
  controllerId: frame.controllerId,
  event: frame.event,
  bindings: frame.bindings,
  vars: frame.vars,
});

export function executeEffectsFrame(ctx: Ctx, frame: Frame<"effects">): void {
  const effect = frame.effects[frame.cursor];
  if (!effect) {
    popFrame(ctx);
    return;
  }
  const context = contextOf(frame, ctx.deps);

  if (effect.kind === "chooseCards") return executeChooseCards(ctx, frame, effect, context);
  if (effect.kind === "chooseOne") return executeChooseOne(ctx, frame, effect, context);
  if (effect.kind === "choosePlayer") return executeChoosePlayer(ctx, frame, effect, context);
  if (effect.kind === "resolveSpecials") return executeResolveSpecials(ctx, frame, effect, context);
  if (effect.kind === "assignDamage") return executeAssignDamage(ctx, frame, effect, context);
  if (effect.kind === "spendResources") return executeSpendResources(ctx, frame, effect, context);

  if (effect.kind === "chooseTarget") {
    if (frame.answer === null) return requestTargetChoice(ctx, frame, effect, context);
    const chosen = frame.answer.filter((id) => id !== "none").map((id) => asInstanceId(id));
    emit(ctx, { type: "targetChosen", slot: effect.slot, instanceIds: chosen });
    setFrame(ctx, {
      ...frame,
      answer: null,
      cursor: frame.cursor + 1,
      bindings: { ...frame.bindings, [effect.slot]: chosen },
    });
    return;
  }
  if (effect.kind === "discardFromHand" && effect.random !== true) {
    const [playerId] = resolvePlayers(ctx.state, effect.player, context);
    const player = playerId ? getPlayer(ctx.state, playerId) : undefined;
    const amount = Math.min(resolveValue(ctx.state, effect.amount, context), player?.hand.length ?? 0);
    if (!playerId || !player || amount <= 0) {
      setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
      return;
    }
    if (frame.answer === null) {
      requestChoice(ctx, {
        playerId,
        prompt: { kind: "chooseTarget", slot: "discard", abilityId: null },
        options: player.hand.map((id) => ({
          optionId: id,
          label: mustCardOf(ctx.state, id).name,
          ref: { kind: "card", instanceId: id },
        })),
        minSelections: amount,
        maxSelections: amount,
        frameId: frame.frameId,
      });
      return;
    }
    for (const optionId of frame.answer) discardFromHand(ctx, playerId, asInstanceId(optionId));
    setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
    return;
  }

  if ((effect.kind === "enemyAttack" || effect.kind === "enemyScheme") && orderEnemies(ctx, frame, effect, context)) return;

  setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
  applyEffect(ctx, effect, context, frame);
}

const ENEMY_ORDER_SLOT = "_enemyOrder";

/**
 * "Each Masters of Evil minion attacks the hero it is engaged with": one effect
 * makes several enemies attack (or scheme), one at a time. The attacks would
 * resolve simultaneously, so the first player orders them (RRG "First Player").
 * Returns true when it handled the effect (asked for the order, or applied it).
 */
function orderEnemies(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "enemyAttack" | "enemyScheme" }>,
  context: EffectContext,
): boolean {
  if (frame.answer !== null) {
    const bindings = { ...frame.bindings, [ENEMY_ORDER_SLOT]: frame.answer.map((id) => asInstanceId(id)) };
    const next: Frame<"effects"> = { ...frame, answer: null, cursor: frame.cursor + 1, bindings };
    setFrame(ctx, next);
    applyEffect(ctx, { ...effect, enemies: { kind: "slot", slot: ENEMY_ORDER_SLOT } }, { ...context, bindings }, next);
    return true;
  }
  const inPlay = cardsInPlay(ctx.state);
  const enemies = [...new Set(resolveRef(ctx.state, effect.enemies, context))].filter(
    (id) => inPlay.includes(id) && categoriesOf(ctx.state, id).includes("enemy"),
  );
  if (enemies.length < 2) return false;
  requestChoice(ctx, {
    playerId: simultaneousOrderer(ctx.state),
    authority: "firstPlayerOrders",
    prompt: { kind: "orderEnemies", activation: effect.kind === "enemyAttack" ? "attack" : "scheme" },
    options: cardOptions(ctx, enemies),
    minSelections: enemies.length,
    maxSelections: enemies.length,
    frameId: frame.frameId,
    ordered: true,
  });
  return true;
}

const cardOptions = (ctx: Ctx, ids: readonly InstanceId[]): readonly ChoiceOption[] =>
  ids.map((id) => ({ optionId: id, label: mustCardOf(ctx.state, id).name, ref: { kind: "card", instanceId: id } as const }));

function executeChooseCards(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "chooseCards" }>,
  context: EffectContext,
): void {
  if (frame.answer !== null) {
    const chosen = frame.answer.map((id) => asInstanceId(id));
    emit(ctx, { type: "targetChosen", slot: effect.slot, instanceIds: chosen });
    setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1, bindings: { ...frame.bindings, [effect.slot]: chosen } });
    return;
  }
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  let candidates = selectCards(ctx, effect.from, context);
  if (effect.distinctNames) {
    const seen = new Set<string>();
    candidates = candidates.filter((id) => {
      const name = cardOf(ctx.state, id)?.name ?? id;
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }
  const max = Math.min(effect.max, candidates.length);
  if (!chooser || max === 0) {
    setFrame(ctx, { ...frame, cursor: frame.cursor + 1, bindings: { ...frame.bindings, [effect.slot]: [] } });
    return;
  }
  requestChoice(ctx, {
    playerId: chooser,
    authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, effect.chooser),
    prompt: { kind: "chooseCards", slot: effect.slot },
    // "Different cards" by name: the offered ids are one per name, so any selection is legal.
    options: cardOptions(ctx, candidates),
    minSelections: Math.min(effect.min, max),
    maxSelections: max,
    frameId: frame.frameId,
  });
}

function executeChooseOne(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "chooseOne" }>,
  context: EffectContext,
): void {
  const available = effect.options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !option.condition || evaluate(ctx.state, option.condition, context));
  const pickedIndex =
    frame.answer !== null ? Number(frame.answer[0]) : available.length === 1 ? (available[0]?.index ?? -1) : null;
  if (pickedIndex === null) {
    const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
    if (!chooser || available.length === 0) {
      setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
      return;
    }
    requestChoice(ctx, {
      playerId: chooser,
      prompt: { kind: "chooseOption" },
      options: available.map(({ option, index }) => ({ optionId: String(index), label: option.label, ref: { kind: "none" } as const })),
      minSelections: 1,
      maxSelections: 1,
      frameId: frame.frameId,
    });
    return;
  }
  setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
  const chosen = effect.options[pickedIndex];
  if (!chosen) return;
  emit(ctx, { type: "optionChosen", label: chosen.label, index: pickedIndex });
  pushEffects(ctx, {
    effects: chosen.effects,
    selfInstanceId: frame.selfInstanceId,
    controllerId: frame.controllerId,
    event: frame.event,
    eventFrameId: frame.eventFrameId,
    bindings: frame.bindings,
    vars: frame.vars,
    scopedPlayerId: frame.scopedPlayerId,
  });
}

function executeChoosePlayer(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "choosePlayer" }>,
  context: EffectContext,
): void {
  if (frame.answer !== null) {
    const identities = frame.answer
      .map((playerId) => ctx.state.players.find((p) => p.playerId === playerId)?.identity.instanceId)
      .filter((id): id is InstanceId => id !== undefined);
    setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1, bindings: { ...frame.bindings, [effect.slot]: identities } });
    return;
  }
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  const players = playerOrder(ctx.state);
  if (!chooser || players.length === 0) {
    setFrame(ctx, { ...frame, cursor: frame.cursor + 1, bindings: { ...frame.bindings, [effect.slot]: [] } });
    return;
  }
  requestChoice(ctx, {
    playerId: chooser,
    authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, effect.chooser),
    prompt: { kind: "choosePlayer", slot: effect.slot },
    options: players.map((p) => ({ optionId: p.playerId, label: p.playerId, ref: { kind: "player", playerId: p.playerId } as const })),
    minSelections: 1,
    maxSelections: 1,
    frameId: frame.frameId,
  });
}

/**
 * "Either spend [E][M][P] resources or …": the player picks a payment from their
 * usual payment options (hand cards, resource abilities). A payment that covers
 * the requirement is spent and `<bind>.made` is 1; selecting nothing or too
 * little spends nothing and `<bind>.made` is 0.
 */
function executeSpendResources(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "spendResources" }>,
  context: EffectContext,
): void {
  const [playerId] = resolvePlayers(ctx.state, effect.player, context);
  const requirement = combineRequirements(effect.resources, 0);
  const finish = (paid: boolean): void =>
    setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1, vars: { ...frame.vars, [`${effect.bind}.made`]: paid ? 1 : 0 } });
  if (frame.answer === null) {
    const options = playerId ? paymentOptions(ctx, playerId, null) : [];
    if (!playerId || options.length === 0) return finish(false);
    requestChoice(ctx, {
      playerId,
      prompt: { kind: "spendResources", requirement },
      options,
      minSelections: 0,
      maxSelections: options.length,
      frameId: frame.frameId,
    });
    return;
  }
  const payment = paymentsFromOptionIds(frame.answer);
  const pool = playerId && payment.length > 0 ? priceOrNull(ctx, playerId, payment, null, null) : null;
  const paid = pool !== null && satisfies(pool, requirement);
  finish(paid);
  if (paid && playerId) payPayment(ctx, playerId, payment);
}

/**
 * "Assign X damage among …": one choice per point, tracked in the frame's vars
 * (`_assign.left`, `_assign.to.<id>`); then each chosen character takes its
 * share as a single damage event.
 */
function executeAssignDamage(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "assignDamage" }>,
  context: EffectContext,
): void {
  const vars: Record<string, number> = { ...frame.vars };
  if (vars["_assign.left"] === undefined) vars["_assign.left"] = Math.max(0, resolveValue(ctx.state, effect.amount, context, ctx.deps));
  if (frame.answer !== null) {
    const [picked] = frame.answer;
    if (picked) vars[`_assign.to.${picked}`] = (vars[`_assign.to.${picked}`] ?? 0) + 1;
    vars["_assign.left"] = (vars["_assign.left"] ?? 1) - 1;
  }
  const legal = selectTargets(ctx.state, effect.among, context);
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  if ((vars["_assign.left"] ?? 0) > 0 && legal.length > 0 && chooser) {
    setFrame(ctx, { ...frame, answer: null, vars });
    requestChoice(ctx, {
      playerId: chooser,
      authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, effect.chooser),
      prompt: { kind: "chooseTarget", slot: "assignDamage", abilityId: null },
      options: cardOptions(ctx, legal),
      minSelections: 1,
      maxSelections: 1,
      frameId: frame.frameId,
    });
    return;
  }
  const shares = Object.entries(vars).filter(([key]) => key.startsWith("_assign.to."));
  const cleaned = Object.fromEntries(Object.entries(vars).filter(([key]) => !key.startsWith("_assign.")));
  setFrame(ctx, { ...frame, answer: null, vars: cleaned, cursor: frame.cursor + 1 });
  pushEvents(
    ctx,
    shares.map(([key, amount]) => ({
      kind: "dealDamage",
      targetInstanceId: asInstanceId(key.slice("_assign.to.".length)),
      amount,
      sourceInstanceId: frame.selfInstanceId,
      fromAttack: false,
    })),
  );
}

/** RRG "Special": each special ability is a step of the sequence; the last step gets `sequence.final`. */
function executeResolveSpecials(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "resolveSpecials" }>,
  context: EffectContext,
): void {
  const steps: TriggerCandidate[] = [];
  for (const id of selectTargets(ctx.state, effect.cards, context)) {
    for (const ref of activeAbilityRefs(ctx.state, id)) {
      if (ctx.deps.abilities[ref.id]?.trigger.kind !== "special") continue;
      steps.push({ instanceId: id, abilityId: ref.id, controllerId: controllerOf(ctx.state, id), forced: true, fromHand: false });
    }
  }
  const key = (c: TriggerCandidate) => `${c.instanceId}:${c.abilityId}`;
  let ordered = steps;
  if (frame.answer !== null) {
    const byKey = new Map(steps.map((c) => [key(c), c]));
    ordered = frame.answer.map((k) => byKey.get(k)).filter((c): c is TriggerCandidate => c !== undefined);
  } else if (steps.length > 1 && frame.controllerId) {
    requestChoice(ctx, {
      playerId: frame.controllerId,
      prompt: { kind: "orderSpecials" },
      options: steps.map(candidateOption(ctx.state)),
      minSelections: steps.length,
      maxSelections: steps.length,
      frameId: frame.frameId,
      ordered: true,
    });
    return;
  }
  setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
  pushFrames(
    ctx,
    ordered.map((step, index) =>
      abilityFrame(ctx, step, frame.event, null, {}, { "sequence.step": index + 1, "sequence.final": index === ordered.length - 1 ? 1 : 0 }),
    ),
  );
}

function requestTargetChoice(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "chooseTarget" }>,
  context: EffectContext,
): void {
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  const legal = selectTargets(ctx.state, effect.query, context);
  if (!chooser || legal.length === 0) {
    // RRG "Choose (Game Element)": with no legal target there is nothing to choose.
    setFrame(ctx, { ...frame, cursor: frame.cursor + 1, bindings: { ...frame.bindings, [effect.slot]: [] } });
    return;
  }
  const count = Math.min(effect.count ?? 1, legal.length);
  requestChoice(ctx, {
    playerId: chooser,
    authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, effect.chooser),
    prompt: { kind: "chooseTarget", slot: effect.slot, abilityId: null },
    options: legal.map((id) => ({
      optionId: id,
      label: mustCardOf(ctx.state, id).name,
      ref: { kind: "card", instanceId: id } as const,
    })),
    minSelections: effect.optional ? 0 : count,
    maxSelections: count,
    frameId: frame.frameId,
  });
}
