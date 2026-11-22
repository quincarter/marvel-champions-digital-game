/**
 * Follow mode for a live replay (issue #876): what the transport does when the host's log changes under a viewer.
 * While the viewer is at the newest position (`target` at `oldLength`), a new command is stepped to and animates as a
 * replay step does. A viewer who has stepped back stays where they are, and a "Live" control jumps them to the newest.
 * Pure, so the rules are tested without a screen.
 */
export type FollowChange = "append" | "rewind" | "end" | "reset";

export type FollowPlan =
  | { readonly kind: "none" }
  /** Play the one new command, animated. */
  | { readonly kind: "step" }
  /** Show the table at `to`, without animating the way there. */
  | { readonly kind: "seek"; readonly to: number };

export interface FollowInput {
  readonly change: FollowChange;
  /** Where the viewer is (or is going, once the queued moves land). */
  readonly target: number;
  /** The log's length before the change, and after. */
  readonly oldLength: number;
  readonly newLength: number;
  /** Commands new at the end (an append). */
  readonly added: number;
}

/** Whether a viewer at `target` is following the newest position of a log `length` long. */
export const isFollowing = (target: number, length: number): boolean => target >= length;

export function followPlan(input: FollowInput): FollowPlan {
  const { change, target, oldLength, newLength, added } = input;
  const following = isFollowing(target, oldLength);
  switch (change) {
    case "append":
      if (!following || added <= 0) return { kind: "none" };
      // One command is watched as it was played; a batch (the host was away, then caught up) is jumped over.
      return added === 1 ? { kind: "step" } : { kind: "seek", to: newLength };
    case "rewind":
      // Behind the cut, the position no longer exists; in front of it, nothing moves.
      return target > newLength ? { kind: "seek", to: newLength } : { kind: "none" };
    case "reset":
      // The whole log was read again (a reconnect): keep the place, or the newest when following.
      if (following) return { kind: "seek", to: newLength };
      return { kind: "seek", to: Math.min(target, newLength) };
    case "end":
      return { kind: "none" };
  }
}
