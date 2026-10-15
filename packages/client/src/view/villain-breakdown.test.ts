import { describe, expect, test } from "vitest";
import type { InstanceId, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { activationHeadline, boostCell, breakdownLineOf } from "./villain-breakdown.js";
import type { ActivationBeat } from "./villain-walkthrough.js";

describe("boostCell", () => {
  test("one boost card is just the icon total", () => {
    expect(boostCell(1, 2)).toEqual({ label: "BOOST", value: "2" });
    expect(boostCell(0, 0)).toEqual({ label: "BOOST", value: "0" });
  });

  test("two boost cards keep the count out of the label, so the line reads without a stray multiplication", () => {
    const { label, value } = boostCell(2, 0);
    expect(`SCH 2 + ${label} ${value} = THREAT 2`).toBe("SCH 2 + BOOST 0 (2 cards) = THREAT 2");
  });
});

async function table() {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
    seed: 7,
  });
  return store.state.game!;
}

describe("the activation's headline and breakdown", () => {
  test("a headline names the hero by the short name, the viewer as you", async () => {
    const game = await table();
    const [spider, shehulk] = game.players;
    const villain = game.villains[0]!.instanceId;
    const attack = (playerId: PlayerId): ActivationBeat => ({
      kind: "attack",
      enemyInstanceId: villain,
      attackedPlayerId: playerId,
      boosts: [],
      defender: null,
      resolved: null,
    });
    expect(activationHeadline(attack(spider!.playerId), game, shehulk!.playerId)).toBe("Rhino attacks Spider-Man");
    expect(activationHeadline(attack(spider!.playerId), game, spider!.playerId)).toBe("Rhino attacks You");
  });

  test("a scheme's breakdown line says which scheme took the threat", async () => {
    const game = await table();
    const scheme = game.mainScheme.instanceId as InstanceId;
    const activation: ActivationBeat = {
      kind: "scheme",
      enemyInstanceId: game.villains[0]!.instanceId,
      playerId: game.players[0]!.playerId,
      boosts: [{ instanceId: "b1" as InstanceId, boostIcons: 1, cancelled: null }],
      resolved: { schemeInstanceId: scheme, baseSch: 2, boostIcons: 1, threatBonus: 0, threatPlaced: 3 },
    };
    const line = breakdownLineOf(activation, game)!;
    expect(line).toMatch(/^SCH 2 \+ BOOST 1 = THREAT 3 → .+/);
    expect(breakdownLineOf({ ...activation, resolved: null }, game)).toBeNull();
  });

  test("an attack's breakdown line has no destination", async () => {
    const game = await table();
    const attack: ActivationBeat = {
      kind: "attack",
      enemyInstanceId: game.villains[0]!.instanceId,
      attackedPlayerId: game.players[0]!.playerId,
      boosts: [],
      defender: null,
      resolved: {
        targetInstanceId: game.players[0]!.identity.instanceId,
        baseAtk: 2,
        boostIcons: 1,
        defenseReduction: 3,
        damageDealt: 0,
      },
    };
    expect(breakdownLineOf(attack, game)).toBe("BASE 2 + BOOST 1 − DEFENSE 3 = DAMAGE 0");
  });
});
