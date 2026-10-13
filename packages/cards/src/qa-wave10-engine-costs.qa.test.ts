/**
 * Wave 10 engine-rules QA, changes 4, 6 and 7 on OLDER cards: excess damage (`excessAsDealt` beside `excessDealt`,
 * Follow Through), printed-X cards that now take a real X (`playCard.x`, `minX`; Speed Cyclone 14006 and Lethal Intent
 * 22010), and the Setup abilities that now resolve at setup step 16.
 *
 * Sources:
 * - RRG 1.8 "Overkill" (p. 31) and the owner's decisions 31B, 40A, 42B, 50A (docs/phase7-wave10.md §4.0): every reader of
 *   "excess damage" other than Prince of Power 59017 stays on damage TAKEN; Follow Through ("When your hero's attack deals
 *   any amount of excess damage, increase that amount by 1") raises the excess dealt and, when the target took excess,
 *   the excess taken; with nothing taken beyond its hit points nothing more spills.
 * - RRG 1.8 "Non-Numerical Variable" (p. 30): "the value of X is defined by card ability or player choice"; owner answer
 *   52B: an ability that only acts on X chosen things cannot be played at X = 0.
 * - RRG 1.8 "Choose (Game Element)" (p. 12): "If multiple targets are required to be chosen by the same player,
 *   simultaneously choose as many as are available, to a maximum of the specified number."
 * - RRG 1.8 Appendix II step 16 (p. 51): identity Setup abilities resolve once, after the draw and the mulligan.
 */
import { applyCommand, createGame, printedResources, type Command, type GameEvent, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "./playable/index.js";
import { firstLegal, inst, P1, patchInstance, payWith, play } from "./testing/harness.js";
import { conjure, DEPS, intoPlay } from "./testing/qa-bench.js";
import { driveWith, plainTable } from "./testing/wave10-engine-qa-bench.js";

const takeFirst = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice!;
  return choice.options.slice(0, choice.maxSelections).map((o) => o.optionId);
};

describe("excess damage on older readers: Into the Fray 13013 reads damage TAKEN, Follow Through 16045 adds 1 (42B, 50A)", () => {
  // Into the Fray: "Deal 6 damage to a minion. For each point of excess damage dealt by this attack, remove 1 threat from
  // the main scheme." Sentinel Mark IV has 4 hit points.
  const intoTheFray = (opts: { readonly followThrough: boolean; readonly tough: boolean; readonly damage: number }) => {
    const t = plainTable(8);
    let s = patchInstance(t.state, t.minion, {
      damage: opts.damage,
      statuses: { ...inst(t.state, t.minion).statuses, tough: opts.tough ? 1 : 0 },
    });
    if (opts.followThrough) s = intoPlay(s, "16045").state;
    const given = conjure(s, "13013");
    const done = driveWith(given.state, play(P1, given.id, payWith(given.state, P1, 3, [given.id])), (state) =>
      state.pendingChoice!.options.some((o) => o.optionId === t.minion) ? [t.minion] : takeFirst(state),
    );
    expect(done.accepted, done.refusal).toBe(true);
    return 8 - inst(done.state, done.state.mainScheme.instanceId).threat;
  };

  it("control: 6 damage to a 4-hit-point minion is 2 excess, so 2 threat comes off", () => {
    expect(intoTheFray({ followThrough: false, tough: false, damage: 0 })).toBe(2);
    expect(intoTheFray({ followThrough: false, tough: false, damage: 2 })).toBe(4);
  });
  it("with Follow Through the excess taken is 1 higher", () => {
    expect(intoTheFray({ followThrough: true, tough: false, damage: 0 })).toBe(3);
    expect(intoTheFray({ followThrough: true, tough: false, damage: 2 })).toBe(5);
  });
  it("a tough minion takes nothing, so 'excess damage' is none for this reader, with or without Follow Through (40A, 50A)", () => {
    expect(intoTheFray({ followThrough: false, tough: true, damage: 0 })).toBe(0);
    expect(intoTheFray({ followThrough: true, tough: true, damage: 0 })).toBe(0);
  });
});

describe("Speed Cyclone 14006 (printed 'Hero Action: Stun X Enemies.', cost X): a real X", () => {
  const cyclone = (x: number | undefined, paid: number) => {
    const t = plainTable(3);
    const given = conjure(t.state, "14006");
    const command = {
      ...play(P1, given.id, payWith(given.state, P1, paid, [given.id])),
      ...(x === undefined ? {} : { x }),
    };
    const done = driveWith(given.state, command, takeFirst);
    const enemies = [t.minion, given.state.activeVillainId!];
    return { done, stunned: enemies.filter((e) => done.accepted && inst(done.state, e).statuses.stunned > 0).length };
  };

  it("X = 1 paid with 1 card stuns one enemy and asks which", () => {
    const { done, stunned } = cyclone(1, 1);
    expect(done.asked).toEqual(["chooseTarget"]);
    expect(stunned).toBe(1);
  });
  it("X = 2 paid with 2 cards stuns two enemies", () => {
    expect(cyclone(2, 2).stunned).toBe(2);
  });
  it("X = 3 with only two enemies in play stuns both (as many as are available, RRG p. 12)", () => {
    const { done, stunned } = cyclone(3, 3);
    expect(done.accepted, done.refusal).toBe(true);
    expect(stunned).toBe(2);
  });
  it("the cost is X: naming X = 2 and paying 1 is refused", () => {
    const { done } = cyclone(2, 1);
    expect(done.accepted).toBe(false);
  });
  it("X = 0 (or no X named) is accepted and stuns nothing, which question Q-B of the report asks about", () => {
    // Under owner answer 52B an ability that only acts on X chosen things cannot be played at X = 0 (Everywhere All at
    // Once 58018 has `minX: 1`). "Stun X enemies" is the same shape and has no `minX`.
    expect(cyclone(0, 0)).toMatchObject({ stunned: 0, done: { accepted: true } });
    expect(cyclone(undefined, 0)).toMatchObject({ stunned: 0, done: { accepted: true } });
  });
});

describe("Lethal Intent 22010 (printed 'Choose up to X technique upgrades you control. Resolve each of their Special abilities'): a real X", () => {
  // Weapons Master 22007 (Special (attack): deal 4 damage to an enemy) and Evasive Maneuvering 22005 (Special: stun or confuse an enemy).
  const lethal = (x: number, techs: number) => {
    let state = plainTable(3).state;
    for (const [index, code] of ["22007", "22005"].slice(0, techs).entries())
      state = intoPlay(state, code, {}, 2 + index).state;
    const given = conjure(state, "22010");
    const done = driveWith(
      given.state,
      { ...play(P1, given.id, payWith(given.state, P1, x, [given.id])), x } as Command,
      takeFirst,
    );
    return done;
  };
  it("X = 2 with two technique upgrades resolves both Specials (an order is asked, a target for each)", () => {
    const done = lethal(2, 2);
    expect(done.accepted, done.refusal).toBe(true);
    expect(done.asked).toContain("orderSpecials");
    expect(done.asked.filter((k) => k === "chooseOption")).toHaveLength(1);
  });
  it("X = 1 with two technique upgrades chooses one: no order to give", () => {
    const done = lethal(1, 2);
    expect(done.accepted, done.refusal).toBe(true);
    expect(done.asked).not.toContain("orderSpecials");
  });
  it("X = 0, or no technique upgrade in play, is accepted and resolves nothing (question Q-B of the report)", () => {
    expect(lethal(0, 2)).toMatchObject({ accepted: true, asked: [] });
    expect(lethal(2, 0)).toMatchObject({ accepted: true, asked: [] });
  });
});

describe("older identity Setup abilities still resolve exactly once at setup step 16 (RRG 1.8 Appendix II, p. 51)", () => {
  // Heroes of waves 1 to 9 whose identity prints a Setup ability, from the ability census of the registry.
  const HEROES: readonly [string, string][] = [
    ["cap-leadership", "03001b.setup"],
    ["star-lord-leadership", "17001b.setup"],
    ["spectrum-leadership", "21001b.setup"],
    ["vision-protection", "26001b.setup"],
    ["valkyrie-aggression", "25001b.setup"],
    ["colossus-protection", "32001b.setup"],
    ["shadowcat-aggression", "32030b.setup"],
    ["phoenix-justice", "34001b.setup"],
    ["rogue-protection", "38001b.setup"],
  ];
  for (const [deck, ability] of HEROES) {
    it(`${deck}: ${ability}`, () => {
      const created = createGame(
        playableScenario("rhino", { seed: 4, players: [{ starterDeckId: deck }] }),
        PLAYABLE_DEPS,
      );
      if (!created.ok) throw new Error(created.error.message);
      const events: GameEvent[] = [...created.events];
      let state = created.state;
      for (let guard = 0; state.pendingChoice && guard < 200; guard++) {
        const choice = state.pendingChoice;
        const next = applyCommand(
          state,
          {
            type: "resolveChoice",
            playerId: choice.playerId,
            choiceId: choice.choiceId,
            selectedOptionIds: firstLegal(state),
          },
          DEPS,
        );
        if (!next.ok) throw new Error(next.error.message);
        events.push(...next.events);
        state = next.state;
      }
      const resolved = events.filter((e) => e.type === "abilityResolved" && e.abilityId === ability);
      expect(resolved).toHaveLength(1);
    });
  }
});

describe("a resource restriction still binds a payment (53B exempts only a resource generated to overpay): Crushing Blow 10002", () => {
  // Printed: "You can only spend [physical] resources to pay for this card." (cost 1). A wild resource counts as any type.
  it("a hand card pays for it exactly when it prints a physical or a wild resource", () => {
    const given = conjure(plainTable(3).state, "10002");
    const hand = given.state.players[0]!.hand.filter((id) => id !== given.id);
    let accepted = 0;
    let refused = 0;
    for (const id of hand) {
      const icons = given.state.cardPool[given.state.instances[id]!.cardId]!;
      const printed = printedResources(icons);
      const should = printed.physical + printed.wild > 0;
      const result = applyCommand(given.state, play(P1, given.id, [id]), DEPS);
      expect(result.ok, `${icons.name} (${JSON.stringify(printed)}) paying for Crushing Blow`).toBe(should);
      if (result.ok) accepted++;
      else refused++;
    }
    // The hand must hold both kinds, or the check proves one side only.
    expect(accepted).toBeGreaterThan(0);
    expect(refused).toBeGreaterThan(0);
  });
});
