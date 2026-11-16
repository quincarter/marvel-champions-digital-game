/**
 * Clear the Area (04049), issue #773: "Hero Action (thwart): Remove 2 threat from a scheme. If this removes the last
 * threat on that scheme, draw 1 card." The last threat is read after the removal, so a thwart raised past 2 (Shrink,
 * 05011: "increase the amount of threat that event removes by 2"; RRG 1.8 FAQ "Shrink", p. 59) that clears a 4-threat
 * scheme still draws. Played from a real Core Spider-Man (Justice) hand in a real Rhino game.
 */

import { describe, expect, it } from "vitest";
import { mainThreat, P1, patchInstance, playerOf } from "../../testing/harness.js";
import { conjure, intoPlay, playOut, table } from "../../testing/qa-bench.js";

const CLEAR_THE_AREA = "04049";
const SHRINK = "05011";

/** Plays Clear the Area at `target` (the main scheme when absent), with Shrink in play and used when `shrink`. */
function clear(opts: { readonly mainThreat?: number; readonly shrink?: boolean; readonly side?: number }) {
  const t = table({ side: opts.side !== undefined });
  let state = patchInstance(t.state, t.state.mainScheme.instanceId, { threat: opts.mainThreat ?? 8 });
  if (t.side && opts.side !== undefined) state = patchInstance(state, t.side, { threat: opts.side });
  if (opts.shrink) state = intoPlay(state, SHRINK).state;
  const given = conjure(state, CLEAR_THE_AREA);
  const before = playerOf(given.state, P1).hand.length;
  const target = t.side && opts.side !== undefined ? t.side : given.state.mainScheme.instanceId;
  const played = playOut(given.state, given.id, 1, { target, use: opts.shrink ? [SHRINK] : [] });
  expect(played.accepted).toBe(true);
  // The played card and the one paid with leave the hand; a draw puts one back.
  const drew = playerOf(played.state, P1).hand.length - (before - 2);
  return { state: played.state, drew, target };
}

describe("Clear the Area (04049): draws when it removes the last threat (#773)", () => {
  it("with Shrink, removing all 4 threat from the main scheme draws a card", () => {
    const { state, drew } = clear({ mainThreat: 4, shrink: true });
    expect(mainThreat(state)).toBe(0);
    expect(drew).toBe(1);
  });

  it("without Shrink, 2 of 4 threat is removed and nothing is drawn", () => {
    const { state, drew } = clear({ mainThreat: 4 });
    expect(mainThreat(state)).toBe(2);
    expect(drew).toBe(0);
  });

  it("clearing a side scheme's last 2 threat draws, though the scheme is defeated and leaves play", () => {
    const { state, drew, target } = clear({ side: 2 });
    expect(state.villainArea).not.toContain(target);
    expect(drew).toBe(1);
  });
});
