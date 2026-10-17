/**
 * Rules audit fix `acceleration-token-removal`. RRG 1.8 "Acceleration Token" (p. 5): "Acceleration tokens on the main
 * scheme cannot be removed from play." Tokens on other cards "are removed from play when the card they are placed on
 * leaves play", so an effect that removes an acceleration token can only take one held by a card that is not a main
 * scheme (its `acceleration` counter).
 */
import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import { replay, startSession } from "../engine.js";
import type { InstanceId } from "../ids.js";
import { mustInstance } from "../query.js";
import { createGame } from "../setup.js";
import type { EffectSpec, TargetRef } from "../spec.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { driveSession } from "../testing/drive.js";
import { stubEvent, stubMainScheme, stubSideScheme, stubTreachery, stubVillain } from "../testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO } from "../testing/scenario.js";
import { copiesOf, playFree } from "../testing/wave3.js";

const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(1) }],
});
const PREY = stubSideScheme({ id: "prey", startingThreat: 5, boostIcons: 0 });
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const prey: TargetRef = { kind: "each", query: { categories: ["sideScheme"], name: "prey" } };
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const REVEAL_PREY = event("reveal-prey", [
  { kind: "selectCards", slot: "p", cards: { kind: "encounter", zones: ["deck"], filter: { name: "prey" } } },
  { kind: "putIntoPlay", card: { kind: "slot", slot: "p" }, controller: { kind: "controller" } },
  { kind: "addAccelerationToken", target: prey },
]);
const TOKEN = event("token", [{ kind: "addAccelerationToken" }]);
const REMOVE = event("remove", [{ kind: "removeAccelerationToken" }]);
const REMOVE_MAIN = event("remove-main", [{ kind: "removeAccelerationToken", target: { kind: "mainScheme" } }]);
const REMOVE_PREY = event("remove-prey", [{ kind: "removeAccelerationToken", target: prey }]);
const EVENTS = [REVEAL_PREY, TOKEN, REMOVE, REMOVE_MAIN, REMOVE_PREY];

const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

function start(): GameState {
  const result = createGame(
    {
      seed: 4,
      cards: [...DEFAULT_CARDS, SCHEME, PREY, VILLAIN, FILLER, ...EVENTS.map((e) => e.card)],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [...copiesOf(FILLER.id, 20), PREY.id],
      includeIdentitySets: false,
      players: [
        {
          identityCardId: HERO.id,
          deck: [...DEFAULT_DECK, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
        },
      ],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

const preyId = (state: GameState): InstanceId | undefined =>
  state.villainArea.find((id) => mustInstance(state, id).cardId === PREY.id);

describe("rules audit fix: acceleration-token-removal (RRG 1.8 p. 5)", () => {
  it("an effect cannot remove an acceleration token from the main scheme", () => {
    const placed = playFree(start(), deps, TOKEN.card.id).state;
    expect(placed.mainScheme.accelerationTokens).toBe(1);
    expect(playFree(placed, deps, REMOVE.card.id).state.mainScheme.accelerationTokens).toBe(1);
    expect(playFree(placed, deps, REMOVE_MAIN.card.id).state.mainScheme.accelerationTokens).toBe(1);
  });

  it("removes a token placed on a card that is not the main scheme, leaving the main scheme's", () => {
    const withMain = playFree(start(), deps, TOKEN.card.id).state;
    const withPrey = playFree(withMain, deps, REVEAL_PREY.card.id).state;
    expect(mustInstance(withPrey, preyId(withPrey)!).counters["acceleration"]).toBe(1);
    const { state, session } = playFree(withPrey, deps, REMOVE_PREY.card.id);
    expect(mustInstance(state, preyId(state)!).counters["acceleration"] ?? 0).toBe(0);
    expect(state.mainScheme.accelerationTokens).toBe(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
