/**
 * The threat meter's counting tween from-value, the same trick `hp-motion.ts`
 * uses for HP: `threatPlaced` means the number was lower a moment ago,
 * `threatRemoved` means it was higher, and the live model already has the
 * "to" value.
 */

import type { GameEvent, InstanceId } from "@mc/engine";

export interface ThreatTick {
  readonly schemeInstanceId: InstanceId;
  /** Added to the live ("to") value to recover the "from" value. */
  readonly delta: number;
}

export function threatTicksFrom(events: readonly GameEvent[]): readonly ThreatTick[] {
  const out: ThreatTick[] = [];
  for (const event of events) {
    if (event.type === "threatPlaced" && event.amount > 0)
      out.push({ schemeInstanceId: event.schemeInstanceId, delta: -event.amount });
    else if (event.type === "threatRemoved" && event.amount > 0)
      out.push({ schemeInstanceId: event.schemeInstanceId, delta: event.amount });
  }
  return out;
}

/** The counting tween's starting value, given the live value already on the panel. Never negative — a meter has no "before zero". */
export function threatFromValue(to: number, tick: ThreatTick): number {
  return Math.max(0, to + tick.delta);
}
