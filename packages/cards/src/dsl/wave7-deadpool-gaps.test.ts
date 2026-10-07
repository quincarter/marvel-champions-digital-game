/**
 * DSL builders for the engine gaps Deadpool's pack pinned (docs/phase7-wave7.md §4.1, §7.3): `keepsExhausted`,
 * `duringTurnOf`, the player-scoped `cannotResolveTriggeredAbilities`, `playedThisPhase` and `takeIntoHand` with
 * `keepOwner`. The engine's `keeps-exhausted-rule`, `turn-of-player-ban`, `played-this-phase` and
 * `take-into-hand-keep-owner` tests drive the compiled specs.
 */

import { describe, expect, it } from "vitest";
import {
  cannotResolveTriggeredAbilities,
  cards,
  chosen,
  constant,
  defineAbilities,
  duringTurnOf,
  isHero,
  keepsExhausted,
  not,
  otherPlayers,
  playedThisPhase,
  playOnlyIf,
  query,
  rule,
  takeIntoHand,
  you,
} from "./index.js";
import { validateDefinition } from "./validate.js";

describe("keepsExhausted", () => {
  const allies = query("ally", { controller: "you" });
  it("compiles to the engine's rule, with its condition when one is given", () => {
    expect(keepsExhausted(allies)).toEqual({
      rules: [{ kind: "keepsExhausted", target: { categories: ["ally"], controller: "you" } }],
    });
    expect(keepsExhausted(allies, { while: isHero() })).toEqual({
      rules: [{ kind: "keepsExhausted", target: allies, while: isHero() }],
    });
  });
  it("sits in one constant beside 'cannot ready', and validates", () => {
    const registry = defineAbilities({
      "44032.x-constant": constant(keepsExhausted(allies), rule({ kind: "cannotReady", target: allies })),
    });
    expect(registry["44032.x-constant"]).toEqual({
      trigger: {
        kind: "constant",
        rules: [
          { kind: "keepsExhausted", target: allies },
          { kind: "cannotReady", target: allies },
        ],
      },
      effects: [],
    });
    expect(validateDefinition(registry["44032.x-constant"]!)).toEqual([]);
  });
});

describe("duringTurnOf", () => {
  it("is 'during your turn' by default and names another player when given one", () => {
    expect(duringTurnOf()).toEqual({ kind: "turnOf", player: { kind: "controller" } });
    expect(duringTurnOf(otherPlayers())).toEqual({
      kind: "turnOf",
      player: { kind: "others", of: { kind: "controller" } },
    });
  });
});

describe("cannotResolveTriggeredAbilities scoped to players and to player cards", () => {
  it("'Other players cannot resolve player card abilities during your turn'", () => {
    const ban = cannotResolveTriggeredAbilities(
      {},
      { player: otherPlayers(), playerCards: true, while: duringTurnOf() },
    );
    expect(ban).toEqual({
      rules: [
        {
          kind: "cannotResolveTriggeredAbilities",
          on: {},
          player: { kind: "others", of: { kind: "controller" } },
          playerCards: true,
          while: { kind: "turnOf", player: { kind: "controller" } },
        },
      ],
    });
    const registry = defineAbilities({ "44032.x-constant": constant(ban) });
    expect(validateDefinition(registry["44032.x-constant"]!)).toEqual([]);
  });
  it("leaves both fields out when they are not asked for", () => {
    expect(cannotResolveTriggeredAbilities(query("identity"))).toEqual({
      rules: [{ kind: "cannotResolveTriggeredAbilities", on: { categories: ["identity"] } }],
    });
  });
});

describe("playedThisPhase", () => {
  const any = query(["ally", "event", "upgrade", "support", "resource"]);
  it("is your own plays by default, at least one", () => {
    expect(playedThisPhase(any)).toEqual({ kind: "playedThisPhase", player: { kind: "controller" }, cards: any });
  });
  it("takes another player and a count", () => {
    expect(playedThisPhase(query("event"), { player: otherPlayers(), atLeast: 2 })).toEqual({
      kind: "playedThisPhase",
      player: { kind: "others", of: { kind: "controller" } },
      cards: { categories: ["event"] },
      atLeast: 2,
    });
  });
  it("as a play restriction: 'You cannot play this card if you have played another card this phase'", () => {
    const registry = defineAbilities({ "44032.x-constant": constant(playOnlyIf(not(playedThisPhase(any)))) });
    expect(registry["44032.x-constant"]!.trigger).toEqual({
      kind: "constant",
      playOnlyIf: { kind: "not", of: { kind: "playedThisPhase", player: { kind: "controller" }, cards: any } },
    });
    expect(validateDefinition(registry["44032.x-constant"]!)).toEqual([]);
  });
});

describe("takeIntoHand with keepOwner", () => {
  it("is absent by default (the taker becomes the owner) and set when asked for", () => {
    expect(takeIntoHand(cards(chosen("banked")))).toEqual({
      kind: "takeIntoHand",
      cards: { kind: "ref", ref: { kind: "slot", slot: "banked" } },
      player: { kind: "controller" },
    });
    expect(takeIntoHand(cards(chosen("banked")), you, { keepOwner: true })).toEqual({
      kind: "takeIntoHand",
      cards: { kind: "ref", ref: { kind: "slot", slot: "banked" } },
      player: { kind: "controller" },
      keepOwner: true,
    });
  });
});
