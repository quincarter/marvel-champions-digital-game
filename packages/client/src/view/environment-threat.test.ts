/**
 * Threat on an environment reads against the line its own text waits for (issue 182): Batroc's Alert Level holds
 * threat, flips at 4[per_hero] on its Low side and loses the game at 4[per_hero] on its High side, and the tile used to
 * show none of it ("no counters", over the card's own text).
 */
import { describe, expect, test } from "vitest";
import type { GameEvent, GameState, InstanceId, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { POOL_DEPS } from "../content/pool.js";
import { boardModel } from "./board-model.js";
import { logLine } from "./log-lines.js";
import { cardName } from "./names.js";

const DECKS = ["falcon-leadership", "core-spider-man-justice"];

async function batroc(players: number) {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "batroc",
    difficulty: "standard",
    players: DECKS.slice(0, players).map((starterDeckId) => ({ starterDeckId })),
    seed: 4,
  });
  for (let choice = store.state.game!.pendingChoice; choice; choice = store.state.game!.pendingChoice) {
    await store.resolveChoice(choice.minSelections > 0 ? [choice.options[0]!.optionId] : []);
  }
  return { state: store.state.game!, me: store.state.perspectiveId as PlayerId };
}

const alertLevel = (state: GameState, me: PlayerId) => {
  const environment = boardModel(state, me, POOL_DEPS).environments.find((panel) => panel.name === "Alert Level");
  if (!environment) throw new Error("Alert Level is not on the board");
  return environment;
};

/** Alert Level with `threat` on it, on its High side when `high`. */
const withAlert = (state: GameState, id: InstanceId, threat: number, high = false): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...state.instances[id]!, threat, flipped: high } },
});

describe("Alert Level's threat on the board", () => {
  test("solo, Low side: 0/4 threat at setup, and the subtitle says it flips there", async () => {
    const { state, me } = await batroc(1);
    const panel = alertLevel(state, me);
    expect(panel.counters[0]).toEqual({ name: "threat", count: 0, limit: 4 });
    expect(panel.subtitle).toBe("Flips at 4");
  });

  test("two players, High side: 3/8 threat, marked as the line that loses the game", async () => {
    const { state, me } = await batroc(2);
    const id = alertLevel(state, me).instanceId;
    const panel = alertLevel(withAlert(state, id, 3, true), me);
    expect(panel.counters[0]).toEqual({ name: "threat", count: 3, limit: 8, danger: true });
    expect(panel.subtitle).toBe("Lose at 8");
  });

  test("an environment with no threat line and no threat shows no threat entry", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "risky-business",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 11,
    });
    const me = store.state.perspectiveId as PlayerId;
    const [environment] = boardModel(store.state.game!, me, POOL_DEPS).environments;
    expect(environment!.counters.some((counter) => counter.name === "threat")).toBe(false);
    expect(environment!.subtitle).toBe("Environment");
  });
});

describe("the log says why threat appeared with no prompt", () => {
  test("Security Cameras on an exhausted character: the threat line names it as the only option left", async () => {
    const { state, me } = await batroc(1);
    const alert = alertLevel(state, me).instanceId;
    const hero = state.players[0]!.identity.instanceId;
    const placed: GameEvent = { type: "threatPlaced", schemeInstanceId: alert, amount: 2, sourceInstanceId: null };
    const events: GameEvent[] = [
      { type: "targetChosen", slot: "character", instanceIds: [hero] },
      { type: "optionChosen", label: "Place 1 threat on Alert Level (2 on its High side)", index: 1, onlyOption: true },
      placed,
    ];
    const line = logLine(placed, state, me, POOL_DEPS, false, undefined, { events, at: 2 });
    expect(line?.text).toBe(`2 threat placed on Alert Level (the only option left for ${cardName(state, hero)}).`);
    // A choice the player made, or no choice at all, keeps the plain line.
    const asked = events.map((event) =>
      event.type === "optionChosen" ? { type: event.type, label: event.label, index: event.index } : event,
    );
    expect(logLine(placed, state, me, POOL_DEPS, false, undefined, { events: asked, at: 2 })?.text).toBe(
      "2 threat placed on Alert Level.",
    );
    expect(logLine(placed, state, me, POOL_DEPS)?.text).toBe("2 threat placed on Alert Level.");
  });
});
