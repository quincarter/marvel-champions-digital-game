/**
 * docs/phase7-wave5.md §3.11: text that depends on the mode of play. Synthetic cards shaped like Surprise! (`sm` 27112:
 * "In expert mode, this card gains surge and cannot be canceled"), Frequent Flyers (27108: "gains incite 1") and
 * Ambush! (27100: "(In expert mode, place 2 threat on Light at the End)").
 *
 * Sources: RRG 1.8 "Modes of Play" (p. 29). A revealed treachery is never in play, so its grants to itself are read
 * wherever it is, as its own `cannotBeCanceled` already was (docs/phase7-wave4.md §3.14).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { revealCannotBeCanceled } from "./rules.js";
import { createGame } from "./setup.js";
import type { EffectSpec, Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubTreachery } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, MAIN_SCHEME, VILLAIN } from "./testing/scenario.js";
import { copiesOf, onTopOfEncounterDeck, playFree } from "./testing/wave3.js";

const expert: Predicate = { kind: "inMode", mode: "expert" };
const SURPRISE_DEFINITION: AbilityDefinition = {
  trigger: {
    kind: "constant",
    keywordGrants: [
      { keyword: { name: "surge" }, target: { self: true }, while: expert },
      { keyword: { name: "incite", value: 1 }, target: { self: true }, while: expert },
    ],
    rules: [{ kind: "cannotBeCanceled", cards: { self: true }, while: expert }],
  },
  effects: [],
};
const SURPRISE_CONSTANT = stubAbility("surprise.constant", SURPRISE_DEFINITION);
const SURPRISE = stubTreachery({ id: "surprise", boostIcons: 0, abilities: [SURPRISE_CONSTANT.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const REVEAL = event("reveal", [{ kind: "revealEncounterCard", player: { kind: "controller" } }]);
const AMBUSH_THREAT = event("ambush-threat", [
  {
    kind: "if",
    condition: expert,
    then: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 2 } }],
  },
]);

const deps: EngineDeps = depsOf(SURPRISE_CONSTANT, REVEAL.ability, AMBUSH_THREAT.ability);

function start(difficulty: "standard" | "expert"): GameState {
  const result = createGame(
    {
      seed: 5,
      cards: [...DEFAULT_CARDS, SURPRISE, FILLER, REVEAL.card, AMBUSH_THREAT.card],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: [SURPRISE.id, ...copiesOf(FILLER.id, 20)],
      difficulty,
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, REVEAL.card.id, AMBUSH_THREAT.card.id] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  const state = driveSession(startSession(result.state), deps).session.state;
  return onTopOfEncounterDeck(state, SURPRISE.id);
}

const surpriseId = (state: GameState): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === SURPRISE.id)!.instanceId;
const revealed = (events: readonly GameEvent[]) => events.filter((e) => e.type === "encounterCardRevealed").length;
const threat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;

describe("§3.11 'In expert mode, this card gains surge and cannot be canceled'", () => {
  it("standard: no surge, no incite, cancellable", () => {
    const state = start("standard");
    expect(revealCannotBeCanceled(state, deps, surpriseId(state))).toBe(false);
    const before = threat(state);
    const { events, state: after } = playFree(state, deps, REVEAL.card.id);
    expect(revealed(events)).toBe(1);
    expect(threat(after)).toBe(before);
  });

  it("expert: the revealed treachery gains surge and incite 1 and cannot be canceled; replay deep-equal", () => {
    const state = start("expert");
    expect(revealCannotBeCanceled(state, deps, surpriseId(state))).toBe(true);
    const before = threat(state);
    const { events, state: after, session } = playFree(state, deps, REVEAL.card.id);
    expect(revealed(events)).toBe(2);
    expect(threat(after)).toBe(before + 1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

describe("§3.11 '(In expert mode, place 2 threat …)'", () => {
  it("an ifThen on the mode", () => {
    const standard = start("standard");
    expect(threat(playFree(standard, deps, AMBUSH_THREAT.card.id).state)).toBe(threat(standard));
    const expertGame = start("expert");
    expect(threat(playFree(expertGame, deps, AMBUSH_THREAT.card.id).state)).toBe(threat(expertGame) + 2);
  });
});
