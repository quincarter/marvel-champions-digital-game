/**
 * Tab change badges, against a real game's own events.
 *
 * What matters is that an event lands on the tab a player would look for it
 * on — damage to the villain is Enemies news, threat on the main scheme is
 * Threat news — since that badge is the only signal a phone player gets that
 * something happened off screen.
 */

import { beforeAll, describe, expect, test } from "vitest";
import type { GameEvent, GameState, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { tabsTouchedBy } from "./tab-badges.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 31,
};

let state: GameState;
let me: PlayerId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
  for (let step = 0; step < 10 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as { choice: { options: readonly { optionId: string }[]; minSelections: number } };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  state = store.state.game!;
  me = store.state.perspectiveId!;
});

describe("tabsTouchedBy", () => {
  test("threat on the main scheme is Threat news", () => {
    const events: GameEvent[] = [
      { type: "threatPlaced", schemeInstanceId: state.mainScheme.instanceId, amount: 1, sourceInstanceId: null },
    ];
    expect(tabsTouchedBy(events, state, me).get("threat")).toBe(1);
  });

  test("damage to the villain is Enemies news, not Threat news", () => {
    const events: GameEvent[] = [
      { type: "damageDealt", targetInstanceId: state.villain.instanceId, amount: 2, sourceInstanceId: null },
    ];
    const tabs = tabsTouchedBy(events, state, me);
    expect(tabs.get("enemies")).toBe(1);
    expect(tabs.has("threat")).toBe(false);
  });

  test("damage to your own identity is Me news", () => {
    const identity = state.players.find((player) => player.playerId === me)!.identity.instanceId;
    const events: GameEvent[] = [{ type: "damageDealt", targetInstanceId: identity, amount: 2, sourceInstanceId: null }];
    expect(tabsTouchedBy(events, state, me).get("me")).toBe(1);
  });

  test("bookkeeping events with no card touch nothing", () => {
    const events: GameEvent[] = [{ type: "roundStarted", round: 2 }];
    expect(tabsTouchedBy(events, state, me).size).toBe(0);
  });

  test("counts repeats, so 'three things happened' is distinguishable from 'one'", () => {
    const events: GameEvent[] = [
      { type: "damageDealt", targetInstanceId: state.villain.instanceId, amount: 1, sourceInstanceId: null },
      { type: "damageDealt", targetInstanceId: state.villain.instanceId, amount: 1, sourceInstanceId: null },
    ];
    expect(tabsTouchedBy(events, state, me).get("enemies")).toBe(2);
  });

  test("never badges the log, which every event would light permanently", () => {
    const events: GameEvent[] = [
      { type: "threatPlaced", schemeInstanceId: state.mainScheme.instanceId, amount: 1, sourceInstanceId: null },
      { type: "damageDealt", targetInstanceId: state.villain.instanceId, amount: 1, sourceInstanceId: null },
    ];
    expect(tabsTouchedBy(events, state, me).has("log")).toBe(false);
  });
});
