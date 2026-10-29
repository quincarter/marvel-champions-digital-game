/**
 * The "each time" loop's keyword order (`orderLoopKeywords`, FFG ruling 38, Nov 19, 2024), staged from a real game:
 * Drang III (16060) discards the top 4 encounter cards in solo and puts each minion into play, and two Kree Privates
 * (16134, quickstrike) are stacked on top, so the engine asks the first player which quickstrike resolves first. The
 * two options carry the same label ("Quickstrike: Kree Private"); the tiles tell them apart. The deck order and Drang
 * II's damage are the only things patched; the choice and its answer are the engine's.
 */
import { applyCommand, type Command, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { glossaryEntry } from "@mc/content";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { canConfirmChoice, toggledSelection } from "./choice-focus.js";
import { choiceHeaderOf, LOOP_KEYWORDS_SUBTITLE, promptTitleOf } from "./choice-source.js";
import { firstSentence, keywordOrderTilesOf } from "./keyword-order-choice.js";
import { appendEvents, emptyLog } from "./log-lines.js";

const KREE_PRIVATE = "16134";

const run = (state: GameState, command: Command) => {
  const result = applyCommand(state, command, POOL_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result;
};
const answer = (state: GameState, selectedOptionIds: readonly string[]): Command => ({
  type: "resolveChoice",
  playerId: state.pendingChoice!.playerId,
  choiceId: state.pendingChoice!.choiceId,
  selectedOptionIds,
});
const defaultAnswer = (state: GameState): Command =>
  answer(
    state,
    state.pendingChoice!.options.slice(0, state.pendingChoice!.minSelections).map((option) => option.optionId),
  );

/** Applies `command`, then answers whatever else is asked with the fewest picks; every event, in order. */
function resolveAll(state: GameState, command: Command): { state: GameState; events: GameEvent[] } {
  let result = run(state, command);
  const events = [...result.events];
  for (let guard = 0; guard < 50 && result.state.pendingChoice; guard++) {
    result = run(result.state, defaultAnswer(result.state));
    events.push(...result.events);
  }
  return { state: result.state, events };
}

const minionsOf = (state: GameState): InstanceId[] =>
  state.pendingChoice!.options.map((o) => (o.ref.kind === "card" ? o.ref.instanceId : ("" as InstanceId)));

let asked: GameState;
/** The two Kree Privates, in the order they sit on the deck: the order the loop discards them. */
let discardOrder: InstanceId[];

beforeAll(async () => {
  const core = new EngineSessionCore();
  const started = await core.start({
    scenarioId: "brotherhood-of-badoon",
    difficulty: "expert",
    players: [{ starterDeckId: "groot-protection" }],
    seed: 2026,
    modularSetIds: ["kree_militant"],
  });
  let state = { ...started.snapshot.state, cardPool: started.cardPool } as GameState;
  while (state.pendingChoice) state = run(state, defaultAnswer(state)).state;
  const p1 = state.players[0]!.playerId;
  // A quickstrike attack is made on a hero: Groot flips first.
  state = run(state, { type: "changeForm", playerId: p1 }).state;
  const villain = state.villains[0]!;
  const deckId = villain.encounterDeckId as keyof GameState["encounterDecks"];
  const piles = state.encounterDecks[deckId]!;
  const typeOf = (id: InstanceId) => state.cardPool[state.instances[id]!.cardId]?.type;
  const privates = piles.deck.filter((id) => state.instances[id]!.cardId === KREE_PRIVATE).slice(0, 2);
  const fillers = piles.deck.filter((id) => typeOf(id) === "treachery").slice(0, 2);
  discardOrder = privates;
  const top = [...privates, ...fillers];
  state = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...piles, deck: [...top, ...piles.deck.filter((id) => !top.includes(id))] },
    },
    instances: { ...state.instances, [villain.instanceId]: { ...state.instances[villain.instanceId]!, damage: 26 } },
  } as GameState;
  // Groot's basic attack defeats Drang II; Drang III's When Revealed runs the loop.
  asked = run(state, {
    type: "basicAttack",
    playerId: p1,
    attackerInstanceId: state.players[0]!.identity.instanceId,
    targetInstanceId: villain.instanceId,
  }).state;
}, 120_000);

describe("ordering the keywords of minions an 'each time' loop put into play", () => {
  test("the engine asks for the order of the two Kree Privates' quickstrikes, labelled alike", () => {
    const choice = asked.pendingChoice!;
    expect(choice.prompt.kind).toBe("orderLoopKeywords");
    expect(choice.ordered).toBe(true);
    expect(choice.options.map((o) => o.label)).toEqual(["Quickstrike: Kree Private", "Quickstrike: Kree Private"]);
    const minions = minionsOf(asked);
    expect(new Set(minions).size).toBe(2);
    expect(minions).toEqual(discardOrder);
    expect(minions.every((id) => asked.instances[id]?.cardId === KREE_PRIVATE)).toBe(true);
  });

  test("each tile names its keyword, then its minion, which the order it was discarded tells apart", () => {
    const tiles = keywordOrderTilesOf(asked.pendingChoice!, asked)!;
    expect([...tiles.keys()]).toEqual(["0", "1"]);
    expect([...tiles.values()].map((t) => t.name)).toEqual(["Quickstrike", "Quickstrike"]);
    expect([...tiles.values()].map((t) => t.subject)).toEqual([
      "Kree Private, 1st of 2 discarded",
      "Kree Private, 2nd of 2 discarded",
    ]);
    // The hover and press-and-hold read show the minion each tile is about.
    expect([...tiles.values()].map((t) => t.instanceId)).toEqual(minionsOf(asked));
    for (const tile of tiles.values()) expect(tile.line).toBe(firstSentence(glossaryEntry("quickstrike")!.definition));
  });

  test("the header says why the order is asked for", () => {
    const choice = asked.pendingChoice!;
    const header = choiceHeaderOf(asked, choice, POOL_DEPS, promptTitleOf(choice.prompt, POOL_DEPS, choice, asked));
    expect(header.title.toLowerCase()).toContain("order the keywords");
    expect(header.subtitle).toBe(LOOP_KEYWORDS_SUBTITLE);
  });

  test("pressing the second tile, then the first, answers in that order", () => {
    const choice = asked.pendingChoice!;
    let picks = toggledSelection([], "1", choice.maxSelections);
    expect(canConfirmChoice(choice, picks.length)).toBe(false);
    picks = toggledSelection(picks, "0", choice.maxSelections);
    expect(picks).toEqual(["1", "0"]);
    expect(canConfirmChoice(choice, picks.length)).toBe(true);
    // A second press takes a pick back, and the next press goes to the end.
    expect(toggledSelection(toggledSelection(picks, "1", 2), "1", 2)).toEqual(["0", "1"]);
  });

  test("the chosen order is the order the attacks resolve in, and the log reads both attacks", () => {
    const [first, second] = minionsOf(asked) as [InstanceId, InstanceId];
    const at = (events: readonly GameEvent[], type: "initiated" | "resolved", id: InstanceId): number =>
      events.findIndex((e) =>
        type === "resolved"
          ? e.type === "attackResolved" && e.enemyInstanceId === id
          : e.type === "triggerEvent" &&
            e.phase === "initiated" &&
            e.event.kind === "enemyAttack" &&
            e.event.enemyInstanceId === id,
      );

    const reversed = resolveAll(asked, answer(asked, ["1", "0"]));
    expect(at(reversed.events, "resolved", second)).toBeGreaterThan(-1);
    expect(at(reversed.events, "resolved", second)).toBeLessThan(at(reversed.events, "initiated", first));

    const listed = resolveAll(asked, answer(asked, ["0", "1"]));
    expect(at(listed.events, "resolved", first)).toBeLessThan(at(listed.events, "initiated", second));

    const log = appendEvents(emptyLog(), reversed.events, reversed.state, asked.players[0]!.playerId, POOL_DEPS);
    // Each attack is one line with its final amount; the bookkeeping between them has none.
    expect(log.lines.filter((line) => line.text.startsWith("Kree Private hit Groot for 1 "))).toHaveLength(2);
    expect(log.lines.some((line) => /await/i.test(line.text))).toBe(false);
  });
});
