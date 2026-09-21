/**
 * Which cards turned this batch: `cardExhausted` starts the quarter turn into
 * exhausted, `cardReadied` starts it back out. Consumed by
 * `scenes/board/character-panel.ts`'s `turnSideways`, which is the one place
 * that knows how a card-shaped panel's whole face re-parents into one
 * container to turn as a piece.
 */

import type { GameEvent, InstanceId } from "@mc/engine";

export type ExhaustDirection = "exhausting" | "readying";

export interface ExhaustMotion {
  readonly instanceId: InstanceId;
  readonly direction: ExhaustDirection;
}

export function exhaustMotionsFrom(events: readonly GameEvent[]): readonly ExhaustMotion[] {
  const out: ExhaustMotion[] = [];
  for (const event of events) {
    if (event.type === "cardExhausted") out.push({ instanceId: event.instanceId, direction: "exhausting" });
    else if (event.type === "cardReadied") out.push({ instanceId: event.instanceId, direction: "readying" });
  }
  return out;
}
