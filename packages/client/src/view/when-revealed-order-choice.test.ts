/**
 * The When Revealed order choice (engine prompt `orderWhenRevealed`; FFG ruling, September 22, 2026: incite, printed
 * When Revealed abilities and surge share one timing, and the first player orders them), staged from a real pending
 * choice: a Rhino game whose "I'm Tough!" (01105) is given the surge keyword in the game's card pool, so its reveal
 * has a printed When Revealed and a surge to order. The keyword is the one patched thing; the choice is the engine's.
 */
import { applyCommand, type Command, type GameState, type PendingChoice } from "@mc/engine";
import { cardId, glossaryEntry } from "@mc/content";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { firstSentence, keywordOrderTilesOf } from "./keyword-order-choice.js";

const run = (state: GameState, command: Command): GameState => {
  const result = applyCommand(state, command, POOL_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
};
const answerDefault = (state: GameState): GameState => {
  const choice = state.pendingChoice!;
  return run(state, {
    type: "resolveChoice",
    playerId: choice.playerId,
    choiceId: choice.choiceId,
    selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
  });
};

let asked: { state: GameState; choice: PendingChoice } | null = null;

beforeAll(async () => {
  const core = new EngineSessionCore();
  const started = await core.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "tigra-aggression" }],
    seed: 11,
    // Round 1: a boost card, then "I'm Tough!" revealed.
    stack: { encounter: ["01098", "01105"].map(cardId) },
  });
  const base = { ...started.snapshot.state, cardPool: started.cardPool } as GameState;
  let state: GameState = {
    ...base,
    cardPool: { ...base.cardPool, "01105": { ...base.cardPool["01105"]!, keywords: [{ name: "surge" }] } },
  } as GameState;
  for (let guard = 0; guard < 400 && !asked; guard++) {
    if (state.pendingChoice) {
      if (state.pendingChoice.prompt.kind === "orderWhenRevealed") asked = { state, choice: state.pendingChoice };
      else state = answerDefault(state);
      continue;
    }
    if (state.outcome || state.round > 2) break;
    state = run(state, { type: "endTurn", playerId: state.players[0]!.playerId } as Command);
  }
}, 120_000);

describe("the When Revealed order choice tiles", () => {
  test("the engine asks the first player to order the printed When Revealed and the surge", () => {
    expect(asked, "the engine asked for the order").not.toBeNull();
    expect(asked!.choice.playerId).toBe(asked!.state.firstPlayerId);
    expect(asked!.choice.options.map((o) => o.optionId)).toEqual(["01105.when-revealed", "surge"]);
  });

  test("the printed ability reads as its own paragraph of the card's text, the surge as its glossary line", () => {
    const { state, choice } = asked!;
    const tiles = keywordOrderTilesOf(choice, state)!;
    expect(tiles.get("01105.when-revealed")).toMatchObject({
      name: "When Revealed",
      line: expect.stringMatching(/^When Revealed: Give Rhino a tough status card\./),
    });
    expect(tiles.get("surge")).toMatchObject({
      name: "Surge",
      line: firstSentence(glossaryEntry("surge")!.definition),
    });
  });

  test("an orderSpecials choice draws only its incite and surge options as tiles", () => {
    const { choice } = asked!;
    const specials = {
      ...choice,
      prompt: { kind: "orderSpecials" },
      options: [
        { optionId: "i9:incite", label: "Scheme: Incite 1", ref: { kind: "card", instanceId: "i9" } },
        { optionId: "i9:x.when-revealed", label: "Scheme", ref: { kind: "ability", instanceId: "i9", abilityId: "x" } },
        { optionId: "i9:surge", label: "Scheme: Surge", ref: { kind: "card", instanceId: "i9" } },
      ],
    } as unknown as PendingChoice;
    expect([...keywordOrderTilesOf(specials)!.keys()]).toEqual(["i9:incite", "i9:surge"]);
  });
});
