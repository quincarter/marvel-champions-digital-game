/**
 * docs/phase7-wave4.md §3.36: an `EventPattern.eventIs` value that is a list — "When Machine Man attacks or thwarts"
 * (Machine Man, `vision` 26022) on `basicPowerUsing`, which also carries his defense. Synthetic ally.
 *
 * Sources: the card's own text; RRG 1.8 "Basic Powers" (p. 10).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { candidatesFor } from "./resolve/triggers.js";
import type { TriggerEvent } from "./trigger-events.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const MACHINE_INTERRUPT = stubAbility("machine.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: false,
    on: { on: "basicPowerUsing", selfIs: "target", eventIs: { power: ["attack", "thwart"] } },
  },
  effects: [],
});
const MACHINE = stubAlly({ id: "machine", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [MACHINE_INTERRUPT.ref] });
const deps: EngineDeps = depsOf(MACHINE_INTERRUPT);

describe("§3.36 'attacks or thwarts': a list in eventIs", () => {
  it("matches either listed value and nothing else", () => {
    const base = gameAtFirstTurn({ cards: [MACHINE], deps, deck: [MACHINE.id] });
    const { state, id } = playerCardIntoPlay(base, MACHINE.id);
    const using = (power: "attack" | "thwart" | "defense"): TriggerEvent => ({
      kind: "basicPowerUsing",
      characterInstanceId: id,
      power,
      playerId: P1,
    });
    expect(candidatesFor(state, deps, using("attack"), "interrupt", false)).toHaveLength(1);
    expect(candidatesFor(state, deps, using("thwart"), "interrupt", false)).toHaveLength(1);
    expect(candidatesFor(state, deps, using("defense"), "interrupt", false)).toHaveLength(0);
  });
});
