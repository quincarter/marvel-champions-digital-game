/**
 * The basic attacks and thwarts a player could make right now if a card's effect had them make one (`EffectSpec
 * basicPowerBy`, `Predicate canUseBasicPower`; docs/phase7-wave8.md §3.64). There is no second copy of the basic power
 * rules here: every candidate is the ordinary `basicAttack` / `basicThwart` command, tried on a scratch copy of the
 * game with only the turn check lifted (`BasicPowerBy.instructed`), so whatever the command refuses (an exhausted
 * character, an alter-ego, guard, crisis, patrol, another game area, a "cannot" rule, a printed "—") is not a use.
 */

import type { AbilityCost, EngineDeps } from "./abilities.js";
import { basicAttack, basicPowerCost, basicThwart } from "./actions.js";
import type { Command } from "./commands.js";
import { createCtx } from "./ctx.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { canPaySpend } from "./payable.js";
import { cardOf, getInstance, getPlayer, isMinion, mainSchemeStates, undefeatedVillains } from "./query.js";
import type { ResourceRequirement } from "./resources.js";
import { mayThwartWithAtk } from "./rules.js";
import { cardsInPlay, isAlly } from "./select.js";
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
): BasicPowerCommand {
  const paid = payment && payment.length > 0 ? { payment } : {};
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

/**
 * The resources a basic power's own additional cost asks for (`basicPowerCosts`: "that hero must spend 1 of any
 * resource"), when resources of a fixed size are all it asks for; null for no cost and for any other cost shape.
 */
export function basicPowerResourceCost(
  state: GameState,
  deps: EngineDeps,
  characterId: InstanceId,
  power: BasicPowerKind,
): ResourceRequirement | null {
  const cost: AbilityCost | undefined = basicPowerCost(state, deps, characterId, power);
  if (!cost || Object.keys(cost).some((key) => key !== "resources")) return null;
  const resources = cost.resources;
  if (resources === undefined) return null;
  if (typeof resources === "number") return { generic: resources };
  return "choose" in resources ? null : resources;
}

/** Whether `use` could be declared now by `playerId` on a card's instruction (see the file comment). */
function declarable(state: GameState, deps: EngineDeps, playerId: PlayerId, use: BasicPowerUse): boolean {
  // A resource cost is checked for affordability and then taken as paid: the payment itself is the player's to pick.
  const resources = basicPowerResourceCost(state, deps, use.characterInstanceId, use.power);
  if (resources !== null && !canPaySpend(state, deps, playerId, resources)) return false;
  const by = { instructed: true, assumeCostPaid: resources !== null };
  const command = basicPowerCommand(playerId, use);
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
