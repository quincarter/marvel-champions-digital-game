/**
 * docs/phase7-wave8.md §3.24: "Resolve the 'Special' ability on the [SETTING] environment → discard this card", the
 * cost form (`AbilityCost.resolveAbility` with `trigger: "special"`, `resolve-ability-cost.ts`), and its `choose` slot.
 *
 * Sources: RRG 1.8 "Special" (p. 40: "Special abilities may only be resolved through the explicit instruction of
 * another card ability"), "Cost" (p. 13), "Cost Arrow Icon" (p. 14), "Initiating Abilities" (p. 24), "You, Your"
 * (p. 49). Owner decisions §4.1 Q7 = A (a cost that would change nothing cannot be paid) and Q15 = A (with several
 * such environments in play the resolving player chooses which). No FFG ruling on these cards in the post-RRG 1.7
 * transcript.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubSupport } from "./testing/fixtures.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";
import { TREACHERY, UPGRADE } from "./testing/scenario.js";

const PLACE = trait("PLACE");
const one = { kind: "const", value: 1 } as const;
const self: TargetRef = { kind: "self" };
const you: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const special = (id: string, ...effects: StubAbility["definition"]["effects"]) =>
  stubAbility(`${id}.special`, { trigger: { kind: "special" }, effects });

/** "Special: Take 1 damage." */
const CRATER_SPECIAL = special("crater", { kind: "dealDamage", target: you, amount: one });
/** "Special: Place 1 threat on the main scheme." */
const PRISON_SPECIAL = special("prison", { kind: "placeThreat", target: { kind: "mainScheme" }, amount: one });
/** "Special: Discard an upgrade you control." With none, nothing happens. */
const SWAMP_SPECIAL = special(
  "swamp",
  {
    kind: "chooseTarget",
    slot: "lost",
    query: { categories: ["upgrade"], controller: "you" },
    chooser: { kind: "controller" },
  },
  { kind: "discardFromPlay", target: { kind: "slot", slot: "lost" } },
);
const CRATER = stubEnvironment({ id: "crater", traits: [PLACE], abilities: [CRATER_SPECIAL.ref] });
const PRISON = stubEnvironment({ id: "prison", traits: [PLACE], abilities: [PRISON_SPECIAL.ref] });
const SWAMP = stubEnvironment({ id: "swamp", traits: [PLACE], abilities: [SWAMP_SPECIAL.ref] });
/** A Place environment that prints no Special. */
const MEADOW = stubEnvironment({ id: "meadow", traits: [PLACE] });

const thePlace: TargetRef = { kind: "each", query: { categories: ["environment"], trait: PLACE } };
const placeCost: AbilityCost = { resolveAbility: { of: thePlace, trigger: "special", choose: "place" } };
/** "Action: Resolve the 'Special' ability on the Place environment → discard this card." */
const PASS_ACTION = stubAbility("pass.action", {
  trigger: { kind: "action" },
  cost: placeCost,
  effects: [{ kind: "discardFromPlay", target: self }],
});
/** "Hero Action: Exhaust your hero and resolve the 'Special' ability on the Place environment → discard this card." */
const LENS_ACTION = stubAbility("lens.action", {
  trigger: { kind: "action", form: "hero" },
  cost: { ...placeCost, exhaustIdentity: true },
  effects: [{ kind: "discardFromPlay", target: self }],
});
const PASS = stubSupport({ id: "pass", cost: 0, abilities: [PASS_ACTION.ref] });
const LENS = stubSupport({ id: "lens", cost: 0, abilities: [LENS_ACTION.ref] });

const deps: EngineDeps = depsOf(CRATER_SPECIAL, PRISON_SPECIAL, SWAMP_SPECIAL, PASS_ACTION, LENS_ACTION);

type Place = "crater" | "prison" | "swamp" | "meadow";
/** P1 in hero form at their first turn, `card` in play under their control, and `places` in the villain's area. */
function start(card: typeof PASS | typeof LENS, ...places: readonly Place[]) {
  const begun = gameAtFirstTurn({
    cards: [CRATER, PRISON, SWAMP, MEADOW, PASS, LENS],
    deps,
    deck: [PASS.id, LENS.id],
    encounter: [CRATER.id, PRISON.id, SWAMP.id, MEADOW.id, ...copiesOf(TREACHERY.id, 20)],
  });
  const heroic: GameState = {
    ...begun,
    players: begun.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const, heroFormIndex: 0 } })),
  };
  const held = playerCardIntoPlay(heroic, card.id);
  const ids: Partial<Record<Place, InstanceId>> = {};
  let state = held.state;
  for (const place of places) {
    const put = encounterCardInVillainArea(state, place as typeof CRATER.id);
    ids[place] = put.id;
    state = put.state;
  }
  return { state, card: held.id, ids };
}

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const hero = (state: GameState) => mustInstance(state, mustPlayer(state, P1).identity.instanceId);
const threat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const offer = (state: GameState, ability: StubAbility) => {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`not P1's turn: ${actions.kind}`);
  return actions.legal.find((a) => a.action.kind === "useAbility" && a.action.abilityId === ability.ref.id);
};
function use(state: GameState, card: InstanceId, ability: StubAbility, place?: InstanceId) {
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: card,
    abilityId: ability.ref.id,
    payment: [],
    ...(place ? { costChoices: { place: [place] } } : {}),
  };
  const run = driveSession(startSession(state), deps, [command]);
  return { state: run.session.state, events: run.events, session: run.session };
}
const refused = (state: GameState, card: InstanceId, ability: StubAbility, place?: InstanceId): string => {
  try {
    use(state, card, ability, place);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("the command was accepted");
};

describe("§3.24 the cost form: resolve the Special on the environment → discard this card", () => {
  it("one such environment in play: the Special resolves with the payer as 'you', then the card is discarded", () => {
    const at = start(PASS, "crater");
    expect(offer(at.state, PASS_ACTION)).toBeDefined();
    const run = use(at.state, at.card, PASS_ACTION);
    expect(hero(run.state).damage).toBe(1);
    expect(cardsInPlay(run.state)).not.toContain(at.card);
    expect(of(run.events, "abilityResolved").map((e) => e.abilityId)).toContain(CRATER_SPECIAL.ref.id);
    expect(of(run.events, "resolveAbilityCostSettled")).toEqual([
      {
        type: "resolveAbilityCostSettled",
        instanceId: at.card,
        playerId: P1,
        ofInstanceId: at.ids.crater,
        trigger: "special",
        resolved: 1,
        paid: true,
      },
    ]);
    // The cost resolves before the effect (RRG 1.8 "Cost Arrow Icon", p. 14).
    const settledAt = run.events.findIndex((e) => e.type === "resolveAbilityCostSettled");
    const damagedAt = run.events.findIndex((e) => e.type === "damageDealt");
    const discardedAt = run.events.findIndex((e) => e.type === "cardDiscardedFromPlay" && e.instanceId === at.card);
    expect(damagedAt).toBeGreaterThan(-1);
    expect(settledAt).toBeGreaterThan(damagedAt);
    expect(discardedAt).toBeGreaterThan(settledAt);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });

  it("no such environment in play: the action is not offered and the command is refused, the card kept", () => {
    const at = start(PASS);
    expect(offer(at.state, PASS_ACTION)).toBeUndefined();
    expect(refused(at.state, at.card, PASS_ACTION)).toMatch(/no card whose ability this cost resolves/);
    expect(cardsInPlay(at.state)).toContain(at.card);
  });

  it("an environment with the trait but no Special: not offered", () => {
    const at = start(PASS, "meadow");
    expect(offer(at.state, PASS_ACTION)).toBeUndefined();
    expect(refused(at.state, at.card, PASS_ACTION)).toMatch(/no such ability to resolve/);
  });

  it("Q7 = A: a Special that can change nothing cannot be the cost; once it can, the action is offered", () => {
    const at = start(PASS, "swamp");
    expect(offer(at.state, PASS_ACTION)).toBeUndefined();
    expect(refused(at.state, at.card, PASS_ACTION)).toMatch(/would change nothing/);
    const geared = playerCardIntoPlay(at.state, UPGRADE.id);
    expect(offer(geared.state, PASS_ACTION)).toBeDefined();
    const run = use(geared.state, at.card, PASS_ACTION);
    expect(cardsInPlay(run.state)).not.toContain(geared.id);
    expect(cardsInPlay(run.state)).not.toContain(at.card);
  });

  it("with an exhaust in the same cost: the hero exhausts and takes the Special's damage; already exhausted, not offered", () => {
    const at = start(LENS, "crater");
    const run = use(at.state, at.card, LENS_ACTION);
    expect(hero(run.state).exhausted).toBe(true);
    expect(hero(run.state).damage).toBe(1);
    expect(cardsInPlay(run.state)).not.toContain(at.card);

    const heroId = mustPlayer(at.state, P1).identity.instanceId;
    const tired: GameState = {
      ...at.state,
      instances: { ...at.state.instances, [heroId]: { ...mustInstance(at.state, heroId), exhausted: true } },
    };
    expect(offer(tired, LENS_ACTION)).toBeUndefined();
  });
});

describe("§3.24, §4.1 Q15 = A: several such environments in play, the payer chooses", () => {
  it("the action offers each as a target; the pick's Special resolves and the other's does not", () => {
    const at = start(PASS, "crater", "prison");
    expect(offer(at.state, PASS_ACTION)?.targets).toEqual([at.ids.crater, at.ids.prison]);

    const prison = use(at.state, at.card, PASS_ACTION, at.ids.prison);
    expect(threat(prison.state)).toBe(threat(at.state) + 1);
    expect(hero(prison.state).damage).toBe(0);
    expect(of(prison.events, "resolveAbilityCostSettled")).toMatchObject([{ ofInstanceId: at.ids.prison, paid: true }]);
    expect(cardsInPlay(prison.state)).not.toContain(at.card);
    const replayed = replay(prison.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(prison.session.state);

    const crater = use(at.state, at.card, PASS_ACTION, at.ids.crater);
    expect(threat(crater.state)).toBe(threat(at.state));
    expect(hero(crater.state).damage).toBe(1);
  });

  it("with no pick named the command is refused: the choice is the player's, not the engine's", () => {
    const at = start(PASS, "crater", "prison");
    expect(refused(at.state, at.card, PASS_ACTION)).toMatch(/choose which card's ability to resolve/);
  });

  it("a pick that is not one of them is refused", () => {
    const at = start(PASS, "crater", "prison");
    expect(refused(at.state, at.card, PASS_ACTION, at.card)).toMatch(/choose exactly one card/);
  });

  it("one that can change nothing is not a legal pick, and the other still pays the cost", () => {
    const at = start(PASS, "swamp", "crater");
    expect(offer(at.state, PASS_ACTION)?.targets).toEqual([at.ids.crater]);
    expect(refused(at.state, at.card, PASS_ACTION, at.ids.swamp)).toMatch(/would change nothing/);
    expect(hero(use(at.state, at.card, PASS_ACTION, at.ids.crater).state).damage).toBe(1);
  });
});
