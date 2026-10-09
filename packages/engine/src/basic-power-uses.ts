/**
 * The basic attacks and thwarts a player could make right now if a card's effect had them make one (`EffectSpec
 * basicPowerBy`, `Predicate canUseBasicPower`; docs/phase7-wave8.md §3.64). There is no second copy of the basic power
 * rules here: every candidate is the ordinary `basicAttack` / `basicThwart` command, tried on a scratch copy of the
 * game with only the turn check lifted (`BasicPowerBy.instructed`), so whatever the command refuses (an exhausted
 * character, an alter-ego, guard, crisis, patrol, another game area, a "cannot" rule, a printed "—") is not a use.
 */

import type { AbilityId } from "@mc/content";
import { type AbilityCost, type EngineDeps, resourcesChoiceOf } from "./abilities.js";
import {
  basicAttack,
  basicPowerCost,
  basicThwart,
  defaultHandDiscardPicks,
  isPriceFault,
  planCost,
} from "./actions.js";
import type { Command } from "./commands.js";
import { createCtx } from "./ctx.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { canPaySpend } from "./payable.js";
import { cardOf, getInstance, getPlayer, isMinion, mainSchemeStates, undefeatedVillains } from "./query.js";
import type { ResolvedRequirement } from "./resources.js";
import { mayThwartWithAtk } from "./rules.js";
import { activeAbilityRefs, cardsInPlay, isAlly } from "./select.js";
import type { GameState } from "./state.js";

export type BasicPowerKind = "attack" | "thwart";

/** One basic power a player could make: who, which power, against what. */
export interface BasicPowerUse {
  readonly characterInstanceId: InstanceId;
  readonly power: BasicPowerKind;
  readonly targetInstanceId: InstanceId;
  /** A thwart made with ATK by the player's choice (`RuleSpec thwartWithAtk`); assault needs no flag. */
  readonly useAtk: boolean;
}

type BasicPowerCommand = Extract<Command, { type: "basicAttack" | "basicThwart" }>;

/** The command that makes `use`, as the player would issue it on their own turn. */
export function basicPowerCommand(
  playerId: PlayerId,
  use: BasicPowerUse,
  payment: BasicPowerCommand["payment"] = undefined,
  /** The cards from hand that pay a "discard N cards from your hand" part of the power's own cost. */
  discard: readonly InstanceId[] | undefined = undefined,
): BasicPowerCommand {
  const paid = {
    ...(payment && payment.length > 0 ? { payment } : {}),
    ...(discard && discard.length > 0 ? { costChoices: { discard } } : {}),
  };
  return use.power === "attack"
    ? {
        type: "basicAttack",
        playerId,
        attackerInstanceId: use.characterInstanceId,
        targetInstanceId: use.targetInstanceId,
        ...paid,
      }
    : {
        type: "basicThwart",
        playerId,
        thwarterInstanceId: use.characterInstanceId,
        schemeInstanceId: use.targetInstanceId,
        ...(use.useAtk ? { useAtk: true } : {}),
        ...paid,
      };
}

/** A basic power's own additional cost (`basicPowerCosts`) as it would be paid on a card's instruction. */
export interface BasicPowerCostNeeds {
  readonly cost: AbilityCost;
  /** The ability the cost is printed on, which a prompt for the cost names. */
  readonly abilityId: AbilityId;
  /** The resources the payment must cover, as `planCost` read them with `discard` picked. */
  readonly requirement: ResolvedRequirement;
  /** The cards from hand a "discard N cards from your hand" part is paid with; absent when the cost has none. */
  readonly discard?: readonly InstanceId[];
  /** The player picks the cards to discard: the cost has such a part with a minimum or a `combined` threshold. */
  readonly asksDiscard: boolean;
}

/**
 * What `characterId`'s basic `power` costs on top of exhausting: null with no such cost, `fault` when `planCost`
 * refuses it. Every cost shape is planned by `planCost`, the planner the player's own command pays through, so nothing
 * about a cost is judged here. `discard` is the player's pick for a hand-discard part; without it the picks are the
 * defaults a timing window judges an interrupt's cost with (`defaultHandDiscardPicks`).
 *
 * A cost that needs any other pick (`costChoices` slots besides `discard`, a `costSelection`) is planned with none, as
 * the player's own basic power is offered by `legalActions`: `planCost` refuses it unless the pick is forced.
 */
export function basicPowerCostNeeds(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  characterId: InstanceId,
  power: BasicPowerKind,
  discard?: readonly InstanceId[],
): BasicPowerCostNeeds | { readonly fault: string } | null {
  const cost = basicPowerCost(state, deps, characterId, power);
  if (!cost) return null;
  const abilityId = activeAbilityRefs(state, characterId, deps).find((ref) => {
    const trigger = deps.abilities[ref.id]?.trigger;
    return trigger?.kind === "constant" && trigger.basicPowerCosts?.some((entry) => entry.cost === cost);
  })?.id;
  if (abilityId === undefined) return { fault: "no ability carries this basic power's cost" };
  const picks = discard ?? defaultHandDiscardPicks(state, deps, characterId, playerId, cost);
  const plan = planCost(state, deps, characterId, playerId, cost, picks ? { discard: picks } : {}, new Set());
  if (isPriceFault(plan)) return { fault: plan.message };
  const part = cost.discardFromHand;
  return {
    cost,
    abilityId,
    requirement: plan.requirement,
    ...(picks ? { discard: picks } : {}),
    asksDiscard: part !== undefined && (part.min > 0 || part.combined !== undefined),
  };
}

/** `state` with `cards` out of every hand: what is left to pay resources with once those cards are discarded. */
const withoutInHand = (state: GameState, cards: readonly InstanceId[]): GameState =>
  cards.length === 0
    ? state
    : { ...state, players: state.players.map((p) => ({ ...p, hand: p.hand.filter((id) => !cards.includes(id)) })) };

/** Whether `use` could be declared now by `playerId` on a card's instruction (see the file comment). */
function declarable(state: GameState, deps: EngineDeps, playerId: PlayerId, use: BasicPowerUse): boolean {
  const needs = basicPowerCostNeeds(state, deps, playerId, use.characterInstanceId, use.power);
  if (needs && "fault" in needs) return false;
  let command = basicPowerCommand(playerId, use);
  let by: { instructed: true; assumeCostPaid?: true } = { instructed: true };
  if (needs && resourcesChoiceOf(needs.cost) !== null) {
    // A resource cost of a size the payer chooses has no requirement to check: the command judges it unpaid.
    if (needs.discard) command = { ...command, costChoices: { discard: needs.discard } };
  } else if (needs) {
    // The cost is planned (above) and its resources checked for affordability with the discards out of hand, then it
    // is taken as paid: which cards are discarded and spent is the player's to pick when the power is made.
    if (!canPaySpend(withoutInHand(state, needs.discard ?? []), deps, playerId, needs.requirement)) return false;
    by = { instructed: true, assumeCostPaid: true };
  }
  const scratch = createCtx(state, deps);
  return (
    (command.type === "basicAttack" ? basicAttack(scratch, command, by) : basicThwart(scratch, command, by)) === null
  );
}

/**
 * Every basic power among `powers` that `playerId` could make now, lazily: characters in play-area order (the
 * identity first), then `powers` in the order given, then targets in table order. A scheme a rule lets the character
 * thwart with ATK instead is yielded both ways, THW first.
 */
export function* basicPowerUses(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  powers: readonly BasicPowerKind[],
): Generator<BasicPowerUse> {
  const player = getPlayer(state, playerId);
  if (!player || player.eliminated) return;
  // RRG 1.8 "Attack (Player Ability Type)" (p. 10): "A character must exhaust to use this power".
  const characters = [player.identity.instanceId, ...player.playArea.filter((id) => isAlly(state, id))].filter(
    (id) => getInstance(state, id)?.exhausted === false,
  );
  if (characters.length === 0) return;
  const enemies = [
    ...undefeatedVillains(state).map((villain) => villain.instanceId),
    ...cardsInPlay(state).filter((id) => isMinion(state, id)),
  ];
  const schemes = [
    ...mainSchemeStates(state).map((scheme) => scheme.instanceId),
    ...state.villainArea.filter((id) => {
      const type = cardOf(state, id)?.type;
      return type === "side_scheme" || type === "player_side_scheme";
    }),
  ];
  for (const characterInstanceId of characters) {
    for (const power of powers) {
      for (const targetInstanceId of power === "attack" ? enemies : schemes) {
        const use: BasicPowerUse = { characterInstanceId, power, targetInstanceId, useAtk: false };
        if (declarable(state, deps, playerId, use)) yield use;
        if (
          power === "thwart" &&
          mayThwartWithAtk(state, deps, targetInstanceId) &&
          !hasKeyword(state, targetInstanceId, "assault", deps)
        ) {
          const withAtk: BasicPowerUse = { ...use, useAtk: true };
          if (declarable(state, deps, playerId, withAtk)) yield withAtk;
        }
      }
    }
  }
}

/** Whether `playerId` could make any basic power among `powers` now (`Predicate canUseBasicPower`). */
export function canUseBasicPower(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  powers: readonly BasicPowerKind[],
): boolean {
  return !basicPowerUses(state, deps, playerId, powers).next().done;
}
