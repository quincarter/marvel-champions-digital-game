/**
 * docs/phase7-wave4.md §3.39: a keyword granted until a duration ends. Synthetic event shaped like Pulsar Shield's
 * second sentence (`mts` 21009: "she gains retaliate 1 until the end of the phase") and Cuts Both Ways (`cw` 56050).
 *
 * Sources: the cards' own text; RRG 1.8 "Lasting Effects" (p. 26), "Retaliate X" (p. 38).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import { hasKeyword, keywordTotal } from "./keywords.js";
import { mustPlayer } from "./query.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playFree } from "./testing/wave3.js";

const BRACE = stubAbility("brace.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "grantKeywordUntil",
      keyword: { name: "retaliate", value: 1 },
      target: { kind: "identityOf", player: { kind: "controller" } },
      until: "endOfPhase",
    },
  ],
});
const BRACE_CARD = stubEvent({ id: "brace", cost: 0, abilities: [BRACE.ref] });
const deps: EngineDeps = depsOf(BRACE);

describe("§3.39 a keyword granted until the end of the phase", () => {
  it("the character has it for the rest of the phase, and not after", () => {
    const start = gameAtFirstTurn({ cards: [BRACE_CARD], deps, deck: [BRACE_CARD.id] });
    const identity = mustPlayer(start, P1).identity.instanceId;
    expect(hasKeyword(start, identity, "retaliate", deps)).toBe(false);
    const { state, session } = playFree(start, deps, BRACE_CARD.id);
    expect(hasKeyword(state, identity, "retaliate", deps)).toBe(true);
    expect(keywordTotal(state, identity, "retaliate", deps)).toBe(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
    const after = runCommands(state, deps, { type: "endTurn", playerId: P1 }).state;
    expect(hasKeyword(after, identity, "retaliate", deps)).toBe(false);
  });
});
