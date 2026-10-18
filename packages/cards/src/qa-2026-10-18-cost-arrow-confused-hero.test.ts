/**
 * Cost arrow with a confused hero (FFG ruling April 30, 2026 (2); RRG 1.8 "Confuse" p. 13, "Cost Arrow Icon" p. 13),
 * proved on a real card: Defender of the Nine Realms (06003) played while the hero is confused, in a real Rhino game
 * (`testing/qa-bench.ts`).
 */
import { cardId, PLAYABLE_CARDS } from "@mc/content";
import { activeEncounterDeck, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, identityOf, inst, instancesOf, mainThreat, patchInstance } from "./testing/harness.js";
import { conjure, playOut, rhino } from "./testing/qa-bench.js";

const DEFENDER = "06003";
const SENTINEL = "32093";

describe("Cost arrow with a confused hero (FFG ruling April 30, 2026 (2); RRG 1.8 'Confuse' p. 13, 'Cost Arrow Icon' p. 13)", () => {
  it("Defender of the Nine Realms (06003) played while confused: the minion (cost) still comes, the confused card replaces the thwart", () => {
    const base = rhino();
    const me = identityOf(base);
    // Two Sentinel Mark IV minions on top of the encounter deck for the "discard until a minion" cost.
    const sentinel = PLAYABLE_CARDS.find((card) => card.id === cardId(SENTINEL))!;
    let staged: GameState = { ...base, cardPool: { ...base.cardPool, [sentinel.id]: sentinel } };
    for (const id of activeEncounterDeck(base).deck.slice(0, 2))
      staged = patchInstance(staged, id, { cardId: sentinel.id });
    staged = patchInstance(staged, me, { statuses: { ...inst(staged, me).statuses, confused: 1 } });
    const given = conjure(staged, DEFENDER);
    const threatBefore = mainThreat(given.state);
    const done = playOut(given.state, given.id, 0);
    expect(done.accepted).toBe(true);
    // The confused card replaced the thwart (this half is right today) and no threat came off.
    expect(inst(done.state, me).statuses.confused).toBe(0);
    expect(mainThreat(done.state)).toBe(threatBefore);
    // The cost (before the arrow) was paid: a minion is engaged with the player. Actual: none.
    const engaged = instancesOf(done.state, SENTINEL).filter((id) => inst(done.state, id).engagedWith === P1);
    expect(engaged.length).toBe(1);
  });
});
