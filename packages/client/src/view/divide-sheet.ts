/**
 * The "divide N among targets" sheet's labels (`divide`, `assignIndirectDamage`). The engine offers one option per
 * point per card (`<instanceId>#<n>`), so a Torrential Rain over two schemes was six identical tiles with nothing to
 * say which scheme each one was. This reads who each option is for and what it currently holds, and keeps a running
 * tally per card of what has been picked. Pure reading of the pending choice and the state; nothing here decides what
 * is legal.
 */

import type { ChoiceRef, GameState, InstanceId, PendingChoice } from "@mc/engine";
import { threatOnCard } from "./board-model.js";
import { cardName } from "./names.js";

export interface DivideOptionLabel {
  /** The card this point is for. */
  readonly name: string;
  /** "Threat 3", "Damage 2" — what the card holds now, before any of the division. */
  readonly holds: string;
  /** Which point of that card this tile is ("1", "2"...), so two tiles for one card still read apart. */
  readonly ordinal: number;
}

export interface DivideSheet {
  /** The label of each option, by option id. */
  readonly labels: ReadonlyMap<string, DivideOptionLabel>;
  /** "The Break-In! 2 · Bomb Scare 1 · 1 to place" — empty while nothing is picked. */
  readonly tally: string;
}

const refInstanceId = (ref: ChoiceRef): InstanceId | null =>
  ref.kind === "card" || ref.kind === "ability" ? ref.instanceId : null;

export const isDivideSheet = (choice: Pick<PendingChoice, "prompt">): boolean =>
  choice.prompt.kind === "divide" || choice.prompt.kind === "assignIndirectDamage";

export function divideSheetOf(
  state: GameState,
  choice: PendingChoice,
  selected: readonly string[],
): DivideSheet | null {
  const { prompt } = choice;
  if (prompt.kind !== "divide" && prompt.kind !== "assignIndirectDamage") return null;
  const what = prompt.kind === "divide" ? prompt.what : "damage";
  const labels = new Map<string, DivideOptionLabel>();
  const ordinals = new Map<InstanceId, number>();
  const order: InstanceId[] = [];
  const owner = new Map<string, InstanceId>();
  for (const option of choice.options) {
    const instanceId = refInstanceId(option.ref);
    if (!instanceId) continue;
    const next = (ordinals.get(instanceId) ?? 0) + 1;
    ordinals.set(instanceId, next);
    if (next === 1) order.push(instanceId);
    owner.set(option.optionId, instanceId);
    labels.set(option.optionId, {
      name: cardName(state, instanceId),
      holds: holdsOf(state, instanceId, what),
      ordinal: next,
    });
  }
  const counts = new Map<InstanceId, number>();
  for (const optionId of selected) {
    const instanceId = owner.get(optionId);
    if (instanceId) counts.set(instanceId, (counts.get(instanceId) ?? 0) + 1);
  }
  const parts = order.flatMap((instanceId) => {
    const count = counts.get(instanceId);
    return count ? [`${cardName(state, instanceId)} ${count}`] : [];
  });
  const left = prompt.amount - selected.length;
  const tally = parts.length === 0 ? "" : `${parts.join(" · ")} · ${left > 0 ? `${left} to place` : "all placed"}`;
  return { labels, tally };
}

function holdsOf(state: GameState, instanceId: InstanceId, what: string): string {
  if (what === "threat") return `Threat ${threatOnCard(state, instanceId)}`;
  if (what === "damage" || what === "heal") return `Damage ${state.instances[instanceId]?.damage ?? 0}`;
  return "";
}
