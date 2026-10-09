import { cardsInPlay, type PendingChoice } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import {
  BREAKIN_AND_TAKIN,
  CROWD_CONTROL,
  DAREDEVIL,
  HYDRA_BOMBER,
  SURVEILLANCE_TEAM,
  startEnemyPopupGame,
  startThreatPopupGame,
} from "../store/dev-threat-popup-game.js";
import { codeOf } from "../store/dev-game-steps.js";
import { SessionStore } from "../store/session-store.js";
import { choiceTileBarsOf } from "./choice-tile-bars.js";

// Spider-Man's turn against Rhino: Surveillance Team out, Crowd Control at 1 threat, Breakin' & Takin' above it.
const store = new SessionStore(new LocalEngineHost());
await startThreatPopupGame(store);
const state0 = store.state.game!;
const idOf = (code: string): string => cardsInPlay(state0).find((id) => codeOf(state0, id) === code)!;
const team = idOf(SURVEILLANCE_TEAM);
const crowd = idOf(CROWD_CONTROL);
const breakin = idOf(BREAKIN_AND_TAKIN);

const ability =
  store.state.legal!.actions.kind === "turn"
    ? store.state.legal!.actions.legal.find((e) => e.action.kind === "useAbility" && e.action.instanceId === team)!
    : undefined;
await store.dispatch(ability!.example);
const state = store.state.game!;
const choice = state.pendingChoice as PendingChoice;

describe("choiceTileBarsOf", () => {
  test("Surveillance Team's popup gives each scheme its own threat bar", () => {
    expect(choice.prompt.kind).toBe("chooseTarget");
    const bars = choiceTileBarsOf(state, choice, [], POOL_DEPS);
    expect(bars.get(crowd)).toMatchObject({ kind: "threat", current: 1, after: null });
    const other = bars.get(breakin)!;
    expect(other.kind).toBe("threat");
    expect(other.current).toBeGreaterThan(1);
    expect(other.after).toBeNull();
  });

  test("a picked scheme shows what the effect would remove, read from the engine's preview", () => {
    const bars = choiceTileBarsOf(state, choice, [breakin], POOL_DEPS);
    expect(bars.get(breakin)!.after).toBe(bars.get(breakin)!.current - 1);
    expect(bars.get(crowd)!.after).toBeNull();
    // Thwarting the last threat empties the bar.
    expect(choiceTileBarsOf(state, choice, [crowd], POOL_DEPS).get(crowd)!.after).toBe(0);
  });

  test("a prompt that is not a target pick draws no bars", () => {
    const other = { ...choice, prompt: { kind: "chooseOption" } } as unknown as PendingChoice;
    expect(choiceTileBarsOf(state, other, [], POOL_DEPS).size).toBe(0);
  });
});

describe("choiceTileBarsOf on enemies", () => {
  test("Daredevil's popup gives each enemy its hit point bar and previews the damage on the pick", async () => {
    const enemies = new SessionStore(new LocalEngineHost());
    await startEnemyPopupGame(enemies);
    const before = enemies.state.game!;
    const daredevil = cardsInPlay(before).find((id) => codeOf(before, id) === DAREDEVIL)!;
    const actions = enemies.state.legal!.actions;
    if (actions.kind !== "turn") throw new Error("not Spider-Man's turn");
    const thwart = actions.legal.find(
      (entry) => entry.action.kind === "basicThwart" && entry.action.instanceId === daredevil,
    )!;
    await enemies.dispatch(thwart.example);
    // "After Daredevil thwarts" is a response, so the player first says to use it.
    await enemies.resolveChoice([enemies.state.game!.pendingChoice!.options[0]!.optionId]);
    const game = enemies.state.game!;
    const pending = game.pendingChoice!;
    expect(pending.prompt.kind).toBe("chooseTarget");
    const bomber = cardsInPlay(game).find((id) => codeOf(game, id) === HYDRA_BOMBER)!;
    const plain = choiceTileBarsOf(game, pending, [], POOL_DEPS);
    expect(plain.get(bomber)).toMatchObject({ kind: "hp", after: null });
    const picked = choiceTileBarsOf(game, pending, [bomber], POOL_DEPS).get(bomber)!;
    expect(picked.after).toBe(picked.current - 1);
  }, 60_000);
});
