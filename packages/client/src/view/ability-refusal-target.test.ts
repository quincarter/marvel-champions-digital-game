/**
 * "Why can't I use this?" for an ability refused for want of a target (#412): Jessica Jones' obligation Work-Life
 * Balance, "Choose: • Remove an ally you control from the game → … • Confuse your identity → …", in a real game. With
 * Inspiring Pottery (Art Museum Heist 60123) on her she is stalwart and cannot be confused (RRG 1.8 "Stalwart", p. 40),
 * so with no ally the engine refuses the action, and Inspect's "Right now" says which target each option is missing.
 */
import { JJ_STARTER_DECKS, cardId, type AbilityId } from "@mc/content";
import { WAVE11_CARDS, WAVE11_DEPS, constant, coreScenario, rule } from "@mc/cards";
import {
  applyCommand,
  createGame,
  legalActions,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { targetRefusalReason, unavailableOptionLines } from "./ability-refusal.js";
import { logLine } from "./log-lines.js";
import { inspectModel } from "./inspect-model.js";

const DEPS = WAVE11_DEPS;
const WORK_LIFE = "61030";
const POTTERY = "60123";
const WORK_LIFE_A = "61030.work-life-balance-action" as AbilityId;
const NO_ALLY = "you control no ally";

let game: GameState;
let me: PlayerId;
let identity: InstanceId;
let workLife: InstanceId;

/** Jessica Jones alone against Core's Rhino, past setup, in alter-ego form. */
function jessicaGame(): GameState {
  const deck = JJ_STARTER_DECKS[0]!;
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE11_CARDS,
  } as never);
  const seat = {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards.flatMap((line) => Array.from({ length: line.quantity }, () => line.cardId)),
  };
  const created = createGame({ ...base, players: [seat], requireLegalDecks: false }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let state = created.state;
  for (let guard = 0; state.pendingChoice && state.step.phase !== "player"; guard++) {
    if (guard > 300) throw new Error("setup choices did not settle");
    const choice = state.pendingChoice;
    const ids = choice.options.slice(0, choice.minSelections).map((option) => option.optionId);
    const result = applyCommand(
      state,
      { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: ids },
      DEPS,
    );
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }
  return state;
}

/** Surgery: `id` out of every pile and into `player`'s play area, faceup; with `host`, attached to it instead. */
function intoPlay(state: GameState, id: InstanceId, player: PlayerId, host: InstanceId | null = null): GameState {
  const out = (pile: readonly InstanceId[]) => pile.filter((x) => x !== id);
  const players = state.players.map((p) => ({
    ...p,
    deck: out(p.deck),
    hand: out(p.hand),
    discard: out(p.discard),
    playArea: p.playerId === player && host === null ? [...out(p.playArea), id] : out(p.playArea),
  }));
  const encounterDecks = Object.fromEntries(
    Object.entries(state.encounterDecks).map(([key, pile]) => [
      key,
      { ...pile, deck: out(pile.deck), discard: out(pile.discard) },
    ]),
  );
  const instances = {
    ...state.instances,
    [id]: { ...state.instances[id]!, faceup: true, controllerId: player, attachedTo: host },
    ...(host
      ? { [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, id] } }
      : {}),
  };
  return { ...state, players, encounterDecks, instances } as GameState;
}

const withPottery = (state: GameState): GameState => {
  const pottery = state.players[0]!.deck[0]!;
  const relabelled = {
    ...state,
    instances: { ...state.instances, [pottery]: { ...state.instances[pottery]!, cardId: cardId(POTTERY) } },
  };
  return intoPlay(relabelled, pottery, me, identity);
};

const confused = (state: GameState): GameState => ({
  ...state,
  instances: {
    ...state.instances,
    [identity]: { ...state.instances[identity]!, statuses: { stunned: 0, confused: 1, tough: 0 } },
  },
});

const rightNow = (state: GameState): string =>
  inspectModel(state, workLife, legalActions(state, me, DEPS), me, DEPS).status.message;

beforeAll(() => {
  const base = jessicaGame();
  me = base.players[0]!.playerId;
  identity = base.players[0]!.identity.instanceId;
  workLife = Object.values(base.instances).find((i) => i.cardId === cardId(WORK_LIFE))!.instanceId;
  game = intoPlay(base, workLife, me);
}, 120_000);

describe("targetRefusalReason (#412)", () => {
  test("Work-Life Balance is usable with no ally while Jessica can be confused: nothing to explain", () => {
    expect(rightNow(game)).toMatch(/^Playable/);
    expect(targetRefusalReason(game, workLife, me, WORK_LIFE_A, DEPS)).toBeNull();
  });

  test("stalwart from Inspiring Pottery and no ally: each option's missing target is named", () => {
    const state = withPottery(game);
    expect(targetRefusalReason(state, workLife, me, WORK_LIFE_A, DEPS)).toBe(
      `${NO_ALLY}, and Jessica Jones is stalwart and cannot be confused`,
    );
    expect(rightNow(state)).toBe(
      `that ability has no valid target: ${NO_ALLY}, and Jessica Jones is stalwart and cannot be confused`,
    );
  });

  test("already confused and no ally: says she is already confused", () => {
    expect(rightNow(confused(game))).toBe(
      `that ability has no valid target: ${NO_ALLY}, and Jessica Jones is already confused`,
    );
  });
});

describe("a status prohibition that is neither stalwart nor a status already held (#414 review)", () => {
  // Inspiring Pottery's grant swapped for "attached character cannot be confused" (a `cannotHaveStatus` rule, as
  // Ronan's): Jessica cannot be confused, but she is not stalwart and holds no confused card.
  const deps: EngineDeps = {
    ...DEPS,
    abilities: {
      ...DEPS.abilities,
      "60123.inspiring-pottery-constant": constant(
        rule({ kind: "cannotHaveStatus", target: { hostOfSelf: true }, statuses: ["confused"] }),
      ),
    },
  };

  test("the engine still refuses, and no reason it has not established is given", () => {
    const state = withPottery(game);
    expect(state.instances[identity]!.statuses.confused).toBe(0);
    expect(targetRefusalReason(state, workLife, me, WORK_LIFE_A, deps)).toBeNull();
    expect(inspectModel(state, workLife, legalActions(state, me, deps), me, deps).status.message).toBe(
      "that ability has no valid target",
    );
  });
});

describe("unavailableOptionLines: each option not offered, and why (#412)", () => {
  const confuseOption = (): { index: number; label: string } => {
    const choice = DEPS.abilities[WORK_LIFE_A]!.effects.find((effect) => effect.kind === "chooseOne")!;
    const options = choice.kind === "chooseOne" ? choice.options : [];
    return { index: 1, label: options[1]!.label };
  };

  test("a missing target is worded from what the engine recorded, not from the state now", () => {
    const { index, label } = confuseOption();
    const missing = {
      target: { categories: ["identity" as const], controller: "you" as const, canTakeStatus: "confused" as const },
      blocked: { instanceId: identity, status: "confused" as const, cause: "stalwart" as const },
    };
    const unavailable = {
      chooserId: me,
      sourceInstanceId: workLife,
      abilityId: WORK_LIFE_A,
      options: [{ index, label, reason: "noTarget" as const, missing }],
    };
    // Read against a game where Pottery is gone and she holds a confused card (a resumed game's log): still the
    // reason recorded when the option was barred.
    expect(unavailableOptionLines(confused(game), unavailable, DEPS)).toEqual([
      `${label}: Jessica Jones is stalwart and cannot be confused`,
    ]);
    const noAlly = {
      ...unavailable,
      options: [
        {
          index: 0,
          label: "Remove an ally",
          reason: "noTarget" as const,
          missing: { target: { categories: ["ally" as const], controller: "you" as const } },
        },
      ],
    };
    expect(unavailableOptionLines(game, noAlly, DEPS)).toEqual(["Remove an ally: you control no ally"]);
  });

  test("any other rule is said in words, never guessed at", () => {
    const unavailable = {
      chooserId: me,
      sourceInstanceId: null,
      abilityId: null,
      options: [
        { index: 0, label: "Avoid", reason: "cannotChoose" as const },
        { index: 1, label: "Pay up", reason: "cannotPay" as const },
        { index: 2, label: "Campaign only", reason: "condition" as const },
        { index: 3, label: "Hit a scheme", reason: "noTarget" as const },
      ],
    };
    expect(unavailableOptionLines(game, unavailable, DEPS)).toEqual([
      "Avoid: a card in play says you cannot choose it",
      "Pay up: you cannot pay its cost",
      "Campaign only: its condition is not met",
      "Hit a scheme: it has no valid target",
    ]);
  });

  test("with an ally and Jessica stalwart, the ally option is taken alone and the log says why confuse was not offered", () => {
    const ally = game.players[0]!.deck[1]!;
    const relabelled = {
      ...game,
      instances: { ...game.instances, [ally]: { ...game.instances[ally]!, cardId: cardId("01067") } },
    };
    const state = withPottery(intoPlay(relabelled, ally, me));
    const result = applyCommand(
      state,
      { type: "useAbility", playerId: me, cardInstanceId: workLife, abilityId: WORK_LIFE_A, payment: [] },
      DEPS,
    );
    if (!result.ok) throw new Error(result.error.message);
    let settled = result.state;
    const events = [...result.events];
    for (let guard = 0; settled.pendingChoice && guard < 20; guard++) {
      const choice = settled.pendingChoice;
      const next = applyCommand(
        settled,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: choice.options.slice(0, Math.max(1, choice.minSelections)).map((o) => o.optionId),
        },
        DEPS,
      );
      if (!next.ok) throw new Error(next.error.message);
      settled = next.state;
      events.push(...next.events);
    }
    const chosen = events.find((event) => event.type === "optionChosen")!;
    const line = logLine(chosen, settled, me, DEPS, false, undefined, { events, at: events.indexOf(chosen) });
    const { label } = confuseOption();
    expect(line?.text).toBe(
      `Only option left: Remove an ally you control from the game. Not available: ${label}: Jessica Jones is stalwart and cannot be confused.`,
    );
  });
});

describe("an option's own condition, worded from its shape (#412)", () => {
  test("Plot Convenience's take option with nothing attached: no card is attached here", () => {
    const unavailable = {
      chooserId: me,
      sourceInstanceId: null,
      abilityId: "44050.plot-convenience-action" as AbilityId,
      options: [{ index: 1, label: "Add 1 card attached here to your hand", reason: "condition" as const }],
    };
    expect(unavailableOptionLines(game, unavailable, DEPS)).toEqual([
      "Add 1 card attached here to your hand: no card is attached here",
    ]);
  });
});
