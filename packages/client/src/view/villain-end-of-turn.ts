/**
 * The end of the player phase, read back at the start of the villain phase (the owner, 2026-10-14: "the draw phase is
 * completely ignored ... we don't get an animation or even a notification that it happens"). Each player draws up to
 * their hand size as the player phase ends (RRG 1.8 "Player Phase", step 4). The villain phase opens by saying who drew
 * what, and the hand marks the new cards.
 *
 * The refill draws one card at a time, and stops when a drawn card's ability answers it (RRG 1.8 "Hand Size", p. 21;
 * ruling Aug 14, 2025), so one refill can span several commands: the command that ends the turn, then each answer to a
 * drawn card's response. The Board folds every command's events into a `RefillTracker` (`trackRefill`) and hands the
 * finished draws to the villain phase when it begins.
 *
 * Pure. A refill's own draws are told apart from a card an ability draws while the refill waits by the engine's own
 * count: each stop (`stepChanged` to `endPhaseDraw` with `drawn`) and each finish (`handRefilled`) says how many cards
 * that player's refill has drawn so far, and a run of the refill draws its cards back to back, so the refill's newest
 * cards are the player's last `cardDrawn` events before the stop or the finish.
 */
import type { GameEvent, InstanceId, PlayerId } from "@mc/engine";

export interface EndOfTurnDraws {
  /** Every seat that drew, with the cards it drew, in seat order of the events. */
  readonly bySeat: ReadonlyMap<PlayerId, readonly InstanceId[]>;
}

/** The refill in progress, carried from one command to the next. */
export interface RefillTracker {
  /** Each seat's refill cards so far, oldest first. */
  readonly bySeat: ReadonlyMap<PlayerId, readonly InstanceId[]>;
  /** How many of each seat's refill cards are in `bySeat` (the engine's running count at its last stop). */
  readonly counted: ReadonlyMap<PlayerId, number>;
}

export const NO_REFILL: RefillTracker = { bySeat: new Map(), counted: new Map() };

/**
 * Folds one command's events into the refill. `ended` is the whole refill when this command began the villain phase,
 * and null otherwise; the returned tracker starts empty again after it.
 */
export function trackRefill(
  tracker: RefillTracker,
  events: readonly GameEvent[],
): { readonly tracker: RefillTracker; readonly ended: EndOfTurnDraws | null } {
  let bySeat = new Map(tracker.bySeat);
  let counted = new Map(tracker.counted);
  let ended: EndOfTurnDraws | null = null;
  const drawnHere = new Map<PlayerId, InstanceId[]>();
  // The refill has drawn `total` cards for this seat: the ones not yet counted are its newest draws in this command.
  const take = (playerId: PlayerId, total: number): void => {
    const fresh = Math.max(0, total - (counted.get(playerId) ?? 0));
    const here = drawnHere.get(playerId) ?? [];
    const cards = here.slice(Math.max(0, here.length - fresh));
    bySeat.set(playerId, [...(bySeat.get(playerId) ?? []), ...cards]);
    counted.set(playerId, total);
  };
  for (const event of events) {
    if (event.type === "cardDrawn") {
      const list = drawnHere.get(event.playerId) ?? [];
      list.push(event.instanceId);
      drawnHere.set(event.playerId, list);
    } else if (event.type === "handRefilled") {
      take(event.playerId, event.drawn);
    } else if (event.type === "stepChanged" && event.to.phase === "player" && event.to.kind === "endPhaseDraw") {
      const stopped = event.to.remainingPlayerIds?.[0];
      if (stopped) {
        take(stopped, event.to.drawn ?? 0);
      } else if (event.from.kind !== "endPhaseDraw") {
        // A new refill begins.
        bySeat = new Map();
        counted = new Map();
      }
    } else if (
      event.type === "stepChanged" &&
      event.to.phase === "villain" &&
      event.to.kind === "placeThreat" &&
      // Step one begins; the same step marked `placed` later in it is not a new phase.
      !event.to.placed
    ) {
      ended = { bySeat };
      bySeat = new Map();
      counted = new Map();
    }
  }
  return { tracker: { bySeat, counted }, ended };
}

/** Tests' shorthand: `trackRefill` over one command from an empty tracker, the draws when the whole refill ran in it. */
export function endOfTurnDrawsOf(events: readonly GameEvent[]): EndOfTurnDraws | null {
  return trackRefill(NO_REFILL, events).ended;
}

/** "You drew 3 cards: Backflip, Genius and Web-Shooter." / "Captain Marvel drew 1 card: Energy." / "" when nobody drew. */
export function endOfTurnLine(
  draws: EndOfTurnDraws,
  viewer: PlayerId | null,
  seatNameOf: (playerId: PlayerId) => string,
  cardNameOf: (instanceId: InstanceId) => string,
): string {
  const parts: string[] = [];
  for (const [playerId, cards] of draws.bySeat) {
    if (cards.length === 0) continue;
    const who = playerId === viewer ? "You" : seatNameOf(playerId);
    const count = `${cards.length} card${cards.length === 1 ? "" : "s"}`;
    // A teammate's cards stay private: only how many.
    if (playerId !== viewer) {
      parts.push(`${who} drew ${count}.`);
      continue;
    }
    const names = cards.map(cardNameOf);
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
    parts.push(`${who} drew ${count}: ${list}.`);
  }
  return parts.join(" ");
}
