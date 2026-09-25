/** Stepping through an effects frame, including the effects that stop for a player choice. */

import type { EngineDeps } from "../abilities.js";
import {
  hostChoicesForEffectPlay,
  hostForEffectPlay,
  paymentOptions,
  paymentsFromOptionIds,
  announceResourcesSpent,
  payPayment,
  playFromEffectRequirement,
  playIgnoringCost,
  playIgnoringCostFault,
  playWithPayment,
  playWithPaymentFault,
  priceOrNull,
} from "../actions.js";
import type { ChoiceOption, ChoicePrompt } from "../choices.js";
import { type Ctx, emit, moveCard, popFrame, pushFrames, requestChoice, setFrame, updateFrame } from "../ctx.js";
import { dealEncounterCardTo, discardFromHand, setForm } from "../effects.js";
import { cannotChangeForm } from "../rules.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { type InstanceId, instanceId as asInstanceId, playerId as asPlayerId, type PlayerId } from "../ids.js";
import {
  activeEncounterDeckId,
  cardOf,
  characterProfile,
  getInstance,
  getPlayer,
  heroFacesOf,
  locateCard,
  mustCardOf,
  playerOrder,
} from "../query.js";
import { cannotChooseToDiscard, cannotTakeDamage } from "../rules.js";
import { combineRequirements, satisfies } from "../resources.js";
import {
  activeAbilityRefs,
  cardsInPlay,
  categoriesOf,
  contextArea,
  controllerOf,
  type EffectContext,
  evaluate,
  isPlayerCard,
  MAIN_SCHEME_CHOICE,
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
import { controllerOfArea, joinGameArea } from "./game-areas.js";
import { damageGroupFrame } from "./damage-group.js";
import { selectCards } from "./cards.js";
import { abilityFrame, addFrameVars, type Frame, pushEffects, pushEvents } from "./frames.js";
import { hasKeyword, keywordTotal } from "../keywords.js";
import { candidateOption } from "./window.js";
import { threatRemovalBlocked } from "./event.js";

/** The `EffectContext` an effects frame resolves in. Exported so `why-not.ts` can rebuild it exactly. */
export const contextOf = (frame: Frame<"effects">, deps: EngineDeps): EffectContext => ({
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
    // A finished branch hands what it bound back to the frame that ran it (docs/phase7-wave4.md §3.43).
    if (frame.returnBindingsTo) {
      updateFrame(ctx, frame.returnBindingsTo, (parent) =>
        parent.kind === "effects"
          ? { ...parent, bindings: { ...parent.bindings, ...frame.bindings }, vars: { ...parent.vars, ...frame.vars } }
          : parent,
      );
    }
    return;
  }
  const context = contextOf(frame, ctx.deps);

  // Two main schemes (Tower Defense, docs/phase7-wave4.md §3.2): "When a someone plays a card that refers to 'the main
  // scheme,' that card's controller must choose which of the two schemes it is referring to" (MC21 p. 10). Asked once
  // per ability, just before the first effect that names it, and read by `resolveRef` from the binding.
  if (needsMainSchemeChoice(ctx, frame, effect)) {
    const choose: EffectSpec = {
      kind: "chooseTarget",
      slot: MAIN_SCHEME_CHOICE,
      query: { categories: ["mainScheme"] },
      chooser: { kind: "controller" },
    };
    setFrame(ctx, {
      ...frame,
      effects: [...frame.effects.slice(0, frame.cursor), choose, ...frame.effects.slice(frame.cursor)],
    });
    return;
  }
  if (effect.kind === "chooseCards") return executeChooseCards(ctx, frame, effect, context);
  if (effect.kind === "chooseOne") return executeChooseOne(ctx, frame, effect, context);
  if (effect.kind === "choosePlayer") return executeChoosePlayer(ctx, frame, effect, context);
  if (effect.kind === "resolveSpecials") return executeResolveSpecials(ctx, frame, effect, context);
  if (effect.kind === "assignDamage") return executeAssignDamage(ctx, frame, effect, context);
  if (effect.kind === "dealIndirectDamage") return executeDealIndirectDamage(ctx, frame, effect, context);
  if (effect.kind === "spendResources") return executeSpendResources(ctx, frame, effect, context);
  if (effect.kind === "dealEncounterCard") return executeDealEncounterCards(ctx, frame, effect, context);
  if (effect.kind === "reorderCards") return executeReorderCards(ctx, frame, effect, context);
  if (effect.kind === "changeForm") return executeChangeForm(ctx, frame, effect, context);
  if (effect.kind === "joinGameArea") return executeJoinGameArea(ctx, frame, context);
  if (effect.kind === "divide") return executeDivide(ctx, frame, effect, context);
  if (effect.kind === "playFromHand") return executePlayFromHand(ctx, frame, effect, context);

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
  if (effect.kind === "discardFromHand" && effect.random !== true)
    return executeDiscardFromHand(ctx, frame, effect, context);

  if ((effect.kind === "enemyAttack" || effect.kind === "enemyScheme") && orderEnemies(ctx, frame, effect, context))
    return;

  setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
  applyEffect(ctx, effect, context, frame);
}

/**
 * Whether a player card's effect about to resolve names "the main scheme" while two are in play in the shared area and
 * the player has not yet chosen one for this ability (docs/phase7-wave4.md §3.2).
 */
function needsMainSchemeChoice(ctx: Ctx, frame: Frame<"effects">, effect: EffectSpec): boolean {
  if ((ctx.state.extraMainSchemes ?? []).length === 0 || frame.bindings[MAIN_SCHEME_CHOICE]) return false;
  if (frame.controllerId === null || !isPlayerCard(ctx.state, frame.selfInstanceId)) return false;
  if (contextArea(ctx.state, contextOf(frame, ctx.deps))) return false;
  return JSON.stringify(effect).includes('{"kind":"mainScheme"}');
}

/**
 * `EffectSpec playFromHand` (docs/phase7-wave2.md §3.8, §9): the player picks a card from their hand and plays it,
 * either ignoring its cost (Chaos Magic) or paying a reduced one (Team-Building Exercise).
 *
 * The paid mode needs up to three answers inside one effect step, so it runs as a small state machine on the frame's
 * own vars (`_play.step`), the way `assignDamage` does: **pick the card → pick a host, if the upgrade has more than
 * one → pick a payment**. Nothing is spent until the last step, and a payment that does not cover the reduced cost
 * plays nothing at all (RRG 1.8 "Initiating Abilities", p. 24, step 5: "abort this process without paying any costs").
 */
function executePlayFromHand(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "playFromHand" }>,
  context: EffectContext,
): void {
  const [playerId] = resolvePlayers(ctx.state, effect.player, context);
  const reduction =
    effect.costReduction === undefined
      ? 0
      : Math.max(0, resolveValue(ctx.state, effect.costReduction, context, ctx.deps));
  const paying = effect.ignoreCost !== true;
  const from = effect.from ?? "hand";
  const fault = (id: InstanceId, player: PlayerId): string | null =>
    paying ? playWithPaymentFault(ctx, player, id, reduction, from) : playIgnoringCostFault(ctx, player, id, from);
  const candidates = playerId
    ? (getPlayer(ctx.state, playerId)?.[from] ?? []).filter(
        (id) => !fault(id, playerId) && (!effect.filter || matchesQuery(ctx.state, id, effect.filter, context)),
      )
    : [];
  const step = frame.vars["_play.step"] ?? 0;
  const done = (): void => {
    const vars = Object.fromEntries(Object.entries(frame.vars).filter(([key]) => !key.startsWith("_play.")));
    const bindings = Object.fromEntries(Object.entries(frame.bindings).filter(([key]) => !key.startsWith("_play.")));
    setFrame(ctx, { ...frame, answer: null, vars, bindings, cursor: frame.cursor + 1 });
  };

  if (step === 0) {
    if (frame.answer === null && playerId && candidates.length > 0) {
      requestChoice(ctx, {
        playerId,
        prompt: { kind: "chooseCards", slot: "playFromHand" },
        options: cardOptions(ctx, candidates),
        minSelections: effect.optional ? 0 : 1,
        maxSelections: 1,
        frameId: frame.frameId,
      });
      return;
    }
    const [picked] = (frame.answer ?? []).map((id) => asInstanceId(id)).filter((id) => candidates.includes(id));
    if (!playerId || !picked) return done();
    if (!paying) {
      done();
      playIgnoringCost(ctx, playerId, picked, from);
      return;
    }
    // A host is only a question when the upgrade names one and several are legal (RRG 1.8 "Attach To", p. 8).
    const choices = hostChoicesForEffectPlay(ctx, playerId, picked);
    setFrame(ctx, {
      ...frame,
      answer: null,
      vars: { ...frame.vars, "_play.step": choices.length > 1 ? 1 : 2 },
      bindings: { ...frame.bindings, "_play.card": [picked] },
    });
    return;
  }

  const [card] = frame.bindings["_play.card"] ?? [];
  if (!playerId || !card) return done();

  if (step === 1) {
    const choices = hostChoicesForEffectPlay(ctx, playerId, card);
    if (frame.answer === null) {
      requestChoice(ctx, {
        playerId,
        prompt: { kind: "chooseTarget", slot: "playFromHandHost", abilityId: null },
        options: cardOptions(ctx, choices),
        minSelections: 1,
        maxSelections: 1,
        frameId: frame.frameId,
      });
      return;
    }
    const [host] = (frame.answer ?? []).map((id) => asInstanceId(id)).filter((id) => choices.includes(id));
    if (!host) return done();
    setFrame(ctx, {
      ...frame,
      answer: null,
      vars: { ...frame.vars, "_play.step": 2 },
      bindings: { ...frame.bindings, "_play.host": [host] },
    });
    return;
  }

  const [chosenHost] = frame.bindings["_play.host"] ?? [];
  const attachTo = chosenHost ?? hostForEffectPlay(ctx, playerId, card) ?? null;
  const requirement = playFromEffectRequirement(ctx, playerId, card, attachTo, reduction);
  if (requirement === null) return done();

  if (frame.answer === null) {
    const needed =
      requirement.generic + requirement.physical + requirement.mental + requirement.energy + (requirement.wild ?? 0);
    const options = needed > 0 ? paymentOptions(ctx, playerId, card) : [];
    if (options.length > 0) {
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
  }
  const payment = paymentsFromOptionIds(frame.answer ?? []);
  done();
  playWithPayment(ctx, playerId, card, payment, attachTo, reduction);
}

/**
 * Whether a point of an "up to" division could do anything to `id` (RRG 1.8 "Target", p. 43): a scheme holding threat
 * this removal is allowed to take (the same check `removeThreat` makes as it applies, crisis and rules included), or a
 * character that can take damage from this card.
 */
function divisionCanAffect(ctx: Ctx, what: "damage" | "threat", id: InstanceId, frame: Frame<"effects">): boolean {
  if (what === "damage") return !cannotTakeDamage(ctx.state, ctx.deps, id, [frame.selfInstanceId]);
  const scheme = getInstance(ctx.state, id);
  return (
    scheme !== undefined &&
    scheme.threat > 0 &&
    threatRemovalBlocked(ctx.state, ctx.deps, id, frame.selfInstanceId) === null
  );
}

/** `EffectSpec divide` (docs/phase7-wave2.md §3.7): see there. */
function executeDivide(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "divide" }>,
  context: EffectContext,
): void {
  const amount = Math.max(0, resolveValue(ctx.state, effect.amount, context, ctx.deps));
  const matched = selectTargets(ctx.state, effect.among, context);
  // "Up to" (docs/phase7-wave3.md §3.41, §4 Q16): at least 1 point whenever something can be targeted, so only
  // targets the division can affect are offered (RRG 1.8 "Target", p. 43), and with none nothing happens.
  const candidates = effect.upTo ? matched.filter((id) => divisionCanAffect(ctx, effect.what, id, frame)) : matched;
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  // "Up to" (docs/phase7-wave3.md §3.41): how many is the chooser's, so even a single candidate is asked.
  const asks = candidates.length > 1 || (effect.upTo === true && candidates.length === 1);
  if (frame.answer === null && asks && amount > 0 && chooser) {
    requestChoice(ctx, {
      playerId: chooser,
      authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, effect.chooser),
      prompt: { kind: "divide", what: effect.what, amount },
      options: candidates.flatMap((id) =>
        Array.from({ length: amount }, (_, n) => ({
          optionId: `${id}#${n + 1}`,
          label: `${mustCardOf(ctx.state, id).name} (${n + 1})`,
          ref: { kind: "card", instanceId: id } as const,
        })),
      ),
      minSelections: effect.upTo ? 1 : amount,
      maxSelections: amount,
      frameId: frame.frameId,
    });
    return;
  }
  const shares = new Map<InstanceId, number>();
  if (frame.answer !== null) {
    for (const optionId of frame.answer) {
      const id = asInstanceId(optionId.slice(0, optionId.lastIndexOf("#")));
      if (candidates.includes(id)) shares.set(id, (shares.get(id) ?? 0) + 1);
    }
  } else if (candidates[0] && amount > 0) {
    shares.set(candidates[0], amount);
  }
  setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
  if (shares.size === 0) return;
  if (effect.what === "damage") {
    pushFrames(ctx, [
      damageGroupFrame(
        ctx,
        [...shares].map(([targetInstanceId, points]) => ({
          kind: "dealDamage",
          targetInstanceId,
          amount: points,
          sourceInstanceId: frame.selfInstanceId,
          fromAttack: false,
        })),
        effect.bind ? { frameId: frame.frameId, prefix: effect.bind } : null,
      ),
    ]);
    return;
  }
  pushEvents(
    ctx,
    [...shares].map(([schemeInstanceId, points]) => ({
      kind: "removeThreat" as const,
      schemeInstanceId,
      amount: points,
      sourceInstanceId: frame.selfInstanceId,
    })),
  );
}

const HERO_FORM = "_heroForm.";

/**
 * Where a `changeForm` effect takes one player: a form and hero face, `null` for no change (already there, can't change,
 * or "your other hero form" with none to go to), or `"choose"` when the player must pick among several hero faces.
 */
function changeFormTarget(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  effect: Extract<EffectSpec, { kind: "changeForm" }>,
): { readonly to: "hero" | "alterEgo"; readonly heroForm: number } | "choose" | null {
  const player = getPlayer(state, playerId);
  if (!player || player.eliminated || cannotChangeForm(state, deps, playerId)) return null;
  const card = cardOf(state, player.identity.instanceId);
  const faces = card?.type === "hero_identity" ? heroFacesOf(card) : [];
  const { form, heroFormIndex } = player.identity;
  const unchanged = (to: "hero" | "alterEgo", heroForm: number) =>
    form === to && (to === "alterEgo" || heroFormIndex === heroForm) ? null : { to, heroForm };
  if (effect.heroForm === "other") {
    if (form !== "hero" || faces.length !== 2) return null;
    return unchanged("hero", heroFormIndex === 0 ? 1 : 0);
  }
  if (effect.heroForm !== undefined) {
    const { withTrait } = effect.heroForm;
    const index = faces.findIndex((face) => face.traits.includes(withTrait));
    return index < 0 ? null : unchanged("hero", index);
  }
  const to = effect.to ?? (form === "hero" ? "alterEgo" : "hero");
  if (to === "alterEgo") return unchanged("alterEgo", 0);
  if (form === "hero") return null;
  return faces.length > 1 ? "choose" : unchanged("hero", 0);
}

/**
 * "Change your form" / "change to your Giant hero form" / "change to your other hero form" (docs/phase7-wave2.md
 * §3.2). A player going to hero form with more than one hero face chooses which (the Ant-Man insert, "Rules
 * Clarifications": "Scott Lang/Ant-Man can change from alter-ego form to either hero form"), one player at a time in the
 * order `player` names them; the answers wait in the frame's vars (`_heroForm.<playerId>`) until everyone has one.
 */
function executeChangeForm(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "changeForm" }>,
  context: EffectContext,
): void {
  const players = resolvePlayers(ctx.state, effect.player, context);
  const vars: Record<string, number> = { ...frame.vars };
  const targets = players.map((playerId) => ({
    playerId,
    target: changeFormTarget(ctx.state, ctx.deps, playerId, effect),
  }));
  const pending = targets.filter(
    ({ playerId, target }) => target === "choose" && vars[`${HERO_FORM}${playerId}`] === undefined,
  );
  if (frame.answer !== null && pending[0]) {
    vars[`${HERO_FORM}${pending[0].playerId}`] = Number(frame.answer[0]);
    pending.shift();
  }
  const [next] = pending;
  if (next) {
    const player = getPlayer(ctx.state, next.playerId);
    const card = player ? cardOf(ctx.state, player.identity.instanceId) : undefined;
    const faces = card?.type === "hero_identity" ? heroFacesOf(card) : [];
    setFrame(ctx, { ...frame, answer: null, vars });
    requestChoice(ctx, {
      playerId: next.playerId,
      prompt: { kind: "chooseOption" },
      options: faces.map((face, index) => ({
        optionId: String(index),
        label: `${face.faceName} (${face.traits.join(", ")})`,
        ref: { kind: "none" } as const,
      })),
      minSelections: 1,
      maxSelections: 1,
      frameId: frame.frameId,
    });
    return;
  }
  const cleaned = Object.fromEntries(Object.entries(vars).filter(([key]) => !key.startsWith(HERO_FORM)));
  setFrame(ctx, { ...frame, answer: null, vars: cleaned, cursor: frame.cursor + 1 });
  const changed: TriggerEvent[] = [];
  for (const { playerId, target } of targets) {
    if (target === null) continue;
    const resolved =
      target === "choose" ? { to: "hero" as const, heroForm: vars[`${HERO_FORM}${playerId}`] ?? 0 } : target;
    const event = setForm(ctx, playerId, resolved.to, false, resolved.heroForm);
    if (event) changed.push(event);
  }
  pushEvents(ctx, changed);
}

/**
 * "Join another game area" / "combine your game area with another game area" (docs/phase7-wave2.md §3.1). The joining
 * players choose the area when there are several ("choose a game area", The Once and Future Kang insert, "Joining
 * Another Game Area"): the first of them in player order answers. With no other separate area left they join the
 * central area and the split ends.
 */
function executeJoinGameArea(ctx: Ctx, frame: Frame<"effects">, context: EffectContext): void {
  const from = contextArea(ctx.state, context);
  const others = from ? ctx.state.gameAreas.filter((area) => area.areaId !== from.areaId) : [];
  if (from && others.length > 1 && frame.answer === null) {
    const chooser = controllerOfArea(ctx.state, from) ?? ctx.state.firstPlayerId;
    requestChoice(ctx, {
      playerId: chooser,
      prompt: { kind: "chooseOption" },
      options: others.map((area) => ({
        optionId: area.areaId,
        label: `Game area with ${area.playerIds.join(", ")}`,
        ref: { kind: "none" } as const,
      })),
      minSelections: 1,
      maxSelections: 1,
      frameId: frame.frameId,
    });
    return;
  }
  setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
  if (!from) return;
  const chosen = frame.answer?.[0];
  const into =
    others.length === 0 ? null : ((others.find((area) => area.areaId === chosen) ?? others[0])?.areaId ?? null);
  pushFrames(ctx, joinGameArea(ctx, from.areaId, into));
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
  const players = resolvePlayers(ctx.state, effect.player, context).filter(
    (id) => getPlayer(ctx.state, id)?.eliminated === false,
  );
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
    // "You cannot choose to discard this card from your hand" (docs/phase7-wave4.md §3.13).
    const candidates = (
      filter ? player.hand.filter((id) => matchesQuery(ctx.state, id, filter, context)) : player.hand
    ).filter((id) => !cannotChooseToDiscard(ctx.state, ctx.deps, id));
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
  const players = resolvePlayers(ctx.state, effect.player, context).filter(
    (id) => getPlayer(ctx.state, id)?.eliminated === false,
  );
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
  if (effect.to === "encounterDeckTopOrBottom") return executePlaceTopOrBottom(ctx, frame, effect, context);
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

/** The answer to an ordering choice over `pile`, if it names every card of the pile exactly once; otherwise `pile`. */
function orderedAnswer(answer: readonly string[] | null, pile: readonly InstanceId[]): readonly InstanceId[] {
  const answered = (answer ?? []).map((id) => asInstanceId(id)).filter((id) => pile.includes(id));
  return answered.length === pile.length && new Set(answered).size === pile.length ? answered : pile;
}

/**
 * `reorderCards` with `to: "encounterDeckTopOrBottom"` (docs/phase7-wave3.md §3.48): "place the rest on the top
 * and/or bottom of the encounter deck in any order" (Take the Fight to Them, `gmw` 16161). RRG 1.8 "Deck" (p. 15): the
 * order changes only as the card instructs, and the card lets each card go to either end, in any order. RRG 1.8
 * "Look, Looked-At" (p. 27): the cards stay part of the deck while looked at, and only the resolving player sees them,
 * so every question goes to `chooser` alone.
 *
 * Three answers inside one effect step, kept on the frame (`_place.step`, `_place.top`, `_place.bottom`) the way
 * `playFromHand` keeps its own:
 *
 * 0. **Split:** which cards go to the bottom (`chooseBottomCards`, 0 to all); the rest go on top.
 * 1. **Order the top pile** (`orderCards` to `encounterDeckTop`), asked only for two or more cards.
 * 2. **Order the bottom pile** (`orderCards` to `encounterDeckBottom`), likewise.
 *
 * Both orders read top-down, the way the deck will: the first card of the top pile becomes the deck's top card, the
 * last card of the bottom pile its bottom card. Nothing moves until the last answer, then every card moves at once
 * (one `cardMoved` each). A malformed answer keeps the cards in the order they were looked at, all on top for the split.
 */
function executePlaceTopOrBottom(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "reorderCards" }>,
  context: EffectContext,
): void {
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  const step = frame.vars["_place.step"] ?? 0;
  const advance = (next: number, top: readonly InstanceId[], bottom: readonly InstanceId[]): void =>
    setFrame(ctx, {
      ...frame,
      answer: null,
      vars: { ...frame.vars, "_place.step": next },
      bindings: { ...frame.bindings, "_place.top": top, "_place.bottom": bottom },
    });
  const ask = (prompt: ChoicePrompt, pile: readonly InstanceId[], min: number, ordered: boolean): void =>
    requestChoice(ctx, {
      playerId: chooser as PlayerId,
      authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, effect.chooser),
      prompt,
      options: cardOptions(ctx, pile),
      minSelections: min,
      maxSelections: pile.length,
      frameId: frame.frameId,
      ordered,
    });

  if (step === 0) {
    const ids = selectCards(ctx, effect.cards, context);
    if (frame.answer === null && ids.length > 0 && chooser) {
      ask({ kind: "chooseBottomCards", deck: "encounterDeck" }, ids, 0, false);
      return;
    }
    const bottom = ids.filter((id) => (frame.answer ?? []).includes(id));
    advance(
      1,
      ids.filter((id) => !bottom.includes(id)),
      bottom,
    );
    return;
  }

  const top = frame.bindings["_place.top"] ?? [];
  const bottom = frame.bindings["_place.bottom"] ?? [];
  if (step === 1) {
    if (frame.answer === null && top.length > 1 && chooser) {
      ask({ kind: "orderCards", to: "encounterDeckTop" }, top, top.length, true);
      return;
    }
    advance(2, orderedAnswer(frame.answer, top), bottom);
    return;
  }
  if (frame.answer === null && bottom.length > 1 && chooser) {
    ask({ kind: "orderCards", to: "encounterDeckBottom" }, bottom, bottom.length, true);
    return;
  }
  const bottomOrder = orderedAnswer(frame.answer, bottom);
  const vars = Object.fromEntries(Object.entries(frame.vars).filter(([key]) => !key.startsWith("_place.")));
  const bindings = Object.fromEntries(Object.entries(frame.bindings).filter(([key]) => !key.startsWith("_place.")));
  setFrame(ctx, { ...frame, answer: null, vars, bindings, cursor: frame.cursor + 1 });
  const deck = { kind: "encounterDeck", deckId: activeEncounterDeckId(ctx.state) } as const;
  // Each bottom card goes under the last, so the pile keeps its top-down order; the top pile is placed last card first.
  for (const id of bottomOrder) moveCard(ctx, id, deck, "bottom");
  for (const id of [...top].reverse()) moveCard(ctx, id, deck, "top");
}

const cardOptions = (ctx: Ctx, ids: readonly InstanceId[]): readonly ChoiceOption[] =>
  ids.map((id) => ({
    optionId: id,
    label: mustCardOf(ctx.state, id).name,
    ref: { kind: "card", instanceId: id } as const,
  }));

function executeChooseCards(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "chooseCards" }>,
  context: EffectContext,
): void {
  if (frame.answer !== null) {
    const chosen = frame.answer.map((id) => asInstanceId(id));
    emit(ctx, { type: "targetChosen", slot: effect.slot, instanceIds: chosen });
    setFrame(ctx, {
      ...frame,
      answer: null,
      cursor: frame.cursor + 1,
      bindings: { ...frame.bindings, [effect.slot]: chosen },
    });
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
  const count = effect.count ?? 1;
  if (count > 1) return executeChooseSeveral(ctx, frame, effect, context, available, count);
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
      options: available.map(({ option, index }) => ({
        optionId: String(index),
        label: option.label,
        ref: { kind: "none" } as const,
      })),
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
    returnBindingsTo: frame.frameId,
    byPlayer: frame.byPlayer === true,
  });
}

/**
 * "Choose two of the following (you may choose the same option twice)" (Double Time; docs/phase7-wave2.md §3.7): one
 * choice of `count` options. With `allowRepeat` each option is offered `count` times (`<index>#<n>`), so it can be picked
 * again; without it, only distinct options (RRG 1.8 "Choose (Option)", p. 12), as many as are available. The chosen
 * options resolve in the order picked, each as its own effects frame, the first on top.
 */
function executeChooseSeveral(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "chooseOne" }>,
  context: EffectContext,
  available: readonly { readonly option: (typeof effect.options)[number]; readonly index: number }[],
  count: number,
): void {
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  const picks = effect.allowRepeat ? count : Math.min(count, available.length);
  if (frame.answer === null) {
    if (!chooser || picks === 0) {
      setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
      return;
    }
    requestChoice(ctx, {
      playerId: chooser,
      prompt: { kind: "chooseOption" },
      options: available.flatMap(({ option, index }) =>
        effect.allowRepeat
          ? Array.from({ length: count }, (_, n) => ({
              optionId: `${index}#${n + 1}`,
              label: option.label,
              ref: { kind: "none" } as const,
            }))
          : [{ optionId: String(index), label: option.label, ref: { kind: "none" } as const }],
      ),
      minSelections: picks,
      maxSelections: picks,
      frameId: frame.frameId,
      ordered: true,
    });
    return;
  }
  const indexes = frame.answer.map((id) => Number(id.split("#")[0]));
  setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
  for (const index of indexes) {
    const chosen = effect.options[index];
    if (chosen) emit(ctx, { type: "optionChosen", label: chosen.label, index });
  }
  // Pushed last-first, so the first option picked resolves first.
  for (const index of [...indexes].reverse()) {
    const chosen = effect.options[index];
    if (!chosen) continue;
    pushEffects(ctx, {
      effects: chosen.effects,
      selfInstanceId: frame.selfInstanceId,
      controllerId: frame.controllerId,
      event: frame.event,
      eventFrameId: frame.eventFrameId,
      bindings: frame.bindings,
      vars: frame.vars,
      scopedPlayerId: frame.scopedPlayerId,
      returnBindingsTo: frame.frameId,
      byPlayer: frame.byPlayer === true,
    });
  }
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
    setFrame(ctx, {
      ...frame,
      answer: null,
      cursor: frame.cursor + 1,
      bindings: { ...frame.bindings, [effect.slot]: identities },
    });
    return;
  }
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  // `among` (docs/phase7-wave3.md §3.35): only those players are eligible, and one eligible player is no choice.
  const eligible = effect.among ? resolvePlayers(ctx.state, effect.among, context) : null;
  const players = playerOrder(ctx.state).filter((p) => eligible === null || eligible.includes(p.playerId));
  if (!chooser || players.length === 0 || (eligible !== null && players.length === 1)) {
    const bound = eligible !== null && players.length === 1 ? [players[0]!.identity.instanceId] : [];
    setFrame(ctx, { ...frame, cursor: frame.cursor + 1, bindings: { ...frame.bindings, [effect.slot]: bound } });
    return;
  }
  requestChoice(ctx, {
    playerId: chooser,
    authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, effect.chooser),
    prompt: { kind: "choosePlayer", slot: effect.slot },
    options: players.map((p) => ({
      optionId: p.playerId,
      label: p.playerId,
      ref: { kind: "player", playerId: p.playerId } as const,
    })),
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
    setFrame(ctx, {
      ...frame,
      answer: null,
      cursor: frame.cursor + 1,
      vars: { ...frame.vars, [`${effect.bind}.made`]: paid ? 1 : 0 },
    });
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
  // Spent mid-effect: the event goes above this effects frame, so "after you spend this card" resolves before the
  // effects that follow the spend (RRG 1.8 "Cost Arrow Icon", p. 14; docs/phase7-wave2.md §12).
  if (paid && playerId) announceResourcesSpent(ctx, playerId, payPayment(ctx, playerId, payment), null, "effect");
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
  if (vars["_assign.left"] === undefined)
    vars["_assign.left"] = Math.max(0, resolveValue(ctx.state, effect.amount, context, ctx.deps));
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
    const allies = player.playArea.filter(
      (id) => controllerOf(ctx.state, id) === playerId && categoriesOf(ctx.state, id).includes("character"),
    );
    return [player.identity.instanceId, ...allies];
  };
  // "Dealt to a group of players … as the group chooses": the first player submits it (docs/phase7-wave1.md §4.7).
  if (to === "group")
    return [
      {
        playerId: ctx.state.firstPlayerId,
        characters: playerOrder(ctx.state).flatMap((p) => controlledBy(p.playerId)),
      },
    ];
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
        fromAttack: effect.fromAttack === true,
        ...(effect.fromAttack === true ? { parentFrameId: frame.eventFrameId } : {}),
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
  const resolvingPlayer = effect.player ? (resolvePlayers(ctx.state, effect.player, context)[0] ?? null) : null;
  // "Resolve this card's 'When Revealed' ability" / "each 'When Revealed' ability on each side scheme" (§3.56).
  const trigger = effect.trigger ?? "special";
  for (const id of sources) {
    for (const ref of activeAbilityRefs(ctx.state, id, ctx.deps)) {
      if (ctx.deps.abilities[ref.id]?.trigger.kind !== trigger) continue;
      steps.push({
        instanceId: id,
        abilityId: ref.id,
        // An encounter card resolving its own Special has no controller of its own (e.g. Nebula's Technique
        // attachments, `gmw` 16094-16098, attached to the villain); "you" inside that Special's text ("You are
        // stunned") then falls back to whoever the *instructing* ability's own "you" was (RRG 1.8 "You, Your",
        // p. 49) — the player the villain's activation concerns, already resolved onto `context.controllerId` by
        // the calling `forcedInterrupt`/Boost frame. docs/phase7-wave3.md §3's "Special" pattern; found scripting
        // `gmw/nebula.ts`.
        // `player` names the resolving player outright ("each player must resolve …", docs/phase7-wave4.md §3.46).
        controllerId: controllerOf(ctx.state, id) ?? resolvingPlayer ?? context.controllerId,
        forced: true,
        fromHand: false,
      });
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
  // A card whose Special resolves from an identity's separate deck (an Invocation card) leaves the deck as it starts
  // resolving, like a played event (RRG 1.8 "Event", p. 19), and is out of play in its owner's `resolving` area until its
  // own text moves it on. If it was the last card, the deck resets now, without it (`settlePlayerDecks`): ruling, Apr 30,
  // 2026 (3) answer 7, "The deck is reshuffled **before** the currently resolving card enters the discard pile"
  // (docs/phase7-wave1.md §4 Q9, resolved 2026-09-25).
  for (const id of new Set(ordered.map((step) => step.instanceId))) {
    const zone = locateCard(ctx.state, id);
    if (zone?.kind === "separateDeck") moveCard(ctx, id, { kind: "resolving", playerId: zone.playerId });
  }
  // Only on request (`includeKeywords`): incite X and surge are each "equivalent to" a When Revealed ability (RRG 1.8
  // "Incite X", p. 24; "Surge", p. 42), resolved in the order a reveal resolves them: incite first, the printed
  // abilities, surge last. Off by default: the user decided Citywide Crisis re-resolves printed abilities only, since
  // a card already in play is not being revealed (§3.56, §4 Q23, 2026-09-25).
  const incites: { readonly id: InstanceId; readonly amount: number }[] = [];
  const surges: InstanceId[] = [];
  if (trigger === "whenRevealed" && effect.includeKeywords === true) {
    for (const id of sources) {
      const amount = keywordTotal(ctx.state, id, "incite", ctx.deps);
      if (amount > 0) incites.push({ id, amount });
      if (hasKeyword(ctx.state, id, "surge", ctx.deps)) surges.push(id);
    }
  }
  if (effect.bind) {
    addFrameVars(ctx, frame.frameId, { [`${effect.bind}.count`]: ordered.length + incites.length + surges.length });
  }
  const whoFor = (id: InstanceId) => controllerOf(ctx.state, id) ?? resolvingPlayer ?? context.controllerId;
  for (const id of [...surges].reverse()) {
    pushEffects(ctx, {
      effects: [{ kind: "revealEncounterCard", player: { kind: "controller" } }],
      selfInstanceId: id,
      controllerId: whoFor(id),
    });
  }
  pushFrames(
    ctx,
    ordered.map((step, index) =>
      abilityFrame(
        ctx,
        step,
        frame.event,
        null,
        {},
        { "sequence.step": index + 1, "sequence.final": index === ordered.length - 1 ? 1 : 0 },
      ),
    ),
  );
  for (const { id, amount } of [...incites].reverse()) {
    pushEffects(ctx, {
      effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: amount } }],
      selfInstanceId: id,
      controllerId: whoFor(id),
    });
  }
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
    effect.count === undefined
      ? 1
      : typeof effect.count === "number"
        ? effect.count
        : Math.max(0, resolveValue(ctx.state, effect.count, context, ctx.deps));
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
    // "Up to X" chooses at least one (§4 Q16, the user's decision); only a printed "may" (`optional`) allows none.
    minSelections: effect.optional ? 0 : effect.upTo ? 1 : count,
    maxSelections: count,
    frameId: frame.frameId,
  });
}
