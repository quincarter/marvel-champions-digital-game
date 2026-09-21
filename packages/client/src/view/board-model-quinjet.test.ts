/**
 * Quinjet's own time counters (`03019`), read the way the client actually
 * reads them — through `characterPanel`, against a real wave 1 game — for
 * PLAN.md Phase 7's "the board has to show counters on a support."
 *
 * Before this, `CharacterPanel` had a counters field for an *attachment*
 * (`AttachmentChip.counters`, "Web-Shooter ×2 web") but nothing for the card
 * itself: Quinjet's own time counters, which its printed Action reads
 * directly ("cost equal to or less than the number of time counters on
 * Quinjet"), never reached the table at all.
 */

import { describe, expect, test } from "vitest";
import { cardOf, type GameState, type PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { characterPanel } from "./board-model.js";
import { WAVE1_DEPS } from "@mc/cards";

// Seed 2 deals Quinjet (03019) and two Super-Soldier Serums (03010, a resource
// ability) into the opening hand — found by brute search, recorded here the
// same way `discard-choice-model.test.ts` records its own seed.
const CAP_VS_RHINO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "cap-leadership" }],
  seed: 2,
};

/** Answers a choice with `optionId` when it's offered, the fewest selections otherwise. */
async function pickOrDecline(store: SessionStore, optionId: string): Promise<void> {
  const legal = store.state.legal!.actions;
  if (legal.kind !== "choice") throw new Error("no pending choice");
  const offered = legal.choice.options.map((o) => o.optionId);
  const selected = offered.includes(optionId)
    ? [optionId]
    : legal.choice.options.slice(0, legal.choice.minSelections).map((o) => o.optionId);
  await store.resolveChoice(selected);
}

describe("Quinjet's time counters reach the board", () => {
  test("characterPanel reports 0 counters fresh in play, then 1 after accepting the next turn's Response", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(CAP_VS_RHINO);
    for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
      const { choice } = store.state.legal.actions as {
        choice: { options: readonly { optionId: string }[]; minSelections: number };
      };
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    }
    let legal = store.state.legal!.actions;
    if (legal.kind === "turn") {
      const flip = legal.legal.find((e) => e.action.kind === "changeForm");
      if (flip) await store.dispatch(flip.example);
    }

    legal = store.state.legal!.actions;
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const playQuinjet = legal.legal.find(
      (entry) => entry.action.kind === "playCard" && cardOf(store.state.game!, entry.action.instanceId)?.id === "03019",
    );
    if (!playQuinjet) throw new Error("expected Quinjet to be playable");
    const quinjetId =
      playQuinjet.action.kind === "playCard"
        ? playQuinjet.action.instanceId
        : (() => {
            throw new Error("unreachable");
          })();
    await store.dispatch(playQuinjet.example);

    let state: GameState = store.state.game!;
    let me: PlayerId = store.state.perspectiveId!;
    expect(characterPanel(state, quinjetId, WAVE1_DEPS).counters).toEqual([]);

    // End the turn, decline everything except Quinjet's own optional Response
    // when it's offered, until my own turn begins again.
    legal = store.state.legal!.actions;
    if (legal.kind === "turn") {
      const end = legal.legal.find((entry) => entry.action.kind === "endTurn");
      if (end) await store.dispatch(end.example);
    }
    for (let guard = 0; guard < 60 && store.state.legal?.actions.kind === "choice"; guard++) {
      await pickOrDecline(store, `${quinjetId}:03019.quinjet-response`);
    }

    state = store.state.game!;
    me = store.state.perspectiveId!;
    expect(state.players.find((p) => p.playerId === me)?.identity).toBeDefined();
    expect(characterPanel(state, quinjetId, WAVE1_DEPS).counters).toEqual([{ name: "time", count: 1 }]);
  });
});
