/**
 * The caption under a trigger option's card. Several copies of one card can answer the same event (three Frostbite
 * forced responses), and the engine asks for an order because it can't know they're interchangeable; the player can
 * tell them apart only by what each is attached to. So an attached card's caption names its host ("on Rhino").
 */

import { getInstance, type GameState, type InstanceId } from "@mc/engine";
import { cardName } from "./names.js";

export function triggerCaption(state: GameState, instanceId: InstanceId, short: string | null): string {
  const host = getInstance(state, instanceId)?.attachedTo;
  if (!host) return short ?? "trigger";
  const on = `on ${cardName(state, host)}`;
  return short ? `${short} ${on}` : on;
}

/**
 * " 2 of 3" for an option whose card and ability appear more than once in the same prompt (three copies of one forced
 * response answering one event), so identical-looking slots read apart; empty when it is the only one.
 */
export function triggerOrdinal(
  options: readonly { readonly optionId: string; readonly ref: unknown }[],
  optionId: string,
  sameAs: (a: unknown, b: unknown) => boolean,
): string {
  const at = options.findIndex((option) => option.optionId === optionId);
  if (at < 0) return "";
  const twins = options.filter((option) => sameAs(option.ref, options[at]!.ref));
  if (twins.length < 2) return "";
  return ` ${twins.findIndex((option) => option.optionId === optionId) + 1} of ${twins.length}`;
}
