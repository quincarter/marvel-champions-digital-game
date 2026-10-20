/**
 * The cards an identity changes between as an additional form (RRG 1.8 "Form, Change Form", p. 21), when it brings a
 * set of single-faced ones: Spectrum's three energy form upgrades (`mts` 21002–21004; docs/phase7-wave4.md §3.1). One is
 * faceup while she is in hero form and the rest wait facedown; in alter-ego form all three are facedown.
 *
 * They are a set, not cards played from the hand, so the board keeps them together in a column beside the play area,
 * the way Doctor Strange's Invocation deck sits there, instead of three cards in the play row (issue #308). Their faces
 * are open to their owner (`faceVisible`'s `playArea` arm), so the column shows each one faceup and marks the active one.
 *
 * Read from the printed form keyword, not from card ids: a later identity with a set of form cards needs no change
 * here. A single double-sided form card (Vision's mass form) is no set and stays in the play row.
 */

import type { GameState, InstanceId, PlayerState } from "@mc/engine";
import { cardOf, getInstance, printedFormTypes } from "@mc/engine";

export interface FormCardGroupIds {
  /** The printed form type: "energy". */
  readonly formType: string;
  /** "Energy forms", the column's heading. */
  readonly title: string;
  /** The group's cards, in play-area order. */
  readonly ids: readonly InstanceId[];
}

/** Single-faced cards in `me`'s own play area that print a form keyword, grouped by form type, two or more a group. */
export function formCardGroupIds(state: GameState, me: PlayerState): readonly FormCardGroupIds[] {
  const groups = new Map<string, InstanceId[]>();
  for (const id of me.playArea) {
    const instance = getInstance(state, id);
    const card = cardOf(state, id);
    if (!instance || !card || instance.attachedTo !== null) continue;
    if (instance.controllerId !== me.playerId) continue;
    if ("flipSide" in card && card.flipSide) continue;
    for (const formType of printedFormTypes(state, id)) {
      const ids = groups.get(formType) ?? [];
      ids.push(id);
      groups.set(formType, ids);
    }
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .map(([formType, ids]) => ({
      formType,
      title: `${formType.charAt(0).toUpperCase()}${formType.slice(1)} forms`,
      ids,
    }));
}
