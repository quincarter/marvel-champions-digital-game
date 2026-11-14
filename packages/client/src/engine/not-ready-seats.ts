/**
 * The new-game backstop for not-ready packs (`NOT_READY_PACK_CODES`): which seat, if any, is led by a hero from one.
 * A seat names its hero by `identityCardId` or by a `starterDeckId`; a pack's own deck is resolved through the config's
 * packs (`seatsWithPackDecks`), then base precons. An id nothing knows is left for `createGame`'s own error.
 */
import { isNotReadyCard } from "@mc/cards";
import type { AnyCard, StarterDeck } from "@mc/content";
import { seatsWithPackDecks, type PackRuntime } from "../packs/pack-runtime.js";
import type { SessionConfig } from "./host.js";

export function notReadySeatIdentity(
  players: SessionConfig["players"],
  packs: readonly PackRuntime[],
  starterDecks: readonly StarterDeck[],
  cardsById: ReadonlyMap<string, AnyCard>,
  baseDeckIds: ReadonlySet<string> = new Set(starterDecks.map((deck) => deck.id as string)),
): AnyCard | null {
  const seats = packs.length > 0 ? seatsWithPackDecks(players, packs, baseDeckIds) : players;
  for (const seat of seats) {
    const identityId =
      "identityCardId" in seat && seat.identityCardId
        ? (seat.identityCardId as string)
        : "starterDeckId" in seat
          ? (starterDecks.find((deck) => (deck.id as string) === (seat.starterDeckId as string))?.identityCardId as
              | string
              | undefined)
          : undefined;
    const identity = identityId ? cardsById.get(identityId) : undefined;
    if (identity && isNotReadyCard(identity)) return identity;
  }
  return null;
}
