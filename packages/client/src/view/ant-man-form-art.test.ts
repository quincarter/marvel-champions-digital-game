/**
 * Ant-Man's identity shows the form he is in, whichever it is (#244): Scott Lang, Tiny or Giant, on the table (the tile's
 * art, `faceOf`) and in Inspect and the hover popover (`inspectModel`), with that form's type line.
 */
import type { GameState, PlayerId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { artFor, artPathOf } from "../art/art-source.js";
import { faceOf } from "./board-model.js";
import { inspectModel } from "./inspect-model.js";

let state: GameState;
let me: PlayerId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "ant-leadership" }],
    seed: 3,
  });
  state = store.state.game!;
  me = store.state.perspectiveId!;
}, 60_000);

/** The game with Ant-Man in `form` (and, as a hero, `heroFormIndex`): 0 is Tiny, 1 is Giant. */
function inForm(form: "alterEgo" | "hero", heroFormIndex = 0): GameState {
  const player = state.players[0]!;
  return {
    ...state,
    players: [{ ...player, identity: { ...player.identity, form, heroFormIndex } }, ...state.players.slice(1)],
  } as GameState;
}

describe("Ant-Man shows the form he is in", () => {
  test.each([
    ["Scott Lang", "alterEgo", 0, "bundles/cards/12001b.png", "ALTER-EGO"],
    ["Tiny", "hero", 0, "bundles/cards/12001a.png", "HERO · AVENGER · TINY"],
    ["Giant", "hero", 1, "bundles/cards/12001c.png", "HERO · AVENGER · GIANT"],
  ] as const)("%s", (_name, form, index, scan, typeLine) => {
    const game = inForm(form, index);
    const identity = game.players[0]!.identity.instanceId;
    const tile = artFor(game.cardPool[game.instances[identity]!.cardId], faceOf(game, identity));
    expect(tile && artPathOf(tile)).toBe(scan);
    const inspect = inspectModel(game, identity, null, me, POOL_DEPS);
    expect(inspect.art && artPathOf(inspect.art)).toBe(scan);
    expect(inspect.typeLine.startsWith(typeLine)).toBe(true);
  });
});
