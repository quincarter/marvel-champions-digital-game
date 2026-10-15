/**
 * The end of the player phase, read back at the start of the villain phase (the owner, 2026-10-14: "the draw phase is
 * completely ignored ... we don't get an animation or even a notification that it happens"). Each player draws up to
 * their hand size as the player phase ends (RRG 1.8 "Player Phase", step 4), in the same command that begins the
 * villain phase, so the table never paused on it. The villain phase now opens by saying who drew what, and the hand
 * marks the new cards.
 *
 * Pure: the draws are the `cardDrawn` events before the villain phase's first step in the command that began it.
 */
import type { GameEvent, InstanceId, PlayerId } from "@mc/engine";

export interface EndOfTurnDraws {
  /** Every seat that drew, with the cards it drew, in seat order of the events. */
  readonly bySeat: ReadonlyMap<PlayerId, readonly InstanceId[]>;
}

/** The draws that ended the player phase, from the command's events; null when this command did not begin the phase. */
export function endOfTurnDrawsOf(events: readonly GameEvent[]): EndOfTurnDraws | null {
  const begins = events.findIndex(
    (event) => event.type === "stepChanged" && event.to.phase === "villain" && event.to.kind === "placeThreat",
  );
  if (begins < 0) return null;
  const bySeat = new Map<PlayerId, InstanceId[]>();
  for (const event of events.slice(0, begins)) {
    if (event.type !== "cardDrawn") continue;
    const list = bySeat.get(event.playerId) ?? [];
    list.push(event.instanceId);
    bySeat.set(event.playerId, list);
  }
  return { bySeat };
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
