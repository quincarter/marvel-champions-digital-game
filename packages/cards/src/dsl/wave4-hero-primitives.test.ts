/**
 * docs/phase7-wave4.md §3.17–§3.22: the DSL builders for the hero-pack and The Hood primitives of cycle 3. Each
 * composition is the one the spec gives the scripter for a printed card; this file proves each validates and emits the
 * plain data the per-primitive engine test drives.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import {
  action,
  constant,
  exhaustEachCost,
  forcedInterrupt,
  gets,
  heroAction,
  heroInterrupt,
  interrupt,
  on,
  whenRevealed,
  response,
  setup,
} from "./abilities.js";
import {
  cards,
  damageAnEnemy,
  dealDamage,
  declareDefender,
  draw,
  ifThen,
  modifyAttack,
  moveCards,
  playSetAside,
  preventDamage,
  ready,
  resolveAttackAgainst,
  zone,
  shuffleInSetAsideModularSet,
  addAccelerationToken,
  endGame,
  flipCard,
} from "./effects.js";
import { validateDefinition } from "./validate.js";
import {
  attackInProgress,
  chosen,
  each,
  eventSource,
  ifElse,
  query,
  refMatches,
  self,
  statOf,
  sum,
  you,
  YOUR_IDENTITY,
  yourIdentity,
  setAsideModularSetCount,
  valueEquals,
} from "./values.js";

const valid = (definition: Parameters<typeof validateDefinition>[0]) =>
  expect(validateDefinition(definition)).toEqual([]);
const AVENGER = trait("AVENGER");
const GUARDIAN = trait("GUARDIAN");
const avengerAndGuardian = exhaustEachCost({
  avenger: query(["identity", "ally"], { trait: AVENGER }),
  guardian: query(["identity", "ally"], { trait: GUARDIAN }),
});
const combined = (stat: "atk" | "thw") => sum(statOf(chosen("avenger"), stat), statOf(chosen("guardian"), stat));

describe("§3.17 Alliance: 'Exhaust an [Avenger] character and a [Guardian] character →' (exhaustEachCost)", () => {
  it("emits one pick per slot, each of exactly one card", () => {
    expect(avengerAndGuardian).toEqual({
      exhaustCards: [
        { slot: "avenger", query: { categories: ["identity", "ally"], trait: AVENGER }, min: 1, max: 1 },
        { slot: "guardian", query: { categories: ["identity", "ally"], trait: GUARDIAN }, min: 1, max: 1 },
      ],
    });
  });

  it("As One! (23032): the combined ATK of those characters reads both slots", () => {
    valid(heroAction({ label: "attack", cost: avengerAndGuardian }, damageAnEnemy(combined("atk"))));
  });

  it("Stand Together (23034): a hero interrupt with the two-slot cost validates", () => {
    valid(
      heroInterrupt(
        on.damage(query(["identity", "ally"]), { fromAttack: true }),
        { cost: avengerAndGuardian },
        preventDamage(),
        dealDamage(1, eventSource),
      ),
    );
  });

  it("refuses a single slot: that is exhaustCardsCost", () => {
    expect(() => exhaustEachCost({ avenger: query("ally") })).toThrow(/two slots/);
  });

  it("the validator knows both slots: reading an unbound slot is an error, reading a bound one is not", () => {
    valid(heroAction({ cost: avengerAndGuardian }, ready(chosen("guardian")), draw(1)));
    expect(validateDefinition(heroAction({ cost: avengerAndGuardian }, ready(chosen("other"))))).not.toEqual([]);
  });
});

const DEATH_GLOW = query("upgrade", { name: "Death-Glow" });
const WITH_GLOW = query("enemy", { hasAttachment: DEATH_GLOW });

describe("§3.22 Valkyrie's kit", () => {
  it("Valkyrie (25001a/b): Setup sets Death-Glow aside; Death Perception plays it from there; 'Not this Day.' sets it aside again", () => {
    valid(setup(moveCards(zone("deck", you, { filter: DEATH_GLOW }), "setAside")));
    const perception = heroAction(playSetAside(DEATH_GLOW));
    expect(perception.effects).toEqual([
      {
        kind: "playFromHand",
        player: you,
        from: "setAside",
        costReduction: { kind: "const", value: 0 },
        filter: DEATH_GLOW,
      },
    ]);
    valid(perception);
    valid(action(moveCards(cards(each(DEATH_GLOW)), "setAside")));
  });

  it("Death-Glow (25002): set aside when its enemy is defeated; ready Valkyrie if she (or an extension of her) defeated it", () => {
    valid(
      forcedInterrupt(
        on.defeated("host"),
        moveCards(cards(self), "setAside"),
        ifThen(refMatches(eventSource, query([], { extensionOf: you }), { anywhere: true }), ready(yourIdentity)),
      ),
    );
  });

  it("Flight of the Valkyrior (25008) / Valhalla (25004): 'the enemy with Death-Glow' read after it was defeated", () => {
    const flight = response(on.defeated(query("enemy"), { withAttachment: DEATH_GLOW }), draw(1));
    expect(flight.trigger).toMatchObject({ on: { on: "characterDefeated", targetHadAttachment: DEATH_GLOW } });
    valid(flight);
    valid(response(on.defeated(query("enemy"), { byAttackFrom: YOUR_IDENTITY, withAttachment: DEATH_GLOW }), draw(1)));
  });

  it("Dragonfang (25006) / Valkyrie's Spear (25005): while attacking / defending against the Death-Glow enemy", () => {
    valid(
      constant(
        gets("atk", ifElse(attackInProgress({ attacker: YOUR_IDENTITY, target: WITH_GLOW }), 2, 1), YOUR_IDENTITY),
      ),
    );
    valid(
      constant(
        gets("def", ifElse(attackInProgress({ attacker: WITH_GLOW, defender: YOUR_IDENTITY }), 2, 1), YOUR_IDENTITY),
      ),
    );
  });

  it("Shieldmaiden (25011), The Best Defense… (25020), Thor (25013)", () => {
    valid(heroInterrupt(on.enemyAttacks(WITH_GLOW), { label: "defense" }, declareDefender(yourIdentity)));
    expect(declareDefender(chosen("ally"), { exhaust: true })).toEqual({
      kind: "declareDefender",
      character: chosen("ally"),
      exhaust: true,
    });
    valid(
      heroInterrupt(
        on.basicPowerUsing(YOUR_IDENTITY, { power: "defense" }),
        { label: "defense" },
        modifyAttack({ defenseUsesAtk: true }),
      ),
    );
    valid(
      interrupt(
        { on: "attack", selfIs: "source", targetIs: query("minion", { engagedWith: "you" }) },
        { cost: { resources: { energy: 1 } } },
        resolveAttackAgainst(each(query("minion", { engagedWith: "you" }))),
      ),
    );
  });
});

describe("§3.18 set-aside modular sets", () => {
  it("Making Connections 1A (24004a) Setup, Promised Prosperity 2A: shuffle in one set-aside modular set at random", () => {
    expect(shuffleInSetAsideModularSet()).toEqual({ kind: "shuffleInSetAsideModularSet" });
    valid(setup(shuffleInSetAsideModularSet()));
    valid(whenRevealed(shuffleInSetAsideModularSet(), addAccelerationToken()));
  });

  it("Wheel of Genres (39026a): 'if there are no set-aside modular encounter sets remaining, the players lose'", () => {
    valid(whenRevealed(ifThen(valueEquals(setAsideModularSetCount, 0), endGame("loss"), flipCard(self))));
  });
});
