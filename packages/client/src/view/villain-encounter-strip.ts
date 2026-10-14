/**
 * "ENCOUNTER CARDS THIS ROUND · N OF M" (D2, P2, T2; issue #128): one tile per encounter card dealt this villain phase,
 * saying whose it is and whether it has been revealed, is being revealed now, or comes next.
 *
 * Paced like the rest of the walkthrough: a card counts as revealed once the screen has shown its reveal beat, not
 * when the engine revealed it (the engine can reveal every card inside one command). Pure: names come in through the
 * two lookups, so this is testable without a game.
 */
import type { InstanceId, PlayerId } from "@mc/engine";
import type { EncounterTracking } from "./villain-walkthrough.js";

export type EncounterTileStatus = "done" | "now" | "next" | "facedown";

export interface EncounterTile {
  readonly instanceId: InstanceId;
  readonly playerId: PlayerId;
  /** "YOU" or the hero's name, upper case. */
  readonly seat: string;
  /** The card's name once shown; "Facedown" before. */
  readonly name: string;
  readonly status: EncounterTileStatus;
  readonly isViewer: boolean;
}

export interface EncounterStrip {
  readonly tiles: readonly EncounterTile[];
  /** Which card of how many is being revealed ("1 OF 2"); null before the first reveal is shown. */
  readonly position: { readonly index: number; readonly total: number } | null;
  /** The card being revealed on screen right now, if any. */
  readonly current: InstanceId | null;
}

export function encounterStripOf(
  encounter: EncounterTracking,
  /** The encounter card each shown beat belongs to, in order (`WalkthroughBeat.encounterInstanceId`). */
  shownEncounterIds: readonly (InstanceId | null | undefined)[],
  viewer: PlayerId | null,
  nameOf: (instanceId: InstanceId) => string,
  seatNameOf: (playerId: PlayerId) => string,
): EncounterStrip {
  const shown = new Set(shownEncounterIds.filter((id): id is InstanceId => !!id));
  let current: InstanceId | null = null;
  for (let i = shownEncounterIds.length - 1; i >= 0; i--) {
    const id = shownEncounterIds[i];
    if (id) {
      current = id;
      break;
    }
  }

  // Every card dealt, in deal order; a card revealed without having been seen dealt (one put straight into play) is
  // added at the end so the counter never undercounts what the player saw revealed.
  const order: { instanceId: InstanceId; playerId: PlayerId }[] = encounter.dealt.map((card) => ({
    instanceId: card.instanceId,
    playerId: card.playerId,
  }));
  for (const card of encounter.revealed) {
    if (!order.some((entry) => entry.instanceId === card.instanceId)) order.push(card);
  }

  let nextMarked = false;
  const tiles = order.map((entry): EncounterTile => {
    const revealed = shown.has(entry.instanceId);
    let status: EncounterTileStatus;
    if (entry.instanceId === current) status = "now";
    else if (revealed) status = "done";
    else if (!nextMarked) {
      status = "next";
      nextMarked = true;
    } else status = "facedown";
    const isViewer = entry.playerId === viewer;
    return {
      instanceId: entry.instanceId,
      playerId: entry.playerId,
      seat: isViewer ? "YOU" : seatNameOf(entry.playerId).toUpperCase(),
      name: revealed ? nameOf(entry.instanceId) : "Facedown",
      status,
      isViewer,
    };
  });

  const index = current ? tiles.findIndex((tile) => tile.instanceId === current) : -1;
  return {
    tiles,
    position: index >= 0 ? { index: index + 1, total: tiles.length } : null,
    current,
  };
}
