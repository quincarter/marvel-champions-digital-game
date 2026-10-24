import type { GameState, PlayerId } from "@mc/engine";
import type { CardFace } from "../art/art-source.js";
import { facedownRoleName, isDroneRole } from "./facedown-history.js";
import { cardName, shortSeatName } from "./names.js";
import type { ActivationBeat } from "./villain-walkthrough.js";

/**
 * The boost cell of a villain activation's arithmetic breakdown ("SCH 2 + BOOST 0 (2 cards) = THREAT 2").
 *
 * The label used to carry the card count ("BOOST ×2") with the icon total after it, which flattened into "BOOST ×2 0"
 * on the one-line rail and read as a multiplication. The label stays "BOOST"; the count rides in the value.
 */
export function boostCell(boostCount: number, boostIcons: number): { readonly label: string; readonly value: string } {
  return { label: "BOOST", value: boostCount > 1 ? `${boostIcons} (${boostCount} cards)` : String(boostIcons) };
}

export interface BreakdownCell {
  readonly label: string;
  readonly value: string;
  readonly emphasis?: boolean;
}

export interface Breakdown {
  readonly cells: readonly BreakdownCell[];
  readonly ops: readonly string[];
}

/** `base + boost − defense = damage`, or `SCH + boost (± threat mod) = threat` — every number `resolved`'s own. */
export function breakdownOf(activation: ActivationBeat): Breakdown | null {
  if (activation.kind === "attack") {
    const r = activation.resolved;
    if (!r) return null;
    return {
      cells: [
        { label: "BASE", value: String(r.baseAtk) },
        { ...boostCell(activation.boosts.length, r.boostIcons) },
        { label: "DEFENSE", value: String(r.defenseReduction) },
        { label: "DAMAGE", value: String(r.damageDealt), emphasis: true },
      ],
      ops: ["+", "−", "="],
    };
  }
  const r = activation.resolved;
  if (!r) return null;
  const cells: BreakdownCell[] = [
    { label: "SCH", value: String(r.baseSch) },
    { ...boostCell(activation.boosts.length, r.boostIcons) },
  ];
  const ops: string[] = ["+"];
  if (r.threatBonus !== 0) {
    cells.push({ label: "THREAT MOD", value: `${r.threatBonus > 0 ? "+" : "−"}${Math.abs(r.threatBonus)}` });
    ops.push(r.threatBonus > 0 ? "+" : "−");
  }
  cells.push({ label: "THREAT", value: String(r.threatPlaced), emphasis: true });
  ops.push("=");
  return { cells, ops };
}

/**
 * The breakdown as one line for the docked rail: "BASE 2 + BOOST 1 − DEFENSE 3 = DAMAGE 0". A scheme activation names
 * the scheme the threat went on ("… = THREAT 3 → Day of Reckoning"): with a villain's own side scheme or two main
 * schemes on the table, the number alone does not say where it landed.
 */
export function breakdownLineOf(activation: ActivationBeat, state: GameState): string | null {
  const breakdown = breakdownOf(activation);
  if (!breakdown) return null;
  const line = breakdown.cells
    .map((cell, i) => `${cell.label} ${cell.value}${i < breakdown.ops.length ? ` ${breakdown.ops[i]}` : ""}`)
    .join(" ");
  if (activation.kind !== "scheme" || !activation.resolved) return line;
  return `${line} → ${cardName(state, activation.resolved.schemeInstanceId)}`;
}

/**
 * The same breakdown with its result first, for where the line must be cut: "DAMAGE 3 = BASE 2 + BOOST 1 − DEFENSE 0",
 * "THREAT 1 → The Break-In! = SCH 1 + BOOST 0". Cut from the end, the full line lost the total, which is the number an
 * interrupt like Backflip is decided on (#394).
 */
export function breakdownTotalFirstOf(activation: ActivationBeat, state: GameState): string | null {
  const breakdown = breakdownOf(activation);
  if (!breakdown) return null;
  const total = breakdown.cells.at(-1)!;
  const terms = breakdown.cells
    .slice(0, -1)
    .map((cell, i) => `${cell.label} ${cell.value}${i < breakdown.ops.length - 1 ? ` ${breakdown.ops[i]}` : ""}`)
    .join(" ");
  const scheme =
    activation.kind === "scheme" && activation.resolved
      ? ` → ${cardName(state, activation.resolved.schemeInstanceId)}`
      : "";
  return `${total.label} ${total.value}${scheme} = ${terms}`;
}

/** "Klaw attacks Captain Marvel" / "Klaw schemes against Black Panther": the activation the events named, the hero short. */
export function activationHeadline(activation: ActivationBeat, state: GameState, viewer: PlayerId | null): string {
  const enemy = activationEnemyName(activation, state);
  return activation.kind === "attack"
    ? `${enemy} attacks ${shortSeatName(state, activation.attackedPlayerId, viewer)}`
    : `${enemy} schemes against ${shortSeatName(state, activation.playerId, viewer)}`;
}

/** The enemy's name as it was when it acted: a Drone that left play facedown later in the command is still "Drone" (#291). */
export function activationEnemyName(activation: ActivationBeat, state: GameState): string {
  return activation.enemyFacedownAs
    ? facedownRoleName(activation.enemyFacedownAs)
    : cardName(state, activation.enemyInstanceId);
}

/**
 * The face to draw for an enemy that was facedown when it acted and has left play since (#291): its player card back,
 * or the Drone picture at the ATK the attack used. Null when the enemy was faceup, so the caller draws it as it is now.
 */
export function activationHiddenFace(activation: ActivationBeat): CardFace | null {
  const role = activation.enemyFacedownAs;
  if (!role) return null;
  const atk = activation.kind === "attack" ? activation.resolved?.baseAtk : undefined;
  return isDroneRole(role) && atk !== undefined
    ? { kind: "back", back: "player", standIn: { kind: "ultronDrone", atk } }
    : { kind: "back", back: "player" };
}
