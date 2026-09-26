/**
 * Inspect on the encounter deck's top card under "you may look at the top card of the encounter deck at any time"
 * (Sector Scan; docs/phase7-wave5.md §3.28): the face shows through the permitted seat's eyes only.
 */

import { activeEncounterDeck, playerId, type GameState, type PlayerId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { inspectModel } from "./inspect-model.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 12,
};

let state: GameState;
let me: PlayerId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
  state = store.state.game!;
  me = store.state.perspectiveId!;
});

/** Test surgery: the lasting rule `applyRuleUntil` leaves behind, frozen to `player`. */
const withLook = (player: PlayerId): GameState => ({
  ...state,
  lastingEffects: [
    ...state.lastingEffects,
    {
      id: "look-test",
      kind: "ruleGrant",
      rule: { kind: "mayLookAtTopOfEncounterDeck", player: { kind: "id", playerId: player } },
      scope: { selfInstanceId: null, controllerId: player, vars: {}, bindings: {} },
      duration: { kind: "endOfRound" },
    },
  ],
});

describe("Inspect on the encounter deck's top card (§3.28)", () => {
  test("is facedown by default", () => {
    const top = activeEncounterDeck(state).deck[0]!;
    expect(inspectModel(state, top, null, me, CORE_DEPS).hidden).toBe(true);
  });

  test("shows its face to the player the rule names, and to no one else", () => {
    const top = activeEncounterDeck(state).deck[0]!;
    const mine = inspectModel(withLook(me), top, null, me, CORE_DEPS);
    expect(mine.hidden).toBe(false);
    expect(mine.typeLine).not.toBe("Facedown");
    expect(mine.name).toBe(state.cardPool[state.instances[top]!.cardId]!.name);

    const someoneElse = inspectModel(withLook(playerId("elsewhere")), top, null, me, CORE_DEPS);
    expect(someoneElse.hidden).toBe(true);
    // Only the top card.
    const second = activeEncounterDeck(state).deck[1]!;
    expect(inspectModel(withLook(me), second, null, me, CORE_DEPS).hidden).toBe(true);
  });
});
