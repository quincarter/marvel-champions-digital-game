/**
 * Which hold layer a pad is in, from its two trigger values (`docs/controller-support.md` decision 9).
 *
 * A trigger engages past `TRIGGER_ENGAGE` and lets go below `TRIGGER_RELEASE`, so a trigger resting near the threshold
 * does not flicker the layer. The first trigger pulled owns the layer until it is released: pulling the other one
 * meanwhile changes nothing (if both arrive in the same frame, LT). Pure: `scenes/board/input.ts` feeds it each pad's
 * trigger values.
 */

import { LAYER_TRIGGER_INDEX, type PadLayer } from "./pad-layer-bindings.js";

export const TRIGGER_ENGAGE = 0.5;
export const TRIGGER_RELEASE = 0.35;

export interface TriggerHold {
  readonly lt: boolean;
  readonly rt: boolean;
  /** The layer this pad is in: the first trigger pulled, kept until it is released. */
  readonly owner: PadLayer | null;
}

export const NO_TRIGGERS: TriggerHold = { lt: false, rt: false, owner: null };

const step = (held: boolean, value: number): boolean => (held ? value > TRIGGER_RELEASE : value >= TRIGGER_ENGAGE);

/**
 * A trigger's pull, 0 to 1, from the browser's button: its analog `value`, or a full pull when it says `pressed` with
 * no value (a pad whose trigger is a plain button, or a bridge message that carries the press but not the pull). The
 * Controls screen's input test reads `pressed`, so a trigger that shows there must engage a layer here too.
 */
export function triggerPull(
  button: { readonly pressed?: boolean; readonly value?: number } | null | undefined,
): number {
  const value = button?.value ?? 0;
  return button?.pressed === true && value < TRIGGER_ENGAGE ? 1 : value;
}

/** The triggers held after reading `ltValue` and `rtValue`, given what was held before. */
export function triggerHoldAfter(previous: TriggerHold, ltValue: number, rtValue: number): TriggerHold {
  const lt = step(previous.lt, ltValue);
  const rt = step(previous.rt, rtValue);
  const kept = previous.owner !== null && (previous.owner === "lt" ? lt : rt) ? previous.owner : null;
  const owner: PadLayer | null = kept ?? (lt ? "lt" : rt ? "rt" : null);
  return lt === previous.lt && rt === previous.rt && owner === previous.owner ? previous : { lt, rt, owner };
}

/** The layer a hold means (the first trigger pulled), or null when none is held. */
export function layerOfHold(hold: TriggerHold): PadLayer | null {
  return hold.owner;
}

/**
 * The layer across every pad: `current` while some pad still holds it (the first pulled wins until released, whichever
 * pad it was), else the first pad's owned layer.
 */
export function layerOfHolds(holds: Iterable<TriggerHold>, current: PadLayer | null = null): PadLayer | null {
  let first: PadLayer | null = null;
  for (const hold of holds) {
    if (current !== null && hold.owner === current) return current;
    first ??= hold.owner;
  }
  return first;
}

/** The standard-layout indices a layer's presses are read from (faces 0-3, LB 4, RB 5). */
export function isLayerButton(meaningIndex: number): boolean {
  return meaningIndex >= 0 && meaningIndex <= 5;
}

export const TRIGGER_BUTTONS = LAYER_TRIGGER_INDEX;

/** The next ability page for a bumper press: wraps both ways, one page when there is nothing to page. */
export function nextAbilityPage(page: number, count: number, step: 1 | -1): number {
  if (count <= 1) return 0;
  return (((page + step) % count) + count) % count;
}
