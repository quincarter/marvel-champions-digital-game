/**
 * docs/phase7-wave4.md §3.19: readying as a costed act, and "cannot be readied by player card effects". Synthetic
 * cards shaped like Mister Fear (`hood` 24027: "As an additional cost for the engaged player to ready a hero or ally they
 * control, the player must spend a [mental] resource") and Unnatural Storm (`mts` 21159: "Heroes and allies cannot be
 * readied by player card effects").
 *
 * Sources: RRG 1.8 "Ready" (p. 36): "If there is an additional cost for a player to ready a card, that player can choose
 * not to pay that cost. If they do not pay the cost, the card does not ready."; "End of Player Phase" (p. 18): step 4
 * readies every card, step 5 resolves "when the phase ends" effects; "'Cannot'" (p. 11).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubSideScheme, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard, RESOURCE } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const FEAR_RULE = stubAbility(
  "fear.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [
        {
          kind: "readyCost",
          target: { categories: ["hero", "ally"], controlledBy: { kind: "engagedWith", of: { kind: "self" } } },
          player: { kind: "engagedWith", of: { kind: "self" } },
          resources: { mental: 1 },
        },
      ],
    },
    effects: [],
  }),
);
const FEAR = stubMinion({ id: "fear", atk: 1, sch: 1, hp: 5, boostIcons: 0, abilities: [FEAR_RULE.ref] });
const STORM_RULE = stubAbility(
  "storm.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "cannotReady", target: { categories: ["hero", "ally"] }, bySource: "playerCard" }],
    },
    effects: [],
  }),
);
const STORM = stubSideScheme({ id: "storm", startingThreat: 5, abilities: [STORM_RULE.ref] });
/** "Action: ready your hero." */
const RALLY_ACTION = stubAbility(
  "rally.action",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "ready", target: { kind: "identityOf", player: { kind: "controller" } } }],
  }),
);
const RALLY = stubEvent({ id: "rally", cost: 0, abilities: [RALLY_ACTION.ref] });
const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 1, thw: 1, hp: 3 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const deps = depsOf(FEAR_RULE, STORM_RULE, RALLY_ACTION);
const DECK: readonly CardId[] = [...copiesOf(RALLY.id, 2), ...copiesOf(RECRUIT.id, 2)];

function start(players: 1 | 2 = 1): GameState {
  const base = gameAtFirstTurn({
    cards: [FEAR, STORM, RALLY, RECRUIT, BLANK],
    deps,
    deck: DECK,
    players,
    encounter: [FEAR.id, STORM.id, ...copiesOf(BLANK.id, 30)],
  });
  return { ...base, players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}
const identityOf = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).identity.instanceId;
const exhaust = (state: GameState, ...ids: InstanceId[]): GameState => ({
  ...state,
  instances: {
    ...state.instances,
    ...Object.fromEntries(ids.map((id) => [id, { ...mustInstance(state, id), exhausted: true }])),
  },
});
/** Answers each ready-cost payment in turn from `answers` (true: pay with the first option; false: decline). */
function payer(answers: boolean[]) {
  const asked: boolean[] = [];
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "spendResources") {
      const pay = answers[asked.length] ?? false;
      asked.push(pay);
      const resource = choice.options.find(
        (o) => o.ref.kind === "card" && state.instances[o.ref.instanceId]?.cardId === RESOURCE.id,
      );
      return pay && resource ? [resource.optionId] : [];
    }
    return defaultPick(state);
  };
  return { pick, asked };
}
function run(state: GameState, commands: readonly Command[], pick = defaultPick) {
  const driven = driveSession(startSession(state), deps, commands, pick);
  return { state: driven.session.state, events: driven.events, session: driven.session };
}

describe("§3.19 an additional cost to ready (Mister Fear)", () => {
  it("end of the player phase: each taxed card asks; paid readies, declined stays exhausted", () => {
    const base = start();
    const fear = minionEngagedWith(base, FEAR.id);
    const recruit = playerCardIntoPlay(fear.state, RECRUIT.id);
    const tired = exhaust(recruit.state, identityOf(base), recruit.id);
    const { pick, asked } = payer([true, false]);
    const { state, events, session } = run(tired, [{ type: "endTurn", playerId: P1 }], pick);
    expect(asked).toEqual([true, false]);
    expect(events.filter((e) => e.type === "readyCostAsked")).toHaveLength(2);
    // The hero is asked first (it readies first), then the ally.
    expect(mustInstance(state, identityOf(state)).exhausted).toBe(false);
    expect(mustInstance(state, recruit.id).exhausted).toBe(true);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(state);
  });

  it("a card effect that readies asks too: declined, the hero stays exhausted", () => {
    const base = start();
    const fear = minionEngagedWith(base, FEAR.id);
    const rally = giveCard(exhaust(fear.state, identityOf(base)), P1, RALLY.id);
    const { pick, asked } = payer([false]);
    const { state } = run(
      rally.state,
      [{ type: "playCard", playerId: P1, cardInstanceId: rally.id, payment: [], attachToInstanceId: null }],
      pick,
    );
    expect(asked).toEqual([false]);
    expect(mustInstance(state, identityOf(state)).exhausted).toBe(true);
  });

  it("only the engaged player's readies are taxed: the other player's hero readies without being asked", () => {
    const base = start(2);
    const fear = minionEngagedWith(base, FEAR.id, P1);
    const tired = exhaust(fear.state, identityOf(base, P2));
    const { pick, asked } = payer([]);
    const { state } = run(
      tired,
      [
        { type: "endTurn", playerId: P1 },
        { type: "endTurn", playerId: P2 },
      ],
      pick,
    );
    expect(asked).toEqual([]);
    expect(mustInstance(state, identityOf(state, P2)).exhausted).toBe(false);
  });

  it("with nothing to pay with, the ready is declined (the card stays exhausted)", () => {
    const base = start();
    const fear = minionEngagedWith(base, FEAR.id);
    const emptyHand: GameState = {
      ...fear.state,
      players: fear.state.players.map((p) => ({ ...p, deck: [...p.hand, ...p.deck], hand: [] })),
    };
    const rally = giveCard(exhaust(emptyHand, identityOf(base)), P1, RALLY.id);
    const { state } = run(rally.state, [
      { type: "playCard", playerId: P1, cardInstanceId: rally.id, payment: [], attachToInstanceId: null },
    ]);
    expect(mustInstance(state, identityOf(state)).exhausted).toBe(true);
  });
});

describe("§3.19 'cannot be readied by player card effects' (Unnatural Storm)", () => {
  it("a player card's 'ready your hero' does nothing, but the end-of-phase ready still readies", () => {
    const base = start();
    const storm = encounterCardInVillainArea(base, STORM.id, 5);
    const rally = giveCard(exhaust(storm.state, identityOf(base)), P1, RALLY.id);
    const played = run(rally.state, [
      { type: "playCard", playerId: P1, cardInstanceId: rally.id, payment: [], attachToInstanceId: null },
    ]);
    expect(mustInstance(played.state, identityOf(played.state)).exhausted).toBe(true);
    const ended = run(played.state, [{ type: "endTurn", playerId: P1 }]);
    expect(mustInstance(ended.state, identityOf(ended.state)).exhausted).toBe(false);
  });
});
