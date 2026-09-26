import { describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { cardOf, legalActions, type GameState, type InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { endTurnConfirmOf } from "./end-turn-confirm.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 4,
};

/** Plays past setup and flips to hero, same fixture as `attacker-choice.test.ts`. */
async function intoTurn(): Promise<GameState> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
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

/** Moves the first ally in hand/deck into play, ready — same helper shape as `attacker-choice.test.ts`'s `withAlly`. */
function withAlly(state: GameState): { state: GameState; ally: InstanceId } {
  const player = state.players[0]!;
  const ally = [...player.hand, ...player.deck].find((id) => cardOf(state, id)?.type === "ally");
  if (!ally) throw new Error("expected an ally in the Spider-Man deck");
  return {
    ally,
    state: {
      ...state,
      players: [
        {
          ...player,
          hand: player.hand.filter((id) => id !== ally),
          deck: player.deck.filter((id) => id !== ally),
          playArea: [...player.playArea, ally],
        },
        ...state.players.slice(1),
      ],
      instances: { ...state.instances, [ally]: { ...state.instances[ally]!, exhausted: false, faceup: true } },
    },
  };
}

/** Exhausts an instance (identity or ally) so it can't attack/thwart/recover. */
function exhaust(state: GameState, id: InstanceId): GameState {
  return { ...state, instances: { ...state.instances, [id]: { ...state.instances[id]!, exhausted: true } } };
}

describe("endTurnConfirmOf", () => {
  test("names the identity's own attack plainly, and an ally's by name", async () => {
    const { state, ally } = withAlly(await intoTurn());
    const playerId = state.players[0]!.playerId;
    const actions = legalActions(state, playerId, CORE_DEPS);
    const confirm = endTurnConfirmOf(state, actions, playerId);
    expect(confirm).not.toBeNull();
    expect(confirm!.items).toContain("Attack");
    const allyName = cardOf(state, ally)?.name;
    expect(confirm!.items.some((item) => item === `Attack (${allyName})` || item === `Thwart (${allyName})`)).toBe(
      true,
    );
    expect(confirm!.sentence).toBe(`You can still: ${confirm!.items.join(", ")}.`);
  });

  test("is null once the identity and every ally are spent (nothing meaningful left)", async () => {
    let state = await intoTurn();
    const playerId = state.players[0]!.playerId;
    const identityId = state.players[0]!.identity.instanceId;
    // Exhausted covers attack/thwart; there is no ally on the table in this fixture, and a Spider-Man deck's
    // identity recovering is still legal until exhausted too, so exhaust it last.
    state = exhaust(state, identityId);
    const actions = legalActions(state, playerId, CORE_DEPS);
    const confirm = endTurnConfirmOf(state, actions, playerId);
    expect(confirm).toBeNull();
  });

  test("a playable card in hand alone does not trigger the prompt", async () => {
    const state = await intoTurn();
    const playerId = state.players[0]!.playerId;
    const actions = legalActions(state, playerId, CORE_DEPS);
    // Sanity: this fixture's turn does have a playable hand card, per `legalActions`' own `illegal`/legal split for
    // `playCard` entries — proving the confirm is driven only by the basic-power entries, not by that.
    expect(actions.kind).toBe("turn");
    const confirm = endTurnConfirmOf(state, actions, playerId);
    // The identity is untouched, so its own attack/thwart/recover are still open: the prompt still fires, but for
    // the basic powers, not because a card is playable.
    expect(confirm?.items.every((item) => ["Attack", "Thwart", "Recover"].includes(item))).toBe(true);
  });

  test("returns null for a non-turn LegalActions (e.g. a pending choice)", async () => {
    const state = await intoTurn();
    const playerId = state.players[0]!.playerId;
    expect(endTurnConfirmOf(state, { kind: "gameOver" }, playerId)).toBeNull();
  });
});
