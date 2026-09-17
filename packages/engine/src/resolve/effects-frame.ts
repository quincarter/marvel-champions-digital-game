/** Stepping through an effects frame, including the effects that stop for a player choice. */

import type { EngineDeps } from "../abilities.js";
import { paymentOptions, paymentsFromOptionIds, payPayment, priceOrNull } from "../actions.js";
import type { ChoiceOption } from "../choices.js";
import { type Ctx, emit, moveCard, popFrame, pushFrames, requestChoice, setFrame } from "../ctx.js";
import { dealEncounterCardTo, discardFromHand } from "../effects.js";
import { type InstanceId, instanceId as asInstanceId, playerId as asPlayerId, type PlayerId } from "../ids.js";
import { activeEncounterDeckId, cardOf, characterProfile, getInstance, getPlayer, mustCardOf, playerOrder } from "../query.js";
import { cannotTakeDamage } from "../rules.js";
import { combineRequirements, satisfies } from "../resources.js";
import {
  activeAbilityRefs,
  cardsInPlay,
  categoriesOf,
  controllerOf,
  type EffectContext,
  evaluate,
  matchesQuery,
  resolvePlayers,
  resolveRef,
  resolveValue,
  selectTargets,
} from "../select.js";
import type { EffectSpec } from "../spec.js";
import type { TriggerCandidate } from "../stack.js";
import { effectChoiceAuthority, simultaneousOrderer } from "../villain/authority.js";
import { applyEffect } from "./apply-effect.js";
import { damageGroupFrame } from "./damage-group.js";
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
  if (effect.kind === "dealIndirectDamage") return executeDealIndirectDamage(ctx, frame, effect, context);
  if (effect.kind === "spendResources") return executeSpendResources(ctx, frame, effect, context);
  if (effect.kind === "dealEncounterCard") return executeDealEncounterCards(ctx, frame, effect, context);
  if (effect.kind === "reorderCards") return executeReorderCards(ctx, frame, effect, context);

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
  if (effect.kind === "discardFromHand" && effect.random !== true) return executeDiscardFromHand(ctx, frame, effect, context);

  if ((effect.kind === "enemyAttack" || effect.kind === "enemyScheme") && orderEnemies(ctx, frame, effect, context)) return;

  setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
  applyEffect(ctx, effect, context, frame);
}

const DISCARD_HAND = "_discardHand.";

/**
 * "Discard N cards from your hand" / "Each player must choose and discard 1 resource of any type from their hand"
 * (Power Drain): one choice per player, in player order, tracked in the frame's vars (`_discardHand.index`) exactly
 * the way `dealIndirectDamage` tracks its assigners, so the resolution is one choice at a time and replays
 * deterministically.
 *
 * `filter` narrows the candidates to the cards the text names ("a resource of any type" → a printed resource icon of
 * any of the four types; ruling, Jan 11, 2026 (3)). A player is asked for at most as many as they actually hold that
 * match: "must … discard" is satisfied by discarding every matching card when they hold fewer than the count, and a
 * player who holds none is skipped without a choice. That is the same "do what you can" the random form has always
 * used (`discardRandomFromHand`; ruling, Feb 28, 2026 (4), a hand of one still discards it).
 */
function executeDiscardFromHand(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "discardFromHand" }>,
  context: EffectContext,
): void {
  const { filter } = effect;
  const players = resolvePlayers(ctx.state, effect.player, context).filter((id) => getPlayer(ctx.state, id)?.eliminated === false);
  const vars: Record<string, number> = { ...frame.vars };
  let index = vars[`${DISCARD_HAND}index`] ?? 0;
  if (frame.answer !== null) {
    const answering = players[index];
    if (answering) for (const optionId of frame.answer) discardFromHand(ctx, answering, asInstanceId(optionId));
    index += 1;
  }
  for (; index < players.length; index++) {
    const playerId = players[index];
    const player = playerId ? getPlayer(ctx.state, playerId) : undefined;
    if (!playerId || !player) continue;
    const candidates = filter ? player.hand.filter((id) => matchesQuery(ctx.state, id, filter, context)) : player.hand;
    const amount = Math.min(resolveValue(ctx.state, effect.amount, context, ctx.deps), candidates.length);
    if (amount <= 0) continue;
    setFrame(ctx, { ...frame, answer: null, vars: { ...vars, [`${DISCARD_HAND}index`]: index } });
    requestChoice(ctx, {
      playerId,
      prompt: { kind: "chooseTarget", slot: "discard", abilityId: null },
      options: cardOptions(ctx, candidates),
      minSelections: amount,
      maxSelections: amount,
      frameId: frame.frameId,
    });
    return;
  }
  const cleaned = Object.fromEntries(Object.entries(vars).filter(([key]) => !key.startsWith(DISCARD_HAND)));
  setFrame(ctx, { ...frame, answer: null, vars: cleaned, cursor: frame.cursor + 1 });
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

/**
 * "Deal N encounter cards to each player" (Green Goblin II). RRG 1.8 "Each Player" (p. 17): "If the effect does not
 * specify what order the players resolve the effect in, the first player decides the order"; ruling, Jan 26, 2026 (4)
 * answer 3: "the first player chooses the order players receive cards, and cards are dealt simultaneously.
 * Distribution is AABB or BBAA." So one player's whole share is dealt before the next player's, and the first player
 * orders the players. One player receiving cards is dealt to without asking, exactly as before.
 */
function executeDealEncounterCards(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "dealEncounterCard" }>,
  context: EffectContext,
): void {
  const players = resolvePlayers(ctx.state, effect.player, context).filter((id) => getPlayer(ctx.state, id)?.eliminated === false);
  const count = effect.count === undefined ? 1 : Math.max(0, resolveValue(ctx.state, effect.count, context, ctx.deps));
  if (frame.answer === null && players.length > 1 && count > 0) {
    requestChoice(ctx, {
      playerId: simultaneousOrderer(ctx.state),
      authority: "firstPlayerOrders",
      prompt: { kind: "orderPlayers", reason: "dealEncounterCards" },
      options: players.map((id) => ({ optionId: id, label: id, ref: { kind: "player", playerId: id } as const })),
      minSelections: players.length,
      maxSelections: players.length,
      frameId: frame.frameId,
      ordered: true,
    });
    return;
  }
  const answered = (frame.answer ?? []).map((id) => asPlayerId(id)).filter((id) => players.includes(id));
  const order = answered.length === players.length ? answered : players;
  setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
  for (const playerId of order) {
    for (let i = 0; i < count; i++) dealEncounterCardTo(ctx, playerId);
  }
}

/**
 * "Discard 1 of them and put the others back in any order" (Heimdall). RRG 1.8 "Deck" (p. 15): a deck's order changes
 * only when a card instructs it. The cards go back on top of the encounter deck they were looked at — the active
 * villain's (§3.2) — with the first card chosen ending up on top. One card needs no ordering.
 */
function executeReorderCards(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "reorderCards" }>,
  context: EffectContext,
): void {
  const ids = selectCards(ctx, effect.cards, context);
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  if (frame.answer === null && ids.length > 1 && chooser) {
    requestChoice(ctx, {
      playerId: chooser,
      authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, effect.chooser),
      prompt: { kind: "orderCards", to: effect.to },
      options: cardOptions(ctx, ids),
      minSelections: ids.length,
      maxSelections: ids.length,
      frameId: frame.frameId,
      ordered: true,
    });
    return;
  }
  const answered = (frame.answer ?? []).map((id) => asInstanceId(id)).filter((id) => ids.includes(id));
  const order = answered.length === ids.length ? answered : ids;
  setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
  const deckId = activeEncounterDeckId(ctx.state);
  // Placed one at a time on top, last first, so the first card chosen ends up on top.
  for (const id of [...order].reverse()) moveCard(ctx, id, { kind: "encounterDeck", deckId }, "top");
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

const INDIRECT = "_indirect.";

/** The characters a player (or the group) may assign indirect damage to: identities and allies they control. */
function indirectAssigners(
  ctx: Ctx,
  to: Extract<EffectSpec, { kind: "dealIndirectDamage" }>["to"],
  context: EffectContext,
): readonly { readonly playerId: PlayerId; readonly characters: readonly InstanceId[] }[] {
  const controlledBy = (playerId: PlayerId): readonly InstanceId[] => {
    const player = getPlayer(ctx.state, playerId);
    if (!player || player.eliminated) return [];
    const allies = player.playArea.filter((id) => controllerOf(ctx.state, id) === playerId && categoriesOf(ctx.state, id).includes("character"));
    return [player.identity.instanceId, ...allies];
  };
  // "Dealt to a group of players … as the group chooses": the first player submits it (docs/phase7-wave1.md §4.7).
  if (to === "group") return [{ playerId: ctx.state.firstPlayerId, characters: playerOrder(ctx.state).flatMap((p) => controlledBy(p.playerId)) }];
  return resolvePlayers(ctx.state, to, context)
    .map((playerId) => ({ playerId, characters: controlledBy(playerId) }))
    .filter((assigner) => assigner.characters.length > 0);
}

/**
 * RRG 1.8 "Indirect Damage" (p. 24). Players assign in player order, each on their own choice; the order is not asked
 * of the first player ("Each Player", p. 17) because the assignments are independent and resolve together. A forced
 * split (one eligible character, or every cap reached) is made without asking. Then every share resolves as one
 * `damageGroup`.
 */
function executeDealIndirectDamage(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "dealIndirectDamage" }>,
  context: EffectContext,
): void {
  const vars: Record<string, number> = { ...frame.vars };
  vars[`${INDIRECT}amount`] ??= Math.max(0, resolveValue(ctx.state, effect.amount, context, ctx.deps));
  const amount = vars[`${INDIRECT}amount`] ?? 0;
  const assign = (id: InstanceId, points: number): void => {
    vars[`${INDIRECT}to.${id}`] = (vars[`${INDIRECT}to.${id}`] ?? 0) + points;
  };
  let index = vars[`${INDIRECT}index`] ?? 0;
  if (frame.answer !== null) {
    for (const optionId of frame.answer) assign(asInstanceId(optionId.slice(0, optionId.lastIndexOf("#"))), 1);
    index += 1;
  }
  const assigners = indirectAssigners(ctx, effect.to, context);
  for (; index < assigners.length; index++) {
    const assigner = assigners[index];
    if (!assigner) break;
    // "A character cannot be assigned more indirect damage than would cause it to be defeated", and "characters that
    // cannot take damage cannot be assigned indirect damage".
    const caps: Record<string, number> = {};
    for (const id of assigner.characters) {
      const max = characterProfile(ctx.state, id, ctx.deps)?.maxHp;
      const remaining = max === undefined ? 0 : max - (getInstance(ctx.state, id)?.damage ?? 0);
      if (remaining > 0 && !cannotTakeDamage(ctx.state, ctx.deps, id, [frame.selfInstanceId])) caps[id] = remaining;
    }
    const eligible = Object.keys(caps).map((id) => asInstanceId(id));
    const total = eligible.reduce((sum, id) => sum + (caps[id] ?? 0), 0);
    const assignable = Math.min(amount, total);
    if (assignable === 0) continue;
    const [only] = eligible;
    if (eligible.length === 1 && only) {
      assign(only, assignable);
      continue;
    }
    if (assignable === total) {
      for (const id of eligible) assign(id, caps[id] ?? 0);
      continue;
    }
    setFrame(ctx, { ...frame, answer: null, vars: { ...vars, [`${INDIRECT}index`]: index } });
    requestChoice(ctx, {
      playerId: assigner.playerId,
      authority: "player",
      prompt: { kind: "assignIndirectDamage", amount: assignable, caps },
      options: eligible.flatMap((id) =>
        Array.from({ length: caps[id] ?? 0 }, (_, n) => ({
          optionId: `${id}#${n + 1}`,
          label: `${mustCardOf(ctx.state, id).name} (${n + 1})`,
          ref: { kind: "card", instanceId: id } as const,
        })),
      ),
      minSelections: assignable,
      maxSelections: assignable,
      frameId: frame.frameId,
    });
    return;
  }
  const shares = Object.entries(vars).filter(([key, points]) => key.startsWith(`${INDIRECT}to.`) && points > 0);
  const cleaned = Object.fromEntries(Object.entries(vars).filter(([key]) => !key.startsWith(INDIRECT)));
  setFrame(ctx, { ...frame, answer: null, vars: cleaned, cursor: frame.cursor + 1 });
  if (shares.length === 0) return;
  pushFrames(ctx, [
    damageGroupFrame(
      ctx,
      shares.map(([key, points]) => ({
        kind: "dealDamage",
        targetInstanceId: asInstanceId(key.slice(`${INDIRECT}to.`.length)),
        amount: points,
        sourceInstanceId: frame.selfInstanceId,
        fromAttack: false,
      })),
      effect.bind ? { frameId: frame.frameId, prefix: effect.bind } : null,
    ),
  ]);
}

/** RRG "Special": each special ability is a step of the sequence; the last step gets `sequence.final`. */
function executeResolveSpecials(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "resolveSpecials" }>,
  context: EffectContext,
): void {
  const steps: TriggerCandidate[] = [];
  // Cards in play (`cards`), or cards a ref names wherever they are (`of`): an Invocation card resolves from its deck.
  const sources = effect.of
    ? resolveRef(ctx.state, effect.of, context).filter((id) => getInstance(ctx.state, id) !== undefined)
    : effect.cards
      ? selectTargets(ctx.state, effect.cards, context)
      : [];
  for (const id of sources) {
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
  // "X enemies": the count can be a value bound earlier in the ability (Shield Toss).
  const wanted =
    effect.count === undefined ? 1 : typeof effect.count === "number" ? effect.count : Math.max(0, resolveValue(ctx.state, effect.count, context, ctx.deps));
  if (!chooser || legal.length === 0 || wanted <= 0) {
    // RRG "Choose (Game Element)": with no legal target there is nothing to choose.
    setFrame(ctx, { ...frame, cursor: frame.cursor + 1, bindings: { ...frame.bindings, [effect.slot]: [] } });
    return;
  }
  const count = Math.min(wanted, legal.length);
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
