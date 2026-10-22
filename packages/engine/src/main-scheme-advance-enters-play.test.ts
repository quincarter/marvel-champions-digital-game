/**
 * A main scheme advance puts a new card into play under the same instance id (`noteReplacedInPlay`,
 * `entered-since.ts`). RRG 1.8 "Main Scheme, Main Scheme Deck" (p. 27) step 1: "Remove the top main scheme card from
 * the game"; "In Play and Out of Play" (p. 23): only the faceup side of the top main scheme card is in play. So the
 * next stage was out of play when the thwart that advanced the scheme was made against the stage before it, and its
 * "after you thwart this scheme" does not answer that thwart (the owner's answer 43B, docs/phase7-wave10.md §4.0).
 *
 * The shape that raised it: Shadow Labyrinth's Into the Labyrinth 1B ("Forced Interrupt: When the last threat is removed
 * from this scheme, advance to stage 2A") and Chamber of Vile Secrets 2B ("Forced Response: After you or an ally you
 * control thwarts this scheme, reveal the top card of the trap deck."). Synthetic cards here.
 */
import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { playerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession, runCommands } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard, HERO, runWith, seatIdentities } from "./testing/scenario.js";

const p1 = playerId("p1");
const self = { kind: "self" } as const;
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const count = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: self,
  counterType,
  amount: { kind: "const", value: 1 },
});

/** Stage 1: "Forced Response: After the last threat is removed from this scheme, advance to stage 2." */
const ADVANCE_ON_EMPTY = stubAbility("labyrinth.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "removeThreat", selfIs: "target", requireResults: { lastThreatRemoved: 1 } },
  },
  effects: [{ kind: "advanceMainScheme" }],
});
/** Stage 2: "Forced Response: After you thwart this scheme, …" (a counter, so the test can count what it heard). */
const AFTER_THWART = stubAbility("chamber.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "thwart", selfIs: "target" } },
  effects: [count("heard")],
});
const LABYRINTH = stubMainScheme({
  id: "labyrinth",
  stages: [
    { startingThreat: flat(1), targetThreat: flat(99), acceleration: flat(0), abilities: [ADVANCE_ON_EMPTY.ref] },
    { startingThreat: flat(5), targetThreat: flat(99), acceleration: flat(0), abilities: [AFTER_THWART.ref] },
  ],
});

/** A support in play: "Forced Response: After you thwart, …". It was in play all along, so it hears every thwart. */
const WITNESS_RESPONSE = stubAbility("witness.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "thwart", playerIs: "controller" } },
  effects: [count("witnessed")],
});
const WITNESS = stubSupport({ id: "witness", cost: 0, abilities: [WITNESS_RESPONSE.ref] });

/** "Hero Action (thwart): Remove 1 threat from the main scheme." One thwart of a "(thwart)" ability. */
const thwartEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    label: ["thwart"],
    effects,
  } as AbilityDefinition);
  return { ability, card: stubEvent({ id, cost: 0, abilities: [ability.ref] }) };
};
const removeOne: EffectSpec = { kind: "thwart", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } };
const SWEEP = thwartEvent("sweep", [removeOne]);
/**
 * "Hero Action (thwart): Remove 1 threat from the main scheme. Remove 1 threat from the main scheme." Two instances of
 * one thwart: the first empties stage 1 (it advances), the second removes threat from stage 2.
 */
const DOUBLE = thwartEvent("double", [removeOne, removeOne]);
/** "Hero Action (thwart): Remove 1 threat from the main scheme. Then advance it." The advance after the instance. */
const PUSH = thwartEvent("push", [removeOne, { kind: "advanceMainScheme" }]);
const EVENTS = [SWEEP, DOUBLE, PUSH];

const deps: EngineDeps = depsOf(ADVANCE_ON_EMPTY, AFTER_THWART, WITNESS_RESPONSE, ...EVENTS.map((e) => e.ability));

function game(): { readonly state: GameState; readonly witness: InstanceId } {
  const identities = seatIdentities(HERO, 1);
  const result = createGame(
    {
      seed: 5,
      cards: [QUIET_VILLAIN, LABYRINTH, BLANK, WITNESS, ...EVENTS.map((e) => e.card), ...identities],
      villainCardId: QUIET_VILLAIN.id,
      mainSchemeCardId: LABYRINTH.id,
      encounterDeck: Array.from({ length: 16 }, () => BLANK.id as CardId),
      includeIdentitySets: false,
      players: identities.map((identity) => ({
        identityCardId: identity.id,
        deck: [WITNESS.id, ...EVENTS.map((e) => e.card.id), ...Array.from({ length: 12 }, () => BLANK.id as CardId)],
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  let state = runCommands(result.state, deps).state;
  if (mustPlayer(state, p1).identity.form !== "hero")
    state = runWith(deps, state, { type: "changeForm", playerId: p1 });
  // Surgery: the support straight into play under p1's control.
  const given = giveCard(state, p1, WITNESS.id);
  state = {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === p1
        ? { ...p, hand: p.hand.filter((id) => id !== given.id), playArea: [...p.playArea, given.id] }
        : p,
    ),
    instances: {
      ...given.state.instances,
      [given.id]: { ...mustInstance(given.state, given.id), controllerId: p1, faceup: true },
    },
  };
  return { state, witness: given.id };
}

const run = (state: GameState, ...commands: readonly Command[]) =>
  driveSession(startSession(state), deps, commands, defaultPick).session.state;
const basicThwart = (state: GameState): Command => ({
  type: "basicThwart",
  playerId: p1,
  thwarterInstanceId: mustPlayer(state, p1).identity.instanceId,
  schemeInstanceId: state.mainScheme.instanceId,
});
const ready = (state: GameState): GameState => {
  const hero = mustPlayer(state, p1).identity.instanceId;
  return { ...state, instances: { ...state.instances, [hero]: { ...mustInstance(state, hero), exhausted: false } } };
};
const counter = (state: GameState, id: InstanceId, type: string): number => mustInstance(state, id).counters[type] ?? 0;

describe("a main scheme advance counts as the next stage entering play", () => {
  it("the basic thwart that removes stage 1's last threat advances it, and stage 2 does not hear that thwart", () => {
    const { state, witness } = game();
    expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(1);
    const after = run(state, basicThwart(state));
    expect(after.mainScheme.stageIndex).toBe(1);
    expect(counter(after, after.mainScheme.instanceId, "heard")).toBe(0);
    // Only the replaced card is excluded: a card in play all along still hears "after you thwart".
    expect(counter(after, witness, "witnessed")).toBe(1);
  });

  it("a thwart of stage 2 itself is still heard by stage 2", () => {
    const { state } = game();
    const advanced = run(state, basicThwart(state));
    expect(advanced.mainScheme.stageIndex).toBe(1);
    const again = run(ready(advanced), basicThwart(advanced));
    expect(mustInstance(again, again.mainScheme.instanceId).threat).toBeLessThan(5);
    expect(counter(again, again.mainScheme.instanceId, "heard")).toBe(1);
  });

  it("a '(thwart)' ability's one thwart that advanced stage 1 is not stage 2's either", () => {
    const { state, witness } = game();
    const after = play(state, SWEEP);
    expect(after.mainScheme.stageIndex).toBe(1);
    expect(counter(after, after.mainScheme.instanceId, "heard")).toBe(0);
    expect(counter(after, witness, "witnessed")).toBe(1);
  });

  it("a '(thwart)' ability whose later instance removes threat from stage 2 thwarted stage 2: it answers", () => {
    const { state, witness } = game();
    const after = play(state, DOUBLE);
    expect(after.mainScheme.stageIndex).toBe(1);
    // Stage 2 started at 5; the second instance took 1 of it.
    expect(mustInstance(after, after.mainScheme.instanceId).threat).toBe(4);
    expect(counter(after, after.mainScheme.instanceId, "heard")).toBe(1);
    expect(counter(after, witness, "witnessed")).toBe(1);
  });

  it("an advance later in the same ability, after its instance thwarted stage 1, keeps stage 2 out of it", () => {
    const { state, witness } = game();
    const scheme = state.mainScheme.instanceId;
    const two = {
      ...state,
      instances: { ...state.instances, [scheme]: { ...mustInstance(state, scheme), threat: 2 } },
    };
    const after = play(two, PUSH);
    expect(after.mainScheme.stageIndex).toBe(1);
    expect(counter(after, after.mainScheme.instanceId, "heard")).toBe(0);
    expect(counter(after, witness, "witnessed")).toBe(1);
  });
});

function play(state: GameState, event: { readonly card: { readonly id: CardId } }): GameState {
  const given = giveCard(state, p1, event.card.id);
  return run(given.state, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}
