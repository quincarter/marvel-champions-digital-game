/**
 * The cards an identity changes form with (RRG 1.8 "Form, Change Form", p. 21): Spectrum's three single-faced energy
 * form upgrades (`mts` 21002–21004; docs/phase7-wave4.md §3.1), one faceup while she is in hero form and the rest
 * facedown, and the one double-sided form upgrade Vision (mass form), Shadowcat (mass form) and Nick Fury (suit form)
 * keep attached to their identity, flipped to change form.
 *
 * They are not cards played from the hand but the forms the hero shifts between, always on the table, so the board
 * keeps them in a column beside the play area, the way Doctor Strange's Invocation deck sits there, instead of in the
 * play row (issue #308). Spectrum's facedown forms are open to her (`faceVisible`'s `playArea` arm), so every face shows.
 *
 * Read from the printed form keyword, not from card ids: a later identity with form cards needs no change here.
 */

import type { GameState, InstanceId, PlayerState } from "@mc/engine";
import { cardOf, getInstance, printedFormTypes } from "@mc/engine";

export interface FormCardGroupIds {
  /** The printed form type: "energy", "mass", "suit". */
  readonly formType: string;
  /** The column's heading: "Energy forms" for a set, "Mass form" for one double-sided card. */
  readonly title: string;
  /** The group's cards, in table order. */
  readonly ids: readonly InstanceId[];
}

const isDoubleSided = (state: GameState, id: InstanceId): boolean => {
  const card = cardOf(state, id);
  return card !== undefined && "flipSide" in card && card.flipSide !== undefined && card.flipSide !== null;
};

/**
 * `me`'s own form cards, grouped by form type: those loose in their play area and the upgrades on their own identity.
 * A group is a set of two or more cards, or a double-sided card the hero flips; a lone single-faced card is no set.
 */
export function formCardGroupIds(state: GameState, me: PlayerState): readonly FormCardGroupIds[] {
  const loose = me.playArea.filter((id) => {
    const instance = getInstance(state, id);
    return instance?.attachedTo === null && instance.controllerId === me.playerId;
  });
  const onIdentity = (getInstance(state, me.identity.instanceId)?.attachments ?? []).filter(
    (id) => cardOf(state, id)?.type === "upgrade" && getInstance(state, id)?.controllerId === me.playerId,
  );
  const groups = new Map<string, InstanceId[]>();
  for (const id of [...new Set([...loose, ...onIdentity])]) {
    for (const formType of printedFormTypes(state, id)) {
      const ids = groups.get(formType) ?? [];
      ids.push(id);
      groups.set(formType, ids);
    }
  }
  const named = (formType: string): string => `${formType.charAt(0).toUpperCase()}${formType.slice(1)}`;
  return [...groups.entries()]
    .filter(([, ids]) => ids.length >= 2 || ids.some((id) => isDoubleSided(state, id)))
    .map(([formType, ids]) => ({
      formType,
      title: ids.length >= 2 ? `${named(formType)} forms` : `${named(formType)} form`,
      ids,
    }));
}

/** The name on the face of a double-sided form card that is not showing ("Dense" while Intangible is up); null otherwise. */
export function otherFormFaceName(state: GameState, id: InstanceId): string | null {
  const card = cardOf(state, id);
  const instance = getInstance(state, id);
  if (!card || !instance || !("flipSide" in card) || !card.flipSide) return null;
  return instance.flipped ? card.name : card.flipSide.name;
}

/** Threat and counters on a form card ("3 threat · 2 all-purpose"), which Nick Fury's suit form gathers; null with none. */
export function formCardTokens(state: GameState, id: InstanceId): string | null {
  const instance = getInstance(state, id);
  if (!instance) return null;
  const parts = [
    ...(instance.threat > 0 ? [`${instance.threat} threat`] : []),
    ...Object.entries(instance.counters)
      .filter(([, count]) => count > 0)
      .map(([name, count]) => `${count} ${name}`),
  ];
  return parts.length > 0 ? parts.join(" · ") : null;
}
