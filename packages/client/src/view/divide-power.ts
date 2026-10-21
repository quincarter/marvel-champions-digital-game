/**
 * Dividing a basic attack or thwart among several targets on the board (issue #322): Wasp's Giant face, "Damage dealt
 * by your basic attack power can be divided among enemies as you choose" (`RuleSpec divideBasicPower`). The engine
 * has always taken a divided command (`basicAttack.divide`, `basicThwart.divide`), but the board only ever aimed at
 * one target, so the player was never offered the split.
 *
 * The player places the power one point at a time: a tap on a target gives it one more point, and once every point is
 * placed a tap on a target that holds some takes one back. One target holding points is the ordinary undivided power,
 * so Confirm is ready as soon as one target is tapped; several targets need every point placed (RRG 1.8 FAQ "Wasp
 * (#1C)", p. 61: the divided attack is her basic attack, and its shares total her ATK).
 *
 * The rules stay the engine's: which targets are legal (`LegalAction.targets`), who may divide (`canDivideBasicPower`;
 * a mandatory even split, Bombshell's, is the engine's to make and is not offered here), and what the shares total
 * (`basicPowerDivisionTotal`). A power with a cost to pay or discard keeps the one-target flow, whose payment step
 * does not carry a division.
 */

import {
  basicPowerDivisionTotal,
  canDivideBasicPower,
  evenlyDividesBasicPower,
  getInstance,
  remainingHitPoints,
  type Command,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type LegalAction,
} from "@mc/engine";
import { cardName } from "./names.js";
import { artOf, type TargetingPanel, type TargetingSource, type TargetOption } from "./targeting-panel.js";

export interface DividedShare {
  readonly targetInstanceId: InstanceId;
  readonly amount: number;
}

export interface DividePowerState {
  readonly action: LegalAction;
  readonly power: "attack" | "thwart";
  readonly characterId: InstanceId;
  /** The points placed so far, one entry per target in the order first tapped (the order the power resolves in). */
  readonly shares: readonly DividedShare[];
}

/**
 * The divide picker for this basic attack or thwart, or null when the board's one-target flow is the right one: not a
 * basic power, fewer than two legal targets, a character with no divide rule (or a mandatory even split), or a power
 * with a cost to pay.
 */
export function beginDividePower(state: GameState, deps: EngineDeps, entry: LegalAction): DividePowerState | null {
  const ref = entry.action;
  if (ref.kind !== "basicAttack" && ref.kind !== "basicThwart") return null;
  if (entry.needsPayment || new Set(entry.targets).size < 2) return null;
  const power = ref.kind === "basicAttack" ? "attack" : "thwart";
  if (!canDivideBasicPower(state, deps, ref.instanceId, power)) return null;
  if (evenlyDividesBasicPower(state, deps, ref.instanceId, power)) return null;
  const choice: DividePowerState = { action: entry, power, characterId: ref.instanceId, shares: [] };
  // Under 2 there is nothing to divide, and a power of 0 (still a legal attack: its triggers, a stun it removes) could
  // place no point at all.
  return divideTotal(state, deps, choice) < 2 ? null : choice;
}

const placed = (choice: DividePowerState): number => choice.shares.reduce((sum, share) => sum + share.amount, 0);

/** What the points must total: the power's value against the targets holding points, or the first target before any. */
export function divideTotal(state: GameState, deps: EngineDeps, choice: DividePowerState): number {
  const targets = choice.shares.map((share) => share.targetInstanceId);
  const against = targets.length > 0 ? targets : choice.action.targets.slice(0, 1);
  return basicPowerDivisionTotal(
    state,
    deps,
    choice.action.example.playerId,
    choice.characterId,
    choice.power,
    against,
  );
}

/**
 * A tap on a target: one more point while any remain, otherwise one point back off a target that holds some. A card
 * that is not a legal target changes nothing.
 */
export function tapDivideTarget(
  state: GameState,
  deps: EngineDeps,
  choice: DividePowerState,
  id: InstanceId,
): DividePowerState {
  if (!choice.action.targets.includes(id)) return choice;
  const held = choice.shares.find((share) => share.targetInstanceId === id);
  const withPoint = held
    ? choice.shares.map((share) => (share === held ? { ...share, amount: share.amount + 1 } : share))
    : [...choice.shares, { targetInstanceId: id, amount: 1 }];
  const added = { ...choice, shares: withPoint };
  // The total is read against the targets the points would then be on: a scheme with assault makes a thwart use ATK.
  if (placed(added) <= divideTotal(state, deps, added)) return added;
  if (!held) return choice;
  const shares = choice.shares
    .map((share) => (share === held ? { ...share, amount: share.amount - 1 } : share))
    .filter((share) => share.amount > 0);
  return { ...choice, shares };
}

/**
 * The command Confirm sends, or null while it is not ready: one target holding points is the ordinary power, aimed at
 * it; several are a division whose points must all be placed.
 */
export function divideCommand(state: GameState, deps: EngineDeps, choice: DividePowerState): Command | null {
  const { example } = choice.action;
  const [first] = choice.shares;
  if (!first) return null;
  if (choice.shares.length === 1) {
    if (example.type === "basicAttack") return { ...example, targetInstanceId: first.targetInstanceId };
    if (example.type === "basicThwart") return { ...example, schemeInstanceId: first.targetInstanceId };
    return null;
  }
  if (placed(choice) !== divideTotal(state, deps, choice)) return null;
  const divide = choice.shares.map((share) => ({ ...share }));
  if (example.type === "basicAttack") return { ...example, targetInstanceId: first.targetInstanceId, divide };
  if (example.type === "basicThwart") {
    // A thwart made with ATK by a scheme's own permission is not one a division takes (`RuleSpec thwartWithAtk`).
    const { useAtk: _useAtk, ...thwart } = example;
    return { ...thwart, schemeInstanceId: first.targetInstanceId, divide };
  }
  return null;
}

const unitOf = (power: DividePowerState["power"]): string => (power === "attack" ? "damage" : "threat");

/** "HP 3" for an enemy, "3 threat" for a scheme: what a point placed on it is weighed against. */
function standingOf(state: GameState, deps: EngineDeps, id: InstanceId, power: DividePowerState["power"]): string {
  if (power === "thwart") return `${getInstance(state, id)?.threat ?? 0} threat`;
  return `HP ${remainingHitPoints(state, id, deps)}`;
}

/** The picker as the targeting panel's multi-pick tiles, with the running count, the split so far and Confirm. */
export function dividePanelOf(
  state: GameState,
  deps: EngineDeps,
  choice: DividePowerState,
  source: TargetingSource,
): TargetingPanel {
  const total = divideTotal(state, deps, choice);
  const left = total - placed(choice);
  const unit = unitOf(choice.power);
  const options = choice.action.targets.map((instanceId): TargetOption => {
    const held = choice.shares.find((share) => share.targetInstanceId === instanceId)?.amount ?? 0;
    // A multi-pick tile shows no hover line, so taking a point back is said on the tile itself.
    const lines = [
      standingOf(state, deps, instanceId, choice.power),
      ...(held > 0 ? [`${held} ${unit} here`] : []),
      ...(held > 0 && left <= 0 ? ["Tap to take 1 back"] : []),
    ];
    return {
      instanceId,
      name: cardName(state, instanceId),
      lines,
      confirmLine: left > 0 ? "Tap to place 1 more" : held > 0 ? "Tap to take 1 back" : "Every point is placed",
      art: artOf(state, instanceId),
    };
  });
  const ready = divideCommand(state, deps, choice) !== null;
  const [only] = choice.shares;
  const split =
    choice.shares.length === 0
      ? null
      : choice.shares.length === 1 && only
        ? `All ${total} on ${cardName(state, only.targetInstanceId)}`
        : choice.shares.map((share) => `${cardName(state, share.targetInstanceId)} ${share.amount}`).join(", ");
  const verb = choice.power === "attack" ? "Attack" : "Thwart";
  return {
    title: `Divide ${total} ${unit}`,
    heading: `${options.length} LEGAL TARGETS · TAP ONE TO PLACE A POINT`,
    source: { ...source, art: artOf(state, source.instanceId) },
    options,
    excluded: [],
    hideExcluded: true,
    multi: {
      picked: new Set(choice.shares.map((share) => share.targetInstanceId)),
      summary: `${total} ${unit.toUpperCase()} · ${Math.max(0, left)} LEFT`,
      preview: split,
      canConfirm: ready,
      reason: ready
        ? null
        : choice.shares.length === 0
          ? "Tap a target"
          : left < 0
            ? `Take ${-left} back`
            : `Place ${left} more`,
      confirmLabel: verb,
    },
  };
}
