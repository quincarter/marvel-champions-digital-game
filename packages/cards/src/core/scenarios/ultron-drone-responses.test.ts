import { cardId } from "@mc/content";
import { createGame, type GameState, type InstanceId } from "@mc/engine";
import { PLAYABLE_DEPS, playableScenario, playableStarterDeckSetup } from "../../playable/index.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";

/**
 * Issue #228: an Ultron Drone is a player card facedown as a minion, and once an attack defeats it, it is that player
 * card again in its owner's discard pile. "After [X] attacks [and defeats] a minion / an enemy" reads the target as the
 * attack damaged it (`TargetSnapshot.was`), so these responses still see a minion. The same holds for an ally an
 * attachment treats as a minion (Beguiled, Fallen Warrior): defeated, it is an ally in its owner's discard pile again.
 */
const D = PLAYABLE_DEPS;

/** Thor (Aggression) against Ultron, in hero form, with these extra cards in his deck. */
function thorVsUltron(extra: readonly string[] = [], modularSetIds?: readonly string[]): GameState {
  const seat = playableStarterDeckSetup("thor-aggression");
  const config = {
    ...playableScenario("ultron", {
      players: [{ ...seat, deck: [...seat.deck, ...extra.map((c) => cardId(c))] }],
      seed: 8,
      ...(modularSetIds ? { modularSetIds } : {}),
    }),
    requireLegalDecks: false,
  };
  const created = createGame(config, D);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", D);
  return settle(runWith(D, opened, toHero(P1)), firstLegal, undefined, D);
}

function playFromDeck(state: GameState, code: string, cost: number): { state: GameState; id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const after = settle(
    runWith(D, given.state, play(P1, id, payWith(given.state, P1, cost, [id]))),
    firstLegal,
    undefined,
    D,
  );
  return { state: after, id };
}

const droneOf = (state: GameState): InstanceId => {
  const drone = playerOf(state, P1).playArea.find((id) => inst(state, id).facedownAs !== null);
  if (!drone) throw new Error("no facedown Drone engaged with P1");
  return drone;
};

/** Every option offered along the way, and a picker that takes the option whose id contains `wanted`. */
function taking(wanted: string): { readonly pick: Picker; readonly offered: string[] } {
  const offered: string[] = [];
  const pick: Picker = (state) => {
    const options = state.pendingChoice?.options ?? [];
    offered.push(...options.map((o) => o.optionId));
    const hit = options.find((o) => o.optionId.includes(wanted));
    return hit ? [hit.optionId] : firstLegal(state);
  };
  return { pick, offered };
}

const attackWith = (state: GameState, attacker: InstanceId, target: InstanceId, pick: Picker) =>
  settle(
    runWith(D, state, { type: "basicAttack", playerId: P1, attackerInstanceId: attacker, targetInstanceId: target }),
    pick,
    undefined,
    D,
  );

describe("responses to an attack that defeats an Ultron Drone (issue #228)", () => {
  it("Battle Fury: after Thor attacks and defeats a Drone, readies him", () => {
    const { state } = playFromDeck(thorVsUltron(), "06018", 1);
    const drone = droneOf(state);
    const { pick, offered } = taking("06018.battle-fury-response");
    const after = attackWith(state, identityOf(state), drone, pick);
    expect(offered.some((id) => id.includes("06018.battle-fury-response"))).toBe(true);
    expect(playerOf(after, P1).playArea).not.toContain(drone);
    expect(playerOf(after, P1).discard).toContain(drone);
    expect(inst(after, identityOf(after)).exhausted).toBe(false);
  });

  it("Jarnbjorn: after Thor attacks a Drone (and defeats it), its response is offered", () => {
    const { state } = playFromDeck(thorVsUltron(), "06019", 2);
    const drone = droneOf(state);
    const { pick, offered } = taking("never-pick");
    attackWith(state, identityOf(state), drone, pick);
    expect(offered.some((id) => id.includes("06019.jarnbjorn-response"))).toBe(true);
  });

  it("Tigra: after she attacks and defeats a Drone, heals 1 damage from her", () => {
    const { state: withTigra, id: tigra } = playFromDeck(thorVsUltron(["01051"]), "01051", 3);
    const state = {
      ...withTigra,
      instances: { ...withTigra.instances, [tigra]: { ...inst(withTigra, tigra), damage: 1 } },
    };
    const drone = droneOf(state);
    const { pick, offered } = taking("01051.tigra-response");
    const after = attackWith(state, tigra, drone, pick);
    expect(offered.some((id) => id.includes("01051.tigra-response"))).toBe(true);
    // 1 damage, +1 consequential damage from her attack, -1 healed.
    expect(inst(after, tigra).damage).toBe(1);
  });
  it("Battle Fury: after Thor attacks and defeats an ally Beguiled treats as a minion, readies him", () => {
    let state = thorVsUltron([], ["enchantress"]);
    for (const [code, cost] of [
      ["06018", 1],
      ["06012", 3],
    ] as const)
      state = playFromDeck(state, code, cost).state;
    const valkyrie = instancesOf(state, "06012").find((id) => playerOf(state, P1).playArea.includes(id))!;
    // Beguiled (21178) is revealed in the villain phase and attaches to the highest-cost ally, Valkyrie.
    const revealed = settle(
      runWith(D, stackEncounterDeck(state, "01186", "21178"), endTurn(P1)),
      firstLegal,
      (s) => s.step.phase === "player" && s.pendingChoice === null,
      D,
    );
    expect(inst(revealed, valkyrie).treatedAs?.kind).toBe("minion");
    const wounded = {
      ...revealed,
      instances: { ...revealed.instances, [valkyrie]: { ...inst(revealed, valkyrie), damage: 3 } },
    };
    const { pick, offered } = taking("06018.battle-fury-response");
    const after = attackWith(wounded, identityOf(wounded), valkyrie, pick);
    expect(offered.some((id) => id.includes("06018.battle-fury-response"))).toBe(true);
    expect(playerOf(after, P1).discard).toContain(valkyrie);
    expect(inst(after, identityOf(after)).exhausted).toBe(false);
  });
});
