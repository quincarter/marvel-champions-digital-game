/**
 * `Frame<"event">.usingAfterWould`: a basic attack's "uses a basic power" announcement waits for the attack's "would"
 * interrupts (RRG 1.8 "'Would'", p. 48; "Villainous", p. 47), and the attack's interrupt window still opens around it,
 * so an interrupt to the attack that a "when you use a basic power" interrupt makes eligible is offered (Psi-Energy
 * Control turning a Knife into a Katana, then Directed Force 41019). Synthetic cards; nothing but the gated interrupt
 * listens to the attack.
 */
import { describe, expect, it } from "vitest";
import { startSession } from "./engine.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const scheme = { kind: "each", query: { categories: ["mainScheme"] } } as const;
/** "Forced Interrupt: When a character uses a basic power, place 1 'flag' counter on the main scheme." */
const FLAG = stubAbility("flag.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "basicPowerUsing" } },
  effects: [{ kind: "addCounters", target: scheme, counterType: "flag", amount: { kind: "const", value: 1 } }],
});
/** "Forced Interrupt: When a character attacks, while the main scheme has a 'flag' counter, place 1 'hit' counter." */
const GATED = stubAbility("gated.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "attack" },
    while: { kind: "counterAtLeast", of: scheme, counterType: "flag", amount: 1 },
  },
  effects: [{ kind: "addCounters", target: scheme, counterType: "hit", amount: { kind: "const", value: 1 } }],
});
const FLAGGER = stubSupport({ id: "flagger", cost: 0, abilities: [FLAG.ref] });
const GATE = stubSupport({ id: "gate", cost: 0, abilities: [GATED.ref] });

function attackWith(flagger: boolean) {
  const deps = depsOf(FLAG, GATED);
  const base = gameAtFirstTurn({ cards: [FLAGGER, GATE], deps, deck: [FLAGGER.id, GATE.id] });
  const hero: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  let state = playerCardIntoPlay(hero, GATE.id, P1).state;
  if (flagger) state = playerCardIntoPlay(state, FLAGGER.id, P1).state;
  const { session } = driveSession(startSession(state), deps, [
    {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: mustPlayer(state, P1).identity.instanceId,
      targetInstanceId: state.villains[0]!.instanceId,
    },
  ]);
  return mustInstance(session.state, session.state.mainScheme.instanceId).counters;
}

describe("usingAfterWould: the attack's window opens for interrupts the announcement makes eligible", () => {
  it("the 'uses a basic power' interrupt enables the attack interrupt, which is then offered and resolves", () => {
    expect(attackWith(true)).toMatchObject({ flag: 1, hit: 1 });
  });

  it("without it, the gated interrupt stays off", () => {
    expect(attackWith(false).hit ?? 0).toBe(0);
  });
});
