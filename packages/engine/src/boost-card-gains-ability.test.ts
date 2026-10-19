/**
 * docs/phase7-wave11-scenarios.md §S3.6: boost cards gaining a Boost ability by encounter set. Purple Man I–III
 * (60097–60099): "Each boost card from the Purple Man encounter set gains: '[star] Boost: After this activation, deal
 * this card to yourself as a facedown encounter card.'" is `RuleSpec gainsAbility { to: { boostCard: true,
 * inEncounterSet } }`, read as the boost card is turned faceup (`gainedBoostAbilities`).
 *
 * Sources: RRG 1.8 "Boost, Boost Icon" (p. 11): the Boost ability resolves when the card is turned faceup, and only the
 * text beneath the divider line is active on a card resolving as a boost card. RRG 1.8 "'Gains'" (p. 21). The granted
 * effect here is a stand-in (+2 boost icons, `adjustBoostCount`) so the test reads it back off the attack's count.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { gainedBoostAbilities } from "./select.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMinion, stubVillain } from "./testing/fixtures.js";
import { defaultPick, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1 } from "./testing/wave3.js";
import type { GameState } from "./state.js";

const SET = "pm-set";

const GRANTED = stubAbility("pm.granted-boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "adjustBoostCount", delta: { kind: "const", value: 2 } }],
});
/** A granted response: not active on a card resolving as a boost card (RRG 1.8 p. 11). */
const GRANTED_RESPONSE = stubAbility("pm.granted-response", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay" } },
  effects: [],
});
const GRANT = stubAbility("pm.grant", {
  trigger: {
    kind: "constant",
    rules: [
      { kind: "gainsAbility", abilityId: GRANTED.ref.id, to: { boostCard: true, inEncounterSet: SET } },
      { kind: "gainsAbility", abilityId: GRANTED_RESPONSE.ref.id, to: { boostCard: true, inEncounterSet: SET } },
    ],
  },
  effects: [],
});
const PRINTED = stubAbility("own.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "adjustBoostCount", delta: { kind: "const", value: 1 } }],
});

/** Purple Man's own granted text: "After this activation, deal this card to yourself as a facedown encounter card." */
const GRANTED_DEAL = stubAbility("pm.granted-deal", {
  trigger: { kind: "boost" },
  effects: [
    {
      kind: "atEndOfActivation",
      effects: [{ kind: "dealAsEncounterCard", cards: { kind: "self" }, player: { kind: "controller" } }],
    },
  ],
});
const GRANT_DEAL = stubAbility("pm.grant-deal", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "gainsAbility", abilityId: GRANTED_DEAL.ref.id, to: { boostCard: true, inEncounterSet: SET } }],
  },
  effects: [],
});
/** Betty Brant's shape (60154): cancel the Boost ability of a boost card as it is turned faceup. */
const CANCEL = stubAbility("cancel.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "boostCardTurnedFaceup" } },
  effects: [{ kind: "cancelBoostAbility" }],
});

/** Attacks for 1, so the attack's boost count is easy to read back. */
const PURPLE = stubVillain({ id: "pm-villain", stages: [{ hp: flat(30), atk: 1, sch: 1, abilities: [GRANT.ref] }] });
const PLAIN = stubVillain({ id: "plain-villain", stages: [{ hp: flat(30), atk: 1, sch: 1 }] });
const PURPLE_CANCELLED = stubVillain({
  id: "pm-cancelled",
  stages: [{ hp: flat(30), atk: 1, sch: 1, abilities: [GRANT.ref, CANCEL.ref] }],
});
const PURPLE_DEAL = stubVillain({
  id: "pm-deal",
  stages: [{ hp: flat(30), atk: 1, sch: 1, abilities: [GRANT_DEAL.ref] }],
});

/** A starred card of the set that prints no Boost of its own (Purple Man's civilians). */
const CIVILIAN = stubMinion({ id: "civilian", encounterSetIds: [SET], atk: 1, sch: 1, hp: 3, boostIcons: 0 });
/** A card of the set printing its own Boost (+1): the gained one resolves after it. */
const OWN_BOOST = stubMinion({
  id: "own-boost",
  encounterSetIds: [SET],
  atk: 1,
  sch: 1,
  hp: 3,
  boostIcons: 0,
  starIcon: true,
  abilities: [PRINTED.ref],
});
/** A card of another set: gains nothing. */
const OUTSIDER = stubMinion({ id: "outsider", encounterSetIds: ["other-set"], atk: 1, sch: 1, hp: 3, boostIcons: 1 });

const deps: EngineDeps = depsOf(GRANTED, GRANTED_RESPONSE, GRANT, PRINTED, GRANTED_DEAL, GRANT_DEAL, CANCEL);

function start(boostCard: typeof CIVILIAN, villain = PURPLE): GameState {
  // Spare treacheries under the boost card: an empty encounter deck and discard pile lose the game (RRG 1.8 p. 17).
  const encounter = [boostCard.id, ...copiesOf(TREACHERY.id, 4)];
  const base = gameAtFirstTurn({ cards: [CIVILIAN, OWN_BOOST, OUTSIDER, villain], deps, villain, encounter });
  const stacked = onTopOfEncounterDeck(base, boostCard.id);
  // In hero form, so the villain attacks.
  return {
    ...stacked,
    players: stacked.players.map((p) => (p.playerId === P1 ? { ...p, identity: { ...p.identity, form: "hero" } } : p)),
  };
}

function runVillainPhase(state: GameState) {
  return driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], defaultPick);
}

const attackBoost = (events: readonly GameEvent[]): number | undefined =>
  events.find((e): e is Extract<GameEvent, { type: "attackResolved" }> => e.type === "attackResolved")?.boostIcons;

const resolvedAbilities = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));

const instanceOf = (state: GameState, cardId: string): InstanceId => {
  const found = (Object.keys(state.instances) as InstanceId[]).find((id) => state.instances[id]?.cardId === cardId);
  if (!found) throw new Error(`no ${cardId}`);
  return found;
};

describe("§S3.6 boost cards gaining a Boost ability by encounter set (Purple Man 60097–60099)", () => {
  it("a boost card of the set resolves the gained Boost ability as it is turned faceup", () => {
    const { events } = runVillainPhase(start(CIVILIAN));
    expect(resolvedAbilities(events)).toContain(GRANTED.ref.id);
    expect(attackBoost(events)).toBe(2);
  });

  it("a granted ability that is not a Boost is not active on a boost card (RRG 1.8 p. 11)", () => {
    const state = start(CIVILIAN);
    const id = instanceOf(state, CIVILIAN.id);
    expect(gainedBoostAbilities(state, deps, id, { asBoostCard: true }).map((g) => g.abilityId)).toEqual([
      GRANTED.ref.id,
    ]);
  });

  it("a card printing its own Boost resolves it first, then the gained one", () => {
    const { events } = runVillainPhase(start(OWN_BOOST));
    const order = resolvedAbilities(events).filter((id) => id === PRINTED.ref.id || id === GRANTED.ref.id);
    expect(order).toEqual([PRINTED.ref.id, GRANTED.ref.id]);
    expect(attackBoost(events)).toBe(3);
  });

  it("a boost card of another set gains nothing", () => {
    const { events } = runVillainPhase(start(OUTSIDER));
    expect(resolvedAbilities(events)).not.toContain(GRANTED.ref.id);
    expect(attackBoost(events)).toBe(1);
  });

  it("without the granting villain in play the set's boost card gains nothing", () => {
    const { events } = runVillainPhase(start(CIVILIAN, PLAIN));
    expect(resolvedAbilities(events)).not.toContain(GRANTED.ref.id);
    expect(attackBoost(events)).toBe(0);
  });

  it("a card of the set in the encounter deck is not a boost card", () => {
    const state = start(CIVILIAN);
    expect(gainedBoostAbilities(state, deps, instanceOf(state, CIVILIAN.id))).toEqual([]);
  });

  it("a cancelled Boost ability cancels the printed and the gained one alike", () => {
    const { events } = runVillainPhase(start(OWN_BOOST, PURPLE_CANCELLED));
    expect(resolvedAbilities(events)).not.toContain(PRINTED.ref.id);
    expect(resolvedAbilities(events)).not.toContain(GRANTED.ref.id);
    expect(events.some((e) => e.type === "boostCancelled" && e.scope === "ability")).toBe(true);
    expect(attackBoost(events)).toBe(0);
  });

  it("the granted 'after this activation, deal this card to yourself' deals it facedown, not to the discard", () => {
    const state = start(CIVILIAN, PURPLE_DEAL);
    const id = instanceOf(state, CIVILIAN.id);
    const { events } = runVillainPhase(state);
    expect(resolvedAbilities(events)).toContain(GRANTED_DEAL.ref.id);
    const moves = events.filter((e): e is Extract<GameEvent, { type: "cardMoved" }> => e.type === "cardMoved");
    const dealt = moves.findIndex((e) => e.instanceId === id && e.to.kind === "dealtEncounter");
    expect(dealt).toBeGreaterThan(-1);
    expect(moves[dealt]!.to).toEqual({ kind: "dealtEncounter", playerId: P1 });
    // Dealt after the activation: the boost card's discard (RRG 1.8 p. 11) came first, and nothing took it back there.
    expect(
      moves
        .slice(0, dealt)
        .filter((e) => e.instanceId === id)
        .map((e) => e.to.kind),
    ).toEqual(["boost", "encounterDiscard"]);
  });

  it("replays deep-equal", () => {
    const { session } = runVillainPhase(start(CIVILIAN));
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
