/**
 * "ENCOUNTER CARDS THIS ROUND · N OF M" (D2, P2, T2; issue #128): one tile per encounter card dealt this villain phase,
 * saying whose it is and whether it has been revealed, is being revealed now, or comes next.
 *
 * Paced like the rest of the walkthrough: a card counts as revealed once the screen has shown its reveal beat, not
 * when the engine revealed it (the engine can reveal every card inside one command). Pure: names come in through the
 * two lookups, so this is testable without a game.
 */
import type { InstanceId, PlayerId } from "@mc/engine";
import { dealtReasonWords } from "./dealt-pile.js";
import { dealtByBeat, type EncounterDealSource, type EncounterTracking } from "./villain-walkthrough.js";

export type EncounterTileStatus = "done" | "now" | "next" | "facedown";

/** "SURGE", "FROM SURGE", or why a card dealt before the phase is here ("DECK RAN OUT", "UNIQUE RULE"). */
export type EncounterTileMark = string;

/** The mark on a card dealt facedown before the villain phase, by what dealt it (`dealtReasonWords`'s words). */
export const dealtBeforeMark = (source: EncounterDealSource): EncounterTileMark =>
  source === "deckReset" ? "DECK RAN OUT" : dealtReasonWords(source, null).toUpperCase();

export interface EncounterTile {
  readonly instanceId: InstanceId;
  readonly playerId: PlayerId;
  /** "YOU" or the hero's name, upper case. */
  readonly seat: string;
  /** The card's name once shown; "Facedown" before. */
  readonly name: string;
  readonly status: EncounterTileStatus;
  readonly isViewer: boolean;
  /**
   * Plain-word marks, never colour alone: "SURGE" on the card that surged, "FROM SURGE" on the card it dealt, and why a
   * card dealt before the phase is here ("DECK RAN OUT", "UNIQUE RULE", "A CARD EFFECT"; issue #984).
   */
  readonly marks: readonly EncounterTileMark[];
}

export interface EncounterStrip {
  readonly tiles: readonly EncounterTile[];
  /** Which card of how many is being revealed ("1 OF 2"); null before the first reveal is shown. */
  readonly position: { readonly index: number; readonly total: number } | null;
  /** The card being revealed on screen right now, if any. */
  readonly current: InstanceId | null;
}

/** Each player's earlier cards then their cards dealt this phase, players in step 3's deal order (then the rest). */
function byPlayerPile(
  before: readonly { readonly instanceId: InstanceId; readonly playerId: PlayerId }[],
  now: readonly { readonly instanceId: InstanceId; readonly playerId: PlayerId }[],
): { instanceId: InstanceId; playerId: PlayerId }[] {
  const players = [...new Set([...now.map((card) => card.playerId), ...before.map((card) => card.playerId)])];
  return players.flatMap((playerId) =>
    [...before, ...now]
      .filter((card) => card.playerId === playerId)
      .map((card) => ({ instanceId: card.instanceId, playerId: card.playerId })),
  );
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

  // Every card dealt as far as the screen has got, in deal order: a card a surge deals later is not counted until the
  // screen reaches its deal (issue #386: "1 OF 3" over a facedown first card told the player two surges were coming).
  // A card revealed without having been seen dealt (one put straight into play) is added at the end once its reveal is
  // shown, so the counter never undercounts what the player saw revealed.
  const dealtBefore = new Map((encounter.dealtBefore ?? []).map((card) => [card.instanceId, card.source]));
  const dealtNow = encounter.dealt
    .filter((card) => dealtByBeat(card, shownEncounterIds.length) && !dealtBefore.has(card.instanceId))
    .map((card) => ({ instanceId: card.instanceId, playerId: card.playerId }));
  // Cards dealt before the phase waited facedown in their player's pile ahead of step 3's deal, and step 4 reveals one
  // player's pile at a time, in player order (RRG 1.8 "Villain Phase", p. 47): so each player's earlier cards come
  // ahead of their own step 3 cards, the players in the order step 3 dealt to them (#984).
  const order: { instanceId: InstanceId; playerId: PlayerId }[] =
    dealtBefore.size === 0 ? dealtNow : byPlayerPile(encounter.dealtBefore ?? [], dealtNow);
  // Also a card revealed from a surge deal made before the phase, which has no `dealt` entry; it is only listed once its
  // reveal is shown, so the badge follows the same pacing.
  const fromSurge = new Set([
    ...encounter.dealt.filter((card) => card.fromSurge).map((card) => card.instanceId),
    ...(encounter.surgeRevealed ?? []),
  ]);
  // SURGE shows once the screen is past the beat the surge came at; a fixture without beats shows it with the reveal.
  const surged = new Set(
    encounter.surgedAt
      ? encounter.surgedAt.filter((entry) => entry.atBeat < shownEncounterIds.length).map((entry) => entry.instanceId)
      : (encounter.surged ?? []),
  );
  for (const card of encounter.revealed) {
    if (shown.has(card.instanceId) && !order.some((entry) => entry.instanceId === card.instanceId)) order.push(card);
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
      // The surging card is marked once its reveal is on screen (it was facedown until then); a card a surge dealt is
      // marked from its deal, which the strip only counts once the screen has got there.
      marks: [
        ...(revealed && surged.has(entry.instanceId) ? (["SURGE"] as const) : []),
        ...(fromSurge.has(entry.instanceId) ? (["FROM SURGE"] as const) : []),
        ...(dealtBefore.has(entry.instanceId) ? [dealtBeforeMark(dealtBefore.get(entry.instanceId)!)] : []),
      ],
    };
  });

  const index = current ? tiles.findIndex((tile) => tile.instanceId === current) : -1;
  return {
    tiles,
    position: index >= 0 ? { index: index + 1, total: tiles.length } : null,
    current,
  };
}
