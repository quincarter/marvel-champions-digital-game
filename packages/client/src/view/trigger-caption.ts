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
