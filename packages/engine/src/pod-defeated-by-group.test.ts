/**
 * Issue #909 ("Shatter the Illusion": your table deals the final damage to Loki): the shared record names the group
 * whose shared event took the shared villain's last hit points. Informational only; the reducer's results are as before.
 */

import { describe, expect, it } from "vitest";
import { groupId } from "./ids.js";
import { applySharedEvent, type SharedEvent, type SharedPodState } from "./pod.js";

const G1 = groupId("g1");
const G2 = groupId("g2");
const damage = (amount: number, from: typeof G1): SharedEvent => ({
  type: "sharedVillainDamaged",
  groupId: from,
  amount,
});
const RECORD: SharedPodState = {
  villainHp: 10,
  villainDamage: 0,
  villainFlipAtRemaining: 5,
  villainFlipped: false,
  schemeThreat: 0,
  schemeTarget: 8,
  status: "playing",
};

describe("SharedPodState.defeatedByGroup", () => {
  it("is absent until the defeat, then names the group of the final damage", () => {
    const first = applySharedEvent(RECORD, damage(6, G1));
    expect(first.results).toEqual(["sharedVillainFlipped"]);
    expect(first.shared.defeatedByGroup).toBeUndefined();
    const last = applySharedEvent(first.shared, damage(9, G2));
    expect(last.results).toEqual(["sharedVillainDefeated"]);
    expect(last.shared).toEqual({ ...first.shared, villainDamage: 10, status: "won", defeatedByGroup: G2 });
  });

  it("is kept once won: later damage changes nothing", () => {
    const won = applySharedEvent(RECORD, damage(10, G1)).shared;
    expect(won.defeatedByGroup).toBe(G1);
    expect(applySharedEvent(won, damage(3, G2)).shared).toBe(won);
  });

  it("names the group that won the race after the shared scheme's completion (MC55 p. 21)", () => {
    const completed = applySharedEvent(RECORD, {
      type: "sharedSchemeThreatPlaced",
      groupId: G1,
      amount: 8,
      cause: "schemeCompleted",
    });
    expect(completed.shared.status).toBe("schemeCompleted");
    expect(applySharedEvent(completed.shared, damage(10, G2)).shared).toMatchObject({
      status: "won",
      defeatedByGroup: G2,
    });
  });
});
