/**
 * Which scheme is at the front of the Stack schemes stack (`scenes/board/schemes.ts`), as plain functions of the
 * schemes in play: the scene keeps the answer between draws and only draws it.
 */

/**
 * The front scheme for this draw, and the target list it was decided for. A front that has left play falls back to the
 * first scheme. A target prompt that has just opened (a new `targets` list) brings its first target forward unless the
 * front is already one of them; the same prompt drawn again leaves the front where the player put it.
 */
export function stackFrontAfter<T>(input: {
  readonly ids: readonly T[];
  readonly front: T | null;
  readonly targets: readonly T[] | null;
  readonly lastTargetsKey: string | null;
}): { readonly front: T | null; readonly targetsKey: string | null } {
  const { ids, targets } = input;
  const front = input.front !== null && ids.includes(input.front) ? input.front : (ids[0] ?? null);
  const targetsKey = targets ? targets.map(String).join(",") : null;
  if (targetsKey === input.lastTargetsKey) return { front, targetsKey };
  const wanted = targets ? ids.filter((id) => targets.includes(id)) : [];
  if (wanted.length > 0 && (front === null || !wanted.includes(front))) return { front: wanted[0]!, targetsKey };
  return { front, targetsKey };
}

/** The scheme one step behind the front (`step` 1) or the one at the back coming round to the front (`step` -1). */
export function stackFlip<T>(ids: readonly T[], front: T | null, step: 1 | -1): T | null {
  if (ids.length === 0) return null;
  const at = front === null ? 0 : Math.max(0, ids.indexOf(front));
  return ids[(at + step + ids.length) % ids.length]!;
}

/** How far a swipe on the front card travels before it flips, and how long a pause starts a new swipe. */
export const STACK_SWIPE_PX = 40;
export const STACK_SWIPE_IDLE_MS = 250;

/**
 * A sideways swipe on the front card, fed each drag step. It flips once, as soon as the finger has travelled far
 * enough, so a slow swipe that rests before it lifts still flips; a drag that pauses longer than `STACK_SWIPE_IDLE_MS`
 * starts counting again, so a short nudge never adds to an old one.
 */
export class StackSwipe {
  #travel = 0;
  #at = -Infinity;
  #done = false;

  /** The flip a drag step of `deltaX` at `now` (ms) makes: 1 (swiped left, the next one), -1, or 0 for none yet. */
  step(deltaX: number, now: number): 1 | -1 | 0 {
    if (now - this.#at > STACK_SWIPE_IDLE_MS) {
      this.#travel = 0;
      this.#done = false;
    }
    this.#at = now;
    if (this.#done) return 0;
    this.#travel += deltaX;
    if (Math.abs(this.#travel) < STACK_SWIPE_PX) return 0;
    this.#done = true;
    return this.#travel < 0 ? 1 : -1;
  }

  /** The finger lifted: the next drag starts afresh. */
  end(): void {
    this.#travel = 0;
    this.#done = false;
    this.#at = -Infinity;
  }
}
