import { activeVillain } from "@mc/engine";
import {
  firstLegal,
  inst,
  instancesOf,
  P1,
  patchInstance,
  payWith,
  settle,
  stackEncounterDeck,
  use,
} from "../../testing/harness.js";
import { wave3Scenario } from "../setup.js";
import { encounterCardInVillainArea, runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

/**
 * Brotherhood of Badoon (docs/phase7-wave3.md §2.2): the villain Drang, Terrestrial Invasion, Badoon Ship, Drang's
 * Spear, Badoon Engineer, the four side schemes, and the Band of Badoon modular set.
 */

const brotherhoodOfBadoon = () =>
  startWave3Game(
    wave3Scenario("brotherhood-of-badoon", { players: [{ starterDeckId: "groot-protection" }], seed: 2026 }),
  );

describe("Brotherhood of Badoon 1A Setup (16061a.setup)", () => {
  it("puts the Badoon Ship environment and the Milano support into play", () => {
    const state = brotherhoodOfBadoon();
    const [ship] = instancesOf(state, "16063");
    const [milano] = instancesOf(state, "16142");
    expect(ship).toBeDefined();
    expect(milano).toBeDefined();
    expect(state.villainArea).toContain(ship);
    expect(state.players.some((p) => p.playArea.includes(milano!))).toBe(true);
    expect(inst(state, milano!).controllerId).toBe(P1);
  });
});

describe("Badoon Ship — Charge Up (16063.charge-up) via Drang's own Forced Response (16058.drang-forced-response)", () => {
  it("places a barrage counter over a villain phase (Drang schemes in alter-ego form)", () => {
    const state = brotherhoodOfBadoon();
    const [ship] = instancesOf(state, "16063");
    expect(state.players[0]!.identity.form).toBe("alterEgo"); // Drang schemes, not attacks, this villain phase
    const afterPhase = settle(runWave3(state, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE3_DEPS);
    expect(inst(afterPhase, ship!).counters.barrage ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("at 4+ counters, deals 2 indirect damage to each player and clears back down below 4", () => {
    const state = brotherhoodOfBadoon();
    const [ship] = instancesOf(state, "16063");
    const withCounters = patchInstance(state, ship!, { counters: { barrage: 3 } });
    const identity = state.players[0]!.identity.instanceId;
    const damageBefore = inst(withCounters, identity).damage;
    const afterPhase = settle(
      runWave3(withCounters, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(afterPhase, ship!).counters.barrage ?? 0).toBeLessThan(4);
    expect(inst(afterPhase, identity).damage).toBeGreaterThanOrEqual(damageBefore + 2);
  });
});

describe("Terrestrial Invasion 1B — First Player Action (16061b.terrestrial-invasion-constant)", () => {
  it("exhausting the Milano removes 3 threat from the main scheme", () => {
    const state = brotherhoodOfBadoon();
    const [milano] = instancesOf(state, "16142");
    const before = inst(state, state.mainScheme.instanceId).threat;
    const used = runWave3(
      state,
      use(P1, state.mainScheme.instanceId, "16061b.terrestrial-invasion-constant", [], { exhausted: [milano!] }),
    );
    expect(inst(used, milano!).exhausted).toBe(true);
    expect(inst(used, state.mainScheme.instanceId).threat).toBe(Math.max(0, before - 3));
  });
});

describe("Drang's Spear (16064)", () => {
  it("grants Drang stalwart, shedding a stunned status the moment it's attached (16064.drangs-spear-constant)", () => {
    const state = brotherhoodOfBadoon();
    const villain = activeVillain(state)!.instanceId;
    const stunned = patchInstance(state, villain, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const { state: staged, id: spear } = encounterCardInVillainArea(stunned, "16064");
    const attached = {
      ...staged,
      instances: { ...staged.instances, [spear]: { ...inst(staged, spear), attachedTo: villain } },
    };
    // `checkStateTriggers` sheds a status a `cannotHaveStatus`/stalwart character can't hold, on the next sweep;
    // driving a no-op command is enough to force one.
    const settled = runWave3(attached, { type: "noop", playerId: P1 } as never);
    expect(inst(settled, villain).statuses.stunned).toBe(0);
  });

  it("Hero Action: spend [mental][physical][physical] resources → discard this card", () => {
    const state = brotherhoodOfBadoon();
    // Drang schemes this villain phase (alter-ego form): stacking 16064 behind a filler treachery reveals it as an
    // ordinary encounter card (docs/card-scripting-process.md's `stackSetAsideBehindBoost` lesson — the villain's
    // own boost draw eats the very top card first).
    const staged = stackEncounterDeck(state, "01186", "16064");
    const [spear] = instancesOf(staged, "16064");
    const villain = activeVillain(staged)!.instanceId;
    const revealed = settle(runWave3(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE3_DEPS);
    expect(inst(revealed, spear!).attachedTo).toBe(villain);
    const heroForm = {
      ...revealed,
      players: revealed.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const cards = payWith(heroForm, P1, 3);
    const paid = runWave3(
      heroForm,
      use(
        P1,
        spear!,
        "16064.drangs-spear-action",
        cards.map((fromHand) => ({ fromHand })),
      ),
    );
    expect(inst(paid, spear!).attachedTo).toBeNull();
  });
});

describe("Blockade, Bombardment, Oppressive Armada, Spatial Positioning — First Player Action", () => {
  const testExhaustMilanoRemovesThreat = (code: string, abilityId: string) => {
    const state = brotherhoodOfBadoon();
    const [milano] = instancesOf(state, "16142");
    const { state: staged, id: scheme } = encounterCardInVillainArea(state, code, 5);
    const used = runWave3(staged, use(P1, scheme, abilityId, [], { exhausted: [milano!] }));
    expect(inst(used, scheme).threat).toBe(2);
    expect(inst(used, milano!).exhausted).toBe(true);
  };

  it("Blockade (16066.blockade-constant)", () => testExhaustMilanoRemovesThreat("16066", "16066.blockade-constant"));
  it("Bombardment (16067.bombardment-constant)", () =>
    testExhaustMilanoRemovesThreat("16067", "16067.bombardment-constant"));
  it("Oppressive Armada (16068.oppressive-armada-constant)", () =>
    testExhaustMilanoRemovesThreat("16068", "16068.oppressive-armada-constant"));
  it("Spatial Positioning (16069.spatial-positioning-constant)", () =>
    testExhaustMilanoRemovesThreat("16069", "16069.spatial-positioning-constant"));
});
