import { describe, expect, test } from "vitest";
import type { GameState, InstanceId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { handSizeNoteOf, smallHandSizeConfirmOf } from "./hand-size-note.js";

const solo = (starterDeckId: string): SessionConfig => ({
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId }],
  seed: 4,
});

/** Plays past setup and flips to hero, the fixture `end-turn-confirm.test.ts` uses. */
async function heroTurn(starterDeckId: string): Promise<GameState> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(solo(starterDeckId));
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  const legal = store.state.legal?.actions;
  if (legal?.kind === "turn") {
    const flip = legal.legal.find((entry) => entry.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
  }
  return store.state.game!;
}

/** The first copy of `code` in the player's deck put straight into play under their control (surgery). */
function intoPlay(state: GameState, code: string): GameState {
  const player = state.players[0]!;
  const id = player.deck.find((card) => state.instances[card]?.cardId === code) as InstanceId | undefined;
  if (!id) throw new Error(`no ${code} in the deck`);
  return {
    ...state,
    players: [
      { ...player, deck: player.deck.filter((card) => card !== id), playArea: [...player.playArea, id] },
      ...state.players.slice(1),
    ],
    instances: {
      ...state.instances,
      [id]: { ...state.instances[id]!, faceup: true, controllerId: player.playerId },
    },
  };
}

/** Holding exactly `count` cards, the rest back on the deck. */
function holding(state: GameState, count: number): GameState {
  const player = state.players[0]!;
  return {
    ...state,
    players: [
      { ...player, hand: player.hand.slice(0, count), deck: [...player.deck, ...player.hand.slice(count)] },
      ...state.players.slice(1),
    ],
  };
}

const TECH_TEXT = '"You get +1 hand size for each Tech upgrade you control (to a maximum hand size of 7)."';

describe("Iron Man's hand size, explained (issue #150)", () => {
  test("hero form with no Tech upgrade: 1, the Tech rule at +0, Tony Stark's 6", async () => {
    const state = holding(await heroTurn("core-iron-man-aggression"), 1);
    const me = state.players[0]!.playerId;

    expect(handSizeNoteOf(state, me, POOL_DEPS)).toEqual({
      handSize: 1,
      held: 1,
      willDraw: 0,
      why: [
        "Printed hand size 1 (Iron Man).",
        `Iron Man: +0 now. ${TECH_TEXT}`,
        "Tony Stark (alter-ego): printed hand size 6.",
      ],
    });
    expect(smallHandSizeConfirmOf(state, me, POOL_DEPS)).toBe(
      [
        "Iron Man's hand size is only 1: you hold 1, so the end-of-turn draw adds nothing.",
        "Printed hand size 1 (Iron Man).",
        `Iron Man: +0 now. ${TECH_TEXT}`,
        "Tony Stark (alter-ego): printed hand size 6.",
      ].join("\n"),
    );
  });

  test("each Tech upgrade in play counts: two make it 3, still under 4, so it still asks", async () => {
    let state = holding(await heroTurn("core-iron-man-aggression"), 0);
    state = intoPlay(intoPlay(state, "01035"), "01039");
    const me = state.players[0]!.playerId;

    const note = handSizeNoteOf(state, me, POOL_DEPS)!;
    expect(note.handSize).toBe(3);
    expect(note.willDraw).toBe(3);
    expect(note.why[1]).toBe(`Iron Man: +2 now. ${TECH_TEXT}`);
    expect(smallHandSizeConfirmOf(state, me, POOL_DEPS)).toMatch(
      /^Iron Man's hand size is only 3: you hold 0, so the end-of-turn draw adds 3\./,
    );
  });

  test("a third makes it 4: no confirm", async () => {
    let state = await heroTurn("core-iron-man-aggression");
    state = intoPlay(intoPlay(intoPlay(state, "01035"), "01039"), "01037");
    expect(smallHandSizeConfirmOf(state, state.players[0]!.playerId, POOL_DEPS)).toBeNull();
  });

  test("a hero with an ordinary hand size never asks (Spider-Man, 5)", async () => {
    const state = holding(await heroTurn("core-spider-man-justice"), 0);
    const me = state.players[0]!.playerId;
    expect(handSizeNoteOf(state, me, POOL_DEPS)?.handSize).toBe(5);
    expect(smallHandSizeConfirmOf(state, me, POOL_DEPS)).toBeNull();
  });
});
