/**
 * The log line of a card put into play on its other face (docs/phase7-wave11-scenarios.md §S3.15; MC60 p. 9 step 12,
 * "into play Failed side faceup"): the face it starts on, read by its first trait, and not a flip.
 */

import { beforeAll, describe, expect, test } from "vitest";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { logLine } from "./log-lines.js";

let state: GameState;
let me: PlayerId;
let id: InstanceId;

/** The game's state with the card at `id` replaced by a double-sided environment whose other face is `traits`. */
const withVenue = (traits: readonly string[]): GameState => {
  const cardId = state.instances[id]!.cardId;
  const venue = {
    ...state.cardPool[cardId]!,
    name: "Synthetic Venue",
    type: "environment",
    flipSide: { name: "Synthetic Venue", traits, keywords: [], text: { printed: "", current: "" }, abilities: [] },
  };
  return { ...state, cardPool: { ...state.cardPool, [cardId]: venue } } as unknown as GameState;
};

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "klaw",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 3,
  });
  state = store.state.game!;
  me = store.state.perspectiveId!;
  id = state.mainScheme.instanceId;
}, 30_000);

describe("cardEnteredOnOtherFace", () => {
  test("names the face by its trait, as where the card starts", () => {
    expect(
      logLine({ type: "cardEnteredOnOtherFace", instanceId: id, playerId: me }, withVenue(["Failed"]), me, POOL_DEPS),
    ).toEqual({
      text: "Synthetic Venue enters play FAILED side faceup.",
      voice: "scenario",
    });
  });

  test("falls back to its other side when that face has no trait", () => {
    expect(
      logLine({ type: "cardEnteredOnOtherFace", instanceId: id, playerId: me }, withVenue([]), me, POOL_DEPS)?.text,
    ).toBe("Synthetic Venue enters play on its other side faceup.");
  });
});
