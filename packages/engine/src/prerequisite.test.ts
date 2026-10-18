/**
 * Prerequisite (form or trait) (docs/phase7-wave11-hero-packs.md §H3.18; Defend Our City 61029, "Prerequisite
 * ([Defender])"). Fear No Evil rulebook p. 3: "In order for a player to play a card with prerequisite …, their identity
 * must be in the specified form … or have the specified trait." A play restriction: a card put into play is not asked
 * (RRG 1.8 "Put into Play", p. 32). A gained trait counts (RRG 1.8 "Gains"). Synthetic cards only.
 */

import { trait, type AbilityReference, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityTriggerSpec, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubSupport } from "./testing/fixtures.js";
import { DEFAULT_DECK, giveCard, HERO, newGame } from "./testing/scenario.js";

const DEFENDER = trait("DEFENDER");
const SPY = trait("SPY");

const abilities: StubAbility[] = [];
const register = (ability: StubAbility): AbilityReference => {
  abilities.push(ability);
  return ability.ref;
};
const constant = (id: string, spec: Omit<Extract<AbilityTriggerSpec, { kind: "constant" }>, "kind">) =>
  register(stubAbility(id, { trigger: { kind: "constant", ...spec }, effects: [] }));
const action = (id: string, effects: readonly EffectSpec[]) =>
  register(stubAbility(id, { trigger: { kind: "action" }, effects }));

/** "Prerequisite ([Defender])." */
const CITY = stubSupport({ id: "city", cost: 0, keywords: [{ name: "prerequisite", traits: [DEFENDER] }] });
/** "Prerequisite ([Defender] or [Spy])." Any one of the traits meets it. */
const EITHER = stubSupport({ id: "either", cost: 0, keywords: [{ name: "prerequisite", traits: [DEFENDER, SPY] }] });
/** "Prerequisite (hero form)." */
const SUITED = stubSupport({ id: "suited", cost: 0, keywords: [{ name: "prerequisite", form: "hero" }] });
/** "Your identity gains the [Spy] trait." */
const BADGE = stubSupport({
  id: "badge",
  cost: 0,
  abilities: [
    constant("badge.constant", {
      traitGrants: [{ trait: SPY, target: { categories: ["identity"], controller: "you" } }],
    }),
  ],
});
/** "Action: Put a City in your hand into play." */
const DROP = stubSupport({
  id: "drop",
  cost: 0,
  abilities: [
    action("drop.action", [
      {
        kind: "selectCards",
        slot: "found",
        cards: { kind: "zone", zone: "hand", player: { kind: "controller" }, filter: { name: "city" } },
      },
      { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: { kind: "controller" } },
    ]),
  ],
});
/** The default hero with the Defender trait on both faces. */
const DEFENDER_HERO = {
  ...HERO,
  hero: { ...HERO.hero, traits: [DEFENDER] },
  alterEgo: { ...HERO.alterEgo, traits: [DEFENDER] },
};

const CARDS: readonly AnyCard[] = [CITY, EITHER, SUITED, BADGE, DROP];
const deps: EngineDeps = depsOf(...abilities);

function game(identity = HERO): GameState {
  return newGame({
    identity,
    deps,
    extraCards: [...CARDS],
    deck: [...DEFAULT_DECK, ...CARDS.flatMap((card) => [card.id, card.id])],
  });
}

const play = (player: PlayerId, id: InstanceId): Command => ({
  type: "playCard",
  playerId: player,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const P = (state: GameState) => state.players[0]!.playerId;
const inPlay = (state: GameState, id: InstanceId) => mustPlayer(state, P(state)).playArea.includes(id);

/** Test surgery: a copy of `card` straight into the first player's play area. */
function place(state: GameState, card: CardId): GameState {
  const given = giveCard(state, P(state), card);
  const s = given.state;
  return {
    ...s,
    players: s.players.map((p) =>
      p.playerId === P(s)
        ? { ...p, hand: p.hand.filter((x) => x !== given.id), playArea: [...p.playArea, given.id] }
        : p,
    ),
    instances: { ...s.instances, [given.id]: { ...mustInstance(s, given.id), faceup: true, controllerId: P(s) } },
  };
}

describe("docs/phase7-wave11-hero-packs.md §H3.18: Prerequisite (form or trait)", () => {
  it("a Defender plays it", () => {
    const given = giveCard(game(DEFENDER_HERO), P(game(DEFENDER_HERO)), CITY.id);
    const result = applyCommand(given.state, play(P(given.state), given.id), deps);
    expect(result.ok).toBe(true);
    if (result.ok) expect(inPlay(result.state, given.id)).toBe(true);
  });

  it("a non-Defender cannot, with a reason a player can read, and legalActions lists it illegal", () => {
    const start = game();
    const given = giveCard(start, P(start), CITY.id);
    expect(applyCommand(given.state, play(P(start), given.id), deps)).toMatchObject({
      ok: false,
      error: { code: "no_valid_target", message: "Prerequisite: your identity must have the DEFENDER trait" },
    });
    const legal = legalActions(given.state, P(start), deps);
    if (legal.kind !== "turn") throw new Error("expected a turn");
    expect(legal.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === given.id)).toBe(false);
    expect(legal.illegal.find((a) => a.action.kind === "playCard" && a.action.instanceId === given.id)).toMatchObject({
      reason: "no_valid_target",
    });
  });

  it("any one of several traits meets it, a gained trait included", () => {
    const start = game();
    const given = giveCard(start, P(start), EITHER.id);
    expect(applyCommand(given.state, play(P(start), given.id), deps).ok).toBe(false);
    expect(applyCommand(place(given.state, BADGE.id), play(P(start), given.id), deps).ok).toBe(true);
  });

  it("a form prerequisite: refused in alter-ego form, played in hero form", () => {
    const start = game();
    expect(mustPlayer(start, P(start)).identity.form).toBe("alterEgo");
    const given = giveCard(start, P(start), SUITED.id);
    expect(applyCommand(given.state, play(P(start), given.id), deps)).toMatchObject({
      ok: false,
      error: { code: "wrong_form" },
    });
    const hero = runCommands(given.state, deps, { type: "changeForm", playerId: P(start) }).state;
    expect(applyCommand(hero, play(P(start), given.id), deps).ok).toBe(true);
  });

  it("put into play is not asked: a non-Defender's effect puts it into play", () => {
    const start = place(game(), DROP.id);
    const drop = mustPlayer(start, P(start)).playArea.at(-1)!;
    const given = giveCard(start, P(start), CITY.id);
    const run = runCommands(given.state, deps, {
      type: "useAbility",
      playerId: P(start),
      cardInstanceId: drop,
      abilityId: abilities.find((a) => a.ref.id === "drop.action")!.ref.id,
      payment: [],
    });
    expect(inPlay(run.state, given.id)).toBe(true);
  });
});
