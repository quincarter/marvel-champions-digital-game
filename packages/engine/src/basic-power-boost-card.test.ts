/**
 * `EffectSpec giveBasicPowerBoostCard`: "Hero Interrupt: When Carnage uses a basic power, you may give him a boost card."
 * (Klyntar Bond, a custom-content card; docs/custom-content-packs.md §6: the pack's text is the authority, and its
 * author expects the card to resolve as villainous's does.) The use resolves the boost card as the villainous keyword
 * does for a friendly character (RRG 1.8 "Villainous", p. 47; MC60 p. 26 FAQ): faceup as the power resolves, its Boost
 * ability resolved, its icons added to the stat powering this use, then discarded once the use has resolved.
 *
 * Synthetic cards, one seat. The stub hero (ATK 2, THW 2, DEF 2) has no villainous keyword. Every encounter card has 2
 * boost icons and a Boost ability that places a "spark" counter on the villain. The upgrade carries the interrupt.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubTreachery, stubUpgrade, stubVillain } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;

/** "Hero Interrupt: When your hero uses a basic power, you may give him a boost card." */
const BOND_INTERRUPT = stubAbility(
  "bond.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: false,
      form: "hero",
      on: { on: "basicPowerUsing", targetIs: { categories: ["identity"], controller: "you" } },
    },
    effects: [{ kind: "giveBasicPowerBoostCard" }],
  }),
);
const BOND = stubUpgrade({ id: "bond", cost: 0, abilities: [BOND_INTERRUPT.ref] });
/** Boost: place 1 spark counter on the villain. */
const SPARK_BOOST = stubAbility(
  "spark.boost",
  def({
    trigger: { kind: "boost" },
    effects: [
      { kind: "addCounters", target: { kind: "villain" }, counterType: "spark", amount: { kind: "const", value: 1 } },
    ],
  }),
);
const SPARK = stubTreachery({ id: "spark", boostIcons: 2, abilities: [SPARK_BOOST.ref] });
const VILLAIN = stubVillain({ id: "big-bad", stages: [{ hp: flat(30), atk: 4, sch: 0 }] });

const deps: EngineDeps = depsOf(BOND_INTERRUPT, SPARK_BOOST);

function start(): { state: GameState; hero: InstanceId; villain: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [BOND, SPARK, VILLAIN],
    deps,
    villain: VILLAIN,
    deck: [BOND.id],
    encounter: copiesOf(SPARK.id, 20),
  });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const state = playerCardIntoPlay(heroes, BOND.id).state;
  return { state, hero: mustPlayer(state, P1).identity.instanceId, villain: state.villains[0]!.instanceId };
}

/** Accepts the interrupt when `take`, else declines; defends with the hero when asked. */
const picker =
  (take: boolean, hero: InstanceId) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") return take ? choice.options.map((o) => o.optionId) : [];
    if (choice?.prompt.kind === "declareDefender") return [hero];
    return defaultPick(state);
  };

function run(state: GameState, take: boolean, hero: InstanceId, commands: readonly Command[]): GameSession {
  return driveSession(startSession(state), deps, commands, picker(take, hero)).session;
}

const sparks = (state: GameState, villain: InstanceId) => mustInstance(state, villain).counters.spark ?? 0;

describe("giveBasicPowerBoostCard: a boost card for a basic power, resolved as villainous's is", () => {
  it("a basic attack: +2 ATK from the card's icons, its Boost ability resolves, and the card is discarded", () => {
    const s = start();
    const deckBefore = activeEncounterDeck(s.state).deck.length;
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: s.hero,
      targetInstanceId: s.villain,
    };
    const session = run(s.state, true, s.hero, [attack]);
    expect(mustInstance(session.state, s.villain).damage).toBe(4);
    expect(sparks(session.state, s.villain)).toBe(1);
    expect(mustInstance(session.state, s.hero).boostCards).toEqual([]);
    expect(activeEncounterDeck(session.state).deck.length).toBe(deckBefore - 1);
    expect(activeEncounterDeck(session.state).discard.length).toBe(1);
  });

  it("declined: no card, ATK 2", () => {
    const s = start();
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: s.hero,
      targetInstanceId: s.villain,
    };
    const session = run(s.state, false, s.hero, [attack]);
    expect(mustInstance(session.state, s.villain).damage).toBe(2);
    expect(sparks(session.state, s.villain)).toBe(0);
  });

  it("a basic thwart: +2 THW", () => {
    const s = start();
    const scheme = s.state.mainScheme!.instanceId;
    const withThreat: GameState = {
      ...s.state,
      instances: { ...s.state.instances, [scheme]: { ...mustInstance(s.state, scheme), threat: 6 } },
    };
    const thwart: Command = { type: "basicThwart", playerId: P1, thwarterInstanceId: s.hero, schemeInstanceId: scheme };
    expect(mustInstance(run(withThreat, true, s.hero, [thwart]).state, scheme).threat).toBe(2);
    expect(mustInstance(run(withThreat, false, s.hero, [thwart]).state, scheme).threat).toBe(4);
  });

  it("a basic defense: the card resolves after the villain's own boost card, +2 DEF (6 ATK - 4 DEF = 2)", () => {
    const s = start();
    const taken = run(s.state, true, s.hero, [{ type: "endTurn", playerId: P1 }]);
    // The villain's boost card (2 icons) makes its ATK 6; the hero's card makes DEF 4.
    expect(mustInstance(taken.state, s.hero).damage).toBe(2);
    expect(mustInstance(taken.state, s.hero).boostCards).toEqual([]);
    const declined = run(s.state, false, s.hero, [{ type: "endTurn", playerId: P1 }]);
    expect(mustInstance(declined.state, s.hero).damage).toBe(4);
  });

  it("replays to the same state", () => {
    const s = start();
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: s.hero,
      targetInstanceId: s.villain,
    };
    const session = run(s.state, true, s.hero, [attack]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
