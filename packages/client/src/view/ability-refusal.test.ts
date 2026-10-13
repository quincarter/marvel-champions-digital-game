/**
 * "Why can't I use this?" for Hercules's New Labors of Hercules (docs/phase7-wave10-client.md 5.3), from a real game: the
 * engine's own refusal (`legalActions`' illegal list) and the part of the ability's condition that failed, read through
 * the engine's `resolveValue`. Ancient Rivalry is checked here too: with no Thor in the game the engine refuses it with its own sentence.
 */
import {
  applyCommand,
  legalActions,
  type Command,
  type GameState,
  type InstanceId,
  type LegalActions,
  type PlayerId,
} from "@mc/engine";
import type { AbilityId } from "@mc/content";
import { WAVE10_DEPS } from "@mc/cards";
import { beforeAll, describe, expect, test } from "vitest";
import { abilityRefusalReason, refusedAbilityLine, CONDITION_UNMET } from "./ability-refusal.js";
import { heroPackGame } from "./hero-pack-fixture.js";
import { highlights } from "./highlights.js";

const DEPS = WAVE10_DEPS;
const NEW_LABORS = "59001b.new-labors-of-hercules" as AbilityId;
let game: GameState;
let me: PlayerId;
let identity: InstanceId;

beforeAll(() => {
  game = heroPackGame("hercules");
  me = game.players[0]!.playerId;
  identity = game.players[0]!.identity.instanceId;
}, 120_000);

function run(state: GameState, command: Command): GameState {
  const result = applyCommand(state, command, DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
}

function settle(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 40 && current.pendingChoice; guard++) {
    const choice = current.pendingChoice;
    current = run(current, {
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
    });
  }
  return current;
}

const turn = (state: GameState): Extract<LegalActions, { kind: "turn" }> => {
  const legal = legalActions(state, me, DEPS);
  if (legal.kind !== "turn") throw new Error(`expected a turn, got ${legal.kind}`);
  return legal;
};

/** New Labors used once: a Labor card is revealed and stays in play. */
function withLaborInPlay(state: GameState): GameState {
  const entry = turn(state).legal.find((e) => e.action.kind === "useAbility" && e.action.abilityId === NEW_LABORS)!;
  return settle(run(state, entry.example));
}

describe("New Labors of Hercules refused", () => {
  test("usable at the start: nothing is refused and no line is drawn", () => {
    const marks = highlights(legalActions(game, me, DEPS));
    expect(marks.usableAbilities.has(identity)).toBe(true);
    expect(marks.refusedAbilities?.get(identity)).toBeUndefined();
  });

  test("with a Labor card in play: the engine refuses, and the line says a Labor card is in play", () => {
    const state = withLaborInPlay(game);
    const refused = turn(state).illegal.find((e) => e.action.kind === "useAbility");
    expect(refused?.message).toBe("that ability cannot be triggered: its condition is not met");
    const marks = highlights(legalActions(state, me, DEPS));
    expect(marks.refusedAbilities?.get(identity)).toEqual([NEW_LABORS]);
    expect(abilityRefusalReason(state, identity, me, NEW_LABORS, DEPS)).toBe("a Labor card is in play");
    expect(refusedAbilityLine(state, identity, me, NEW_LABORS, DEPS)).toBe("Can't use: a Labor card is in play");
  });

  test("with the Labor deck empty: the line says the deck is empty", () => {
    const seat = game.players[0]!;
    const emptied = {
      ...game,
      players: game.players.map((entry, at) =>
        at === 0
          ? { ...entry, separateDecks: { ...entry.separateDecks, Labor: { ...seat.separateDecks.Labor!, deck: [] } } }
          : entry,
      ),
    } as GameState;
    const marks = highlights(legalActions(emptied, me, DEPS));
    expect(marks.refusedAbilities?.get(identity)).toEqual([NEW_LABORS]);
    expect(abilityRefusalReason(emptied, identity, me, NEW_LABORS, DEPS)).toBe("the Labor deck is empty");
  });

  test("an ability with no condition, or one it cannot word, keeps the engine's sentence", () => {
    expect(abilityRefusalReason(game, identity, me, "59001a.atonement" as AbilityId, DEPS)).toBe(CONDITION_UNMET);
    expect(abilityRefusalReason(game, identity, me, "no.such-ability" as AbilityId, DEPS, "because")).toBe("because");
  });
});

describe("Ancient Rivalry (59026) without Thor", () => {
  test("is refused by the engine; the hand's own Team-Up tag already says it needs its partner", () => {
    const rivalry = Object.keys(game.instances).find((id) => game.instances[id]!.cardId === "59026") as InstanceId;
    const hero = run(game, { type: "changeForm", playerId: me });
    const staged = {
      ...hero,
      players: hero.players.map((entry, at) =>
        at === 0
          ? {
              ...entry,
              hand: [rivalry, ...entry.hand.filter((x) => x !== rivalry)],
              deck: entry.deck.filter((x) => x !== rivalry),
              discard: entry.discard.filter((x) => x !== rivalry),
            }
          : entry,
      ),
    } as GameState;
    const legal = turn(staged);
    const refused = legal.illegal.find((e) => e.action.kind === "playCard" && e.action.instanceId === rivalry);
    expect(refused?.message).toBe("Team-Up needs Thor in play");
  });
});
