/**
 * "Shuffle this card into the Ninja deck" on a card of an identity's separate deck of encounter cards that is now the
 * scenario's (the Ninja cards 63002–63004, owner decision 2A of docs/phase7-elektra-iron-fist.md, provisional): it
 * goes back into that deck of its owner when its owner has one, else of the first player in player order who does
 * (`separateDeckToReturnTo`, `resolve/cards.ts`). In the encounter deck the card has no owner (RRG 1.8 "Ownership and
 * Control", p. 31: the scenario owns each encounter card), so the fallback decides. Synthetic cards, two seats, only
 * the second with the deck.
 */

import type { AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import { startSession } from "./engine.js";
import { locateCard, mustInstance, mustPlayer, separateDeckOf } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubTreachery } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1 } from "./testing/wave3.js";

const NINJA = "Ninja";
/** "[star] Boost: … shuffle this card into the Ninja deck." */
const HOME = stubAbility("home.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "separateDeckShuffle" }],
});
const NINJA_CARD: AnyCard = {
  ...stubTreachery({ id: "ninja-card", boostIcons: 1, starIcon: true, abilities: [HOME.ref] }),
  separateDeck: NINJA,
};
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const deps = depsOf(HOME);

/** Two seats; only the second has a (here empty) Ninja deck; the Ninja card is the villain's next boost card. */
function staged(): GameState {
  const base = gameAtFirstTurn({
    cards: [NINJA_CARD, FILLER],
    deps,
    players: 2,
    encounter: [NINJA_CARD.id, ...copiesOf(FILLER.id, 20)],
  });
  const second = base.players[1]!.playerId;
  const withDeck: GameState = {
    ...base,
    players: base.players.map((p) =>
      p.playerId === second ? { ...p, separateDecks: { ...p.separateDecks, [NINJA]: { deck: [], discard: [] } } } : p,
    ),
  };
  return onTopOfEncounterDeck(withDeck, NINJA_CARD.id);
}

describe("separateDeckShuffle on a card no player owns", () => {
  it("goes into the first player in order who has that deck, and is theirs again", () => {
    const s = staged();
    const second = s.players[1]!.playerId;
    const card = Object.keys(s.instances).find((id) => (s.instances[id]?.cardId as string) === NINJA_CARD.id)!;
    expect(mustInstance(s, card as never).ownerId).toBeNull();
    expect(mustPlayer(s, P1).separateDecks[NINJA]).toBeUndefined();
    const { session, events } = driveSession(
      startSession(s),
      deps,
      [
        { type: "endTurn", playerId: P1 },
        { type: "endTurn", playerId: second },
      ],
      defaultPick,
    );
    const after = session.state;
    expect(events).toContainEqual(expect.objectContaining({ type: "boostCardFlipped", instanceId: card }));
    expect(separateDeckOf(after, second, NINJA).deck).toContain(card);
    expect(locateCard(after, card as never)).toEqual({ kind: "separateDeck", playerId: second, name: NINJA });
    expect(mustInstance(after, card as never)).toMatchObject({
      ownerId: second,
      controllerId: null,
      home: { kind: "separateDeck", name: NINJA },
    });
  });
});
