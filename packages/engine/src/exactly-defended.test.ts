/**
 * "Exactly defend" (`EXACTLY_DEFENDED_RESULT`) and "your DEF for that attack" (`DEFENDER_DEF_RESULT`), the results an
 * enemy attack records for a hero's basic defense (Redirection Mastery, `iron_fist` 64018). Synthetic villain shaped
 * like "Forced Response: After a hero exactly defends this enemy's attack, place counters here equal to that hero's DEF
 * for that attack", answering the `defended` response (which carries the attack's results).
 *
 * Sources: FFG ruling September 10, 2026 (4): the defender's modified DEF must equal the attacker's modified ATK for
 * that attack, and a basic defense is required (October 12, 2026 (4)); RRG 1.8 "Attack (Enemy Activation)" steps 3-4
 * (p. 9): boost icons add to the ATK, DEF is subtracted from the damage.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { startSession } from "./engine.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";
import { DEFENDER_DEF_RESULT, EXACTLY_DEFENDED_RESULT } from "./trigger-events.js";

const self = { kind: "self" } as const;
const EXACT = stubAbility("mirror.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "defended", selfIs: "source", requireResults: { [EXACTLY_DEFENDED_RESULT]: 1 } },
  },
  effects: [
    {
      kind: "addCounters",
      target: self,
      counterType: "def",
      amount: { kind: "eventResult", key: DEFENDER_DEF_RESULT },
    },
  ],
});
// "Forced Interrupt: When this enemy attacks, it gets +N ATK for this attack."
const rage = (n: number) =>
  stubAbility(`mirror.rage-${n}`, {
    trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source" } },
    effects: [{ kind: "modifyAttack", atkBonus: { kind: "const", value: n } }],
  });
// "Forced Interrupt: When this enemy attacks, declare the attacked player's hero the defender" (Shieldmaiden's shape:
// declared by an effect, so a basic defense; RRG 1.8 "Defend, Defense", p. 15).
const DECLARE = stubAbility("mirror.declare", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source" } },
  effects: [{ kind: "declareDefender", character: { kind: "identityOf", player: { kind: "eventPlayer" } } }],
});
// "Forced Interrupt (defense): When an enemy attacks you, place a counter here." A "(defense)" ability alone: the hero is
// the defender, but makes no basic defense (RRG 1.8 "Defend, Defense", p. 16).
const GUARD_UP = stubAbility("guard-up.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
  },
  label: ["defense"],
  effects: [{ kind: "addCounters", target: self, counterType: "used", amount: { kind: "const", value: 1 } }],
});
const GUARD = stubSupport({ id: "guard", cost: 0, abilities: [GUARD_UP.ref] });
const mirror = (atk: number, abilities: readonly StubAbility[]) =>
  stubVillain({ id: "mirror", stages: [{ hp: flat(30), atk, sch: 1, abilities: abilities.map((a) => a.ref) }] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const ONE_ICON = stubTreachery({ id: "one-icon", boostIcons: 1 });

function villainPhase(opts: {
  atk: number;
  boost?: "blank" | "one";
  defend: boolean;
  extra?: StubAbility[];
  guard?: boolean;
}) {
  const abilities = [EXACT, ...(opts.extra ?? [])];
  const deps: EngineDeps = depsOf(...abilities, GUARD_UP);
  const boost = opts.boost === "one" ? ONE_ICON : BLANK;
  let state: GameState = gameAtFirstTurn({
    cards: [boost, GUARD],
    deps,
    villain: mirror(opts.atk, abilities),
    encounter: copiesOf(boost.id, 30),
    deck: [GUARD.id],
  });
  const guard = opts.guard ? playerCardIntoPlay(state, GUARD.id, P1) : null;
  if (guard) state = guard.state;
  const villain = state.villains[0]!.instanceId;
  const hero = mustPlayer(state, P1).identity.instanceId;
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const, heroFormIndex: 0 } })),
  };
  const pick = (current: GameState): readonly string[] =>
    current.pendingChoice?.prompt.kind === "declareDefender" && opts.defend ? [hero] : defaultPick(current);
  const after = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], pick).session.state;
  return {
    def: mustInstance(after, villain).counters["def"] ?? 0,
    damage: mustInstance(after, hero).damage,
    ...(guard ? { guardUsed: mustInstance(after, guard.id).counters["used"] ?? 0 } : {}),
  };
}

describe("exactly defending an enemy attack (hero DEF 2)", () => {
  it("ATK 2, no boost icons, basic defense: exactly defended, DEF 2 for that attack", () => {
    const run = villainPhase({ atk: 2, defend: true });
    expect(run).toEqual({ def: 2, damage: 0 });
  });

  it("ATK 1: DEF exceeds the ATK, so not exactly", () => {
    expect(villainPhase({ atk: 1, defend: true }).def).toBe(0);
  });

  it("ATK 1 plus a boost icon is modified ATK 2: exactly defended", () => {
    expect(villainPhase({ atk: 1, boost: "one", defend: true }).def).toBe(2);
  });

  it("ATK 2 plus a boost icon is 3: not exactly, 1 damage taken", () => {
    expect(villainPhase({ atk: 2, boost: "one", defend: true })).toEqual({ def: 0, damage: 1 });
  });

  it("'+1 ATK for this attack' counts: ATK 1 + 1 is exactly defended", () => {
    expect(villainPhase({ atk: 1, defend: true, extra: [rage(1)] }).def).toBe(2);
  });

  it("an undefended attack is never exactly defended", () => {
    expect(villainPhase({ atk: 2, defend: false }).def).toBe(0);
  });

  it("ruling Oct 12, 2026 (4): a hero made the defender only by a '(defense)' ability makes no basic defense", () => {
    // ATK 2 and DEF 2, but DEF is never subtracted: the hero takes the 2 and has not exactly defended.
    const run = villainPhase({ atk: 2, defend: false, guard: true });
    expect(run).toMatchObject({ guardUsed: 1, def: 0, damage: 2 });
  });

  it("ruling Oct 12, 2026 (4): a hero declared the defender by an effect makes a basic defense, and can exactly defend", () => {
    const run = villainPhase({ atk: 2, defend: false, extra: [DECLARE] });
    expect(run).toMatchObject({ def: 2, damage: 0 });
  });
});
