/**
 * A played event goes to its OWNER's discard pile, not to the discard pile of the player who played it. RRG 1.8
 * "Ownership and Control" (p. 31): "A change in control of a card remains in effect until one of the following occurs:
 * … That card is an event that was played, it is placed in its owner's discard pile." Rogue's Superpower Adaptation
 * (`rogue`) lets her play an event another player owns. Synthetic cards; the event is moved from P2's hand to P1's
 * by surgery.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCards, newGame, RESOURCE } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);

/** An event: "Action: Draw 1 card." */
const TRICK_ABILITY = stubAbility("trick.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
} satisfies AbilityDefinition);
const TRICK = stubEvent({ id: "trick", cost: 0, abilities: [TRICK_ABILITY.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const deps: EngineDeps = depsOf(TRICK_ABILITY);

const handOf = (state: GameState, player: PlayerId) => mustPlayer(state, player).hand;
const discardOf = (state: GameState, player: PlayerId) => mustPlayer(state, player).discard;

/** Two players; P1 holds one TRICK of her own and one of P2's (moved from P2's hand). */
function setup(): { state: GameState; own: InstanceId; borrowed: InstanceId } {
  const state = newGame({
    players: 2,
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] }),
    mainScheme: stubMainScheme({
      id: "scheme",
      stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
    }),
    extraCards: [BLANK, TRICK],
    deck: [...copies(TRICK.id), ...copies(RESOURCE.id, 20)],
    encounterDeck: copies(BLANK.id, 20),
    deps,
  });
  const mine = giveCards(state, p1, TRICK.id);
  const theirs = giveCards(mine.state, p2, TRICK.id);
  const own = mine.ids[0]!;
  const borrowed = theirs.ids[0]!;
  const moved: GameState = {
    ...theirs.state,
    players: theirs.state.players.map((p) =>
      p.playerId === p2
        ? { ...p, hand: p.hand.filter((id) => id !== borrowed) }
        : p.playerId === p1
          ? { ...p, hand: [...p.hand, borrowed] }
          : p,
    ),
  };
  return { state: moved, own, borrowed };
}

const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const run = (state: GameState, commands: readonly Command[]) =>
  driveSession(startSession(state), deps, commands, defaultPick);

describe("a played event goes to its owner's discard pile (RRG 1.8 p. 31)", () => {
  it("P2's event, played by P1, resolves for P1 and goes to P2's discard pile", () => {
    const s = setup();
    expect(mustInstance(s.state, s.borrowed).ownerId).toBe(p2);
    const hand = handOf(s.state, p1).length;
    const { session } = run(s.state, [play(s.borrowed)]);
    // P1 played it ("you" is P1): she drew the card.
    expect(handOf(session.state, p1)).toHaveLength(hand - 1 + 1);
    expect(discardOf(session.state, p2)[0]).toBe(s.borrowed);
    expect(discardOf(session.state, p1)).not.toContain(s.borrowed);
  });

  it("near miss: P1's own event goes to P1's discard pile", () => {
    const s = setup();
    const { session } = run(s.state, [play(s.own)]);
    expect(discardOf(session.state, p1)[0]).toBe(s.own);
    expect(discardOf(session.state, p2)).not.toContain(s.own);
  });

  it("replays deep-equal", () => {
    const s = setup();
    const { session } = run(s.state, [play(s.borrowed), play(s.own)]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
