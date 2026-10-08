/** Stepping through an effects frame, including the effects that stop for a player choice. */

import { announceDeckTops } from "../deck-top.js";
import type { EngineDeps } from "../abilities.js";
import {
  cardsInPlayFromZone,
  hostChoicesForEffectPlay,
  hostForEffectPlay,
  paymentOptions,
  paymentsFromOptionIds,
  announceResourcesSpent,
  payPayment,
  eventActionsForEffectPlay,
  playFromEffectRequirement,
  playIgnoringCost,
  playIgnoringCostFault,
  playWithPayment,
  playWithPaymentFault,
  priceOrNull,
  isPriceFault as isFault,
  planCost,
  type ActionTiming,
  type PlayFromZone,
} from "../actions.js";
import {
  canPayFormChangeCosts,
  formChangeCostSources,
  payFormChangeCosts,
  planFormChangeCosts,
  settleFormChangeCosts,
} from "../form-change-cost.js";
import { cardTypeName, isRulesCardType, RULES_CARD_TYPES } from "../card-types.js";
import type { ChoiceList, ChoiceOption, ChoicePrompt } from "../choices.js";
import {
  type Ctx,
  emit,
  moveCard,
  popFrame,
  pushFrames,
  requestChoice,
  setFrame,
  updateFrame,
  updatePlayer,
} from "../ctx.js";
import {
  addLastingEffect,
  dealEncounterCardTo,
  discardFromHand,
  expirePaidForEffects,
  giveStatus,
  setForm,
  settleAwaitingAttackEffects,
  shuffleZone,
} from "../effects.js";
import { EngineInvariantError } from "../errors.js";
import { cannotChangeForm, formChangeCostsFor, type FormChangeCost } from "../rules.js";
import type { GameState, ZoneId } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import {
  type FrameId,
  type InstanceId,
  instanceId as asInstanceId,
  playerId as asPlayerId,
  type PlayerId,
} from "../ids.js";
import {
  activeEncounterDeckId,
  cardOf,
  characterProfile,
  isPlayerCardType,
  getInstance,
  getPlayer,
  heroFacesOf,
  locateCard,
  mustCardOf,
  mustPlayer,
  playerOrder,
  undefeatedVillains,
} from "../query.js";
import { cannotBeHealed, cannotChooseToDiscard, cannotTakeDamage, cannotThwart } from "../rules.js";
import { combineRequirements, requirementTotal, type ResolvedRequirement } from "../resources.js";
import { spendPays } from "../payable.js";
import {
  activeAbilityRefs,
  cardsInPlay,
  cardTypeOf,
  categoriesOf,
  chosenVar,
  contextArea,
  controllerOf,
  type EffectContext,
  evaluate,
  isPlayerCard,
  MAIN_SCHEME_CHOICE,
  matchesQuery,
  VILLAIN_CHOICE,
  PLAYED_VIA_SLOT,
  printedAbilityRefs,
  resolvePlayers,
  resolveRef,
  resolveValue,
  selectTargets,
} from "../select.js";
import type { EffectSpec, PlayerRef, StatusName } from "../spec.js";
import type { StackFrame, TriggerCandidate } from "../stack.js";
import { executeSettleBasicThwartCost } from "../thwart-cost.js";
import { executeSettleCostDamage } from "../cost-damage.js";
import { executePayEncounterLookDiscard } from "../encounter-look-cost.js";
import { executeSettleEnemyAttackCost } from "../enemy-attack-cost.js";
import { executeDefeatedTogether } from "./defeated-together.js";
import { executeSearchCollection } from "./collection.js";
import { executeReportFact } from "./report-fact.js";
import { executeBasicPowerBy } from "./basic-power-by.js";
import { resolveTeamwork } from "./enter-play.js";
import { effectChoiceAuthority, simultaneousOrderer } from "../villain/authority.js";
import { applyEffect, putIntoPlayHostSlot, threatRemoverOf } from "./apply-effect.js";
import { upgradeHostCandidates } from "./reveal.js";
import { controllerOfArea, joinGameArea } from "./game-areas.js";
import { damageGroupFrame } from "./damage-group.js";
import { eachEncounterCard, selectCards } from "./cards.js";
import { abilityFrame, addFrameVars, type Frame, pushEffects, pushEvents } from "./frames.js";
import { hasKeyword, keywordTotal, statusCapacity } from "../keywords.js";
import { cardEffectBonus } from "../modifiers.js";
import { candidateOption } from "./window.js";
import { thwartBlockedOn } from "./event.js";
import { abilityRootFrameId, announceAbilityThwart } from "./thwart-session.js";
import {
  abilityAttackDamage,
  abilityAttackOf,
  mayAttackWith,
  noteAttackedByAbility,
  openLabelAttack,
  skipUnattackable,
} from "./attack-ability.js";
import {
  attackTargetAllowed,
  canDealDamageTo,
  canRemoveThreatFrom,
  canThwartScheme,
  isRequiredChoice,
  isRequiredSearch,
  readsDeck,
  slotTargetValid,
  UNRESOLVED_VAR,
} from "./target-validity.js";
import { markPreThenUnresolved } from "./then.js";

/** The `EffectContext` an effects frame resolves in. Exported so `why-not.ts` can rebuild it exactly. */
export const contextOf = (frame: Frame<"effects">, deps: EngineDeps): EffectContext => ({
  deps,
  scopedPlayerId: frame.scopedPlayerId,
  selfInstanceId: frame.selfInstanceId,
  controllerId: frame.controllerId,
  event: frame.event,
  bindings: frame.bindings,
  vars: frame.vars,
  ...(frame.controllerId !== null &&
  frame.abilityId !== undefined &&
  deps.abilities[frame.abilityId]?.label?.includes("thwart")
    ? { thwartLabeled: true }
    : {}),
  ...(frame.controllerId !== null &&
  frame.abilityId !== undefined &&
  deps.abilities[frame.abilityId]?.label?.includes("attack")
    ? { attackLabeled: true }
    : {}),
});

export function executeEffectsFrame(ctx: Ctx, frame: Frame<"effects">): void {
  const effect = frame.effects[frame.cursor];
  if (!effect) {
    // A "(thwart)" ability is one thwart: "after you thwart" answers it here, once, after its last effect (RRG 1.8
    // "Thwart", p. 44). The frame waits beneath the resolved thwart's response window and finishes after it.
    if (announceAbilityThwart(ctx, frame)) return;
    popFrame(ctx);
    // A rule waiting on an attack this frame never initiated ends with it (spec.ts `applyRuleUntil`, "initiated").
    settleAwaitingAttackEffects(ctx, frame.frameId, null);
    // "That attack" on a resource ability ends with the ability it paid for (spec.ts `applyRuleUntil`, "endOfPaidFor").
    expirePaidForEffects(ctx, frame.frameId);
    // A finished branch hands what it bound back to the frame that ran it (docs/phase7-wave4.md §3.43).
    if (frame.returnBindingsTo && frame.returnBindingsPrefix) {
      // A Special's own bindings, reported to the `resolveSpecials` that resolved it (docs/phase7-wave5.md §3.7): under
      // the prefix, added to what the sequence's earlier Specials reported.
      const prefix = frame.returnBindingsPrefix;
      updateFrame(ctx, frame.returnBindingsTo, (parent) => {
        if (parent.kind !== "effects") return parent;
        const bindings: Record<string, readonly InstanceId[]> = { ...parent.bindings };
        for (const [key, ids] of Object.entries(frame.bindings))
          bindings[`${prefix}.${key}`] = [...new Set([...(bindings[`${prefix}.${key}`] ?? []), ...ids])];
        const vars: Record<string, number> = { ...parent.vars };
        for (const [key, amount] of Object.entries(frame.vars))
          vars[`${prefix}.${key}`] = (vars[`${prefix}.${key}`] ?? 0) + amount;
        return { ...parent, bindings, vars };
      });
    } else if (frame.returnBindingsTo) {
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
  // Two or more villains (Tower Defense, Breakout, The Sinister Six): a player card that names "the villain" asks which
  // (owner, 2026-10-04, matrix Q-M2), once per ability, just before the first effect that names it.
  if (needsVillainChoice(ctx, frame, effect, context)) {
    const choose: EffectSpec = {
      kind: "chooseTarget",
      slot: VILLAIN_CHOICE,
      query: { categories: ["villain"] },
      chooser: { kind: "controller" },
    };
    setFrame(ctx, {
      ...frame,
      effects: [...frame.effects.slice(0, frame.cursor), choose, ...frame.effects.slice(frame.cursor)],
    });
    return;
  }
  // An "(attack)" ability with no attack effect is still one attack (owner ruling Q48): it is made as the ability
  // reaches its first damage instruction against an enemy, which then resolves as that attack's damage.
  if (openLabelAttack(ctx, frame, effect, context)) return;
  if (effect.kind === "chooseCards") return executeChooseCards(ctx, frame, effect, context);
  if (effect.kind === "lookAt") return executeLookAt(ctx, frame, effect, context);
  if (effect.kind === "chooseOne") return executeChooseOne(ctx, frame, effect, context);
  if (effect.kind === "choosePlayer") return executeChoosePlayer(ctx, frame, effect, context);
  if (effect.kind === "chooseNumber") return executeChooseNumber(ctx, frame, effect, context);
  if (effect.kind === "chooseCardType") return executeChooseCardType(ctx, frame, effect, context);
  if (effect.kind === "searchCollection") return executeSearchCollection(ctx, frame, effect, context);
  if (effect.kind === "reportFact") return executeReportFact(ctx, frame, effect, context);
  if (effect.kind === "resolveSpecials") return executeResolveSpecials(ctx, frame, effect, context);
  if (effect.kind === "assignDamage") return executeAssignDamage(ctx, frame, effect, context);
  if (effect.kind === "dealIndirectDamage") return executeDealIndirectDamage(ctx, frame, effect, context);
  if (effect.kind === "divideDamageEvenly") return executeDivideDamageEvenly(ctx, frame, effect, context);
  if (effect.kind === "spendResources") return executeSpendResources(ctx, frame, effect, context);
  if (effect.kind === "dealEncounterCard") return executeDealEncounterCards(ctx, frame, effect, context);
  if (effect.kind === "reorderCards") return executeReorderCards(ctx, frame, effect, context);
  if (effect.kind === "changeForm") return executeChangeForm(ctx, frame, effect, context);
  if (effect.kind === "joinGameArea") return executeJoinGameArea(ctx, frame, context);
  if (effect.kind === "divide") return executeDivide(ctx, frame, effect, context);
  if (effect.kind === "playFromHand") return executePlayFromHand(ctx, frame, effect, context);
  // docs/phase7-wave8.md §3.64: a player makes a basic attack or thwart on a card's instruction.
  if (effect.kind === "basicPowerBy") return executeBasicPowerBy(ctx, frame, effect, context);
  // docs/phase7-wave5.md §4.1 Q27: a basic thwart's additional cost is settled, and the thwart carried out or not.
  if (effect.kind === "settleBasicThwartCost") return executeSettleBasicThwartCost(ctx, frame, effect);
  if (effect.kind === "settleCostDamage") return executeSettleCostDamage(ctx, frame, effect);
  // docs/phase7-wave6.md §3.54: "look at the top 2 cards of the encounter deck, discard 1 of those cards →".
  if (effect.kind === "payEncounterLookDiscard") return executePayEncounterLookDiscard(ctx, frame, effect);
  // docs/phase7-wave7.md §3.19 (b): "attached villain attacks you →", settled once the attack has resolved.
  if (effect.kind === "settleEnemyAttackCost") return executeSettleEnemyAttackCost(ctx, frame, effect);
  // docs/phase7-wave5.md §4.1 Q49: allies and minions defeated by one effect, resolved together.
  if (effect.kind === "defeatedTogether") return executeDefeatedTogether(ctx, frame, effect);
  // docs/phase7-wave6.md §3.1: a minion's teamwork keyword, checked as it resolves.
  if (effect.kind === "resolveTeamwork") {
    setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
    resolveTeamwork(ctx, effect.minion);
    return;
  }

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

  if (
    (effect.kind === "enemyAttack" || effect.kind === "enemyScheme" || effect.kind === "enemyActivation") &&
    orderEnemies(ctx, frame, effect, context)
  )
    return;

  if (effect.kind === "putIntoPlay" && askPutIntoPlayHost(ctx, frame, effect, context)) return;

  setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
  applyEffect(ctx, effect, context, frame);
}

/**
 * The host question of a `putIntoPlay`: a player's upgrade enters play attached as playing it would (RRG 1.8 "Play, Put
 * into Play", p. 32), and when its "attach to" text allows several hosts its controller chooses one (RRG 1.8 "Attach
 * To", p. 8), as for an upgrade an effect plays (`executePlayFromHand`). One upgrade is asked about per pass; the answer
 * is kept in the frame's bindings (`putIntoPlayHostSlot`) for the effect to read. Returns true while a question is
 * open or was just answered, so the effect resolves only once every host is settled.
 */
function askPutIntoPlayHost(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "putIntoPlay" }>,
  context: EffectContext,
): boolean {
  const [controller] = resolvePlayers(ctx.state, effect.controller, context);
  // A card put into play facedown has no host to choose (`EffectSpec putIntoPlay.facedown`).
  if (!controller || effect.facedown === true) return false;
  const inPlay = cardsInPlay(ctx.state);
  for (const id of resolveRef(ctx.state, effect.card, context)) {
    const slot = putIntoPlayHostSlot(id);
    if (frame.bindings[slot] || inPlay.includes(id)) continue;
    const hosts = upgradeHostCandidates(ctx.state, ctx.deps, id, controller);
    if (hosts.length < 2) continue;
    if (frame.answer === null) {
      requestChoice(ctx, {
        playerId: controller,
        prompt: { kind: "chooseTarget", slot: "putIntoPlayHost", abilityId: null },
        options: cardOptions(ctx, hosts),
        minSelections: 1,
        maxSelections: 1,
        frameId: frame.frameId,
      });
      return true;
    }
    const [host] = frame.answer.map((answer) => asInstanceId(answer)).filter((answer) => hosts.includes(answer));
    setFrame(ctx, { ...frame, answer: null, bindings: { ...frame.bindings, [slot]: [host ?? hosts[0]!] } });
    return true;
  }
  return false;
}

/**
 * Whether a player card's effect about to resolve names "the villain" while more than one villain is in play and the
 * player has not yet chosen one for this ability (owner, 2026-10-04, matrix Q-M2). Not in a separate game area, where
 * the area's own villain is meant.
 */
function needsVillainChoice(ctx: Ctx, frame: Frame<"effects">, effect: EffectSpec, context: EffectContext): boolean {
  if (frame.bindings[VILLAIN_CHOICE] || frame.controllerId === null) return false;
  if (!isPlayerCard(ctx.state, frame.selfInstanceId) || contextArea(ctx.state, context)) return false;
  if (undefeatedVillains(ctx.state).length < 2) return false;
  return JSON.stringify(effect).includes('{"kind":"villain"}');
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
 * own vars (`_play.step`), the way `assignDamage` does: **pick the card → pick which Action ability, if the event has
 * more than one it could trigger → pick a host, if the upgrade has more than one → pick a payment**. Nothing is spent until the last step, and a payment that does not cover the reduced cost
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
  // `{ tuckedUnder }` (Med Lab; docs/phase7-wave6.md §3.57): the hosts are read as the effect resolves.
  const from: PlayFromZone =
    typeof effect.from === "object"
      ? { tuckedUnder: resolveRef(ctx.state, effect.from.tuckedUnder, context) }
      : (effect.from ?? "hand");
  // "Play an event with a 'Hero Action' ability" from a Response (`ignoreActionTiming`): the Action's turn is not asked.
  const timing: ActionTiming = effect.ignoreActionTiming === true ? "any" : "turn";
  const fault = (id: InstanceId, player: PlayerId): string | null =>
    paying
      ? playWithPaymentFault(ctx, player, id, reduction, from, undefined, timing)
      : playIgnoringCostFault(ctx, player, id, from, undefined, timing);
  // A card picked already (`card`, the cost's pick: docs/phase7-wave6.md §3.42) is the only candidate, if still legal.
  const named = effect.card ? resolveRef(ctx.state, effect.card, context) : null;
  // From the hand, the top card of the deck is a candidate too while a `playableTopOfDeck` permission lets the player
  // play it "as if it was in your hand" (docs/phase7-wave8.md §3.49; RRG 1.8 FAQ "Magik (#30A)", p. 64).
  const candidates = playerId
    ? cardsInPlayFromZone(ctx.state, playerId, from, ctx.deps).filter(
        (id) =>
          (named === null || named.includes(id)) &&
          !fault(id, playerId) &&
          (!effect.filter || matchesQuery(ctx.state, id, effect.filter, context)),
      )
    : [];
  // "If you exhausted Wolverine's Claws to play this card" (`via`): recorded on the play for its ability frames.
  const via = effect.via ? resolveRef(ctx.state, effect.via, context) : [];
  const playBindings = via.length > 0 ? { [PLAYED_VIA_SLOT]: via } : {};
  // "That attack gains piercing" (`whileResolving`): lasts while the play's own frame does (§3.30's scope).
  const grantWhileResolving = (playFrameId: FrameId | null): void => {
    if (!playFrameId) return;
    // "It enters play exhausted" (`entersExhausted`, Med Lab; §3.57): read by the play's own enter-play step.
    if (effect.entersExhausted === true)
      updateFrame(ctx, playFrameId, (play) => (play.kind === "playCard" ? { ...play, entersExhausted: true } : play));
    const scope = {
      selfInstanceId: frame.selfInstanceId,
      controllerId: frame.controllerId,
      vars: frame.vars,
      bindings: frame.bindings,
    };
    for (const rule of effect.whileResolving ?? [])
      addLastingEffect(ctx, { kind: "ruleGrant", rule, scope }, { kind: "endOfPaidFor", frameId: playFrameId });
  };
  const step = frame.vars["_play.step"] ?? 0;
  const vars = Object.fromEntries(Object.entries(frame.vars).filter(([key]) => !key.startsWith("_play.")));
  const bindings = Object.fromEntries(Object.entries(frame.bindings).filter(([key]) => !key.startsWith("_play.")));
  const done = (): void => setFrame(ctx, { ...frame, answer: null, vars, bindings, cursor: frame.cursor + 1 });
  // A searched deck (`from: "deck"`, Fetch Quest; docs/phase7-wave6.md §3.70) is shuffled "upon completion of that game
  // step" (RRG 1.8 "Search", p. 39): this step stays current while the played card resolves above it, then comes back
  // here once to shuffle, played or not.
  const searched = from === "deck" && playerId !== undefined;
  const finish = (): void => {
    if (!searched) return done();
    setFrame(ctx, { ...frame, answer: null, vars: { ...vars, "_play.shuffle": 1 }, bindings });
  };
  if (from === "deck" && playerId && (frame.vars["_play.shuffle"] ?? 0) > 0) {
    const order = shuffleZone(ctx, { kind: "deck", playerId }, mustPlayer(ctx.state, playerId).deck);
    updatePlayer(ctx, playerId, (p) => ({ ...p, deck: order }));
    announceDeckTops(ctx);
    return done();
  }

  if (step === 0) {
    if (frame.answer === null && playerId && candidates.length > 0 && named === null) {
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
    const [picked] =
      named === null
        ? (frame.answer ?? []).map((id) => asInstanceId(id)).filter((id) => candidates.includes(id))
        : candidates;
    if (!playerId || !picked) return finish();
    setFrame(ctx, {
      ...frame,
      answer: null,
      vars: { ...frame.vars, "_play.step": 1 },
      bindings: { ...frame.bindings, "_play.card": [picked] },
    });
    return;
  }

  const [card] = frame.bindings["_play.card"] ?? [];
  if (!playerId || !card) return finish();

  // RRG 1.8 "Event" (p. 18): "If an event has more than one triggered ability on it, the player playing it chooses one
  // of those abilities to trigger". Asked only among the Action abilities this effect could play now, and before the
  // host and the payment, since each ability has its own cost (RRG 1.8 "Initiating Abilities", p. 24, steps 2–3).
  // `_play.ability` is the chosen one's place among them, from 1.
  const actions = eventActionsForEffectPlay(ctx, playerId, card, paying ? reduction : null, from, timing);
  if (step === 1) {
    let chosen = actions.length === 1 ? actions[0] : undefined;
    if (actions.length > 1) {
      if (frame.answer === null) {
        requestChoice(ctx, {
          playerId,
          prompt: { kind: "chooseOption" },
          options: actions.map((abilityId) => ({
            optionId: abilityId,
            label:
              printedAbilityRefs(mustCardOf(ctx.state, card)).find((ref) => ref.id === abilityId)?.label ?? abilityId,
            ref: { kind: "ability", instanceId: card, abilityId } as const,
          })),
          minSelections: 1,
          maxSelections: 1,
          frameId: frame.frameId,
        });
        return;
      }
      chosen = actions.find((abilityId) => abilityId === frame.answer?.[0]);
      if (!chosen) return finish();
    }
    if (!paying) {
      finish();
      grantWhileResolving(playIgnoringCost(ctx, playerId, card, from, playBindings, chosen, timing));
      return;
    }
    // A host is only a question when the upgrade names one and several are legal (RRG 1.8 "Attach To", p. 8).
    const choices = hostChoicesForEffectPlay(ctx, playerId, card);
    setFrame(ctx, {
      ...frame,
      answer: null,
      vars: {
        ...frame.vars,
        "_play.step": choices.length > 1 ? 2 : 3,
        ...(chosen ? { "_play.ability": actions.indexOf(chosen) + 1 } : {}),
      },
    });
    return;
  }
  const action = actions[(frame.vars["_play.ability"] ?? 0) - 1];

  if (step === 2) {
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
    if (!host) return finish();
    setFrame(ctx, {
      ...frame,
      answer: null,
      vars: { ...frame.vars, "_play.step": 3 },
      bindings: { ...frame.bindings, "_play.host": [host] },
    });
    return;
  }

  const [chosenHost] = frame.bindings["_play.host"] ?? [];
  const attachTo = chosenHost ?? hostForEffectPlay(ctx, playerId, card) ?? null;
  const requirement = playFromEffectRequirement(ctx, playerId, card, attachTo, reduction, action, from);
  if (requirement === null) return finish();

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
  finish();
  grantWhileResolving(playWithPayment(ctx, playerId, card, payment, attachTo, reduction, playBindings, action, from));
}

/**
 * Whether a point of an "up to" division could do anything to `id` (RRG 1.8 "Target", p. 43): a scheme holding threat
 * this removal is allowed to take (the same check `removeThreat` makes as it applies, crisis and rules included), or a
 * character that can take damage from this card.
 */
function divisionCanAffect(
  ctx: Ctx,
  what: "damage" | "threat",
  id: InstanceId,
  frame: Frame<"effects">,
  context: EffectContext,
): boolean {
  if (what === "damage") return canDealDamageTo(ctx.state, ctx.deps, id, frame.selfInstanceId);
  const scheme = getInstance(ctx.state, id);
  if (scheme === undefined || scheme.threat <= 0) return false;
  // A "(thwart)" ability's division is a thwart (`EffectContext.thwartLabeled`): patrol and `cannotThwart` count too.
  return context.thwartLabeled
    ? canThwartScheme(ctx.state, ctx.deps, id, context)
    : canRemoveThreatFrom(ctx.state, ctx.deps, id, frame.selfInstanceId);
}

/** `EffectSpec divide` (docs/phase7-wave2.md §3.7): see there. */
function executeDivide(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "divide" }>,
  context: EffectContext,
): void {
  if (effect.what === "heal") return executeHealDivide(ctx, frame, effect, context);
  if (effect.what !== "damage" && effect.what !== "threat") {
    return executeStatusDivide(ctx, frame, effect, effect.what, context);
  }
  const what = effect.what;
  const amount = Math.max(0, resolveValue(ctx.state, effect.amount, context, ctx.deps));
  // An "(attack)" ability's division of damage attacks each enemy given a share (owner rulings Q48 to Q50,
  // `attack-ability.ts`): an enemy its player's identity may not attack right now (guard) is not offered.
  const attack = what === "damage" ? abilityAttackOf(ctx.state, ctx.deps, frame) : undefined;
  const matched = selectTargets(ctx.state, effect.among, context).filter(
    (id) => attack === undefined || mayAttackWith(ctx.state, ctx.deps, attack, id),
  );
  // "Up to" (docs/phase7-wave3.md §3.41, §4 Q16): at least 1 point whenever something can be targeted, so only
  // targets the division can affect are offered (RRG 1.8 "Target", p. 43), and with none nothing happens.
  // A "(thwart)" ability's division offers only the schemes its player can thwart, "up to" or not (RRG 1.8 "Target",
  // p. 43: "A target that cannot be thwarted is not a valid target for a thwart-labeled ability"; owner decision,
  // 2026-10-03): not the main scheme under an engaged patrol minion or a crisis icon.
  const candidates = effect.upTo
    ? matched.filter((id) => divisionCanAffect(ctx, what, id, frame, context))
    : what === "threat" && context.thwartLabeled
      ? matched.filter((id) => canThwartScheme(ctx.state, ctx.deps, id, context))
      : matched;
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  // "Up to" (docs/phase7-wave3.md §3.41): how many is the chooser's, so even a single candidate is asked.
  const asks = candidates.length > 1 || (effect.upTo === true && candidates.length === 1);
  if (frame.answer === null && asks && amount > 0 && chooser) {
    requestChoice(ctx, {
      playerId: chooser,
      authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, effect.chooser),
      prompt: {
        kind: "divide",
        what,
        amount,
        ...(effect.maxTargets !== undefined ? { maxTargets: effect.maxTargets } : {}),
      },
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
    // A played card's damage bonus (`modifyCardEffect`, Aggressive Energy) is added once to each enemy that takes a
    // share, not once per point or once overall: ruling, June 25, 2026 (2) ("+1 damage to each enemy damaged by the
    // effect"), the same per-instance reading as `dealDamage` (RRG 1.8 "Event", p. 19; FAQ "Embiggen (#10)", p. 59).
    const bonus = cardEffectBonus(ctx.state, frame.selfInstanceId, "damage");
    // Each enemy's share is an instance of the ability's one attack, and that enemy is attacked.
    const attacked: Extract<TriggerEvent, { kind: "characterAttacked" }>[] = [];
    const events = [...shares].map(([targetInstanceId, points]): Extract<TriggerEvent, { kind: "dealDamage" }> => {
      const ofAttack = attack?.waiting
        ? abilityAttackDamage(ctx.state, ctx.deps, attack.waiting, targetInstanceId)
        : null;
      if (ofAttack) attacked.push(ofAttack.attacked);
      return {
        kind: "dealDamage",
        targetInstanceId,
        amount: points + bonus + (ofAttack?.extra ?? 0),
        sourceInstanceId: frame.selfInstanceId,
        fromAttack: false,
        ...ofAttack?.damage,
      };
    });
    if (attack?.waiting) {
      // Guard minions the attacker ignores are recorded as ignored; nothing is skipped (only attackable enemies were offered).
      skipUnattackable(
        ctx,
        attack,
        frame.selfInstanceId,
        attacked.map((event) => event.targetInstanceId),
      );
      noteAttackedByAbility(ctx, attack.waiting.frameId, attacked);
    }
    pushFrames(ctx, [
      damageGroupFrame(ctx, events, effect.bind ? { frameId: frame.frameId, prefix: effect.bind } : null),
    ]);
    return;
  }
  // A "(thwart)" ability's division (Inconspicuous, Heroic Intervention): each scheme's share is an instance of the
  // one thwart the controller's identity makes (RRG 1.8 "Labeled Ability", p. 26; "Thwart", p. 44: a single thwart,
  // whose instances of threat removal an "additional threat" modifier each increases, docs/phase7-wave6.md §4.1 Q78). A share put on a scheme that player cannot thwart (an engaged patrol minion and the main scheme, a
  // `cannotThwart` rule) is not removed (RRG 1.8 "Patrol", p. 32).
  const thwartingPlayer = context.thwartLabeled ? frame.controllerId : null;
  const thwarter = thwartingPlayer ? getPlayer(ctx.state, thwartingPlayer)?.identity.instanceId : undefined;
  if (thwartingPlayer && thwarter) {
    if (cannotThwart(ctx.state, ctx.deps, thwartingPlayer, undefined, thwarter)) return;
    const thwarts: TriggerEvent[] = [];
    for (const [schemeInstanceId, points] of shares) {
      const blocked = thwartBlockedOn(
        ctx.state,
        ctx.deps,
        { thwarterInstanceId: thwarter, playerId: thwartingPlayer },
        schemeInstanceId,
      );
      if (blocked) {
        emit(ctx, { type: "threatRemovalBlocked", schemeInstanceId, reason: blocked });
        continue;
      }
      thwarts.push({
        kind: "thwart",
        thwarterInstanceId: thwarter,
        schemeInstanceId,
        playerId: thwartingPlayer,
        amount: points,
        basic: false,
        sourceInstanceId: frame.selfInstanceId,
        // One thwart, however many schemes take a share (RRG 1.8 "Thwart", p. 44; `thwart-session.ts`).
        abilityFrameId: abilityRootFrameId(ctx.state, frame),
      });
    }
    pushEvents(ctx, thwarts);
    return;
  }
  pushEvents(
    ctx,
    [...shares].map(([schemeInstanceId, points]) => ({
      kind: "removeThreat" as const,
      schemeInstanceId,
      amount: points,
      sourceInstanceId: frame.selfInstanceId,
      playerId: threatRemoverOf(ctx, frame),
    })),
  );
}

/**
 * `EffectSpec divide` of healing ("heal 3 damage from among characters you control", Compassion, `mut_gen` 32182): see
 * `EffectSpec divide.what`. A candidate's cap is the damage on it; `total` is what will be healed.
 */
function executeHealDivide(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "divide" }>,
  context: EffectContext,
): void {
  const amount = Math.max(0, resolveValue(ctx.state, effect.amount, context, ctx.deps));
  const caps = new Map<InstanceId, number>();
  for (const id of selectTargets(ctx.state, effect.among, context)) {
    const cap = Math.min(amount, getInstance(ctx.state, id)?.damage ?? 0);
    if (cap > 0 && !cannotBeHealed(ctx.state, ctx.deps, id, frame.selfInstanceId)) caps.set(id, cap);
  }
  const candidates = [...caps.keys()];
  const held = [...caps.values()].reduce((sum, cap) => sum + cap, 0);
  const total = Math.min(amount, held);
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  // Nothing to choose when every candidate is healed in full (one candidate included), unless "up to" leaves how
  // many to the chooser (docs/phase7-wave3.md §3.41, §4 Q16: at least 1).
  const asks = effect.upTo === true ? candidates.length > 0 : candidates.length > 1 && held > amount;
  if (frame.answer === null && asks && chooser) {
    requestChoice(ctx, {
      playerId: chooser,
      authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, effect.chooser),
      prompt: {
        kind: "divide",
        what: "heal",
        amount: total,
        ...(effect.maxTargets !== undefined ? { maxTargets: effect.maxTargets } : {}),
      },
      options: candidates.flatMap((id) =>
        Array.from({ length: caps.get(id) ?? 0 }, (_, n) => ({
          optionId: `${id}#${n + 1}`,
          label: `${mustCardOf(ctx.state, id).name} (${n + 1})`,
          ref: { kind: "card", instanceId: id } as const,
        })),
      ),
      minSelections: effect.upTo ? 1 : total,
      maxSelections: total,
      frameId: frame.frameId,
    });
    return;
  }
  const shares = new Map<InstanceId, number>();
  if (frame.answer !== null) {
    for (const optionId of frame.answer) {
      const id = asInstanceId(optionId.slice(0, optionId.lastIndexOf("#")));
      if (caps.has(id)) shares.set(id, (shares.get(id) ?? 0) + 1);
    }
  } else {
    for (const [id, cap] of caps) shares.set(id, cap);
  }
  setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
  if (shares.size === 0) return;
  pushEvents(
    ctx,
    [...shares].map(([targetInstanceId, points]) => ({
      kind: "healDamage" as const,
      targetInstanceId,
      amount: points,
      sourceInstanceId: frame.selfInstanceId,
    })),
    effect.bind ? { frameId: frame.frameId, prefix: effect.bind } : null,
  );
}

/**
 * `EffectSpec divide` of status cards ("place a total of 2 stun status cards on up to 2 enemies", Thwip Thwip!, `spdr`
 * 31017): see `EffectSpec divide.what`. Each candidate's room is its `statusCapacity` less what it holds (RRG 1.8
 * "Status Cards", p. 41); one without room is no candidate, and no card is offered more than its room or `amount`.
 */
function executeStatusDivide(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "divide" }>,
  status: StatusName,
  context: EffectContext,
): void {
  const amount = Math.max(0, resolveValue(ctx.state, effect.amount, context, ctx.deps));
  const room = (id: InstanceId): number =>
    Math.max(0, statusCapacity(ctx.state, id, status, ctx.deps) - (getInstance(ctx.state, id)?.statuses[status] ?? 0));
  const caps: Record<string, number> = {};
  for (const id of selectTargets(ctx.state, effect.among, context)) {
    const cap = Math.min(amount, room(id));
    if (cap > 0) caps[id] = cap;
  }
  const candidates = Object.keys(caps).map(asInstanceId);
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  // One candidate is a forced choice (at least one target whenever one exists, docs/phase7-wave3.md §4 Q16): it takes
  // what it can hold. Several are the chooser's.
  if (frame.answer === null && candidates.length > 1 && chooser) {
    requestChoice(ctx, {
      playerId: chooser,
      authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, effect.chooser),
      prompt: {
        kind: "divide",
        what: status,
        amount,
        caps,
        ...(effect.maxTargets !== undefined ? { maxTargets: effect.maxTargets } : {}),
      },
      options: candidates.flatMap((id) =>
        Array.from({ length: caps[id] ?? 0 }, (_, n) => ({
          optionId: `${id}#${n + 1}`,
          label: `${mustCardOf(ctx.state, id).name} (${n + 1})`,
          ref: { kind: "card", instanceId: id } as const,
        })),
      ),
      minSelections: 1,
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
  } else if (candidates[0]) {
    shares.set(candidates[0], caps[candidates[0]] ?? 0);
  }
  setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
  let given = 0;
  const by = { sourceInstanceId: frame.selfInstanceId, playerId: threatRemoverOf(ctx, frame) };
  for (const [id, count] of shares) {
    for (let i = 0; i < count; i++) if (giveStatus(ctx, id, status, by)) given += 1;
  }
  if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.amount`]: given });
}

const HERO_FORM = "_heroForm.";
/** The alter-ego face among a form choice's options: its option id, and its answer in the frame's vars. */
const ALTER_EGO_OPTION = "alterEgo";
const ALTER_EGO_ANSWER = -1;
/** Whether a player's additional cost to change form was paid (`RuleSpec formChangeCost`), in the frame's vars. */
const FORM_COST = "_formCost.";
const FORM_COST_PAID = 1;
const FORM_COST_UNPAID = 0;

/**
 * Where a `changeForm` effect takes one player: a form and hero face, `null` for no change (already there, can't change,
 * or "your other hero form" with none to go to), or `"choose"` when the player must pick among several faces.
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
    // A title names one face (RRG 1.8 "Identity", p. 23): the printed title of a hero face, whichever face is showing.
    const wanted = effect.heroForm;
    const index = faces.findIndex((face) =>
      "named" in wanted ? face.faceName === wanted.named : face.traits.includes(wanted.withTrait),
    );
    return index < 0 ? null : unchanged("hero", index);
  }
  if (effect.to === "alterEgo") return unchanged("alterEgo", 0);
  if (form === "alterEgo") return faces.length > 1 ? "choose" : unchanged("hero", 0);
  // In hero form: "change to hero form" changes nothing, and a bare "change form" goes to the alter-ego face, unless
  // the identity has another hero face to go to as well (docs/phase7-wave7.md §3.62).
  if (effect.to === "hero") return null;
  return faces.length > 1 ? "choose" : unchanged("alterEgo", 0);
}

/**
 * The faces a player choosing a form may change to, as options: every hero face from alter-ego form; from a hero face,
 * the alter-ego face and each other hero face (only a bare "change form" asks there).
 */
function formChoiceOptions(state: GameState, playerId: PlayerId): readonly ChoiceOption[] {
  const player = getPlayer(state, playerId);
  const card = player ? cardOf(state, player.identity.instanceId) : undefined;
  if (!player || card?.type !== "hero_identity") return [];
  const ref = { kind: "none" } as const;
  const heroFaces = heroFacesOf(card).map((face, index) => ({
    optionId: String(index),
    label: `${face.faceName} (${face.traits.join(", ")})`,
    ref,
  }));
  if (player.identity.form === "alterEgo") return heroFaces;
  return [
    { optionId: ALTER_EGO_OPTION, label: card.alterEgo.faceName, ref },
    ...heroFaces.filter((_, index) => index !== player.identity.heroFormIndex),
  ];
}

/**
 * "Change your form" / "change to your Giant hero form" / "change to your other hero form" (docs/phase7-wave2.md
 * §3.2). A player going to hero form with more than one hero face chooses which (the Ant-Man insert, "Rules
 * Clarifications": "Scott Lang/Ant-Man can change from alter-ego form to either hero form"), one player at a time in the
 * order `player` names them; the answers wait in the frame's vars (`_heroForm.<playerId>`) until everyone has one.
 * A bare "change form" from a hero face of such an identity is a choice too, among the faces not showing: a change
 * "from one hero form to the other hero form" is a change of form (the same insert; docs/phase7-wave7.md §3.62).
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
  const answeredForm = frame.answer !== null && pending[0] !== undefined;
  if (frame.answer !== null && pending[0]) {
    const [answer] = frame.answer;
    vars[`${HERO_FORM}${pending[0].playerId}`] = answer === ALTER_EGO_OPTION ? ALTER_EGO_ANSWER : Number(answer);
    pending.shift();
  }
  const [next] = pending;
  if (next) {
    setFrame(ctx, { ...frame, answer: null, vars });
    requestChoice(ctx, {
      playerId: next.playerId,
      prompt: { kind: "chooseOption" },
      options: formChoiceOptions(ctx.state, next.playerId),
      minSelections: 1,
      maxSelections: 1,
      frameId: frame.frameId,
    });
    return;
  }
  const changes = targets.flatMap(({ playerId, target }) => {
    if (target === null) return [];
    const chosen = vars[`${HERO_FORM}${playerId}`] ?? 0;
    const resolved =
      target !== "choose"
        ? target
        : chosen === ALTER_EGO_ANSWER
          ? { to: "alterEgo" as const, heroForm: 0 }
          : { to: "hero" as const, heroForm: chosen };
    return [{ playerId, ...resolved }];
  });
  // An additional cost to change form (`RuleSpec formChangeCost`, docs/phase7-wave8.md §3.63), one player at a time.
  // §4.2 Q37 = A: a change the player makes by an ability of a player card they resolve is theirs to pay for; a
  // change an encounter card makes costs nothing and happens. Paid, the payment's own announcements resolve above
  // this frame, which then comes back here for the next player or the changes themselves.
  //
  // The prompt is a payment, so a cost that picks cards ("discard 1 card from your hand") cannot be asked for here
  // yet and reads as unpayable: it needs a pick step before the payment when a card prints one.
  const source = frame.selfInstanceId === null ? undefined : cardOf(ctx.state, frame.selfInstanceId);
  const byPlayerCard = source !== undefined && isPlayerCardType(source);
  // The answer on the frame is a payment only if no form choice took it above.
  let answer = frame.answer !== null && !answeredForm ? frame.answer : null;
  for (const { playerId, to } of changes) {
    const key = `${FORM_COST}${playerId}`;
    if (vars[key] !== undefined || !byPlayerCard || context.controllerId !== playerId) continue;
    const costs = formChangeCostsFor(ctx.state, ctx.deps, playerId, to);
    if (costs.length === 0) continue;
    const sourceInstanceIds = formChangeCostSources(costs);
    const unpaid = (outcome: "declined" | "unpayable"): void => {
      vars[key] = FORM_COST_UNPAID;
      emit(ctx, { type: "formChangeCostSettled", playerId, to, sourceInstanceIds, outcome });
    };
    // A cost of no resources leaves nothing to select: it is paid if it can be.
    const needsPayment = isFault(planFormChangeCosts(ctx, playerId, costs, [], {}));
    if (answer === null && needsPayment) {
      if (!canPayFormChangeCosts(ctx.state, ctx.deps, playerId, costs)) {
        unpaid("unpayable");
        continue;
      }
      const asked = formChangeCostAsked(ctx, playerId, costs);
      setFrame(ctx, { ...frame, answer: null, vars });
      emit(ctx, { type: "formChangeCostAsked", playerId, to, sourceInstanceIds });
      const options = paymentOptions(ctx, playerId, null);
      requestChoice(ctx, {
        playerId,
        prompt: {
          kind: "spendResources",
          requirement: asked.requirement,
          formChangeCost: {
            to,
            sourceInstanceIds,
            ...(asked.sameType === undefined ? {} : { sameType: asked.sameType }),
          },
        },
        options,
        minSelections: 0,
        maxSelections: options.length,
        frameId: frame.frameId,
      });
      return;
    }
    const payment = answer === null ? [] : paymentsFromOptionIds(answer);
    answer = null;
    const planned = planFormChangeCosts(ctx, playerId, costs, payment, {});
    if (isFault(planned)) {
      unpaid("declined");
      continue;
    }
    vars[key] = FORM_COST_PAID;
    setFrame(ctx, { ...frame, answer: null, vars });
    settleFormChangeCosts(ctx, playerId, planned, payFormChangeCosts(ctx, playerId, planned, to, payment));
    return;
  }
  const cleaned = Object.fromEntries(
    Object.entries(vars).filter(([key]) => !key.startsWith(HERO_FORM) && !key.startsWith(FORM_COST)),
  );
  setFrame(ctx, { ...frame, answer: null, vars: cleaned, cursor: frame.cursor + 1 });
  const changed: TriggerEvent[] = [];
  for (const { playerId, to, heroForm } of changes) {
    // RRG 1.8 "Cost" (p. 14): unpaid, "the effect associated with the costs does not occur".
    if (vars[`${FORM_COST}${playerId}`] === FORM_COST_UNPAID) continue;
    const event = setForm(ctx, playerId, to, false, heroForm);
    if (event) changed.push(event);
  }
  pushEvents(ctx, changed);
}

/** What a `changeForm` effect's cost prompt shows: the resources asked for, and how many must be of one type. */
function formChangeCostAsked(
  ctx: Ctx,
  playerId: PlayerId,
  costs: readonly FormChangeCost[],
): { readonly requirement: ResolvedRequirement; readonly sameType?: number } {
  let requirement = combineRequirements(0, 0);
  const sameTypes: number[] = [];
  for (const { sourceInstanceId, cost } of costs) {
    const planned = planCost(ctx.state, ctx.deps, sourceInstanceId, playerId, cost, {}, new Set());
    if (isFault(planned)) continue;
    requirement = combineRequirements(requirement, planned.requirement);
    if ((planned.cost ?? cost).sameResourceType) sameTypes.push(requirementTotal(planned.requirement));
  }
  const sameType = sameTypes.length === 1 ? sameTypes[0] : undefined;
  return { requirement, ...(sameType === undefined ? {} : { sameType }) };
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
  effect: Extract<EffectSpec, { kind: "enemyAttack" | "enemyScheme" | "enemyActivation" }>,
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
    prompt: { kind: "orderEnemies", activation: orderedActivation(ctx, effect, context, enemies) },
    options: cardOptions(ctx, enemies),
    minSelections: enemies.length,
    maxSelections: enemies.length,
    frameId: frame.frameId,
    ordered: true,
  });
  return true;
}

/**
 * What the enemies being ordered do, for the prompt: an `enemyActivation` (§4.1 Q67) attacks or schemes by the form of
 * the first player it is against (the first enemy's engaged player when none is named), as `applyEffect` decides it.
 */
function orderedActivation(
  ctx: Ctx,
  effect: Extract<EffectSpec, { kind: "enemyAttack" | "enemyScheme" | "enemyActivation" }>,
  context: EffectContext,
  enemies: readonly InstanceId[],
): "attack" | "scheme" {
  if (effect.kind !== "enemyActivation") return effect.kind === "enemyAttack" ? "attack" : "scheme";
  const [playerId] = effect.against
    ? resolvePlayers(ctx.state, effect.against, context)
    : [getInstance(ctx.state, enemies[0]!)?.engagedWith ?? context.controllerId];
  const player = playerId ? getPlayer(ctx.state, playerId) : undefined;
  return player && player.identity.form !== "hero" ? "scheme" : "attack";
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
  // A deal that resets the encounter deck part-way pauses for the response to the reset and then deals the rest from
  // the new deck, in the order already chosen (`eachEncounterCard`; RRG 1.8 "Encounter Deck", p. 17).
  eachEncounterCard(ctx, frame, order.length * count, (index) => {
    const playerId = order[Math.floor(index / count)];
    if (playerId) dealEncounterCardTo(ctx, playerId);
  });
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
  if (effect.to !== "encounterDeckTop") return executePlaceTopOrBottom(ctx, frame, effect, context);
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
 *
 * `to: "playerDeckTopOrBottom"` (docs/phase7-wave5.md §4.1 Q60) asks the same three questions and puts the cards into
 * `deckOwner`'s player deck instead. A `deckOwner` that names no player leaves the cards where they are. Cards moved
 * within one player deck never empty it mid-move, so no reset (RRG 1.8 "Player Deck", p. 33) can fire from this.
 */
function executePlaceTopOrBottom(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "reorderCards" }>,
  context: EffectContext,
): void {
  const target = placeTarget(ctx, effect, context);
  const withoutPlace = (): Frame<"effects"> => ({
    ...frame,
    answer: null,
    vars: Object.fromEntries(Object.entries(frame.vars).filter(([key]) => !key.startsWith("_place."))),
    bindings: Object.fromEntries(Object.entries(frame.bindings).filter(([key]) => !key.startsWith("_place."))),
    cursor: frame.cursor + 1,
  });
  if (!target) {
    setFrame(ctx, withoutPlace());
    return;
  }
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
      ask(target.split, ids, 0, false);
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
      ask(target.orderTop, top, top.length, true);
      return;
    }
    advance(2, orderedAnswer(frame.answer, top), bottom);
    return;
  }
  if (frame.answer === null && bottom.length > 1 && chooser) {
    ask(target.orderBottom, bottom, bottom.length, true);
    return;
  }
  const bottomOrder = orderedAnswer(frame.answer, bottom);
  setFrame(ctx, withoutPlace());
  const deck = target.deck;
  // Each bottom card goes under the last, so the pile keeps its top-down order; the top pile is placed last card first.
  for (const id of bottomOrder) moveCard(ctx, id, deck, "bottom");
  for (const id of [...top].reverse()) moveCard(ctx, id, deck, "top");
}

/** Where a top-or-bottom `reorderCards` puts its cards, and the three prompts that ask how; `null` for no deck. */
interface PlaceTarget {
  readonly deck: ZoneId;
  readonly split: ChoicePrompt;
  readonly orderTop: ChoicePrompt;
  readonly orderBottom: ChoicePrompt;
}

function placeTarget(
  ctx: Ctx,
  effect: Extract<EffectSpec, { kind: "reorderCards" }>,
  context: EffectContext,
): PlaceTarget | null {
  if (effect.to !== "playerDeckTopOrBottom") {
    return {
      deck: { kind: "encounterDeck", deckId: activeEncounterDeckId(ctx.state) },
      split: { kind: "chooseBottomCards", deck: "encounterDeck" },
      orderTop: { kind: "orderCards", to: "encounterDeckTop" },
      orderBottom: { kind: "orderCards", to: "encounterDeckBottom" },
    };
  }
  const [deckOwner] = resolvePlayers(ctx.state, effect.deckOwner, context);
  if (deckOwner === undefined) return null;
  return {
    deck: { kind: "deck", playerId: deckOwner },
    split: { kind: "chooseBottomCards", deck: "playerDeck", deckOwner },
    orderTop: { kind: "orderCards", to: "playerDeckTop", deckOwner },
    orderBottom: { kind: "orderCards", to: "playerDeckBottom", deckOwner },
  };
}

const cardOptions = (ctx: Ctx, ids: readonly InstanceId[]): readonly ChoiceOption[] =>
  ids.map((id) => ({
    optionId: id,
    label: mustCardOf(ctx.state, id).name,
    ref: { kind: "card", instanceId: id } as const,
  }));

/**
 * A choice that chooses nothing binds its slot empty and moves on. A required one (`isRequiredChoice`), or a search
 * that must find a card (`isRequiredSearch`), that found no candidate leaves the text before a "then" not fully resolved (RRG 1.8 "'Then'", p. 44), so the frame is marked and a
 * later `then` in it is skipped. Every other effect still resolves as far as it can, which is how an encounter card or
 * a forced ability resolves, and how a player ability resolves if its target left play after it was initiated.
 */
function choseNothing(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "chooseTarget" | "chooseCards" }>,
  noCandidates: boolean,
): void {
  const required = noCandidates && isRequiredChoice(effect);
  const search = noCandidates && isRequiredSearch(effect);
  const unresolved = required || search;
  if (required) emit(ctx, { type: "choiceFoundNothing", slot: effect.slot });
  if (search) emit(ctx, { type: "preThenUnresolved", cause: "searchFoundNothing" });
  setFrame(ctx, {
    ...frame,
    cursor: frame.cursor + 1,
    bindings: { ...frame.bindings, [effect.slot]: [] },
    ...(unresolved ? { vars: { ...frame.vars, [UNRESOLVED_VAR]: 1 } } : {}),
  });
}

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
    choseNothing(ctx, frame, effect, candidates.length === 0);
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

/**
 * `EffectSpec lookAt` (RRG 1.8 "Look, Looked-At", p. 27): the viewer looks at the cards and nothing moves. The first
 * pass binds and logs the look, then parks a `lookAt` choice offering the cards with zero selections, which is what
 * makes a deck card face-visible (`visibility.ts` `offeredByOpenChoice`); the empty answer resumes past it. With
 * nothing to look at, or nobody to look, there is no choice: the look simply finds nothing.
 */
function executeLookAt(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "lookAt" }>,
  context: EffectContext,
): void {
  if (frame.answer !== null) {
    setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
    return;
  }
  const [viewer] = resolvePlayers(ctx.state, effect.viewer, context);
  const ids = viewer ? selectCards(ctx, effect.cards, context) : [];
  const bound = effect.bind
    ? {
        bindings: { ...frame.bindings, [effect.bind]: ids },
        vars: { ...frame.vars, [`${effect.bind}.count`]: ids.length },
      }
    : {};
  if (!viewer || ids.length === 0) {
    setFrame(ctx, { ...frame, ...bound, cursor: frame.cursor + 1 });
    // The same "then" gate as a `selectCards` over a deck that found nothing (RRG 1.8 "'Then'", p. 44).
    if (readsDeck(effect.cards)) markPreThenUnresolved(ctx, frame.frameId, "lookFoundNothing");
    return;
  }
  setFrame(ctx, { ...frame, ...bound });
  emit(ctx, { type: "cardsLookedAt", playerId: viewer, instanceIds: ids });
  requestChoice(ctx, {
    playerId: viewer,
    prompt: { kind: "lookAt" },
    options: cardOptions(ctx, ids),
    minSelections: 0,
    maxSelections: 0,
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
    abilityId: frame.abilityId,
    instruction: frame.instruction,
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
      abilityId: frame.abilityId,
      instruction: frame.instruction,
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

/**
 * `EffectSpec chooseNumber` (docs/phase7-wave6.md §3.69): "any number of …". The bounds are read as the effect
 * resolves (and again when the answer comes back: the game does not move while a choice is open, so they are the same).
 * A range of one number is bound without asking; an empty range binds 0 with `<bind>.made` 0.
 */
function executeChooseNumber(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "chooseNumber" }>,
  context: EffectContext,
): void {
  const [playerId] = resolvePlayers(ctx.state, effect.player, context);
  const min = Math.max(0, effect.min ? resolveValue(ctx.state, effect.min, context, ctx.deps) : 0);
  const max = resolveValue(ctx.state, effect.max, context, ctx.deps);
  const bind = (amount: number, made: boolean): void =>
    setFrame(ctx, {
      ...frame,
      answer: null,
      cursor: frame.cursor + 1,
      vars: { ...frame.vars, [`${effect.bind}.amount`]: amount, [`${effect.bind}.made`]: made ? 1 : 0 },
    });
  if (!playerId || max < min) return bind(0, false);
  if (frame.answer === null && min < max) {
    requestChoice(ctx, {
      playerId,
      authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, effect.player),
      prompt: { kind: "chooseNumber", min, max },
      options: Array.from({ length: max - min + 1 }, (_, index) => ({
        optionId: String(min + index),
        label: String(min + index),
        ref: { kind: "none" } as const,
      })),
      minSelections: 1,
      maxSelections: 1,
      frameId: frame.frameId,
    });
    return;
  }
  const answered = frame.answer === null ? min : Number(frame.answer[0]);
  const amount = Number.isInteger(answered) && answered >= min && answered <= max ? answered : min;
  bind(amount, true);
  emit(ctx, { type: "numberChosen", playerId, bind: effect.bind, amount });
}

/**
 * The step every "choose one entry of a fixed list" effect shares (docs/phase7-wave7.md §3.33): parks a
 * `chooseFromList` choice for the first player `player` names and, once it is answered, binds the entry as
 * `<bind>.chosen.<id>` = 1 with `<bind>.made` = 1 (`chosenFromList` reads it back) and moves past the effect. An
 * earlier choice under the same name is replaced. A list of one entry is no decision and is bound without asking.
 *
 * Returns who chose what once it is bound, for the caller's own log event; null while the choice is open, and null
 * with `<bind>.made` = 0 when there is no such player or nothing to choose.
 */
function chooseFromList(
  ctx: Ctx,
  frame: Frame<"effects">,
  context: EffectContext,
  choice: {
    readonly player: PlayerRef;
    readonly bind: string;
    readonly list: ChoiceList;
    readonly entries: readonly { readonly id: string; readonly label: string }[];
  },
): { readonly playerId: PlayerId; readonly chosen: string } | null {
  const [playerId] = resolvePlayers(ctx.state, choice.player, context);
  const prefix = chosenVar(choice.bind, "");
  const bind = (chosen: string | null): void =>
    setFrame(ctx, {
      ...frame,
      answer: null,
      cursor: frame.cursor + 1,
      vars: {
        ...Object.fromEntries(Object.entries(frame.vars).filter(([name]) => !name.startsWith(prefix))),
        ...(chosen === null ? {} : { [chosenVar(choice.bind, chosen)]: 1 }),
        [`${choice.bind}.made`]: chosen === null ? 0 : 1,
      },
    });
  if (!playerId || choice.entries.length === 0) {
    bind(null);
    return null;
  }
  if (frame.answer === null && choice.entries.length > 1) {
    requestChoice(ctx, {
      playerId,
      authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, choice.player),
      prompt: { kind: "chooseFromList", list: choice.list },
      options: choice.entries.map((entry) => ({
        optionId: entry.id,
        label: entry.label,
        ref: { kind: "none" } as const,
      })),
      minSelections: 1,
      maxSelections: 1,
      frameId: frame.frameId,
    });
    return null;
  }
  const answered = frame.answer === null ? choice.entries[0]!.id : frame.answer[0];
  const entry = choice.entries.find((candidate) => candidate.id === answered);
  if (!entry) throw new EngineInvariantError(`"${String(answered)}" is not an entry of the ${choice.list} list`);
  bind(entry.id);
  return { playerId, chosen: entry.id };
}

/**
 * `EffectSpec chooseCardType` (docs/phase7-wave7.md §3.33): all fifteen card types, whatever the player holds
 * (ruling, Jan 26, 2026 (4) answer 4). The types in that player's hand come first, each group in the RRG's order: a
 * convenience for the prompt, and no rule.
 */
function executeChooseCardType(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "chooseCardType" }>,
  context: EffectContext,
): void {
  const [chooser] = resolvePlayers(ctx.state, effect.player, context);
  const held = new Set(
    (chooser ? getPlayer(ctx.state, chooser)?.hand : undefined)?.map((id) => cardTypeOf(ctx.state, id)),
  );
  const types = [
    ...RULES_CARD_TYPES.filter((type) => held.has(type)),
    ...RULES_CARD_TYPES.filter((type) => !held.has(type)),
  ];
  const bound = chooseFromList(ctx, frame, context, {
    player: effect.player,
    bind: effect.bind,
    list: "cardType",
    entries: types.map((type) => ({ id: type, label: cardTypeName(type) })),
  });
  if (bound && isRulesCardType(bound.chosen))
    emit(ctx, { type: "cardTypeChosen", playerId: bound.playerId, cardType: bound.chosen });
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
  // docs/phase7-wave6.md §3.69: "spend 2 different resources", the cost field's rule (`distinctTypeCount`), shared with
  // the `canPayResources` predicate (`spendPays`).
  const distinctTypes = effect.distinctTypes ?? 0;
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
      prompt: { kind: "spendResources", requirement, ...(distinctTypes > 0 ? { distinctTypes } : {}) },
      options,
      minSelections: 0,
      maxSelections: options.length,
      frameId: frame.frameId,
    });
    return;
  }
  const payment = paymentsFromOptionIds(frame.answer);
  const pool = playerId && payment.length > 0 ? priceOrNull(ctx, playerId, payment, null, null) : null;
  const paid = pool !== null && spendPays(pool, requirement, distinctTypes);
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

/** The characters a player controls: their identity and the allies they control (none once eliminated). */
function charactersControlledBy(ctx: Ctx, playerId: PlayerId): readonly InstanceId[] {
  const player = getPlayer(ctx.state, playerId);
  if (!player || player.eliminated) return [];
  const allies = player.playArea.filter(
    (id) => controllerOf(ctx.state, id) === playerId && categoriesOf(ctx.state, id).includes("character"),
  );
  return [player.identity.instanceId, ...allies];
}

/** The characters a player (or the group) may assign indirect damage to: identities and allies they control. */
function indirectAssigners(
  ctx: Ctx,
  to: Extract<EffectSpec, { kind: "dealIndirectDamage" }>["to"],
  context: EffectContext,
): readonly { readonly playerId: PlayerId; readonly characters: readonly InstanceId[] }[] {
  const controlledBy = (playerId: PlayerId): readonly InstanceId[] => charactersControlledBy(ctx, playerId);
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
      if (remaining <= 0 || cannotTakeDamage(ctx.state, ctx.deps, id, [frame.selfInstanceId])) continue;
      // A cost's damage is not offered to a character whose tough status card would prevent it (`asCost`).
      if (effect.asCost && (getInstance(ctx.state, id)?.statuses.tough ?? 0) > 0) continue;
      caps[id] = remaining;
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
        indirect: true as const,
        ...(effect.fromAttack === true ? { parentFrameId: frame.eventFrameId } : {}),
      })),
      effect.bind ? { frameId: frame.frameId, prefix: effect.bind } : null,
    ),
  ]);
}

/**
 * `EffectSpec divideDamageEvenly`. The division is fixed when the effect starts resolving (the characters and the
 * amount are read then), and the chooser's answer only says which characters take the leftover points; a character
 * that leaves play before the damage group resolves simply isn't dealt its share.
 */
function executeDivideDamageEvenly(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "divideDamageEvenly" }>,
  context: EffectContext,
): void {
  const amount = Math.max(0, resolveValue(ctx.state, effect.amount, context, ctx.deps));
  const characters = resolvePlayers(ctx.state, effect.to, context).flatMap((p) => charactersControlledBy(ctx, p));
  const each = characters.length > 0 ? Math.floor(amount / characters.length) : 0;
  const remainder = characters.length > 0 ? amount % characters.length : 0;
  let extra: readonly InstanceId[] = [];
  if (remainder > 0) {
    const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
    if (frame.answer === null && chooser) {
      requestChoice(ctx, {
        playerId: chooser,
        authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, effect.chooser),
        prompt: { kind: "divideEvenlyRemainder", amount: remainder, each },
        options: cardOptions(ctx, characters),
        minSelections: remainder,
        maxSelections: remainder,
        frameId: frame.frameId,
      });
      return;
    }
    // No chooser to ask (none resolves): the first characters in player order take the leftover points.
    extra = frame.answer ? frame.answer.map((id) => asInstanceId(id)) : characters.slice(0, remainder);
  }
  setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
  const shares = characters
    .map((id) => ({ id, points: each + (extra.includes(id) ? 1 : 0) }))
    .filter((share) => share.points > 0);
  if (shares.length === 0) return;
  pushFrames(ctx, [
    damageGroupFrame(
      ctx,
      shares.map(({ id, points }) => ({
        kind: "dealDamage",
        targetInstanceId: id,
        amount: points,
        sourceInstanceId: frame.selfInstanceId,
        fromAttack: effect.fromAttack === true,
        ...(effect.fromAttack === true ? { parentFrameId: frame.eventFrameId } : {}),
        ...(effect.piercingFor === id ? { piercing: true } : {}),
      })),
      null,
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
  // "Resolve Spider-Man's 'Venom Blast' ability": only the named abilities, when the caller names any (§4.1 Q63).
  const only = effect.abilities ? new Set<string>(effect.abilities) : null;
  for (const id of sources) {
    for (const ref of activeAbilityRefs(ctx.state, id, ctx.deps)) {
      const definition = ctx.deps.abilities[ref.id];
      // A card's attach instruction is not one of its When Revealed abilities (docs/phase7-wave7.md §3.35).
      if (definition?.trigger.kind !== trigger || definition.attachInstruction) continue;
      if (only && !only.has(ref.id)) continue;
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
  // With `bind`, what each Special's effects bind comes back as `<bind>.<slot>` (docs/phase7-wave5.md §3.7).
  const returnTo = effect.bind ? { returnBindingsTo: { frameId: frame.frameId, prefix: effect.bind } } : {};
  // A When Defeated resolved on demand (Zeal for the Cause, docs/phase7-wave6.md §3.17) reads its defeat from its frame's
  // event: "the player who defeated [this card]" is the resolving player (§4.1 Q10). The event is only that ability's
  // context; no defeat happens, so no `characterDefeated` is logged, nothing leaves play and no window opens.
  const defeatedBy = resolvingPlayer ?? context.controllerId;
  const eventFor = (step: TriggerCandidate): TriggerEvent | null =>
    trigger === "whenDefeated"
      ? { kind: "characterDefeated", instanceId: step.instanceId, defeatedByPlayerId: defeatedBy }
      : frame.event;
  pushFrames(
    ctx,
    ordered.map(
      (step, index): StackFrame =>
        ({
          ...abilityFrame(
            ctx,
            step,
            eventFor(step),
            null,
            {},
            { "sequence.step": index + 1, "sequence.final": index === ordered.length - 1 ? 1 : 0 },
          ),
          ...returnTo,
        }) as StackFrame,
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
  // Only valid targets are offered (RRG 1.8 "Target", pp. 42–43): those some effect in the rest of this program can
  // affect. The main scheme is no target for a "(thwart)" while its player is patrolled (docs/phase7-wave3.md §3.5).
  const rest = frame.effects.slice(frame.cursor + 1);
  // An enemy an "(attack)" ability would attack through this slot must be one its player's identity may attack (guard;
  // owner ruling Q49, `attackTargetAllowed`).
  const legal = selectTargets(ctx.state, effect.query, context).filter(
    (id) =>
      slotTargetValid(ctx.state, ctx.deps, rest, effect.slot, id, context) &&
      attackTargetAllowed(ctx.state, ctx.deps, rest, effect.slot, id, context),
  );
  // "X enemies": the count can be a value bound earlier in the ability (Shield Toss).
  const wanted =
    effect.count === undefined
      ? 1
      : typeof effect.count === "number"
        ? effect.count
        : Math.max(0, resolveValue(ctx.state, effect.count, context, ctx.deps));
  if (!chooser || legal.length === 0 || wanted <= 0) {
    // RRG "Choose (Game Element)": with no legal target there is nothing to choose.
    choseNothing(ctx, frame, effect, legal.length === 0);
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
