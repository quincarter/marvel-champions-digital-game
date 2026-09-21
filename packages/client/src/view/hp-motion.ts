/**
 * The HP counting tween's from-value: `damageDealt`/`damagePlaced`/
 * `damageHealed`/`hitPointsSet` each carry enough to say where the number
 * *was* a moment ago, given where the live model says it is *now*
 * (`hpFromValue`). Also which characters were just defeated, for the
 * border flash.
 */

import type { GameEvent, InstanceId } from "@mc/engine";

export type HpTickKind = "damage" | "heal" | "set";

export interface HpTick {
  readonly instanceId: InstanceId;
  readonly kind: HpTickKind;
  /**
   * Added to the live ("to") value to recover the counting tween's starting
   * ("from") value: `+amount` for damage (HP was higher before), `-amount`
   * for a heal (HP was lower before). 0 for `"set"` — `hitPointsSet` carries
   * an absolute dial position, not a delta, so there is no prior value to
   * recover and it lands with no count.
   */
  readonly delta: number;
  /** Only damage nudges the panel; a heal or a dial-set doesn't. */
  readonly nudge: boolean;
}

export function hpTicksFrom(events: readonly GameEvent[]): readonly HpTick[] {
  const out: HpTick[] = [];
  for (const event of events) {
    switch (event.type) {
      case "damageDealt":
      case "damagePlaced":
        if (event.amount > 0)
          out.push({ instanceId: event.targetInstanceId, kind: "damage", delta: event.amount, nudge: true });
        break;
      case "damageHealed":
        if (event.amount > 0)
          out.push({ instanceId: event.targetInstanceId, kind: "heal", delta: -event.amount, nudge: false });
        break;
      case "hitPointsSet":
        out.push({ instanceId: event.instanceId, kind: "set", delta: 0, nudge: false });
        break;
      default:
        break;
    }
  }
  return out;
}

/** The counting tween's starting value, given the live value already on the panel. */
export function hpFromValue(to: number, tick: HpTick): number {
  return to + tick.delta;
}

export function defeatFlashesFrom(events: readonly GameEvent[]): readonly InstanceId[] {
  const out: InstanceId[] = [];
  for (const event of events) if (event.type === "characterDefeated") out.push(event.instanceId);
  return out;
}
