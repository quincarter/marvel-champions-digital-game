import { cardId, encounterSetId } from "@mc/content";
import {
  cardOf,
  characterProfile,
  handSize,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { inst, instancesOf, playerOf, stackEncounterDeck, toHero, endTurn, P1, P2 } from "../../../testing/harness.js";
import { driveEvents, encounterCardInVillainArea } from "../../../testing/staging.js";
import { startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

const mysterioGame = () =>
  startWave5Game(ghostSpiderScenario("mysterio", { seed: 1, modularSetIds: [encounterSetId("bomb_scare")] }));

/**
 * How many cards `player` held in hand right when `revealedCardId` was revealed: the initial hand, adjusted for
 * every `cardDrawn`/`cardDiscardedFromHand`/hand-leaving `cardMoved` event strictly before its own
 * `encounterCardRevealed`. Ghost-Spider's own kit (27006, a card that discards itself early in the round) changes
 * her hand between game start and the villain phase's own reveal step, so "the number of cards in your hand" for
 * Weakness from Within/Deepest Fears has to be read at the reveal, not at the start of the round.
 */
function handCountAtReveal(
  handBefore: number,
  events: readonly GameEvent[],
  player: string,
  revealedCardId: string,
): number {
  const revealIndex = events.findIndex(
    (e) => e.type === "encounterCardRevealed" && e.instanceId === revealedCardId && e.playerId === player,
  );
  if (revealIndex < 0) throw new Error(`${revealedCardId} was never revealed to ${player}`);
  let count = handBefore;
  for (const event of events.slice(0, revealIndex)) {
    if (event.type === "cardDrawn" && event.playerId === player) count += 1;
    else if (event.type === "cardDiscardedFromHand" && event.playerId === player) count -= 1;
    else if (
      event.type === "cardMoved" &&
      event.from.kind === "hand" &&
      event.from.playerId === player &&
      event.to.kind !== "discard"
    ) {
      count -= 1;
    }
  }
  return count;
}

/** Test surgery: Evil Doppelgänger out of the encounter deck, into `player`'s play area, engaged with them. */
function engagedDoppelganger(state: GameState, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const { state: staged, id } = encounterCardInVillainArea(state, "27154");
  return {
    id,
    state: {
      ...staged,
      villainArea: staged.villainArea.filter((i) => i !== id),
      players: staged.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...staged.instances, [id]: { ...staged.instances[id]!, engagedWith: player } },
    },
  };
}
const isIdentitySpecific = (state: GameState, id: InstanceId): boolean => {
  const card = cardOf(state, id);
  return card !== undefined && "aspect" in card && String(card.aspect).startsWith("hero:");
};
/** Test surgery: `player`'s hand becomes `identitySpecific` of their identity-specific cards plus `other` others. */
function handOf(state: GameState, player: PlayerId, identitySpecific: number, other: number): GameState {
  const seat = playerOf(state, player);
  const pool = [...seat.hand, ...seat.deck];
  const mine = pool.filter((id) => isIdentitySpecific(state, id)).slice(0, identitySpecific);
  const rest = pool.filter((id) => !isIdentitySpecific(state, id)).slice(0, other);
  if (mine.length < identitySpecific || rest.length < other) throw new Error(`${player} lacks the cards to stage`);
  const hand = [...mine, ...rest];
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, hand, deck: pool.filter((id) => !hand.includes(id)) } : p,
    ),
  };
}
const statsOf = (state: GameState, id: InstanceId) => {
  const profile = characterProfile(state, id, WAVE5_DEPS)!;
  return { atk: profile.atk, sch: profile.sch };
};

describe("Evil Doppelgänger (27154)", () => {
  it("27154.evil-doppelganger-constant: +X SCH and +X ATK, X the identity-specific cards in the engaged player's hand", () => {
    const { state, id } = engagedDoppelganger(mysterioGame());
    expect(cardOf(state, id)?.id).toBe(cardId("27154"));
    // Printed 1 ATK / 1 SCH; non-identity-specific cards never count.
    expect(statsOf(handOf(state, P1, 0, 5), id)).toEqual({ atk: 1, sch: 1 });
    expect(statsOf(handOf(state, P1, 1, 4), id)).toEqual({ atk: 2, sch: 2 });
    // Read live: the same minion rises and falls as identity-specific cards enter and leave the hand.
    expect(statsOf(handOf(state, P1, 3, 2), id)).toEqual({ atk: 4, sch: 4 });
    expect(statsOf(handOf(state, P1, 2, 0), id)).toEqual({ atk: 3, sch: 3 });
  });

  it("reads only the engaged player's hand in a 2-player game", () => {
    const twoPlayer = startWave5Game(
      ghostSpiderScenario("mysterio", {
        seed: 1,
        modularSetIds: [encounterSetId("bomb_scare")],
        extraPlayers: [{ starterDeckId: "spider-man-morales" }],
      }),
    );
    const { state, id } = engagedDoppelganger(handOf(handOf(twoPlayer, P1, 1, 3), P2, 4, 1));
    expect(statsOf(state, id)).toEqual({ atk: 2, sch: 2 });
    const onP2 = engagedDoppelganger(handOf(handOf(twoPlayer, P1, 1, 3), P2, 4, 1), P2);
    expect(statsOf(onP2.state, onP2.id)).toEqual({ atk: 5, sch: 5 });
  });

  it("engaged with no one, there is no engaged player's hand, so it has its printed stats", () => {
    const { state, id } = engagedDoppelganger(handOf(mysterioGame(), P1, 3, 0));
    expect(statsOf(state, id)).toEqual({ atk: 4, sch: 4 });
    const unengaged = {
      ...state,
      instances: { ...state.instances, [id]: { ...state.instances[id]!, engagedWith: null } },
    };
    expect(statsOf(unengaged, id)).toEqual({ atk: 1, sch: 1 });
  });
});

describe("Fool's Paradise (27155)", () => {
  it("27155.fools-paradise-constant: each identity gets +2 hand size", () => {
    const state = mysterioGame();
    const before = handSize(state, P1, WAVE5_DEPS);
    const { state: withCard } = encounterCardInVillainArea(state, "27155");
    expect(handSize(withCard, P1, WAVE5_DEPS)).toBe(before + 2);
  });
});

describe("Weakness from Within (27156)", () => {
  it("27156.when-revealed: places 1 additional threat here for each card in your hand", () => {
    const state = mysterioGame();
    const handBefore = playerOf(state, P1).hand.length;
    const stacked = stackEncounterDeck(state, "01186", "27156");
    const { state: after, events } = driveEvents(WAVE5_DEPS, stacked, toHero(P1), endTurn(P1));
    const card = instancesOf(after, "27156")[0]!;
    const handCount = handCountAtReveal(handBefore, events, P1, card);
    expect(inst(after, card).threat).toBe(1 + handCount); // 1 startingThreat (data) + 1 per hand card
  });
});

describe("Deepest Fears (27157)", () => {
  it("27157.when-revealed: discards cards from the top of your deck equal to your hand size; identity-specific discard places threat, otherwise you take damage", () => {
    const state = mysterioGame();
    const handBefore = playerOf(state, P1).hand.length;
    const deckBefore = playerOf(state, P1).deck.length;
    const stacked = stackEncounterDeck(state, "01186", "27157");
    const { state: after, events } = driveEvents(WAVE5_DEPS, stacked, toHero(P1), endTurn(P1));
    // Deepest Fears prints 2 copies (quantityInSet): the one this round actually reveals, not necessarily
    // `instancesOf`'s own first hit.
    const revealed = events.find(
      (e) => e.type === "encounterCardRevealed" && e.cardId === "27157" && e.playerId === P1,
    );
    if (revealed?.type !== "encounterCardRevealed") throw new Error("Deepest Fears was never revealed");
    const card = revealed.instanceId;
    const handCount = handCountAtReveal(handBefore, events, P1, card);
    expect(playerOf(after, P1).deck.length).toBe(deckBefore - handCount);
    const placedThreat = events.some((e) => e.type === "threatPlaced" && e.sourceInstanceId === card);
    const tookDamage = events.some((e) => e.type === "damageDealt" && e.sourceInstanceId === card);
    // Exactly one of the two printed branches fires, depending on whether an identity-specific card was among the
    // discards (Ghost-Spider's own precon carries several, so this is not a coin flip in practice, but either
    // outcome is a legal reveal).
    expect(placedThreat).not.toBe(tookDamage);
  });
});
