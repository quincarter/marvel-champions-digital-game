/**
 * The new-game backstop for not-ready packs (`NOT_READY_PACK_CODES`): which seat, if any, is led by a hero from one.
 * A seat names its hero by `identityCardId` or by a `starterDeckId`; a pack's own deck is resolved through the config's
 * packs (`seatsWithPackDecks`), then by `identityOfDeck`, which must resolve every precon the scenario builder can seat
 * (the playable starter decks, not-ready packs' included). An id nothing knows is left for `createGame`'s own error.
 */
import { isNotReadyCard } from "@mc/cards";
import type { AnyCard } from "@mc/content";
import { seatsWithPackDecks, type PackRuntime } from "../packs/pack-runtime.js";
import type { SessionConfig } from "./host.js";

export function notReadySeatIdentity(
  players: SessionConfig["players"],
  packs: readonly PackRuntime[],
  identityOfDeck: (starterDeckId: string) => string | undefined,
  cardsById: ReadonlyMap<string, AnyCard>,
  baseDeckIds: ReadonlySet<string>,
): AnyCard | null {
  const seats = packs.length > 0 ? seatsWithPackDecks(players, packs, baseDeckIds) : players;
  for (const seat of seats) {
    const identityId =
      "identityCardId" in seat && seat.identityCardId
        ? (seat.identityCardId as string)
        : "starterDeckId" in seat
          ? identityOfDeck(seat.starterDeckId as string)
          : undefined;
    const identity = identityId ? cardsById.get(identityId) : undefined;
    if (identity && isNotReadyCard(identity)) return identity;
  }
  return null;
}
