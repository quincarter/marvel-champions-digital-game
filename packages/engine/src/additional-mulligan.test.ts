/**
 * docs/phase7-wave5.md §3.26: an additional mulligan. MC27 p. 22 reputation node 5, as errata'd by RRG 1.8 p. 67:
 * "During the Resolve Mulligans step of game setup, each player may take 1 additional mulligan." Each one is a full
 * mulligan (RRG 1.8 Appendix II step 15: discard any number, draw up to starting hand size; §4 question 12's default).
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_DEPS } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import { playerId } from "./ids.js";
import { mustPlayer } from "./query.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { GameState } from "./state.js";
import { driveSession } from "./testing/drive.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  HERO,
  MAIN_SCHEME,
  TREACHERY,
  VILLAIN,
  defaultPick,
  handOf,
  resolvePending,
  seatIdentities,
  settle,
} from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const p3 = playerId("p3");

/** Settles setup, discarding one card at each mulligan `discards` approves (keeping the hand otherwise). */
function mulliganOrder(start: GameState, discards: (state: GameState) => boolean) {
  const deciders: string[] = [];
  const additional: (number | undefined)[] = [];
  const done = settle(start, (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind !== "mulligan") return defaultPick(state);
    deciders.push(choice.playerId);
    additional.push(choice.prompt.additional);
    return discards(state) ? handOf(state, choice.playerId).slice(0, 1) : [];
  });
  return { deciders, additional, done };
}

function configWith(extraMulligans: readonly (number | undefined)[]): GameSetupConfig {
  const identities = seatIdentities(HERO, extraMulligans.length);
  return {
    seed: 1234,
    cards: [...DEFAULT_CARDS, ...identities],
    villainCardId: VILLAIN.id,
    mainSchemeCardId: MAIN_SCHEME.id,
    encounterDeck: Array.from({ length: 20 }, () => TREACHERY.id),
    players: identities.map((identity, seat) => ({
      identityCardId: identity.id,
      deck: DEFAULT_DECK,
      ...(extraMulligans[seat] !== undefined ? { extraMulligans: extraMulligans[seat] } : {}),
    })),
  };
}

function atMulligan(extraMulligans: readonly (number | undefined)[]): GameState {
  const result = createGame(configWith(extraMulligans), DEFAULT_DEPS);
  if (!result.ok) throw new Error(`setup failed: ${result.error.message}`);
  return result.state;
}

describe("an additional mulligan (§3.26)", () => {
  it("a player with one extra mulligan decides a second full mulligan after the first draw-up", () => {
    const start = atMulligan([1]);
    expect(start.pendingChoice?.prompt).toEqual({ kind: "mulligan", handSize: 6 });
    const firstHand = mustPlayer(start, p1).hand;

    const second = resolvePending(start, firstHand.slice(0, 2));
    expect(second.step).toEqual({ phase: "setup", kind: "mulligan", remainingPlayerIds: [p1], pass: 1 });
    expect(second.pendingChoice?.playerId).toBe(p1);
    expect(second.pendingChoice?.prompt).toEqual({ kind: "mulligan", handSize: 6, additional: 1 });
    const secondHand = mustPlayer(second, p1).hand;
    expect(secondHand).toHaveLength(6);

    const done = resolvePending(second, secondHand.slice(0, 3));
    const player = mustPlayer(done, p1);
    expect(player.hand).toHaveLength(6);
    // Both mulligans' discards stay in the discard pile (not shuffled back), and none is redrawn.
    expect(player.discard).toHaveLength(5);
    for (const id of [...firstHand.slice(0, 2), ...secondHand.slice(0, 3)]) expect(player.hand).not.toContain(id);
    expect(done.pendingChoice).toBeNull();
    expect(done.step).toEqual({ phase: "player", kind: "turn", activePlayerId: p1, remainingPlayerIds: [] });
  });

  it("keeping the hand ends that player's mulligans: the same hand is not offered again", () => {
    const kept = resolvePending(atMulligan([1]), []);
    expect(kept.pendingChoice).toBeNull();
    expect(kept.step.kind).toBe("turn");
    expect(mustPlayer(kept, p1).discard).toHaveLength(0);
  });

  it("two players: the additional mulligans are a second pass in player order, p1, p2, then p1, p2 (§4.1 Q19)", () => {
    const { deciders, additional, done } = mulliganOrder(atMulligan([1, 1]), () => true);
    expect(deciders).toEqual([p1, p2, p1, p2]);
    expect(additional).toEqual([undefined, undefined, 1, 1]);
    expect(mustPlayer(done, p1).discard).toHaveLength(2);
    expect(mustPlayer(done, p2).discard).toHaveLength(2);
    expect(done.round).toBe(1);
  });

  it("three players: the second pass holds only those with an extra mulligan, still in player order", () => {
    const { deciders, additional } = mulliganOrder(atMulligan([1, undefined, 1]), () => true);
    expect(deciders).toEqual([p1, p2, p3, p1, p3]);
    expect(additional).toEqual([undefined, undefined, undefined, 1, 1]);
  });

  it("three players with two extra mulligans each decide three passes in player order", () => {
    const { deciders, additional } = mulliganOrder(atMulligan([2, 2, 2]), () => true);
    expect(deciders).toEqual([p1, p2, p3, p1, p2, p3, p1, p2, p3]);
    expect(additional).toEqual([undefined, undefined, undefined, 1, 1, 1, 2, 2, 2]);
  });

  it("p1 keeps their hand and is not offered the extra mulligan; p2 mulliganed and is (§4.1 Q20)", () => {
    const start = atMulligan([1, 1]);
    const p1Kept = resolvePending(start, []);
    expect(p1Kept.step).toEqual({ phase: "setup", kind: "mulligan", remainingPlayerIds: [p2] });
    const afterFirstPass = resolvePending(p1Kept, handOf(p1Kept, p2).slice(0, 1));
    expect(afterFirstPass.step).toEqual({
      phase: "setup",
      kind: "mulligan",
      remainingPlayerIds: [p2],
      pass: 1,
    });
    const { deciders, additional, done } = mulliganOrder(start, (state) => state.pendingChoice?.playerId !== p1);
    expect(deciders).toEqual([p1, p2, p2]);
    expect(additional).toEqual([undefined, undefined, 1]);
    expect(mustPlayer(done, p1).discard).toHaveLength(0);
    expect(mustPlayer(done, p2).discard).toHaveLength(2);
  });

  it("replays deep-equal through both passes", () => {
    const { session } = driveSession(startSession(atMulligan([1, 1])), DEFAULT_DEPS, [], (state) =>
      state.pendingChoice?.prompt.kind === "mulligan"
        ? handOf(state, state.pendingChoice.playerId).slice(0, 1)
        : defaultPick(state),
    );
    expect(session.state.step.kind).toBe("turn");
    const replayed = replay(session.log, DEFAULT_DEPS);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("no extra mulligans leaves the one mulligan and the player state as they were", () => {
    const start = atMulligan([0]);
    expect("extraMulligans" in mustPlayer(start, p1)).toBe(false);
    const done = resolvePending(start, mustPlayer(start, p1).hand.slice(0, 1));
    expect(done.pendingChoice).toBeNull();
    expect(done.step.kind).toBe("turn");
  });

  it("refuses an extraMulligans that is not a whole number of 0 or more", () => {
    for (const bad of [-1, 1.5]) {
      const result = createGame(configWith([bad]), DEFAULT_DEPS);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("invalid_setup");
    }
  });
});
