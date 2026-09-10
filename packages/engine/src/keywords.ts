import type { KeywordInstance, KeywordName } from "@mc/content";
import type { InstanceId } from "./ids.js";
import { cardOf, mainSchemeStage, villainStage } from "./query.js";
import type { StatusName } from "./spec.js";
import type { GameState } from "./state.js";

/**
 * Keyword semantics are engine behaviour keyed off the `KeywordInstance` list on
 * the `@mc/content` card — never a per-card special case. This module is the
 * single lookup layer; the rules themselves live where the relevant game action
 * is resolved (attacks in `select.ts`/`actions.ts`, damage in `resolve.ts`,
 * statuses and counters in `effects.ts`).
 */
export function keywordsOf(state: GameState, id: InstanceId): readonly KeywordInstance[] {
  const card = cardOf(state, id);
  if (!card) return [];
  if (card.type === "villain") {
    return id === state.villain.instanceId ? villainStage(state).keywords : [];
  }
  if (card.type === "main_scheme") {
    return id === state.mainScheme.instanceId ? mainSchemeStage(state).keywords : [];
  }
  return "keywords" in card ? card.keywords : [];
}

export const hasKeyword = (state: GameState, id: InstanceId, name: KeywordName): boolean =>
  keywordsOf(state, id).some((keyword) => keyword.name === name);

/** RRG "Keywords": repeated instances of a numbered keyword add their values together. */
export function keywordTotal(
  state: GameState,
  id: InstanceId,
  name: "retaliate" | "incite" | "hinder" | "victory",
): number {
  let total = 0;
  for (const keyword of keywordsOf(state, id)) {
    if (keyword.name === name) total += keyword.value;
  }
  return total;
}

export const usesKeyword = (
  state: GameState,
  id: InstanceId,
): Extract<KeywordInstance, { name: "uses" }> | undefined =>
  keywordsOf(state, id).find(
    (keyword): keyword is Extract<KeywordInstance, { name: "uses" }> => keyword.name === "uses",
  );

/**
 * RRG "Status Cards": one of each type per character. Steady allows a second
 * stunned and a second confused; stalwart allows neither.
 */
export function statusCapacity(state: GameState, id: InstanceId, status: StatusName): number {
  if (status === "tough") return 1;
  if (hasKeyword(state, id, "stalwart")) return 0;
  return hasKeyword(state, id, "steady") ? 2 : 1;
}

/** RRG "Steady": a steady character is not stunned/confused until it holds two of that card. */
export function statusActive(state: GameState, id: InstanceId, status: StatusName): boolean {
  const instance = state.instances[id];
  if (!instance) return false;
  const needed = status === "tough" ? 1 : hasKeyword(state, id, "steady") ? 2 : 1;
  return instance.statuses[status] >= needed;
}

