import type { GameState, PlayerId } from "@mc/engine";
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

/** "Klaw attacks Captain Marvel" / "Klaw schemes against Black Panther": the activation the events named, the hero short. */
export function activationHeadline(activation: ActivationBeat, state: GameState, viewer: PlayerId | null): string {
  const enemy = cardName(state, activation.enemyInstanceId);
  return activation.kind === "attack"
    ? `${enemy} attacks ${shortSeatName(state, activation.attackedPlayerId, viewer)}`
    : `${enemy} schemes against ${shortSeatName(state, activation.playerId, viewer)}`;
}
