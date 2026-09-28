import { encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  activeVillain,
  hasKeyword,
  statBonus,
  type GameEvent,
  type GameState,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { endTurn, inst, instancesOf, P1, P2, stackEncounterDeck, toHero } from "../../testing/harness.js";
import { driveEvents, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { novaScenario } from "../nova/support.js";
import { playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";
import { spiderHamScenario } from "./support.js";

/**
 * The Inheritors (`spiderham` 30030-30038, `inheritors.ts`): Hunting the Spider-Totems (side scheme) and eight
 * unique Inheritor minions, each printing its own copy of the same set-wide "Each Inheritor minion …" constant and
 * a "When Revealed: if a Web-Warrior character is in play, …" clause.
 *
 * Spider-Ham's own identity (30001a/b) carries the Web-Warrior trait (`packages/content/src/data/spiderham/
 * cards.ts`), so his own precon (`spiderHamScenario`) always has a Web-Warrior character in play — used for every
 * "with a Web-Warrior in play" case below. Nova (`nova` 28001, CHAMPION only, no Web-Warrior trait anywhere in her
 * precon) is used for every "without" case.
 */
const withWebWarrior = (seed = 1) =>
  // Peter Porker's alter-ego face carries CARTOON/CIVILIAN, not Web-Warrior (only Spider-Ham's own hero face does,
  // `packages/content/src/data/spiderham/cards.ts` 30001a vs 30001b) — hero form (by test surgery, `withForm`: a
  // `changeForm` command is once-per-round and P1-turn-only, both moot for what this file needs), so a Web-Warrior
  // character is actually in play.
  withForm(
    startWave5Game(spiderHamScenario("rhino", { seed, modularSetIds: [encounterSetId("inheritors")] })),
    { heroForm: 0 },
    P1,
  );
const withoutWebWarrior = (seed = 1) =>
  startWave5Game(novaScenario("rhino", { seed, modularSetIds: [encounterSetId("inheritors")] }));

/**
 * `stackEncounterDeck` alone isn't enough to make `code` the card a player's own encounter-card reveal step deals:
 * the villain phase's own boost draw (step 2, one per activation) reads from the top of the same deck *first*
 * (RRG 1.8 "Boost", p. 11) — one 0-icon filler (`01186` Advance) ahead of `code` survives it and reaches the real
 * reveal (`armadillo.ts`'s own `stageForReveal` precedent).
 */
const stageForReveal = (state: GameState, ...codes: readonly string[]): GameState =>
  stackEncounterDeck(state, "01186", ...codes);
/**
 * Hunting the Spider-Totems' own Forced Interrupt fires "when the villain phase begins", before step one and
 * before any boost draw (`flow.ts`'s `finishPlayerPhase`: `phaseBeginning` is pushed to resolve "before step one").
 * No filler needed for it specifically.
 */
const stageForPhaseBegin = (state: GameState, ...codes: readonly string[]): GameState =>
  stackEncounterDeck(state, ...codes);

describe("Bora (30031)", () => {
  it("30031.bora-constant: each Inheritor minion gains 1 acceleration icon, stacking with two in play, none from the villain", () => {
    const stepOneThreat = (state: GameState) =>
      driveEvents(WAVE5_DEPS, state, endTurn(P1)).events.find(
        (e): e is Extract<GameEvent, { type: "threatPlaced" }> => e.type === "threatPlaced",
      )?.amount ?? 0;
    const base = withWebWarrior();
    const baseline = stepOneThreat(base);
    const oneInheritor = encounterCardInVillainArea(base, "30031").state; // Bora himself: 1 icon.
    expect(stepOneThreat(oneInheritor) - baseline).toBe(1);
    const twoInheritors = encounterCardInVillainArea(oneInheritor, "30032").state; // + Brix: 2 icons total.
    expect(stepOneThreat(twoInheritors) - baseline).toBe(2);
  });

  it("30031.when-revealed: with a Web-Warrior character in play, places 1 threat on the main scheme, sourced from Bora", () => {
    // Not staging Hunting the Spider-Totems (30030) itself here: its own Forced Interrupt would discard from the
    // very same encounter deck top before this card's own reveal, covered on its own below instead.
    const state = withWebWarrior();
    const card = instancesOf(state, "30031")[0]!;
    const staged = stageForReveal(state, "30031");
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const placed = events.filter(
      (e): e is Extract<GameEvent, { type: "threatPlaced" }> =>
        e.type === "threatPlaced" && e.sourceInstanceId === card,
    );
    expect(placed).toHaveLength(1);
    expect(placed[0]!.amount).toBe(1);
    expect(placed[0]!.schemeInstanceId).toBe(state.mainScheme.instanceId);
  });

  it("30031.when-revealed: without a Web-Warrior character in play, places no threat from this card", () => {
    const state = withoutWebWarrior();
    const card = instancesOf(state, "30031")[0]!;
    const staged = stageForReveal(state, "30031");
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(events.some((e) => e.type === "threatPlaced" && e.sourceInstanceId === card)).toBe(false);
  });
});

describe("Brix (30032)", () => {
  it("30032.brix-constant: each Inheritor minion gains patrol, stacking with two in play, not the villain", () => {
    const state = withWebWarrior();
    const bora = encounterCardInVillainArea(state, "30031");
    const brix = encounterCardInVillainArea(bora.state, "30032");
    expect(hasKeyword(brix.state, bora.id, "patrol", WAVE5_DEPS)).toBe(true);
    expect(hasKeyword(brix.state, brix.id, "patrol", WAVE5_DEPS)).toBe(true);
    expect(hasKeyword(brix.state, activeVillain(brix.state).instanceId, "patrol", WAVE5_DEPS)).toBe(false);
  });

  it("30032.when-revealed: with a Web-Warrior character in play, places 2 threat on the main scheme, sourced from Brix", () => {
    const state = withWebWarrior();
    const card = instancesOf(state, "30032")[0]!;
    const staged = stageForReveal(state, "30032");
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const placed = events.filter(
      (e): e is Extract<GameEvent, { type: "threatPlaced" }> =>
        e.type === "threatPlaced" && e.sourceInstanceId === card,
    );
    expect(placed).toHaveLength(1);
    expect(placed[0]!.amount).toBe(2);
    expect(placed[0]!.schemeInstanceId).toBe(state.mainScheme.instanceId);
  });

  it("30032.when-revealed: without a Web-Warrior character in play, places no threat from this card", () => {
    const state = withoutWebWarrior();
    const staged = stageForReveal(state, "30032");
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const card = instancesOf(state, "30032")[0]!;
    expect(events.some((e) => e.type === "threatPlaced" && e.sourceInstanceId === card)).toBe(false);
  });
});

describe("Daemos (30033)", () => {
  it("30033.daemos-constant: each Inheritor minion gains stalwart, stacking with two in play, not the villain", () => {
    const state = withWebWarrior();
    const daemos = encounterCardInVillainArea(state, "30033");
    const jennix = encounterCardInVillainArea(daemos.state, "30034");
    expect(hasKeyword(jennix.state, daemos.id, "stalwart", WAVE5_DEPS)).toBe(true);
    expect(hasKeyword(jennix.state, jennix.id, "stalwart", WAVE5_DEPS)).toBe(true);
    expect(hasKeyword(jennix.state, activeVillain(jennix.state).instanceId, "stalwart", WAVE5_DEPS)).toBe(false);
  });

  it("30033.when-revealed: with a Web-Warrior character in play, stuns a character you control", () => {
    const state = withWebWarrior();
    const staged = stageForReveal(state, "30033");
    const { state: after } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const identity = after.players.find((p) => p.playerId === P1)!.identity.instanceId;
    expect(inst(after, identity).statuses.stunned).toBeGreaterThanOrEqual(1);
  });

  it("30033.when-revealed: without a Web-Warrior character in play, stuns nobody", () => {
    const state = withoutWebWarrior();
    const staged = stageForReveal(state, "30033");
    const { state: after } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const identity = after.players.find((p) => p.playerId === P1)!.identity.instanceId;
    expect(inst(after, identity).statuses.stunned ?? 0).toBe(0);
  });
});

describe("Jennix (30034)", () => {
  it("30034.jennix-constant: each Inheritor minion gains guard, stacking with two in play, not the villain", () => {
    const state = withWebWarrior();
    const jennix = encounterCardInVillainArea(state, "30034");
    const karn = encounterCardInVillainArea(jennix.state, "30035");
    expect(hasKeyword(karn.state, jennix.id, "guard", WAVE5_DEPS)).toBe(true);
    expect(hasKeyword(karn.state, karn.id, "guard", WAVE5_DEPS)).toBe(true);
    expect(hasKeyword(karn.state, activeVillain(karn.state).instanceId, "guard", WAVE5_DEPS)).toBe(false);
  });

  it("30034.when-revealed: with a Web-Warrior character in play, gives Jennix a tough status card", () => {
    const state = withWebWarrior();
    const jennixId = instancesOf(state, "30034")[0]!;
    const staged = stageForReveal(state, "30034");
    const { state: after } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(inst(after, jennixId).statuses.tough).toBeGreaterThanOrEqual(1);
  });

  it("30034.when-revealed: without a Web-Warrior character in play, gives no tough status card", () => {
    const state = withoutWebWarrior();
    const jennixId = instancesOf(state, "30034")[0]!;
    const staged = stageForReveal(state, "30034");
    const { state: after } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(inst(after, jennixId).statuses.tough ?? 0).toBe(0);
  });
});

describe("Karn (30035)", () => {
  it("30035.karn-constant: each Inheritor minion gains overkill and piercing, stacking with two in play, not the villain", () => {
    const state = withWebWarrior();
    const karn = encounterCardInVillainArea(state, "30035");
    const morlun = encounterCardInVillainArea(karn.state, "30036");
    for (const name of ["overkill", "piercing"] as const) {
      expect(hasKeyword(morlun.state, karn.id, name, WAVE5_DEPS)).toBe(true);
      expect(hasKeyword(morlun.state, morlun.id, name, WAVE5_DEPS)).toBe(true);
      expect(hasKeyword(morlun.state, activeVillain(morlun.state).instanceId, name, WAVE5_DEPS)).toBe(false);
    }
  });

  it("30035.when-revealed: with a Web-Warrior character in play, discards an upgrade you control (Huge Wooden Hammer)", () => {
    const state = withWebWarrior(); // already hero form, so Huge Wooden Hammer is playable.
    const { state: withHammer, id: hammer } = playFromHand(state, "30010", 2); // Huge Wooden Hammer.
    const staged = stageForReveal(withHammer, "30035");
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(
      events.some(
        (e): e is Extract<GameEvent, { type: "cardMoved" }> =>
          e.type === "cardMoved" && e.instanceId === hammer && e.to.kind === "discard",
      ),
    ).toBe(true);
  });

  it("30035.when-revealed: without a Web-Warrior character in play, discards nothing", () => {
    const state = runWave5(withoutWebWarrior(), toHero(P1)); // hero form, so Supernova Helmet is playable.
    const { state: withHelmet, id: helmet } = playFromHand(state, "28009", 1); // Supernova Helmet (an upgrade she controls).
    const staged = stageForReveal(withHelmet, "30035");
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(
      events.some(
        (e): e is Extract<GameEvent, { type: "cardMoved" }> =>
          e.type === "cardMoved" && e.instanceId === helmet && e.to.kind === "discard",
      ),
    ).toBe(false);
  });
});

describe("Morlun (30036)", () => {
  it("30036.morlun-constant: each Inheritor minion gets +1 ATK, stacking with two in play, not the villain", () => {
    const state = withWebWarrior();
    const morlun = encounterCardInVillainArea(state, "30036");
    const solus = encounterCardInVillainArea(morlun.state, "30037");
    expect(statBonus(solus.state, WAVE5_DEPS, morlun.id, "atk")).toBe(1);
    expect(statBonus(solus.state, WAVE5_DEPS, solus.id, "atk")).toBe(1);
    expect(statBonus(solus.state, WAVE5_DEPS, activeVillain(solus.state).instanceId, "atk")).toBe(0);
  });

  it("30036.when-revealed: with a Web-Warrior character in play, takes 2 damage", () => {
    // Read off `damageDealt`'s own `sourceInstanceId` rather than the identity's total damage: the villain's own
    // attack that same villain phase also damages the identity, and this card's own contribution must be read in
    // isolation from that (the exact-effect testing bar, not "damage went up").
    const state = withWebWarrior();
    const card = instancesOf(state, "30036")[0]!;
    const identity = state.players.find((p) => p.playerId === P1)!.identity.instanceId;
    const staged = stageForReveal(state, "30036");
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const dealt = events.filter(
      (e): e is Extract<GameEvent, { type: "damageDealt" }> =>
        e.type === "damageDealt" && e.sourceInstanceId === card && e.targetInstanceId === identity,
    );
    expect(dealt).toHaveLength(1);
    expect(dealt[0]!.amount).toBe(2);
  });

  it("30036.when-revealed: without a Web-Warrior character in play, takes no damage from this card", () => {
    const state = withoutWebWarrior();
    const card = instancesOf(state, "30036")[0]!;
    const identity = state.players.find((p) => p.playerId === P1)!.identity.instanceId;
    const staged = stageForReveal(state, "30036");
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(
      events.some((e) => e.type === "damageDealt" && e.sourceInstanceId === card && e.targetInstanceId === identity),
    ).toBe(false);
  });
});

describe("Solus (30037)", () => {
  it("30037.solus-constant: each Inheritor minion gains villainous, stacking with two in play, not the villain", () => {
    const state = withWebWarrior();
    const solus = encounterCardInVillainArea(state, "30037");
    const verna = encounterCardInVillainArea(solus.state, "30038");
    expect(hasKeyword(verna.state, solus.id, "villainous", WAVE5_DEPS)).toBe(true);
    expect(hasKeyword(verna.state, verna.id, "villainous", WAVE5_DEPS)).toBe(true);
    // The real villain already carries its own printed keywords; "villainous" is only meaningful on a minion.
    expect(hasKeyword(verna.state, activeVillain(verna.state).instanceId, "villainous", WAVE5_DEPS)).toBe(false);
  });

  it("30037.when-revealed: with a Web-Warrior character in play, gives Solus 1 facedown boost card", () => {
    const state = withWebWarrior();
    const solusId = instancesOf(state, "30037")[0]!;
    const staged = stageForReveal(state, "30037");
    const { state: after } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(inst(after, solusId).boostCards.length).toBeGreaterThanOrEqual(1);
  });

  it("30037.when-revealed: without a Web-Warrior character in play, gives Solus no boost card", () => {
    const state = withoutWebWarrior();
    const solusId = instancesOf(state, "30037")[0]!;
    const staged = stageForReveal(state, "30037");
    const { state: after } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(inst(after, solusId).boostCards.length).toBe(0);
  });
});

describe("Verna (30038)", () => {
  it("30038.verna-constant: each Inheritor minion gains retaliate 1, stacking with two in play, not the villain", () => {
    const state = withWebWarrior();
    const verna = encounterCardInVillainArea(state, "30038");
    const bora = encounterCardInVillainArea(verna.state, "30031");
    expect(hasKeyword(bora.state, verna.id, "retaliate", WAVE5_DEPS)).toBe(true);
    expect(hasKeyword(bora.state, bora.id, "retaliate", WAVE5_DEPS)).toBe(true);
    expect(hasKeyword(bora.state, activeVillain(bora.state).instanceId, "retaliate", WAVE5_DEPS)).toBe(false);
  });

  it("30038.when-revealed: with a Web-Warrior character in play, deals 1 damage to each character you control", () => {
    // Read off `damageDealt`'s own `sourceInstanceId`, not the identity's total damage: the villain's own attack
    // that same villain phase also damages the identity (Morlun's own test above has the same isolation).
    const state = withWebWarrior();
    const card = instancesOf(state, "30038")[0]!;
    const identity = state.players.find((p) => p.playerId === P1)!.identity.instanceId;
    const staged = stageForReveal(state, "30038");
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const dealt = events.filter(
      (e): e is Extract<GameEvent, { type: "damageDealt" }> =>
        e.type === "damageDealt" && e.sourceInstanceId === card && e.targetInstanceId === identity,
    );
    expect(dealt).toHaveLength(1);
    expect(dealt[0]!.amount).toBe(1);
  });

  it("30038.when-revealed: without a Web-Warrior character in play, deals no damage from this card", () => {
    const state = withoutWebWarrior();
    const card = instancesOf(state, "30038")[0]!;
    const identity = state.players.find((p) => p.playerId === P1)!.identity.instanceId;
    const staged = stageForReveal(state, "30038");
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(
      events.some((e) => e.type === "damageDealt" && e.sourceInstanceId === card && e.targetInstanceId === identity),
    ).toBe(false);
  });
});

describe("Hunting the Spider-Totems (30030)", () => {
  it("30030.hunting-the-spider-totems-forced-interrupt: discards the top 3 cards of the encounter deck when the villain phase begins", () => {
    const withScheme = encounterCardInVillainArea(withWebWarrior(), "30030");
    // Three ordinary (non-Inheritor) fillers: none of them re-enters play, so this test isolates the discard itself
    // from the "put an Inheritor minion into play" half, covered separately below.
    const staged = stageForPhaseBegin(withScheme.state, "01186", "01107", "01101");
    // The exact instances `stackEncounterDeck` put on top — not `instancesOf`, which (multiple printed copies of
    // these Core "Standard" cards) can return a different copy than the one actually moved.
    const [c1, c2, c3] = staged.encounterDecks[activeEncounterDeckId(staged)]!.deck.slice(0, 3);
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const discarded = events.filter(
      (e): e is Extract<GameEvent, { type: "cardMoved" }> =>
        e.type === "cardMoved" && e.to.kind === "encounterDiscard" && [c1, c2, c3].includes(e.instanceId),
    );
    expect(discarded).toHaveLength(3);
  });

  it("puts an Inheritor minion discarded this way into play engaged with a player who controls a Web-Warrior character, if able", () => {
    // P1 Nova (no Web-Warrior character), P2 Spider-Ham (Web-Warrior) — the first player is P1, so if the ability
    // fell back to "the first player" this would land on P1 instead.
    const base = withForm(
      startWave5Game(
        novaScenario("rhino", {
          seed: 1,
          modularSetIds: [encounterSetId("inheritors")],
          extraPlayers: [{ starterDeckId: "spiderham-justice" }],
        }),
      ),
      { heroForm: 0 },
      P2, // Spider-Ham's own hero face is the one carrying the Web-Warrior trait.
    );
    const withScheme = encounterCardInVillainArea(base, "30030");
    const staged = stageForPhaseBegin(withScheme.state, "30031", "01186", "01107");
    const { state: after } = driveEvents(WAVE5_DEPS, staged, endTurn(P1), endTurn(P2));
    const boraId = instancesOf(after, "30031").find((id) => inst(after, id).engagedWith !== null)!;
    expect(inst(after, boraId).engagedWith).toBe(P2);
  });

  it("otherwise, puts an Inheritor minion discarded this way into play engaged with the first player", () => {
    const withScheme = encounterCardInVillainArea(withoutWebWarrior(), "30030"); // Nova alone: no Web-Warrior character anywhere in play.
    const staged = stageForPhaseBegin(withScheme.state, "30031", "01186", "01107");
    const { state: after } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const boraId = instancesOf(after, "30031").find((id) => inst(after, id).engagedWith !== null)!;
    expect(inst(after, boraId).engagedWith).toBe(P1);
  });
});
