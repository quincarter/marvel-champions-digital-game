/**
 * The log line of a villain phase replaced by another player phase within the same round (`villainPhaseSkipped` with
 * `playerPhaseInstead`; custom content's Out of the Game), next to the plain skip's (Run Them to Ground).
 */

import { beforeAll, describe, expect, test } from "vitest";
import type { GameEvent, GameState, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { logLine } from "./log-lines.js";

let state: GameState;
let me: PlayerId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 3,
  });
  state = store.state.game!;
  me = store.state.perspectiveId!;
}, 30_000);

const text = (event: GameEvent): string => logLine(event, state, me, POOL_DEPS)!.text;

describe("villainPhaseSkipped", () => {
  test("a player phase played instead", () => {
    expect(text({ type: "villainPhaseSkipped", round: 1, remaining: 0, playerPhaseInstead: true })).toBe(
      "Another player phase is played before the villain phase.",
    );
  });

  test("a plain skip", () => {
    expect(text({ type: "villainPhaseSkipped", round: 1, remaining: 0 })).toBe(
      "The villain phase is skipped this round.",
    );
  });
});
