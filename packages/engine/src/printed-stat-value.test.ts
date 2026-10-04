/**
 * docs/phase7-wave6.md §3.33: `ValueSpec stat` with `printed` reads the stat as printed on the card (RRG 1.8 "Printed",
 * p. 35), with no modifier: "remove X threat from the main scheme, where X is that minion's printed SCH" (Marvel Girl,
 * 34015). A printed "—" or a star ("X" in the card data, defined only by the card's own text) reads 0.
 */

import { describe, expect, it } from "vitest";
import type { InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import { resolveValue, type EffectContext } from "./select.js";
import type { StatName } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubMinion, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1 } from "./testing/wave3.js";

/** Every minion gets +2 SCH and +3 ATK, and every identity +1 ATK (a constant ability on the boosting minion). */
const pumped = stubAbility("pumped", {
  trigger: {
    kind: "constant",
    modifiers: [
      { stat: "sch", amount: 2, target: { categories: ["minion"] } },
      { stat: "atk", amount: 3, target: { categories: ["minion"] } },
      { stat: "atk", amount: 1, target: { categories: ["identity"] } },
    ],
  },
  effects: [],
});
const BOOSTER = stubMinion({ id: "booster", atk: 1, sch: 2, hp: 4, abilities: [pumped.ref] });
const DASHED = stubMinion({ id: "dashed", atk: null, sch: null, hp: 3 });
const STARRED = stubMinion({ id: "starred", atk: "X", sch: "X", hp: 3 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const deps = depsOf(pumped);

function board(): { readonly state: GameState; readonly ids: Readonly<Record<string, InstanceId>> } {
  let state = gameAtFirstTurn({
    cards: [BOOSTER, DASHED, STARRED, BLANK],
    deps,
    encounter: [BOOSTER.id, DASHED.id, STARRED.id, ...copiesOf(BLANK.id, 20)],
  });
  const ids: Record<string, InstanceId> = {};
  for (const card of [BOOSTER, DASHED, STARRED]) {
    const engaged = minionEngagedWith(state, card.id);
    state = engaged.state;
    ids[card.id] = engaged.id;
  }
  return { state, ids };
}

const read = (state: GameState, id: InstanceId, stat: StatName, printed: boolean): number => {
  const context: EffectContext = { selfInstanceId: null, controllerId: P1, event: null, bindings: { c: [id] }, deps };
  const of = { kind: "slot", slot: "c" } as const;
  return resolveValue(state, printed ? { kind: "stat", of, stat, printed: true } : { kind: "stat", of, stat }, context);
};

describe("§3.33 a printed stat as a value", () => {
  it("reads the printed SCH and ATK of a minion, ignoring modifiers", () => {
    const { state, ids } = board();
    const booster = ids[BOOSTER.id]!;
    expect(read(state, booster, "sch", false)).toBe(4);
    expect(read(state, booster, "sch", true)).toBe(2);
    expect(read(state, booster, "atk", false)).toBe(4);
    expect(read(state, booster, "atk", true)).toBe(1);
  });

  it("reads an identity's printed ATK and THW, ignoring modifiers", () => {
    const { state } = board();
    const identity = mustPlayer(state, P1).identity.instanceId;
    const printedAtk = read(state, identity, "atk", true);
    expect(read(state, identity, "atk", false)).toBe(printedAtk + 1);
    expect(read(state, identity, "thw", true)).toBe(read(state, identity, "thw", false));
  });

  it("a printed dash or star reads 0, modifiers or not", () => {
    const { state, ids } = board();
    for (const id of [ids[DASHED.id]!, ids[STARRED.id]!]) {
      expect(read(state, id, "sch", true)).toBe(0);
      expect(read(state, id, "atk", true)).toBe(0);
    }
    // The star's base is 0 with the +2 still applying to the current value; the dash stays an unmodifiable 0.
    expect(read(state, ids[STARRED.id]!, "sch", false)).toBe(2);
    expect(read(state, ids[DASHED.id]!, "sch", false)).toBe(0);
  });

  it("totals printed values over several cards", () => {
    const { state, ids } = board();
    const context: EffectContext = {
      selfInstanceId: null,
      controllerId: P1,
      event: null,
      bindings: { all: Object.values(ids) },
      deps,
    };
    const of = { kind: "slot", slot: "all" } as const;
    expect(resolveValue(state, { kind: "stat", of, stat: "sch", total: true, printed: true }, context)).toBe(2);
    expect(resolveValue(state, { kind: "stat", of, stat: "sch", total: true }, context)).toBe(4 + 0 + 2);
  });
});
