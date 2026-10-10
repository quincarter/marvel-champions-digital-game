/** Trigger matching: which abilities (in play or in hand) an event makes available in a timing window. */

import type { EngineDeps, EventPattern } from "../abilities.js";
import {
  attachmentsPlayableBy,
  deckTopCostReduction,
  deckTopPlayableBy,
  deckTopPlayOf,
  playsOwnCardFromHand,
  ownCardPlayFault,
  defaultHandDiscardPicks,
  defaultInPlayPicks,
  isAlternativeAmount,
  mostFromEachHandCard,
  isPriceFault,
  paymentOptions,
  paymentsFromOptionIds,
  planCost,
  playRequirement,
  playRestrictionFault,
  priceOrNull,
} from "../actions.js";
import { createCtx } from "../ctx.js";
import { candidateDefenseBar, type DefenseBar } from "../defense-claim.js";
import { addPools, EMPTY_POOL, requirementTotal, satisfies } from "../resources.js";
import type { AbilityId } from "@mc/content";
import type { InstanceId, PlayerId } from "../ids.js";
import { cardOf, deckDiscardStillThere, getPlayer, playerOrder } from "../query.js";
import {
  activeAbilityRefs,
  activeRules,
  type ActiveRule,
  cardsInPlay,
  characterNames,
  controllerOf,
  type EffectContext,
  evaluate,
  matchesQuery,
  resolvePlayers,
  sourcePlayerOf,
  triggeringPlayers,
  uncontrolledYouOf,
  isCaptiveAlly,
} from "../select.js";
import type { TargetQuery } from "../spec.js";
import { snapshotTitledAs } from "../titles.js";
import { candidateOf, type TriggerCandidate, type WindowTiming } from "../stack.js";
import type { LastingEffect } from "../lasting.js";
import { STATUS_NAMES, type Form, type GameState } from "../state.js";
import { carriedByEvent, eventSubjects, type TriggerEvent } from "../trigger-events.js";
import { limitReached } from "./ability.js";
import { resourcesChoiceOf, type AbilityDefinition } from "../abilities.js";
import { chosenSizePayments } from "../payable.js";
import { cannotEnterPlay, cannotPlayCard, revealCannotBeCanceled, triggeredAbilityForbidden } from "../rules.js";
import { abilityLacksValidTarget } from "./target-validity.js";
import { KEYWORD_ABILITIES } from "../keyword-abilities.js";
import { attackKeywordsOf, hasKeyword } from "../keywords.js";

/**
 * A cancel with nothing it can cancel is not offered (docs/phase7-wave4.md §3.27, §4 Q16 as the user decided it on
 * 2026-09-24): an ability whose effects cancel the card being revealed ("cancel its 'When Revealed' effects", "cancel
 * the effects of that card") has that card as its target, and when the card cannot be canceled ("This effect cannot be
 * canceled.", `revealCannotBeCanceled`) it has no valid target, so it can't be initiated (RRG 1.8 "Initiating
 * Abilities", p. 24, step 2) and no cost is paid. Read from the ability's own top-level effects, where every printed
 * reveal cancel sits.
 */
function cancelHasNoTarget(state: GameState, deps: EngineDeps, definition: AbilityDefinition, event: TriggerEvent) {
  if (event.kind !== "encounterCardRevealing") return false;
  const cancels = definition.effects.some((e) => e.kind === "cancelWhenRevealed" || e.kind === "cancelRevealedCard");
  return cancels && revealCannotBeCanceled(state, deps, event.instanceId);
}

/**
 * Whether an optional interrupt or response could have its cost paid right now, so it may be offered: RRG 1.8 "Cost"
 * (p. 13) and "Initiating Abilities" (p. 24, step 2: "the player checks that the cost can be paid … If the cost cannot
 * be paid, the process is aborted"). Full Blast (`cyclops` 33008, "exhaust Cyclops →") with Cyclops exhausted, or
 * Nightcrawler (`mut_gen` 32011, "spend an [energy] resource") with nothing that can pay it, is not offered.
 *
 * `fromHand`: an event played inside the window (`inHandCandidates`), whose cost is its printed cost plus its ability's
 * (`playRequirement`, as `playWindowEvent` prices it); otherwise the ability's own cost, paid from the card it is on.
 *
 * The non-resource parts are checked as `planCost` checks them, with the default picks of cards in play and of cards in
 * hand for a hand-discard cost (picks the player makes later in the window, `costPick`, docs/phase7-wave4.md §3.17;
 * a card picked for the discard still counts as a payment source here, part of the same upper bound). The resources are checked against the most
 * the player could generate: every payment source they could choose (`paymentOptions`, the same list the window's payment
 * prompt offers), each priced on its own and summed. That is an upper bound — two sources whose own costs clash still
 * both count — so an ability is only withheld when no payment could pay it; one that passes may still be declined at
 * the payment prompt, as before.
 */
function costPayable(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  playerId: PlayerId,
  definition: AbilityDefinition,
  fromHand: boolean,
  /** The event the ability would answer: a computed X ("for each damage dealt by that attack") is read against it. */
  event: TriggerEvent,
): boolean {
  const cost = definition.cost;
  if (!cost && !fromHand) return true;
  // "Discard 1 card from your hand →" (`AbilityCost.discardFromHand`): default picks from the hand, as `legalActions`
  // supplies them for an action, so the cost is judged on whether the hand holds enough cards it accepts.
  const handPicks = defaultHandDiscardPicks(state, deps, id, playerId, cost);
  const plan = planCost(
    state,
    deps,
    id,
    playerId,
    cost,
    { ...defaultInPlayPicks(state, deps, id, playerId, cost), ...(handPicks ? { discard: handPicks } : {}) },
    new Set(),
    {},
    event,
  );
  if (isPriceFault(plan)) return false;
  // Played from the top of the deck (`playableTopOfDeck`), the permission's reduction applies, as `playWindowEvent`
  // prices it.
  const requirement = fromHand
    ? playRequirement(
        state,
        playerId,
        id,
        plan.requirement,
        deps,
        null,
        0,
        deckTopCostReduction(state, deps, playerId, id),
      )
    : plan.requirement;
  const chosenSize = fromHand ? null : resourcesChoiceOf(plan.cost ?? cost);
  if (requirementTotal(requirement) === 0 && !chosenSize) return true;
  const ctx = createCtx(state, deps);
  const exclude = fromHand ? id : null;
  const payingFor = plan.payingFor ?? id;
  // One use of a resource ability pays one amount: only the option for the most it generates counts toward the bound.
  const sources = paymentsFromOptionIds(
    paymentOptions(ctx, playerId, exclude, payingFor).map((option) => option.optionId),
  ).filter((source) => !isAlternativeAmount(source));
  // One card is spent once: each hand card counts as the most it could generate ("When you spend this card").
  const mostEach = mostFromEachHandCard(ctx, playerId, sources, exclude, payingFor);
  // "Spend up to 3 resources →" (`ResourcesChoice`; docs/phase7-wave8.md §3.62): at least one resource (RRG 1.8 "Cost",
  // p. 14), and more than its maximum is overpaid (owner decision, 2026-10-08, §4.1 row 78; RRG p. 13), so the ability
  // is offered when some payment generates its minimum.
  if (chosenSize) return !chosenSizePayments(state, deps, playerId, sources, chosenSize, payingFor, true).next().done;
  let most = EMPTY_POOL;
  for (const source of mostEach) {
    const pool = priceOrNull(ctx, playerId, [source], exclude, payingFor);
    if (pool) most = addPools(most, pool);
  }
  return satisfies(most, requirement);
}

function matchesPattern(
  state: GameState,
  pattern: EventPattern,
  event: TriggerEvent,
  /** The window the pattern is read in: it decides who the "you" of an enemy attack is (`attackYouOf`). */
  timing: WindowTiming,
  selfId: InstanceId,
  deps: EngineDeps,
  /** Who controls `selfId` when that is not `controllerOf` (a spent card out of play, `spentCardCandidates`). */
  controllerOverride?: PlayerId,
): boolean {
  if (!matchesOwnFields(state, pattern, event, timing, selfId, deps, controllerOverride)) return false;
  // "After [this] or [that]" (`EventPattern.anyOf`): one whole alternative must match as well.
  return (
    pattern.anyOf === undefined ||
    pattern.anyOf.some((alternative) =>
      matchesPattern(state, alternative, event, timing, selfId, deps, controllerOverride),
    )
  );
}

/** A pattern's own fields, without its `anyOf` alternatives. */
function matchesOwnFields(
  state: GameState,
  pattern: EventPattern,
  event: TriggerEvent,
  timing: WindowTiming,
  selfId: InstanceId,
  deps: EngineDeps,
  controllerOverride?: PlayerId,
): boolean {
  const kinds: readonly TriggerEvent["kind"][] = typeof pattern.on === "string" ? [pattern.on] : pattern.on;
  if (!kinds.includes(event.kind)) return false;
  // The same attack resolved against another player doesn't re-trigger the attacker's own "when it attacks".
  if (event.kind === "enemyAttack" && event.additionalResolution && event.enemyInstanceId === selfId) return false;
  if (event.kind === "attack" && event.additionalResolution && event.attackerInstanceId === selfId) return false;
  const subjects = eventSubjects(event);
  if (pattern.selfIs === "source" && !subjects.sources.includes(selfId)) return false;
  if (pattern.selfIs === "target" && !subjects.targets.includes(selfId)) return false;
  if (pattern.selfIs === "either" && !subjects.sources.includes(selfId) && !subjects.targets.includes(selfId)) {
    return false;
  }
  const controller = controllerOverride ?? controllerOf(state, selfId);
  if (pattern.playerIs === "controller") {
    // An encounter card has no controller: its "you" is the player the event is about — unless the rules name its
    // "you" (an attachment on a player card, an obligation: `uncontrolledYouOf`), when the event must be about them.
    if (!controller) {
      const acting = actingPlayerOf(event, pattern, timing);
      if (acting === null) return false;
      const named = uncontrolledYouOf(state, selfId);
      if (named !== null && acting !== named) return false;
      return matchesRest(state, pattern, event, selfId, null, deps);
    }
    // "[enemy] attacks you": the attack's "you" at this timing, whichever of the player's characters was attacked.
    const attackedPlayer =
      pattern.usesAttackedPlayer && event.kind === "enemyAttack" ? attackYouOf(event, timing) : null;
    if (attackedPlayer !== null) {
      if (controller !== attackedPlayer) return false;
    } else if (!subjects.players.includes(controller)) {
      return false;
    }
  }
  return matchesRest(state, pattern, event, selfId, controller, deps);
}

/** Pattern checks that don't depend on who "you" is. */
function matchesRest(
  state: GameState,
  pattern: EventPattern,
  event: TriggerEvent,
  selfId: InstanceId,
  controller: PlayerId | null,
  deps: EngineDeps,
): boolean {
  const subjects = eventSubjects(event);
  if (pattern.fromAttack !== undefined) {
    // Damage from an attack, or a defeat by attack damage ("defeated by an enemy attack"; docs/phase7-wave3.md §3.45).
    const fromAttack =
      event.kind === "dealDamage" || event.kind === "damagePrevented"
        ? event.fromAttack
        : event.kind === "characterDefeated"
          ? event.fromAttack === true
          : undefined;
    if (fromAttack !== pattern.fromAttack) return false;
  }
  // An ally's consequential damage (docs/phase7-wave5.md §4.1 Q62) on a `dealDamage` event, and "after an ally is
  // defeated by consequential damage" (Med Lab 38028; docs/phase7-wave6.md §3.57) on a `characterDefeated` one, which
  // carries the defeating damage's flag. No other event kind matches.
  if (pattern.consequential !== undefined) {
    if (event.kind !== "dealDamage" && event.kind !== "characterDefeated") return false;
    if ((event.consequential === true) !== pattern.consequential) return false;
  }
  // One character's share of indirect damage (RRG 1.8 "Indirect Damage", p. 24), on its `dealDamage` event only.
  if (pattern.indirect !== undefined) {
    if (event.kind !== "dealDamage") return false;
    if ((event.indirect === true) !== pattern.indirect) return false;
  }
  // "You" in the pattern's queries (`controller: "you"`, `identitySetOf: you`) on an uncontrolled card whose "you" the
  // rules name is that player, as it is for `playerIs` and for the card's rules (`uncontrolledYouOf`; RRG 1.8
  // "Attachment", p. 8, "Obligation", p. 30). Any other uncontrolled card's queries still read "you" as no one.
  const you = controller ?? uncontrolledYouOf(state, selfId);
  const carried = carriedByEvent(event);
  const context: EffectContext = {
    selfInstanceId: selfId,
    controllerId: you,
    event,
    bindings: carried.bindings,
    vars: carried.vars,
    deps,
    // Watching is a read: a pattern sees a card in a closed scenario area (docs/phase7-wave8.md §4.1 Q18 = A).
    reaches: "all",
  };
  if (pattern.targetIs) {
    const query: TargetQuery = pattern.targetIs;
    // "After a [Web-Warrior] ally leaves play": its traits as it left, granted ones included (§3.13 of wave 5). "After a
    // MUTANT alter-ego changes into hero form" (Moira MacTaggert): the identity's traits on the face it left
    // (`formChanged.fromTraits`, docs/phase7-wave6.md §3.56); the rest of the query reads the identity as it now is.
    const lastKnown =
      event.kind === "cardLeavesPlay"
        ? { id: event.instanceId, traits: event.traits }
        : event.kind === "formChanged" && event.fromTraits !== undefined && event.identityInstanceId !== undefined
          ? { id: event.identityInstanceId, traits: event.fromTraits }
          : null;
    if (lastKnown !== null) {
      const { trait, withoutTrait, anyTrait, ...rest } = query;
      const traits = lastKnown.traits;
      if (trait && !traits.includes(trait)) return false;
      if (withoutTrait && traits.includes(withoutTrait)) return false;
      if (anyTrait && !anyTrait.some((wanted) => traits.includes(wanted))) return false;
      if (!matchesQuery(state, lastKnown.id, rest, context)) return false;
    } else if (event.kind === "characterDefeated" && event.asDefeated !== undefined) {
      // "After a Controlled minion is defeated": what the character was as its defeat was initiated (`DefeatedSnapshot`,
      // docs/phase7-wave9.md §3.32). A player card in play facedown as a minion is itself again once it has left play,
      // so its categories, its traits and whether it was facedown are read from the snapshot; the rest of the query,
      // and a clause inside `anyOf`/`not`, read the card as it now is.
      const was = event.asDefeated;
      const { categories, trait, withoutTrait, anyTrait, facedown, ...rest } = query;
      if (categories && !categories.some((category) => was.categories.includes(category))) return false;
      if (trait && !was.traits.includes(trait)) return false;
      if (withoutTrait && was.traits.includes(withoutTrait)) return false;
      if (anyTrait && !anyTrait.some((wanted) => was.traits.includes(wanted))) return false;
      if (facedown !== undefined && was.facedown !== facedown) return false;
      if (!matchesQuery(state, event.instanceId, rest, context)) return false;
    } else if (
      (event.kind === "dealDamage" || event.kind === "attack") &&
      event.targetAsDamaged !== undefined &&
      event.targetInstanceId !== null
    ) {
      // "After Deadpool takes damage": who the target was as it took the damage (`TargetSnapshot`), since the damage
      // may have turned an identity to its other side before this is read (RRG 1.8 "Identity", p. 23: a title names
      // only the side showing it). "After Cypher attacks and damages a confused enemy": the status cards it held as
      // the attack damaged it, since its defeat took them out of play (owner ruling 2026-10-06). Only the top-level
      // name and status clauses are read from the snapshot; the rest, and a clause inside `anyOf`/`not`, read the card
      // as it now is.
      const was = event.targetAsDamaged;
      const id = event.targetInstanceId;
      const asDamaged = (): boolean => {
        const { name, titled, hasStatus, hasAnyStatus, ...live } = query;
        if (name !== undefined && was.name !== name) return false;
        if (
          titled !== undefined &&
          !characterNames(state, titled, context).some((wanted) => snapshotTitledAs(state, id, was.titles, wanted))
        )
          return false;
        const held = was.statuses;
        if (held !== undefined) {
          if (hasStatus !== undefined && held[hasStatus] <= 0) return false;
          if (hasAnyStatus !== undefined && STATUS_NAMES.some((status) => held[status] > 0) !== hasAnyStatus)
            return false;
        }
        // A snapshot stamped before it carried statuses: those clauses read the live card with the rest.
        const rest: TargetQuery =
          held !== undefined
            ? live
            : {
                ...live,
                ...(hasStatus !== undefined ? { hasStatus } : {}),
                ...(hasAnyStatus !== undefined ? { hasAnyStatus } : {}),
              };
        return matchesQuery(state, id, rest, context);
      };
      // An "(attack)" ability's attack attacked every enemy it targeted (`attack.attacked`, owner ruling Q50): "after
      // you attack a minion" is satisfied by any of them. Only the first target has a snapshot; the others are read
      // as they now are.
      const others = event.kind === "attack" ? subjects.targets.filter((target) => target !== id) : [];
      const first = subjects.targets.includes(id) && asDamaged();
      if (!first && !others.some((target) => matchesQuery(state, target, query, context))) return false;
    } else if (!subjects.targets.some((target) => matchesQuery(state, target, query, context))) return false;
  }
  if (pattern.sourceIs) {
    const query: TargetQuery = pattern.sourceIs;
    // Damage or a removal no player makes (`noPlayer`, docs/phase7-wave7.md §4.1 Q2) is not the doing of whoever
    // controls its source, so a pattern asking who controls the source ("after you deal damage") does not match it.
    const noPlayer = (event.kind === "dealDamage" || event.kind === "removeThreat") && event.noPlayer === true;
    if (noPlayer && (query.controller !== undefined || query.controlledBy !== undefined)) return false;
    if (!subjects.sources.some((source) => matchesQuery(state, source, query, context))) return false;
  }
  if (pattern.subjectIs) {
    const query: TargetQuery = pattern.subjectIs;
    const subjectIds = [...subjects.sources, ...subjects.targets];
    if (!subjectIds.some((id) => matchesQuery(state, id, query, context))) return false;
  }
  if (pattern.requireResults) {
    for (const [key, amount] of Object.entries(pattern.requireResults)) {
      if ((event.results?.[key] ?? 0) < amount) return false;
    }
  }
  // "…and take no damage" (`{ damage: 0 }`): a result the event must not exceed. A result the event never recorded
  // reads as 0, so it satisfies any non-negative bound.
  if (pattern.resultsAtMost) {
    for (const [key, amount] of Object.entries(pattern.resultsAtMost)) {
      if ((event.results?.[key] ?? 0) > amount) return false;
    }
  }
  if (pattern.activation && (!("activation" in event) || event.activation !== pattern.activation)) return false;
  if (pattern.eventAtLeast) {
    const carried = event as unknown as Readonly<Record<string, unknown>>;
    for (const [key, amount] of Object.entries(pattern.eventAtLeast)) {
      const value = carried[key];
      if (typeof value !== "number" || value < amount) return false;
    }
  }
  if (pattern.eventAtMost) {
    const carried = event as unknown as Readonly<Record<string, unknown>>;
    for (const [key, amount] of Object.entries(pattern.eventAtMost)) {
      const value = carried[key];
      if (typeof value !== "number" || value > amount) return false;
    }
  }
  if (pattern.eventIs) {
    const carried = event as unknown as Readonly<Record<string, unknown>>;
    for (const [key, expected] of Object.entries(pattern.eventIs)) {
      // A list: any one of its values (docs/phase7-wave4.md §3.36).
      const matches =
        typeof expected === "string" ? carried[key] === expected : expected.includes(carried[key] as string);
      if (!matches) return false;
    }
  }
  if (pattern.targetHadAttachment) {
    if (event.kind !== "characterDefeated") return false;
    const query: TargetQuery = pattern.targetHadAttachment;
    if (!(event.attachedInstanceIds ?? []).some((id) => matchesQuery(state, id, query, context))) return false;
  }
  if (pattern.attackKind) {
    if (event.kind !== "attack" && event.kind !== "thwart") return false;
    if ((pattern.attackKind === "basic") !== (event.basic === true)) return false;
  }
  // "When you use your 'Optic Blast' ability" (docs/phase7-wave6.md §3.84): the ability that made the attack.
  if (pattern.sourceAbility !== undefined) {
    if (event.kind !== "attack" || event.sourceAbilityId === undefined) return false;
    const wanted: readonly string[] =
      typeof pattern.sourceAbility === "string" ? [pattern.sourceAbility] : pattern.sourceAbility;
    if (!wanted.includes(event.sourceAbilityId)) return false;
  }
  // "When you make a ranged attack" (docs/phase7-wave7.md §3.59, §3.69): any one of the listed keywords, on the attack
  // as it stands now. A keyword an interrupt grants this attack later is a var on its frame, not read here.
  if (pattern.attackHas !== undefined) {
    if (event.kind !== "attack") return false;
    const has = attackKeywordsOf(state, deps, {
      attackerInstanceId: event.attackerInstanceId,
      viaInstanceId: event.sourceInstanceId ?? null,
      basic: event.basic === true,
      ...(event.keywords ? { keywords: event.keywords } : {}),
    });
    const wanted = pattern.attackHas;
    if (!wanted.some((keyword) => has.includes(keyword) || (keyword === "overkill" && event.overkill === true)))
      return false;
  }
  // "After the engaged player …" (docs/phase7-wave5.md §3.25): the event's player is one the ref names.
  if (pattern.playerIn) {
    const player = subjects.players[0];
    if (player === undefined || !resolvePlayers(state, pattern.playerIn, context).includes(player)) return false;
  }
  return true;
}

/**
 * The "you" of "[enemy] attacks you" (`EventPattern.usesAttackedPlayer`). RRG 1.8 "Defend, Defense" (the entry begins
 * on p. 15; these sentences are on p. 16): "If a player defends against an enemy attack that targets a different
 * player (either by defending with a character they control or by resolving a defense ability), the defending player
 * becomes the new target of that attack. Any triggered ability that refers to 'you' refers to the player who was the
 * target of the attack when that ability resolved. (For example, the 'you' in an ability that triggers 'when [enemy]
 * attacks you' refers to the player against whom the attack initiated, while the 'you' in an ability that triggers
 * 'after [enemy] attacks you' refers to the player whose character defended the attack.)" Owner ruling, 2026-10-09
 * (docs/phase7-wave8.md §4.1 row 91).
 *
 * So an interrupt reads the player the attack was initiated against (`attackedPlayerId`), and a response reads the
 * attack's target player as it ended (`targetPlayerId`): the controller of the hero or ally that defended (p. 15:
 * "When an ally defends an attack, ... its controller becomes the target player for that attack"), the player whose
 * "(defense)" ability made their identity the defender, or the attacked player still when nobody defended. A player
 * who defends with their own ally stays "you" (RRG 1.8 "Attack (Enemy Activation)", p. 8).
 */
function attackYouOf(event: Extract<TriggerEvent, { kind: "enemyAttack" }>, timing: WindowTiming): PlayerId {
  return timing === "response" ? event.targetPlayerId : event.attackedPlayerId;
}

/** Who "you" is when an encounter card's ability triggers on an event. */
function actingPlayerOf(event: TriggerEvent, pattern: EventPattern, timing: WindowTiming): PlayerId | null {
  if (event.kind === "enemyAttack" && usesAttackedPlayer(pattern, event)) return attackYouOf(event, timing);
  return eventSubjects(event).players[0] ?? null;
}

/** `usesAttackedPlayer` on the pattern, or on one of its `anyOf` alternatives that hears this event's kind. */
function usesAttackedPlayer(pattern: EventPattern, event: TriggerEvent): boolean {
  if (pattern.usesAttackedPlayer === true) return true;
  const kinds: readonly TriggerEvent["kind"][] = typeof pattern.on === "string" ? [pattern.on] : pattern.on;
  if (!kinds.includes(event.kind)) return false;
  return (pattern.anyOf ?? []).some((alternative) => usesAttackedPlayer(alternative, event));
}

/**
 * Who is offered an optional ability on an encounter card, and resolves it as "you". RRG 1.8 "Ability" (p. 4): "Any
 * player can use such an ability on an encounter card". A damage event names no player, so the offer goes to the
 * controller of the card dealing the damage, the player whose attack it is (docs/phase7-wave5.md §4 Q8, Bell Tower's
 * "(you may) place that many chime counters here instead"); with no controlling player, `controllersToAsk` falls back
 * to the first player. Forced abilities keep `actingPlayerOf`: nobody chooses whether to resolve them.
 */
function offeredPlayerOf(
  state: GameState,
  event: TriggerEvent,
  pattern: EventPattern,
  timing: WindowTiming,
): PlayerId | null {
  const acting = actingPlayerOf(event, pattern, timing);
  if (acting !== null || event.kind !== "dealDamage") return acting;
  return sourcePlayerOf(state, event);
}

/** RRG "Hero Interrupt"/"Alter-Ego Response": the gate is on the controller's current form. */
const formSatisfied = (state: GameState, controllerId: PlayerId | null, form: Form | undefined): boolean => {
  if (!form) return true;
  if (!controllerId) return false;
  return getPlayer(state, controllerId)?.identity.form === form;
};

/**
 * An interrupt or response's own condition (`trigger.while`, docs/phase7-wave6.md §3.57: Med Lab's "(Limit 1 ally at a
 * time.)"): RRG 1.8 "Play Restrictions and Permissions" (p. 33), checked before the cost at "Initiating Abilities"
 * (p. 24) step 2. "This card" is the ability's card and "you" the player who would resolve it.
 */
function conditionHolds(
  state: GameState,
  deps: EngineDeps,
  trigger: AbilityDefinition["trigger"],
  id: InstanceId,
  playerId: PlayerId | null,
  event: TriggerEvent,
): boolean {
  if ((trigger.kind !== "interrupt" && trigger.kind !== "response") || !trigger.while) return true;
  // "…, if you discarded at least 1 [mental]": what the answered moment carries is read here too (§3.71).
  const carried = carriedByEvent(event);
  return evaluate(state, trigger.while, {
    selfInstanceId: id,
    controllerId: playerId,
    event,
    bindings: carried.bindings,
    vars: carried.vars,
    deps,
  });
}

/**
 * Whether a use of this card's ability is still resolving (`notWhileResolving`): the frame paying for it, or any
 * effects frame of it, is on the stack. Every frame an ability's effects push for their branches and replacements
 * carries the ability's id and card, so this holds from the moment the ability is initiated until its last effect
 * has resolved, across whatever it starts in between (an attack, with its own windows).
 */
const abilityResolving = (state: GameState, id: InstanceId, ability: AbilityId): boolean =>
  state.stack.some(
    (frame) =>
      (frame.kind === "effects" && frame.selfInstanceId === id && frame.abilityId === ability) ||
      (frame.kind === "ability" && frame.instanceId === id && frame.abilityId === ability),
  );

/**
 * Whether the event is an amount of nothing: 0 threat to place or 0 damage to deal. Such an event opens no window and
 * sets off no "each time" effect (owner rulings 2026-10-05 for threat and 2026-10-06 for damage, docs/phase7-wave7.md
 * §4.1).
 *
 * - **Threat.** A placement of 0 threat places none (villain phase step one with no acceleration; `applyPlaceThreat`
 *   does nothing for it): "when any amount of threat would be placed" and "after threat is placed" have not happened.
 *   Maintainer reading: the RRG does not define "any amount" for threat.
 * - **Damage.** RRG 1.8 "Damage" (p. 14) words every step around damage as "any amount of damage" ("would deal/be
 *   dealt", "would take", "takes", "after … deals/is dealt/takes"), and "Tough" (p. 44) the same ("would take any
 *   amount of damage"; `toughResolvesFirst` and `applyDamage` leave the status card alone at 0, as the p. 9 and p. 44
 *   notes on a basic defense that covers the whole attack require). So damage whose amount is 0 as it would be dealt
 *   (a 0 ATK attack, an attack a defender's DEF covered, an X of 0) has no "would" window, is neither dealt nor
 *   taken, and nothing answers it afterwards. The attack it came from still happened: "after [enemy] attacks",
 *   "after [character] defends" and retaliate key off the attack, not the damage (p. 9 step 6, "Retaliate X", p. 38).
 * - **Damage an interrupt prevented in full.** Its interrupt window did open (the amount was positive), and once
 *   `preventDamage` has taken the event's `amount` to 0 no further interrupt is gathered for it: nothing is left that
 *   "would" be taken. Afterwards the damage was dealt and not taken (RRG 1.8 "Prevent", p. 35: "the amount of damage
 *   'dealt' is not reduced"), exactly as damage a tough status card, a constant or "cannot take damage" stopped: the
 *   event carries `dealt` (positive) and `taken` (0), its response window opens, "after X deals / is dealt damage"
 *   fires and "after X takes damage" does not (owner ruling 2026-10-07, overruling the 2026-10-06 reading that a full
 *   prevention left nothing to answer). So an interrupt reads `amount`, and a response or an "each time" effect reads
 *   the amount dealt.
 */
const nothingToAnswer = (event: TriggerEvent, timing: WindowTiming): boolean => {
  if (event.kind === "placeThreat") return event.amount <= 0;
  if (event.kind !== "dealDamage") return false;
  return (timing === "interrupt" ? event.amount : (event.dealt ?? event.amount)) <= 0;
};

export function candidatesFor(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
  timing: WindowTiming,
  forced: boolean,
): readonly TriggerCandidate[] {
  // A "(defense)"-labeled ability of a player the attack in progress is closed to is neither offered nor, when
  // forced, initiated (RRG 1.8 "Defend, Defense", pp. 14-15; `defense-claim.ts`).
  return gatherCandidates(state, deps, event, timing, forced).filter(
    (candidate) => candidateDefenseBar(state, deps, candidate) === null,
  );
}

/**
 * The "(defense)"-labeled abilities this event would have made available but for another player's defense of the
 * attack in progress, each with the reason: what `candidatesFor` left out for that reason alone (`choiceExclusions`).
 */
export function defenseBarredCandidates(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
  timing: WindowTiming,
  forced: boolean,
): readonly { readonly candidate: TriggerCandidate; readonly reason: DefenseBar }[] {
  return gatherCandidates(state, deps, event, timing, forced).flatMap((candidate) => {
    const reason = candidateDefenseBar(state, deps, candidate);
    return reason === null ? [] : [{ candidate, reason }];
  });
}

function gatherCandidates(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
  timing: WindowTiming,
  forced: boolean,
): readonly TriggerCandidate[] {
  // The start of a villain phase step is an interrupt-only timing point (docs/phase7-wave6.md §3.61).
  if (timing === "response" && event.kind === "villainStepStarting") return [];
  // A change of form about to happen is interrupt-only: "after you change form" answers `formChanged`.
  if (timing === "response" && event.kind === "formChanging") return [];
  // A tuck about to happen is interrupt-only ("would", RRG 1.8 p. 48; docs/phase7-wave9.md §3.40).
  if (timing === "response" && event.kind === "cardBeingTucked") return [];
  // So is a discard from a hand or a deck about to happen (docs/phase7-wave9.md §4.1 Q20).
  if (timing === "response" && event.kind === "cardBeingDiscarded") return [];
  // And a status card about to be given ("after a status card is placed" answers `statusPlaced`; wave 9 §3.33).
  if (timing === "response" && event.kind === "statusBeingGiven") return [];
  if (nothingToAnswer(event, timing)) return [];
  // A card discarded from a deck that a response has since moved leaves nothing to act on: no other ability answers
  // its discard (docs/phase7-wave7.md §3.55).
  if (event.kind === "cardDiscardedFromDeck" && !deckDiscardStillThere(state, event)) return [];
  const found: TriggerCandidate[] = [];
  // Read once per call, and only once some ability has the right timing.
  let noTriggers: readonly ActiveRule<"cannotResolveTriggeredAbilities">[] | undefined;
  for (const id of cardsInPlay(state)) {
    for (const ref of activeAbilityRefs(state, id, deps)) {
      const definition = deps.abilities[ref.id];
      if (!definition) continue;
      const trigger = definition.trigger;
      if (trigger.kind !== timing || trigger.forced !== forced) continue;
      // "You cannot resolve triggered abilities in your hero's printed text box" (Induced Panic): neither offered nor,
      // when forced, initiated (`cannotResolveTriggeredAbilities`).
      // A rule scoped to players ("other players cannot resolve player card abilities") is read below, once the
      // player who would resolve this one is known.
      noTriggers ??= activeRules(state, deps, "cannotResolveTriggeredAbilities");
      if (triggeredAbilityForbidden(state, deps, id, trigger, null, noTriggers)) continue;
      // A cost reduction is used while paying, not offered in the play's window (docs/phase7-wave3.md §3.20).
      if (definition.playCostReduction) continue;
      // An ability that works only in hand does nothing in play (docs/phase7-wave4.md §3.13), nor does one a card
      // makes from where its discard from a deck left it (docs/phase7-wave7.md §3.55).
      // Nor one a card makes to its own discard from under another card (docs/phase7-wave9.md §3.40).
      if (definition.activeIn === "hand" || definition.activeIn === "discard" || definition.activeIn === "tucked")
        continue;
      // "Only the player who controls Robert Kelly can trigger this ability" (`triggerableBy`, docs/phase7-wave6.md
      // §3.11): each player it names is offered the ability as its "you".
      const named = forced ? null : triggeringPlayers(state, deps, id, trigger, event);
      if (named) {
        for (const playerId of named) {
          if (trigger.firstPlayerOnly === true && playerId !== state.firstPlayerId) continue;
          if (triggeredAbilityForbidden(state, deps, id, trigger, playerId, noTriggers)) continue;
          if (offeredTo(state, deps, id, ref.id, definition, event, playerId)) {
            found.push(candidateOf({ instanceId: id, abilityId: ref.id, controllerId: playerId, definition }, forced));
          }
        }
        continue;
      }
      // An ally under no player's control (`isCaptiveAlly`; docs/phase7-wave9.md §3.19): its optional Interrupt or
      // Response is its controller's to trigger, and it has none, so it is offered to nobody. Its forced abilities
      // still resolve, as any card's in play do.
      if (!forced && isCaptiveAlly(state, id)) continue;
      const controllerId = controllerOf(state, id);
      // "First Player Interrupt/Response": the first player is the one offered it and resolving it (§3.13).
      if (trigger.firstPlayerOnly === true && controllerId !== null && controllerId !== state.firstPlayerId) continue;
      // An uncontrolled card whose "you" the rules name (an obligation, an attachment on a player card, an environment in
      // a player's play area: `uncontrolledYouOf`) resolves as that player.
      const acting =
        controllerId ??
        (trigger.firstPlayerOnly === true
          ? state.firstPlayerId
          : (uncontrolledYouOf(state, id) ??
            (forced ? actingPlayerOf(event, trigger.on, timing) : offeredPlayerOf(state, event, trigger.on, timing))));
      if (acting !== null && triggeredAbilityForbidden(state, deps, id, trigger, acting, noTriggers)) continue;
      // "Hero Response" on an encounter card gates the player who resolves it (docs/phase7-wave6.md §3.11).
      if (!formSatisfied(state, acting, trigger.form)) continue;
      if (!conditionHolds(state, deps, trigger, id, acting, event)) continue;
      if (trigger.notWhileResolving === true && abilityResolving(state, id, ref.id)) continue;
      const limitPlayer =
        controllerId ??
        (trigger.firstPlayerOnly === true ? state.firstPlayerId : actingPlayerOf(event, trigger.on, timing));
      if (limitReached(state, id, ref.id, definition, event, limitPlayer)) continue;
      if (!matchesPattern(state, trigger.on, event, timing, id, deps)) continue;
      if (cancelHasNoTarget(state, deps, definition, event)) continue;
      // RRG 1.8 "Target" (pp. 42–43): an optional ability with no valid target is not offered (docs/phase7-wave3.md §3.5).
      if (!forced && abilityLacksValidTarget(state, deps, definition, id, limitPlayer, event)) continue;
      // RRG "Cost": an ability whose cost can't be paid can't be triggered (`costPayable`).
      if (controllerId && !costPayable(state, deps, id, controllerId, definition, false, event)) continue;
      found.push(candidateOf({ instanceId: id, abilityId: ref.id, controllerId: acting, definition }, forced));
    }
  }
  found.push(...keywordCandidates(state, deps, event, timing, forced));
  found.push(...spentCardCandidates(state, deps, event, timing, forced));
  found.push(...leftCardCandidates(state, deps, event, timing, forced));
  found.push(...deckDiscardCandidates(state, deps, event, timing, forced));
  found.push(...tuckedDiscardCandidates(state, deps, event, timing, forced));
  found.push(...inHandCandidates(state, deps, event, timing, forced));
  return found;
}

/**
 * The engine's keyword abilities this event sets off (`KEYWORD_ABILITIES`): one per card in play that has the keyword
 * right now, read through `hasKeyword` so a lost keyword exempts the card and a granted one counts (RRG 1.8 "Temporary",
 * p. 44; "'Loses'", p. 27; docs/phase7-wave6.md §3.26). A keyword is not a printed triggered ability, so a rule against
 * resolving those (Induced Panic) does not reach it. Its controller resolves it; an uncontrolled card resolves as the
 * player the rules name (`uncontrolledYouOf`), else as no one.
 */
function keywordCandidates(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
  timing: WindowTiming,
  forced: boolean,
): readonly TriggerCandidate[] {
  const found: TriggerCandidate[] = [];
  for (const ability of KEYWORD_ABILITIES) {
    const trigger = ability.definition.trigger;
    if (trigger.kind !== timing || trigger.forced !== forced) continue;
    const kinds: readonly TriggerEvent["kind"][] = typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on;
    // Cheap before the scan of every card in play: most events are of no keyword's kind.
    if (!kinds.includes(event.kind)) continue;
    for (const id of cardsInPlay(state)) {
      if (!hasKeyword(state, id, ability.keyword, deps)) continue;
      if (!matchesPattern(state, trigger.on, event, timing, id, deps)) continue;
      const controllerId = controllerOf(state, id) ?? uncontrolledYouOf(state, id);
      found.push({ instanceId: id, abilityId: ability.abilityId, controllerId, forced, fromHand: false });
    }
  }
  return found;
}

/**
 * Whether an optional interrupt/response that names who may trigger it (`triggerableBy`) is offered to `playerId` as
 * its "you": that player's form, limit, event pattern, target and cost, as `candidatesFor` reads a controller's.
 */
function offeredTo(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  abilityId: AbilityId,
  definition: AbilityDefinition,
  event: TriggerEvent,
  playerId: PlayerId,
): boolean {
  const trigger = definition.trigger;
  if (trigger.kind !== "interrupt" && trigger.kind !== "response") return false;
  if (!formSatisfied(state, playerId, trigger.form)) return false;
  if (!conditionHolds(state, deps, trigger, id, playerId, event)) return false;
  if (limitReached(state, id, abilityId, definition, event, playerId)) return false;
  if (!matchesPattern(state, trigger.on, event, trigger.kind, id, deps, playerId)) return false;
  if (cancelHasNoTarget(state, deps, definition, event)) return false;
  if (abilityLacksValidTarget(state, deps, definition, id, playerId, event)) return false;
  return costPayable(state, deps, id, playerId, definition, false, event);
}

/**
 * "Interrupt: When Spider-Man leaves play, …" (`sm` 27017; docs/phase7-wave5.md §3.13): the card that left answers its
 * own `cardLeavesPlay` from wherever it went, controlled by whoever controlled it as it left. Only its abilities on that
 * event with itself as the target (`selfIs: "target"`) come alive, as `spentCardCandidates` does for a spent card.
 */
function leftCardCandidates(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
  timing: WindowTiming,
  forced: boolean,
): readonly TriggerCandidate[] {
  if (event.kind !== "cardLeavesPlay") return [];
  const id = event.instanceId;
  if (cardsInPlay(state).includes(id)) return [];
  // An uncontrolled card resolves as the player its "you" named in play, as it did there (`uncontrolledYouOf`).
  const controllerId = event.controllerId ?? event.speakerId ?? null;
  const found: TriggerCandidate[] = [];
  for (const ref of activeAbilityRefs(state, id, deps)) {
    const definition = deps.abilities[ref.id];
    if (!definition) continue;
    const trigger = definition.trigger;
    if (trigger.kind !== timing || trigger.forced !== forced) continue;
    if (trigger.on.selfIs !== "target") continue;
    if (!formSatisfied(state, controllerId, trigger.form)) continue;
    if (!conditionHolds(state, deps, trigger, id, controllerId, event)) continue;
    if (limitReached(state, id, ref.id, definition, event, controllerId)) continue;
    if (!matchesPattern(state, trigger.on, event, timing, id, deps, controllerId ?? undefined)) continue;
    // A cost is paid from play; a card that has left has nothing to pay it with.
    if (definition.cost) continue;
    found.push(candidateOf({ instanceId: id, abilityId: ref.id, controllerId, definition }, forced));
  }
  return found;
}

/**
 * "Response: After this card is discarded from the top of your deck, …" (`AbilityDefinition.activeIn: "discard"`,
 * docs/phase7-wave7.md §3.55): the discarded card answers its own `cardDiscardedFromDeck` from where the discard left
 * it, its owner's discard pile or, when the discard emptied the deck, the new deck (§4.1 Q33; `candidatesFor` has
 * already dropped a card a response moved). RRG 1.8 "In Play and Out of Play" (p. 23): only an ability that
 * "specifically refer[s] to being used from an out-of-play area" works there, so only the card's abilities marked that
 * way, on that event, with itself as the target. The player whose deck it left resolves it as "you": the card's
 * owner, since a player card is discarded to its owner's pile (RRG 1.8 "Ownership and Control", p. 31: "A player
 * controls the cards in their own out-of-play areas (such as the hand, the deck, and the discard pile)"). A cost is
 * paid from play, so an ability with one is not offered.
 */
function deckDiscardCandidates(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
  timing: WindowTiming,
  forced: boolean,
): readonly TriggerCandidate[] {
  if (event.kind !== "cardDiscardedFromDeck") return [];
  const id = event.instanceId;
  const card = cardOf(state, id);
  if (!card || !("abilities" in card)) return [];
  const controllerId = event.playerId;
  const found: TriggerCandidate[] = [];
  for (const ref of card.abilities) {
    const definition = deps.abilities[ref.id];
    if (!definition || definition.activeIn !== "discard") continue;
    const trigger = definition.trigger;
    if (trigger.kind !== timing || trigger.forced !== forced) continue;
    if (trigger.on.selfIs !== "target") continue;
    if (!formSatisfied(state, controllerId, trigger.form)) continue;
    if (!conditionHolds(state, deps, trigger, id, controllerId, event)) continue;
    if (limitReached(state, id, ref.id, definition, event, controllerId)) continue;
    if (!matchesPattern(state, trigger.on, event, timing, id, deps, controllerId)) continue;
    if (!forced && abilityLacksValidTarget(state, deps, definition, id, controllerId, event)) continue;
    if (definition.cost) continue;
    found.push(candidateOf({ instanceId: id, abilityId: ref.id, controllerId, definition }, forced));
  }
  return found;
}

/**
 * "Forced Response: After a player card effect discards this card from under an identity, …"
 * (`AbilityDefinition.activeIn: "tucked"`, docs/phase7-wave9.md §3.40 (b)): the discarded card answers its own
 * `tuckedCardDiscarded` from the discard pile it went to. RRG 1.8 "In Play and Out of Play" (p. 23): only an ability
 * that "specifically refer[s] to being used from an out-of-play area" works there, so only the card's abilities marked
 * that way, on that event, with itself as the target. "You" is the player its host spoke to (the identity's
 * controller), who resolves it; for a host that spoke to no one a forced ability still resolves, with no "you". A cost
 * is paid from play, so an ability with one is not offered.
 */
function tuckedDiscardCandidates(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
  timing: WindowTiming,
  forced: boolean,
): readonly TriggerCandidate[] {
  if (event.kind !== "tuckedCardDiscarded") return [];
  const id = event.instanceId;
  const card = cardOf(state, id);
  if (!card || !("abilities" in card)) return [];
  const controllerId = event.playerId;
  const found: TriggerCandidate[] = [];
  for (const ref of card.abilities) {
    const definition = deps.abilities[ref.id];
    if (!definition || definition.activeIn !== "tucked") continue;
    const trigger = definition.trigger;
    if (trigger.kind !== timing || trigger.forced !== forced) continue;
    if (trigger.on.selfIs !== "target") continue;
    if (!formSatisfied(state, controllerId, trigger.form)) continue;
    if (!conditionHolds(state, deps, trigger, id, controllerId, event)) continue;
    if (limitReached(state, id, ref.id, definition, event, controllerId)) continue;
    if (!matchesPattern(state, trigger.on, event, timing, id, deps, controllerId ?? undefined)) continue;
    if (!forced && abilityLacksValidTarget(state, deps, definition, id, controllerId, event)) continue;
    if (definition.cost) continue;
    found.push(candidateOf({ instanceId: id, abilityId: ref.id, controllerId, definition }, forced));
  }
  return found;
}

/**
 * "After you spend this card" (docs/phase7-wave2.md §12): while a `resourcesSpent` event resolves, each card it spent
 * offers its own abilities on that event, although the card is already in its owner's discard pile. RRG 1.8 "Resource
 * Card" (p. 37): "Some resource cards have card text that is active while using the card to generate resources", and a
 * spent resource "is also considered to be spent by that player's identity", so the spender controls the ability.
 *
 * Only abilities that trigger on `resourcesSpent` with the card itself as the spent card (`selfIs: "source"`) come
 * alive this way — nothing else on a card in the discard pile does, so a spent card's other text stays inactive.
 */
function spentCardCandidates(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
  timing: WindowTiming,
  forced: boolean,
): readonly TriggerCandidate[] {
  if (event.kind !== "resourcesSpent") return [];
  const controllerId = event.playerId;
  const inPlay = new Set(cardsInPlay(state));
  const found: TriggerCandidate[] = [];
  for (const id of event.cardInstanceIds) {
    // A card that is somehow in play already had its abilities scanned above; never offer one twice.
    if (inPlay.has(id)) continue;
    for (const ref of activeAbilityRefs(state, id, deps)) {
      const definition = deps.abilities[ref.id];
      if (!definition) continue;
      const trigger = definition.trigger;
      if (trigger.kind !== timing || trigger.forced !== forced) continue;
      if (trigger.on.selfIs !== "source") continue;
      const kinds: readonly TriggerEvent["kind"][] =
        typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on;
      if (!kinds.includes("resourcesSpent")) continue;
      if (!formSatisfied(state, controllerId, trigger.form)) continue;
      if (!conditionHolds(state, deps, trigger, id, controllerId, event)) continue;
      if (limitReached(state, id, ref.id, definition, event, controllerId)) continue;
      if (!matchesPattern(state, trigger.on, event, timing, id, deps, controllerId)) continue;
      if (!costPayable(state, deps, id, controllerId, definition, false, event)) continue;
      found.push(candidateOf({ instanceId: id, abilityId: ref.id, controllerId, definition }, forced));
    }
  }
  return found;
}

/**
 * RRG "Event" + "Interrupt"/"Response": an event whose ability is an interrupt
 * or a response is played from hand *inside* the matching timing window, so the
 * window has to offer each player their matching in-hand events alongside the
 * optional abilities already in play. Playing one is never forced, so these only
 * ever appear in the optional tier.
 *
 * An event a constant lets its controller play from an attachment "as if it were in your hand" (Jocasta, Black
 * Panther 23012, George Stacy, Hawkeye's Quiver: `attachmentsPlayableBy`) is a permission (RRG 1.8 "Play Restrictions
 * and Permissions", p. 33) to play it from there, so the window offers it exactly as it offers the same event in hand
 * (RRG 1.8 "Event", p. 18; "Interrupt", p. 25; "Response", p. 38). `playWindowEvent` then prices and plays it as from
 * hand, and playing it moves it off its host.
 *
 * A card's own `activeIn: "hand"` triggered ability is offered here too, forced or not: "Forced Response: After this card
 * enters your hand, …" on an encounter card that stays in the hand (Infiltration, `mut_gen` 32082; `RuleSpec
 * staysInHand`, docs/phase7-wave6.md §3.10) resolves from the hand of the player who drew it, as its "you".
 * An event's own in-hand ability is the same: it resolves from the hand and the event is not played.
 */
function inHandCandidates(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
  timing: WindowTiming,
  forced: boolean,
): readonly TriggerCandidate[] {
  const found: TriggerCandidate[] = [];
  for (const player of playerOrder(state)) {
    const attached = new Set(attachmentsPlayableBy(state, deps, player.playerId));
    // "You may play the top card of your deck as if it was in your hand" (`playableTopOfDeck`, docs/phase7-wave8.md
    // §3.49): offered as an event in hand is, and for an in-hand ability that plays its own card (`playsOwnCardFromHand`).
    // Nothing else of the card works from there: it is in the deck.
    const deckTop = new Set(deckTopPlayableBy(state, deps, player.playerId));
    for (const id of [...player.hand, ...attached, ...deckTop]) {
      const card = cardOf(state, id);
      if (!card) continue;
      // "While Pip the Troll is in your hand, he gains 'Interrupt: …'" (`activeIn: "hand"`, docs/phase7-wave4.md §3.13):
      // an ability of the card, used from hand, not a play of it. The permission covers *playing* an attached card,
      // so an attached card's "while in your hand" text stays inactive.
      // An event's own (`activeIn: "hand"`) ability is heard the same way, forced or not: "Forced Response: After your
      // turn ends, if this card is in your hand, take 1 damage." is an ability of the card resolving from the hand,
      // not a play of the event (RRG 1.8 "In Play and Out of Play", p. 23: an ability is used out of play when it
      // "specifically refer[s] to being used from an out-of-play area"; "Forced", p. 20: it must resolve). The card
      // is not paid for, played or discarded, and stays in the hand.
      if (!attached.has(id)) {
        for (const ref of "abilities" in card ? card.abilities : []) {
          const definition = deps.abilities[ref.id];
          if (!definition || definition.activeIn !== "hand") continue;
          if (deckTop.has(id) && !playsOwnCardFromHand(definition)) continue;
          const trigger = definition.trigger;
          if (trigger.kind !== timing || trigger.forced !== forced) continue;
          // "Other players cannot resolve player card abilities during your turn": one used from a hand included.
          if (triggeredAbilityForbidden(state, deps, id, trigger, player.playerId)) continue;
          if (!formSatisfied(state, player.playerId, trigger.form)) continue;
          if (!conditionHolds(state, deps, trigger, id, player.playerId, event)) continue;
          if (limitReached(state, id, ref.id, definition, event, player.playerId)) continue;
          // The card's "you" is the player whose hand it is in.
          if (!matchesPattern(state, trigger.on, event, timing, id, deps, player.playerId)) continue;
          if (cancelHasNoTarget(state, deps, definition, event)) continue;
          if (!forced && abilityLacksValidTarget(state, deps, definition, id, player.playerId, event)) continue;
          // "Play Colossus from your hand (paying his resource cost)": an optional in-hand ability that plays its own
          // card is not offered while the card could not be played or paid for (`ownCardPlayFault`).
          if (!forced && ownCardPlayFault(state, deps, player.playerId, id, definition, event) !== null) continue;
          found.push({ instanceId: id, abilityId: ref.id, controllerId: player.playerId, forced, fromHand: false });
        }
      }
      if (card.type !== "event") continue;
      // Playing an event is never forced.
      if (forced) continue;
      // "Max 1 per round", "Play only if …": a window never offers a card its restrictions forbid.
      if (playRestrictionFault(state, deps, player.playerId, card, id)) continue;
      // Nor one a `cannotPlay` rule forbids ("You cannot play events until after that attack resolves", In Cold
      // Blood): an event played in a timing window is still played (RRG 1.8 "Play, Put Into Play", p. 32).
      if (cannotPlayCard(state, deps, player.playerId, id)) continue;
      for (const ref of card.abilities) {
        const definition = deps.abilities[ref.id];
        // Its "while in your hand" abilities were heard above; they are not ways to play it.
        if (!definition || definition.activeIn === "hand") continue;
        const trigger = definition.trigger;
        if (trigger.kind !== timing || trigger.forced) continue;
        if (!formSatisfied(state, player.playerId, trigger.form)) continue;
        if (!conditionHolds(state, deps, trigger, id, player.playerId, event)) continue;
        // "(Max 1 per attack.)" on an event (docs/phase7-wave7.md §3.69): a copy that could not be triggered for this
        // instance is not offered, so it is never played for nothing.
        if (limitReached(state, id, ref.id, definition, event, player.playerId)) continue;
        if (!matchesPattern(state, trigger.on, event, timing, id, deps)) continue;
        if (cancelHasNoTarget(state, deps, definition, event)) continue;
        if (abilityLacksValidTarget(state, deps, definition, id, player.playerId, event)) continue;
        // Its printed cost and its ability's cost (Full Blast's "exhaust Cyclops →") must be payable (`costPayable`).
        if (!costPayable(state, deps, id, player.playerId, definition, true, event)) continue;
        found.push({
          instanceId: id,
          abilityId: ref.id,
          controllerId: player.playerId,
          forced: false,
          fromHand: true,
        });
      }
    }
  }
  return found;
}

/** A candidate's key in `Frame<"window">.heardAtOpen`: its card, its ability and, in a shared window, its condition. */
export const hearerKey = (instanceId: InstanceId, abilityId: AbilityId, sharedIndex?: number): string =>
  `${instanceId}:${abilityId}${sharedIndex === undefined ? "" : `@${sharedIndex}`}`;

/**
 * The optional abilities of this timing that are live right now and listen for this kind of event, whatever the rest
 * of their condition says (`Frame<"window">.heardAtOpen`): on a card in play with the ability active, an event in a
 * hand (or playable from an attachment or the top of a deck) with an ability of this timing, or a card's own
 * "while in your hand" ability. Liveness only; `candidatesFor` judges everything else when one is offered.
 */
export function hearersOf(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
  timing: WindowTiming,
  sharedIndex?: number,
): readonly string[] {
  const listens = (definition: AbilityDefinition | undefined): boolean => {
    const trigger = definition?.trigger;
    if (!trigger || trigger.kind !== timing || trigger.forced) return false;
    const kinds: readonly TriggerEvent["kind"][] = typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on;
    return kinds.includes(event.kind);
  };
  const found: string[] = [];
  for (const id of cardsInPlay(state)) {
    for (const ref of activeAbilityRefs(state, id, deps)) {
      const definition = deps.abilities[ref.id];
      if (definition?.activeIn === "hand" || definition?.activeIn === "discard" || definition?.activeIn === "tucked")
        continue;
      if (listens(definition)) found.push(hearerKey(id, ref.id, sharedIndex));
    }
  }
  for (const player of playerOrder(state)) {
    const elsewhere = [
      ...attachmentsPlayableBy(state, deps, player.playerId),
      ...deckTopPlayableBy(state, deps, player.playerId),
    ];
    for (const id of [...player.hand, ...elsewhere]) {
      const card = cardOf(state, id);
      if (!card || !("abilities" in card)) continue;
      for (const ref of card.abilities) {
        const definition = deps.abilities[ref.id];
        if (card.type !== "event" && definition?.activeIn !== "hand") continue;
        if (listens(definition)) found.push(hearerKey(id, ref.id, sharedIndex));
      }
    }
  }
  return found;
}

/**
 * Whether any ability could react to this event right now, in either window. Events on paths every game takes (a turn
 * ending, surge, an ability resolving, a minion engaging) go on the stack only when one could, so a game with nothing
 * listening resolves exactly as it did before those events existed.
 */
export const heard = (state: GameState, deps: EngineDeps, event: TriggerEvent): boolean =>
  hasCandidates(state, deps, event, "interrupt") ||
  hasCandidates(state, deps, event, "response") ||
  eachTimeEffectsFor(state, deps, event).length > 0;

/**
 * The lasting "each time …" effects this event sets off (`LastingEffectBody eachTime`, docs/phase7-wave3.md §3.17), in
 * the order they were created. Each is matched with its scope's card as "self" and its controller as "you", which is
 * what an event card in its discard pile needs (Schadenfreude).
 */
export function eachTimeEffectsFor(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
): readonly Extract<LastingEffect, { kind: "eachTime" }>[] {
  return state.lastingEffects.filter(
    (effect): effect is Extract<LastingEffect, { kind: "eachTime" }> =>
      effect.kind === "eachTime" &&
      !nothingToAnswer(event, "response") &&
      effect.scope.selfInstanceId !== null &&
      matchesPattern(
        state,
        effect.on,
        event,
        "response",
        effect.scope.selfInstanceId,
        deps,
        effect.scope.controllerId ?? undefined,
      ),
  );
}

export const hasCandidates = (state: GameState, deps: EngineDeps, event: TriggerEvent, timing: WindowTiming): boolean =>
  candidatesFor(state, deps, event, timing, true).length > 0 ||
  candidatesFor(state, deps, event, timing, false).length > 0;

/**
 * Whether an optional candidate gathered as its window opened can still be initiated now, after the window's forced
 * tier resolved (`Frame<"window">.optionalAtOpen`, docs/phase7-wave6.md §3.79). Its triggering condition is not read
 * again: it was met by the occurrence (RRG 1.8 "Triggering Condition", p. 45), whatever the forced abilities changed
 * since. What is read again is everything `candidatesFor` checks of the ability itself: it is still on a card in play
 * and active (or the event is still in hand), its form, its own condition (`trigger.while`), limit, target and cost (RRG 1.8 "Initiating Abilities",
 * p. 24). A card answering from out of play (a spent resource, a card that left) is kept as it was gathered.
 */
export function stillOffered(
  state: GameState,
  deps: EngineDeps,
  candidate: TriggerCandidate,
  event: TriggerEvent,
): boolean {
  const definition = deps.abilities[candidate.abilityId];
  if (!definition) return false;
  // Another player defended the attack, or used a "(defense)" ability for it, while the forced tier resolved.
  if (candidateDefenseBar(state, deps, candidate) !== null) return false;
  // Not a condition read again but a card that is gone: a response moved the discarded card (`candidatesFor`).
  if (event.kind === "cardDiscardedFromDeck" && !deckDiscardStillThere(state, event)) return false;
  const id = candidate.instanceId;
  const controllerId = candidate.controllerId;
  const trigger = definition.trigger;
  if (candidate.fromHand) {
    if (!controllerId) return false;
    const player = getPlayer(state, controllerId);
    const card = cardOf(state, id);
    if (!player || !card) return false;
    if (
      !player.hand.includes(id) &&
      !attachmentsPlayableBy(state, deps, controllerId).includes(id) &&
      !deckTopPlayOf(state, deps, controllerId, id)
    )
      return false;
    if (playRestrictionFault(state, deps, controllerId, card, id)) return false;
    if (cannotPlayCard(state, deps, controllerId, id)) return false;
    // A card that plays itself in a window is still entering play (`RuleSpec cannotEnterPlay`; an event is not).
    if (card.type !== "event" && cannotEnterPlay(state, deps, id)) return false;
  } else if (cardsInPlay(state).includes(id)) {
    if (!activeAbilityRefs(state, id, deps).some((ref) => ref.id === candidate.abilityId)) return false;
    const noTriggers = activeRules(state, deps, "cannotResolveTriggeredAbilities");
    if (triggeredAbilityForbidden(state, deps, id, trigger, controllerId, noTriggers)) return false;
  } else if (definition.activeIn === "hand") {
    if (!controllerId) return false;
    const fromDeckTop = playsOwnCardFromHand(definition) && deckTopPlayOf(state, deps, controllerId, id) !== null;
    if (!getPlayer(state, controllerId)?.hand.includes(id) && !fromDeckTop) return false;
    if (triggeredAbilityForbidden(state, deps, id, trigger, controllerId)) return false;
    if (ownCardPlayFault(state, deps, controllerId, id, definition, event) !== null) return false;
  } else if (!answersFromOutOfPlay(event, id)) {
    return false; // it left play while the forced tier resolved
  }
  if ("form" in trigger && !formSatisfied(state, controllerId, trigger.form)) return false;
  if (!conditionHolds(state, deps, trigger, id, controllerId, event)) return false;
  if (limitReached(state, id, candidate.abilityId, definition, event, controllerId)) return false;
  if (cancelHasNoTarget(state, deps, definition, event)) return false;
  if (abilityLacksValidTarget(state, deps, definition, id, controllerId, event)) return false;
  if (controllerId && (candidate.fromHand || cardsInPlay(state).includes(id))) {
    if (!costPayable(state, deps, id, controllerId, definition, candidate.fromHand, event)) return false;
  }
  return true;
}

/**
 * A card whose abilities answer this event from out of play: `spentCardCandidates`, `leftCardCandidates`,
 * `deckDiscardCandidates`, `tuckedDiscardCandidates`.
 */
const answersFromOutOfPlay = (event: TriggerEvent, id: InstanceId): boolean =>
  (event.kind === "resourcesSpent" && event.cardInstanceIds.includes(id)) ||
  (event.kind === "cardLeavesPlay" && event.instanceId === id) ||
  (event.kind === "cardDiscardedFromDeck" && event.instanceId === id) ||
  (event.kind === "tuckedCardDiscarded" && event.instanceId === id);
