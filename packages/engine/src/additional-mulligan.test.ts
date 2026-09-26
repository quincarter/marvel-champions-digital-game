/**
 * docs/phase7-wave5.md §3.26: an additional mulligan. MC27 p. 22 reputation node 5, as errata'd by RRG 1.8 p. 67:
 * "During the Resolve Mulligans step of game setup, each player may take 1 additional mulligan." Each one is a full
 * mulligan (RRG 1.8 Appendix II step 15: discard any number, draw up to starting hand size; §4 question 12's default).
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_DEPS } from "./abilities.js";
import { playerId } from "./ids.js";
import { mustPlayer } from "./query.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { GameState } from "./state.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  HERO,
  MAIN_SCHEME,
  TREACHERY,
  VILLAIN,
  resolvePending,
  seatIdentities,
  settle,
} from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");

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
    expect(second.step).toEqual({ phase: "setup", kind: "mulligan", remainingPlayerIds: [p1], mulligansTaken: 1 });
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

  it("each player decides their own additional mulligan before the next player's first", () => {
    const start = atMulligan([1, undefined]);
    const deciders: string[] = [];
    const additional: (number | undefined)[] = [];
    const done = settle(start, (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "mulligan") return [];
      deciders.push(choice.playerId);
      additional.push(choice.prompt.additional);
      return mustPlayer(state, choice.playerId).hand.slice(0, 1);
    });
    expect(deciders).toEqual([p1, p1, p2]);
    expect(additional).toEqual([undefined, 1, undefined]);
    expect(mustPlayer(done, p1).discard).toHaveLength(2);
    expect(mustPlayer(done, p2).discard).toHaveLength(1);
    expect(done.round).toBe(1);
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
