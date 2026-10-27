/**
 * The log line of a change of form names the face an identity with several hero faces changed to: Wasp's Tiny and
 * Giant faces both print "Wasp", so "flipped to hero form" said neither which one nor, from Tiny to Giant, what
 * happened (a change between two hero faces is not a flip; FFG rulings Jun 17, 2025 and Jun 8, 2023).
 */

import { beforeAll, describe, expect, test } from "vitest";
import type { GameEvent, GameState, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { GIANT_WASP_DEV_CONFIG } from "../store/dev-giant-wasp-game.js";
import { SessionStore } from "../store/session-store.js";
import { logLine } from "./log-lines.js";

let state: GameState;
let me: PlayerId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(GIANT_WASP_DEV_CONFIG);
  state = store.state.game!;
  me = state.players[0]!.playerId;
}, 30_000);

const changed = (fields: Partial<Extract<GameEvent, { type: "formChanged" }>>): GameEvent =>
  ({ type: "formChanged", playerId: me, to: "hero", ...fields }) as GameEvent;
const text = (event: GameEvent, viewer: PlayerId | null = me): string => logLine(event, state, viewer, POOL_DEPS)!.text;

describe("formChanged names the hero face", () => {
  test("from alter-ego to either hero face", () => {
    expect(text(changed({ fromHeroFormIndex: null, heroFormIndex: 0 }))).toBe("You flipped to Tiny Wasp.");
    expect(text(changed({ fromHeroFormIndex: null, heroFormIndex: 1 }))).toBe("You flipped to Giant Wasp.");
  });

  test("between the two hero faces, and by an effect (Ready for a Fight's shape)", () => {
    expect(text(changed({ fromHeroFormIndex: 0, heroFormIndex: 1 }))).toBe("You changed to Giant Wasp.");
    expect(text(changed({ fromHeroFormIndex: 1, heroFormIndex: 0, byEffect: true }))).toBe(
      "You were changed to Tiny Wasp.",
    );
  });

  test("to alter-ego, as before", () => {
    expect(text(changed({ to: "alterEgo", fromHeroFormIndex: 1, heroFormIndex: null }))).toBe(
      "You flipped to alter-ego form.",
    );
  });
});
