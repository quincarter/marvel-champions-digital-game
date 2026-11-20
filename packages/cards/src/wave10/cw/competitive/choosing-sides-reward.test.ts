/**
 * The Choosing Sides reward (docs/competitive-mode-plan.md milestone M6): Now It's Personal (56128b), "Action: Remove
 * this card from the game → each player on your team chooses 2 of your leader's set-aside player cards and adds them to
 * their hand", in the engine's two-team fixture (`packages/engine/src/testing/team.ts`), whose registration team (p1,
 * and p2 in 2v2) has `registration-card-1` to `-4` set aside for its own leader.
 *
 * Sources: MC56 p. 16 (defeating Choosing Sides earns two of your leader's basic player cards; once earned they are part
 * of that player's deck for the rest of the game); Q12 A per owner decision 2026-11-20 (to hand now, then ordinary
 * cards of that player's deck; in 2v2 the players choose in turn from the four set aside; in 1v1 two stay set aside).
 */

import { cardId, type AnyCard, type CardId } from "@mc/content";
import type { EngineDeps, GameState, InstanceId, PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { firstLegal, use } from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS } from "../../testing.js";

vi.setConfig({ testTimeout: 120_000 });

const ENGINE_TESTING = new URL("../../../../../engine/src/testing/", import.meta.url).href;
interface Fixture {
  readonly competitiveGame: (options?: {
    readonly sizes?: readonly [number, number];
    readonly deps?: EngineDeps;
    readonly extraCards?: readonly AnyCard[];
    readonly encounterDecks?: readonly [readonly CardId[], readonly CardId[]];
  }) => GameState;
}
interface Fixtures {
  readonly stubTreachery: (spec: { id: string; boostIcons?: number }) => AnyCard;
}
const { competitiveGame } = (await import(/* @vite-ignore */ `${ENGINE_TESTING}team.ts`)) as Fixture;
const { stubTreachery } = (await import(/* @vite-ignore */ `${ENGINE_TESTING}fixtures.ts`)) as Fixtures;

const P1 = "p1" as PlayerId;
const P2 = "p2" as PlayerId;
const NOW_ITS_PERSONAL = "56128b";
const ACTION = "56128b.now-its-personal-action";
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const REAL = ["56128a", NOW_ITS_PERSONAL].map((code) => WAVE10_CARDS.find((card) => (card.id as string) === code)!);
const deck = (): CardId[] => [cardId("56128a"), ...Array.from({ length: 12 }, () => FILLER.id)];

/** The fixture with Now It's Personal in p1's play area, under p1's control (surgery: flipped Choosing Sides). */
function withNowItsPersonal(sizes: readonly [number, number]): { state: GameState; id: InstanceId } {
  const state = competitiveGame({
    sizes,
    deps: WAVE10_DEPS,
    extraCards: [FILLER, ...REAL],
    encounterDecks: [deck(), deck()],
  });
  const deckId = state.villains[0]!.encounterDeckId;
  const piles = state.encounterDecks[deckId]!;
  const id = piles.deck.find((i) => state.instances[i]!.cardId === cardId("56128a"))!;
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((i) => i !== id) } },
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, cardId: cardId(NOW_ITS_PERSONAL), controllerId: P1, faceup: true },
      },
    },
  };
}

const leaderCards = (state: GameState): readonly InstanceId[] => state.teams![0]!.leaderCardIds!;
const nameOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId as string;

describe("Now It's Personal in 2v2: each player of your team chooses 2 of the 4, in turn (Q12 A)", () => {
  const { state: start, id } = withNowItsPersonal([2, 2]);
  const four = leaderCards(start);
  const { state } = driveEventsPicking(WAVE10_DEPS, start, firstLegal, use(P1, id, ACTION));
  const handOf = (player: PlayerId) => state.players.find((p) => p.playerId === player)!.hand;

  it("removes Now It's Personal from the game", () => {
    expect(state.removedFromGame).toContain(id);
  });

  it("p1 takes two and p2 the other two: none is left set aside, none goes to the other team", () => {
    const p1 = four.filter((card) => handOf(P1).includes(card));
    const p2 = four.filter((card) => handOf(P2).includes(card));
    expect(p1).toHaveLength(2);
    expect(p2).toHaveLength(2);
    expect(new Set([...p1, ...p2]).size).toBe(4);
    expect(state.encounterSetAside.filter((card) => four.includes(card))).toEqual([]);
    expect(four.every((card) => nameOf(state, card).startsWith("registration-card-"))).toBe(true);
  });

  it("each card earned is that player's own from then on: owned and controlled by them (part of their deck)", () => {
    for (const player of [P1, P2])
      for (const card of four.filter((c) => handOf(player).includes(c)))
        expect(state.instances[card]).toMatchObject({
          ownerId: player,
          controllerId: player,
          home: { kind: "player" },
        });
  });
});

describe("Now It's Personal in 1v1: the one player chooses 2, and the other 2 stay set aside (Q12 A)", () => {
  const { state: start, id } = withNowItsPersonal([1, 1]);
  const four = leaderCards(start);
  const { state } = driveEventsPicking(WAVE10_DEPS, start, firstLegal, use(P1, id, ACTION));
  const hand = state.players.find((p) => p.playerId === P1)!.hand;

  it("p1 takes two; two stay set aside", () => {
    expect(four.filter((card) => hand.includes(card))).toHaveLength(2);
    expect(state.encounterSetAside.filter((card) => four.includes(card))).toHaveLength(2);
  });

  it("the resistance team's own leader cards are never offered", () => {
    const theirs = state.teams![1]!.leaderCardIds!;
    expect(theirs.every((card) => state.encounterSetAside.includes(card))).toBe(true);
  });
});
