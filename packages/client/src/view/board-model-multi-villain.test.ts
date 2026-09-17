/**
 * `BoardModel` against a real Wrecking Crew Breakout game — four villains in play at once — for the bug reported
 * from play: the board built only `model.villain` (the active one), so Thunderball, Piledriver and Bulldozer were
 * in play with nothing drawn for them, discoverable only through the "Choose a target" sheet.
 *
 * The game is a real `SessionStore` session through the pool's own scenario builder (`content/pool.ts`'s
 * `buildScenario`, reached through `LocalEngineHost`/`session-core.ts` — never `@mc/cards`' `wave1Scenario`
 * called directly), the same way every other `board-model*.test.ts` proves the client against the actual engine
 * rather than a hand-built fixture. Moving the active counter and defeating a villain mid-scenario would need many
 * turns of real play to reach through commands alone, so those two are reached by editing the real `GameState` this
 * session produced (`activeVillainId`, `villains[n].defeated`) — `boardModel` is a pure function of `GameState`, so
 * this exercises exactly the same code a later `activeVillainChanged`/`characterDefeated` in real play would.
 */

import { describe, expect, test } from "vitest";
import type { GameState } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { boardModel } from "./board-model.js";
import { POOL_DEPS } from "../content/pool.js";

const SPIDER_MAN_VS_BREAKOUT: SessionConfig = {
  scenarioId: "breakout",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 41,
};

const KLAW_SOLO: SessionConfig = {
  scenarioId: "klaw",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 41,
};

/** Starts a session and clears every setup choice, the same helper `board-model.test.ts` uses. */
async function intoPlay(config: SessionConfig, maxSteps = 40): Promise<SessionStore> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(config);
  for (let step = 0; step < maxSteps; step++) {
    const legal = store.state.legal;
    if (!legal || legal.actions.kind !== "choice") break;
    const { choice } = legal.actions;
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
  }
  return store;
}

describe("boardModel with more than one villain (The Wrecking Crew's Breakout)", () => {
  test("exposes all four villains in printed order, with exactly one active", async () => {
    const store = await intoPlay(SPIDER_MAN_VS_BREAKOUT);
    const state = store.state.game!;
    const viewer = store.state.perspectiveId!;
    const model = boardModel(state, viewer, POOL_DEPS);

    expect(model.villains).toHaveLength(4);
    // Printed order (`TWC_SCENARIOS`'s `multipleVillains.villains`): Wrecker, Thunderball, Piledriver, Bulldozer.
    expect(model.villains.map((v) => v.panel.name)).toEqual(["Wrecker", "Thunderball", "Piledriver", "Bulldozer"]);
    expect(model.villains.every((v) => v.defeated === false)).toBe(true);

    const active = model.villains.filter((v) => v.active);
    expect(active).toHaveLength(1);
    // Breakout 1A's own setup: "Place the active counter on Wrecker."
    expect(active[0]!.panel.name).toBe("Wrecker");
    // The kept convenience accessor names the same villain as the one flagged active in the list.
    expect(model.villain.instanceId).toBe(active[0]!.panel.instanceId);
  });

  test("each villain reports its own encounter deck, not the active villain's", async () => {
    const store = await intoPlay(SPIDER_MAN_VS_BREAKOUT);
    const state = store.state.game!;
    const model = boardModel(state, store.state.perspectiveId!, POOL_DEPS);

    for (const villainPanel of model.villains) {
      const villainState = state.villains.find((v) => v.instanceId === villainPanel.panel.instanceId)!;
      const engineDeck = state.encounterDecks[villainState.encounterDeckId];
      expect(villainPanel.deck.deck).toBe(engineDeck?.deck.length ?? 0);
      expect(villainPanel.deck.discard).toBe(engineDeck?.discard.length ?? 0);
    }
    // Four distinct decks (`perVillain`), not the active villain's one deck read four times.
    const deckIds = new Set(state.villains.map((v) => v.encounterDeckId));
    expect(deckIds.size).toBe(4);
  });

  test("each villain's signature side scheme is in play and labeled with its villain's name", async () => {
    const store = await intoPlay(SPIDER_MAN_VS_BREAKOUT);
    const state = store.state.game!;
    const model = boardModel(state, store.state.perspectiveId!, POOL_DEPS);

    for (const villainPanel of model.villains) {
      const link = villainPanel.signatureScheme;
      expect(link).not.toBeNull();
      // Breakout 1A's setup: "Put the ... side schemes into play" — all four, for every villain, before turn one.
      expect(link!.status).toBe("inPlay");
      expect(link!.scheme.subtitle).toContain(villainPanel.panel.name);
    }
    // Distinct schemes, one per villain, not the same side scheme parroted four times.
    const schemeIds = new Set(model.villains.map((v) => v.signatureScheme!.scheme.instanceId));
    expect(schemeIds.size).toBe(4);
  });

  test("the active flag moves to whichever villain the engine names, after an activeVillainChanged", async () => {
    const store = await intoPlay(SPIDER_MAN_VS_BREAKOUT);
    const state = store.state.game!;
    const nextActive = state.villains.find((v) => v.instanceId !== state.activeVillainId)!;
    const moved: GameState = { ...state, activeVillainId: nextActive.instanceId };

    const model = boardModel(moved, store.state.perspectiveId!, POOL_DEPS);
    const active = model.villains.filter((v) => v.active);
    expect(active).toHaveLength(1);
    expect(active[0]!.panel.instanceId).toBe(nextActive.instanceId);
    expect(model.villain.instanceId).toBe(nextActive.instanceId);
    // The old active villain reads as inactive now, not stuck on.
    const former = model.villains.find((v) => v.panel.instanceId === state.activeVillainId)!;
    expect(former.active).toBe(false);
  });

  test("a defeated villain is reported as defeated without disturbing the other three", async () => {
    const store = await intoPlay(SPIDER_MAN_VS_BREAKOUT);
    const state = store.state.game!;
    const defeatedId = state.villains[1]!.instanceId;
    const withDefeat: GameState = {
      ...state,
      villains: state.villains.map((v) => (v.instanceId === defeatedId ? { ...v, defeated: true } : v)),
    };

    const model = boardModel(withDefeat, store.state.perspectiveId!, POOL_DEPS);
    expect(model.villains).toHaveLength(4);
    expect(model.villains.find((v) => v.panel.instanceId === defeatedId)?.defeated).toBe(true);
    expect(model.villains.filter((v) => v.defeated)).toHaveLength(1);
  });
});

describe("boardModel with one villain (every scenario before The Wrecking Crew)", () => {
  test("villains has exactly one entry, identical to the kept `villain` accessor", async () => {
    const store = await intoPlay(KLAW_SOLO);
    const state = store.state.game!;
    const model = boardModel(state, store.state.perspectiveId!, POOL_DEPS);

    expect(model.villains).toHaveLength(1);
    expect(model.villains[0]!.panel.instanceId).toBe(model.villain.instanceId);
    expect(model.villains[0]!.active).toBe(true);
    expect(model.villains[0]!.defeated).toBe(false);
    // Klaw has no signature side scheme (The Wrecking Crew's own mechanic).
    expect(model.villains[0]!.signatureScheme).toBeNull();
  });
});
