/**
 * The log line of a main scheme swapped with a set-aside one (docs/phase7-wave11-scenarios.md §S3.2; Change of Venue,
 * `fne` 60141): the new scheme is named, then the one set aside, and the play area when the scheme is in one.
 */

import { beforeAll, describe, expect, test } from "vitest";
import type { GameEvent, GameState, InstanceId, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { logLine } from "./log-lines.js";

let state: GameState;
let me: PlayerId;

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
}, 30_000);

const nameOf = (id: InstanceId): string => state.cardPool[state.instances[id]!.cardId]!.name;

describe("mainSchemeSwapped", () => {
  const swapped = (playArea: PlayerId | null): GameEvent => ({
    type: "mainSchemeSwapped",
    outgoing: state.mainScheme.instanceId,
    incoming: state.activeVillainId,
    cardIds: [state.mainScheme.cardId, state.instances[state.activeVillainId]!.cardId],
    playArea,
    threat: 3,
  });

  test("names the new scheme, the one set aside, and your play area", () => {
    const outgoing = nameOf(state.mainScheme.instanceId);
    const incoming = nameOf(state.activeVillainId);
    expect(logLine(swapped(me), state, me, POOL_DEPS)).toEqual({
      text: `${incoming} replaces ${outgoing} in your play area; ${outgoing} is set aside.`,
      voice: "scenario",
    });
    expect(logLine(swapped(null), state, me, POOL_DEPS)?.text).toBe(
      `${incoming} replaces ${outgoing}; ${outgoing} is set aside.`,
    );
  });
});
