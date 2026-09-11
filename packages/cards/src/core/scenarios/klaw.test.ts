import { characterProfile, type GameState, type InstanceId } from "@mc/engine";
import { CORE_DEPS } from "../index.js";
import { coreScenario } from "../setup.js";
import {
  answer,
  endTurn,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  playerOf,
  run,
  settle,
  settleUntil,
  stackEncounterDeck,
  startCoreGame,
  toHero,
} from "../../testing/harness.js";

const vsKlaw = (difficulty: "standard" | "expert" = "standard", modularSetIds?: readonly string[]) =>
  startCoreGame(coreScenario("klaw", { difficulty, ...(modularSetIds ? { modularSetIds } : {}), players: [{ starterDeckId: "core-she-hulk-aggression" }], seed: 5 }));
const typeOf = (state: GameState, id: InstanceId) => state.cardPool[inst(state, id).cardId]?.type;
const minionsOf = (state: GameState) => playerOf(state, P1).playArea.filter((id) => typeOf(state, id) === "minion");

describe("coreScenario('klaw')", () => {
  it("setup: Defense Network is revealed, then 1B puts the first minion discarded into play engaged with the first player", () => {
    const state = vsKlaw();
    const network = instancesOf(state, "01125")[0] as InstanceId;
    expect(state.villainArea).toContain(network);
    expect(inst(state, network).threat).toBe(3);
    expect(minionsOf(state)).toHaveLength(1);
  });

  it("expert: Klaw (II) reveals The \"Immortal\" Klaw, which gives him +10 hit points while it's in play", () => {
    const state = vsKlaw("expert");
    expect(state.villainArea).toContain(instancesOf(state, "01127")[0]);
    expect(characterProfile(state, state.villain.instanceId, CORE_DEPS)?.maxHp).toBe(18 + 10);
  });
});

describe("Klaw encounter set", () => {
  it("Weapons Runner's boost puts it into play engaged with the attacked player instead of being discarded", () => {
    const stacked = stackEncounterDeck(vsKlaw(), "01121", "01186", "01186");
    const runner = stacked.encounterDeck[0] as InstanceId;
    const after = settle(run(settle(run(stacked, toHero())), endTurn()));
    expect(playerOf(after, P1).playArea).toContain(runner);
    expect(inst(after, runner).engagedWith).toBe(P1);
    expect(after.encounterDiscard).not.toContain(runner);
  });

  it("Sonic Boom: declining to spend [E][M][P] exhausts each character you control", () => {
    const atPrompt = settleUntil(run(stackEncounterDeck(vsKlaw(), "01186", "01123"), endTurn()), "spendResources");
    expect(atPrompt.pendingChoice?.prompt).toEqual({ kind: "spendResources", requirement: { generic: 0, physical: 1, mental: 1, energy: 1 } });
    const after = settle(answer(atPrompt, []));
    expect(inst(after, identityOf(after)).exhausted).toBe(true);
  });

  it("Sonic Boom: paying [E][M][P] spends them and exhausts nothing", () => {
    const given = moveToHand(vsKlaw(), P1, "01088", "01089", "01090"); // Energy, Genius, Strength
    const atPrompt = settleUntil(run(stackEncounterDeck(given.state, "01186", "01123"), endTurn()), "spendResources");
    const after = settle(answer(atPrompt, given.ids.map((id) => `hand:${id}`)));
    expect(inst(after, identityOf(after)).exhausted).toBe(false);
    expect(playerOf(after, P1).discard).toEqual(expect.arrayContaining([...given.ids]));
  });
});

describe("Legions of Hydra modular set", () => {
  it("Legions of Hydra fetches Madame Hydra; she can't take damage while it's in play; her scheming adds 2 threat to it", () => {
    const round2 = settle(run(stackEncounterDeck(vsKlaw("standard", ["legions_of_hydra"]), "01186", "01180"), endTurn()));
    const madame = instancesOf(round2, "01181")[0] as InstanceId;
    const legions = instancesOf(round2, "01180").find((id) => round2.villainArea.includes(id)) as InstanceId;
    expect(inst(round2, madame).engagedWith).toBe(P1);
    // 3 + 2 for each Hydra enemy in play (Madame Hydra at least).
    expect(inst(round2, legions).threat).toBeGreaterThanOrEqual(5);
    const attacked = settle(run(settle(run(round2, toHero())), { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(round2), targetInstanceId: madame }));
    expect(inst(attacked, madame).damage).toBe(0);
    // Alter-ego: Madame Hydra schemes in the villain phase (the hazard icon deals two cards; both harmless here).
    const round3 = settle(run(stackEncounterDeck(round2, "01186", "01120", "01120"), endTurn()));
    expect(inst(round3, legions).threat - inst(round2, legions).threat).toBe(2);
  });
});
