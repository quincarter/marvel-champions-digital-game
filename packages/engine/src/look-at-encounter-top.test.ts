/**
 * docs/phase7-wave5.md §3.28: looking at the top card of the encounter deck at any time. A synthetic event shaped like
 * Sector Scan ("Until the end of the round, you may look at the top card of the encounter deck at any time").
 *
 * Source: RRG 1.8 "Look, Looked-At" (p. 27): "only the player who is resolving the ability can look at those cards".
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import { activeEncounterDeck } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, P2, playFree } from "./testing/wave3.js";
import { faceVisible, zoneHidden } from "./visibility.js";

const SCAN_ACTION = stubAbility("scan.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "applyRuleUntil",
      rule: { kind: "mayLookAtTopOfEncounterDeck", player: { kind: "controller" } },
      until: "endOfRound",
    },
  ],
});
const SCAN = stubEvent({ id: "scan", cost: 0, abilities: [SCAN_ACTION.ref] });
const deps: EngineDeps = depsOf(SCAN_ACTION);

const start = (): GameState => gameAtFirstTurn({ cards: [SCAN], deps, players: 2, deck: [SCAN.id] });
const top = (state: GameState) => activeEncounterDeck(state).deck[0]!;
const second = (state: GameState) => activeEncounterDeck(state).deck[1]!;
const sees = (state: GameState, id: string, viewer: typeof P1) => faceVisible(state, id as never, { viewer, deps });

describe("§3.28 'you may look at the top card of the encounter deck at any time'", () => {
  it("only the resolving player sees the top card, nothing else moves, replay deep-equal", () => {
    const before = start();
    expect(sees(before, top(before), P1)).toBe(false);

    const { session, state } = playFree(before, deps, SCAN.id, P1);
    expect(sees(state, top(state), P1)).toBe(true);
    // Another player, the table-wide answer and `preview()`'s truncation rule do not see it.
    expect(sees(state, top(state), P2)).toBe(false);
    expect(faceVisible(state, top(state))).toBe(false);
    expect(zoneHidden(state, top(state))).toBe(true);
    // Only the top card, and the deck is untouched.
    expect(sees(state, second(state), P1)).toBe(false);
    expect(activeEncounterDeck(state).deck).toEqual(activeEncounterDeck(before).deck);
    expect(
      state.lastingEffects.some((e) => e.kind === "ruleGrant" && e.rule.kind === "mayLookAtTopOfEncounterDeck"),
    ).toBe(true);

    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(state);
  });

  it('holds through another player\'s turn ("at any time") and ends with the round', () => {
    const { session, state } = playFree(start(), deps, SCAN.id, P1);
    // P2's turn: still P1's to look at. Then the villain phase deals off the top and the round ends.
    const endedP1 = driveSession(session, deps, [{ type: "endTurn", playerId: P1 }]);
    const midRound = endedP1.session.state;
    expect(sees(midRound, top(midRound), P1)).toBe(true);
    const ended = driveSession(endedP1.session, deps, [{ type: "endTurn", playerId: P2 }]).session.state;
    expect(ended.round).toBe(state.round + 1);
    expect(ended.lastingEffects.some((e) => e.kind === "ruleGrant")).toBe(false);
    expect(sees(ended, top(ended), P1)).toBe(false);
  });
});
