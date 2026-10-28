/**
 * The villain phase's "You drew N cards" line against a real game whose end-of-turn refill stops across commands. The
 * refill draws one card at a time and resolves a drawn card's ability before the next (RRG 1.8 "Hand Size", p. 21;
 * ruling Aug 14, 2025). Mystique's Infiltration (32082), shuffled into the player's deck, has "Forced Response: After
 * this card enters your hand, discard an ally or support you control"; with two to pick from, the refill waits on that
 * choice, and the rest of the refill (and the villain phase's start) come in the command that answers it.
 */
import { describe, expect, it } from "vitest";
import { cardId } from "@mc/content";
import { PLAYABLE_DEPS, playableScenario } from "@mc/cards";
import {
  activeEncounterDeckId,
  applyCommand,
  createGame,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { NO_REFILL, endOfTurnDrawsOf, trackRefill, type EndOfTurnDraws } from "./villain-end-of-turn.js";

const deps = PLAYABLE_DEPS;
const INFILTRATION = "32082";
const DAREDEVIL = "01058";
const AUNT_MAY = "01006";

function run(state: GameState, command: Command): { state: GameState; events: readonly GameEvent[] } {
  const result = applyCommand(state, command, deps);
  if (!result.ok) throw new Error(result.error.message);
  return { state: result.state, events: result.events };
}

/** Answers `state`'s choice with `pick` when it offers that option, else with the fewest options it allows. */
function answer(state: GameState, pick?: InstanceId): Command {
  const choice = state.pendingChoice!;
  const ids = choice.options.some((option) => option.optionId === pick)
    ? [pick!]
    : choice.options.slice(0, choice.minSelections).map((option) => option.optionId);
  return { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: ids };
}

/** Sabretooth with the Mystique and Acolytes modular sets, Core Spider-Man alone, past setup. */
function mystiqueGame(): GameState {
  const config = playableScenario("sabretooth", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: ["mystique", "acolytes"],
  } as never);
  const created = createGame(config, deps);
  if (!created.ok) throw new Error(created.error.message);
  let state = created.state;
  for (let guard = 0; state.pendingChoice && state.step.phase !== "player"; guard++) {
    if (guard > 300) throw new Error("setup choices did not settle");
    state = run(state, answer(state)).state;
  }
  return state;
}

/**
 * Daredevil and Aunt May in P1's play area, an empty hand, and Infiltration second from the top of the deck: the
 * refill draws one card, then Infiltration, whose Forced Response asks which of the two to discard.
 */
function staged(): { state: GameState; player: PlayerId; infiltration: InstanceId; auntMay: InstanceId } {
  const base = mystiqueGame();
  const player = base.players[0]!;
  const own = [...player.hand, ...player.deck];
  const find = (code: string): InstanceId => own.find((i) => base.instances[i]!.cardId === cardId(code))!;
  const daredevil = find(DAREDEVIL);
  const auntMay = find(AUNT_MAY);
  const deckId = activeEncounterDeckId(base);
  const piles = base.encounterDecks[deckId]!;
  const infiltration = [...piles.deck, ...piles.discard].find(
    (i) => base.instances[i]!.cardId === cardId(INFILTRATION),
  )!;
  const rest = own.filter((i) => i !== daredevil && i !== auntMay);
  const state: GameState = {
    ...base,
    encounterDecks: {
      ...base.encounterDecks,
      [deckId]: {
        deck: piles.deck.filter((i) => i !== infiltration),
        discard: piles.discard.filter((i) => i !== infiltration),
      },
    },
    players: base.players.map((p) =>
      p.playerId === player.playerId
        ? {
            ...p,
            hand: [],
            playArea: [...p.playArea, daredevil, auntMay],
            deck: [rest[0]!, infiltration, ...rest.slice(1)],
          }
        : p,
    ),
    instances: {
      ...base.instances,
      [daredevil]: { ...base.instances[daredevil]!, faceup: true, exhausted: false, controllerId: player.playerId },
      [auntMay]: { ...base.instances[auntMay]!, faceup: true, exhausted: false, controllerId: player.playerId },
      [infiltration]: { ...base.instances[infiltration]!, faceup: false },
    },
  };
  return { state, player: player.playerId, infiltration, auntMay };
}

describe("the end-of-turn draw recap, when the refill waits on a drawn card's choice", () => {
  it("names every refill card, from the command that ended the turn and the one that answered the choice", () => {
    const { state: start, player, infiltration, auntMay } = staged();
    let { state, events } = run(start, { type: "endTurn", playerId: player });
    const commands: (readonly GameEvent[])[] = [events];
    let tracker = trackRefill(NO_REFILL, events);
    let ended: EndOfTurnDraws | null = tracker.ended;
    for (let guard = 0; !ended; guard++) {
      if (guard > 50) throw new Error("the villain phase never began");
      ({ state, events } = run(state, answer(state, auntMay)));
      commands.push(events);
      tracker = trackRefill(tracker.tracker, events);
      ended = tracker.ended;
    }
    // The refill really did span commands: the turn-ending command drew Infiltration and stopped on the choice.
    const drawsIn = (list: readonly GameEvent[]) =>
      list
        .filter((e) => e.type === "cardDrawn" && e.playerId === player)
        .map((e) => (e as { instanceId: InstanceId }).instanceId);
    expect(drawsIn(commands[0]!)).toEqual([start.players[0]!.deck[0], infiltration]);
    expect(commands.length).toBeGreaterThan(1);

    const hand = state.players.find((p) => p.playerId === player)!.hand;
    // Infiltration stays in the hand; with the empty hand refilled, the recap is exactly the hand, in draw order.
    expect([...ended.bySeat.get(player)!]).toEqual([...hand]);
    expect(hand).toContain(infiltration);
    // Read from the last command alone (the old recap), the first two cards were missing.
    const lastOnly = endOfTurnDrawsOf(commands[commands.length - 1]!);
    expect(lastOnly?.bySeat.get(player)?.length ?? 0).toBeLessThan(hand.length);
  });
});
