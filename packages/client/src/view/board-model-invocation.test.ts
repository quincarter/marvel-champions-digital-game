/**
 * Doctor Strange's Invocation deck (`HeroIdentityCard.separateDecks`), read
 * and played the way the client actually does — through `boardModel` and a
 * real dispatch of Master of the Mystic Arts (`09005`) — for PLAN.md Phase
 * 7's "the board has no Invocation deck; the client never mentions
 * `separateDeck`. Add an on-board pile for it with the faceup top card
 * readable (and inspectable), and make the action prompt and resolve in
 * play."
 *
 * The engine side of this (paying the top card's cost, resolving its
 * Special, placing it back on top faceup) is already proven in
 * `packages/cards/src/wave1/drs/doctor-strange.test.ts`; what this file
 * proves is that the *client's own* path — `legalActions`'s own example,
 * dispatched exactly as the Board would — reaches the same result, and that
 * `boardModel` gives the table a zone to show it in at all.
 */

import { describe, expect, test } from "vitest";
import { type GameState, type PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { boardModel } from "./board-model.js";
import { WAVE1_DEPS } from "@mc/cards";

// Seed 3 deals Master of the Mystic Arts (09005) into the opening hand —
// found by brute search, recorded here the same way `discard-choice-
// model.test.ts` and `board-model-quinjet.test.ts` record their own seeds.
const DRS_VS_RHINO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "drs-protection" }],
  seed: 3,
};

describe("Doctor Strange's Invocation deck reaches the board", () => {
  test("boardModel exposes it as its own pile, and playing Master of the Mystic Arts resolves through the client's own dispatch", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(DRS_VS_RHINO);
    for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
      const { choice } = store.state.legal.actions as { choice: { options: readonly { optionId: string }[]; minSelections: number } };
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    }
    let legal = store.state.legal!.actions;
    if (legal.kind === "turn") {
      const flip = legal.legal.find((e) => e.action.kind === "changeForm");
      if (flip) await store.dispatch(flip.example);
    }

    let state: GameState = store.state.game!;
    let me: PlayerId = store.state.perspectiveId!;
    const before = boardModel(state, me, WAVE1_DEPS);
    expect(before.separateDecks).toHaveLength(1);
    expect(before.separateDecks[0]!.name).toBe("Invocation");
    expect(before.separateDecks[0]!.deckCount).toBe(5);
    expect(before.separateDecks[0]!.discardCount).toBe(0);
    // The top card is readable: `topArt` (and so Inspect, and so the pile's
    // own tap target) has something to show, not a blank/facedown pile.
    expect(before.separateDecks[0]!.topInstanceId).not.toBeNull();
    expect(before.separateDecks[0]!.topArt).not.toBeNull();
    const topBefore = before.separateDecks[0]!.topInstanceId;

    legal = store.state.legal!.actions;
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const playMota = legal.legal.find((entry) => entry.action.kind === "playCard" && state.instances[entry.action.instanceId]?.cardId === "09005");
    if (!playMota) throw new Error("expected Master of the Mystic Arts to be playable");
    await store.dispatch(playMota.example);

    // A "choose a target" (Seven Rings of Raggadorr) or similar decision may
    // follow the Special resolving — answer it the same generic way any
    // other card's `chooseTarget` already is, so this proves the client's
    // ordinary dispatch/choice loop carries an Invocation Special through,
    // not a hand-picked one.
    let afterLegal = store.state.legal?.actions;
    while (afterLegal?.kind === "choice") {
      await store.resolveChoice(afterLegal.choice.options.slice(0, afterLegal.choice.minSelections).map((option) => option.optionId));
      afterLegal = store.state.legal?.actions;
    }

    state = store.state.game!;
    me = store.state.perspectiveId!;
    const after = boardModel(state, me, WAVE1_DEPS);
    // "Then, place it back on top of the Invocation deck faceup" (09005's own printed text): still 5 in the deck, still none in its discard.
    expect(after.separateDecks[0]!.deckCount).toBe(5);
    expect(after.separateDecks[0]!.discardCount).toBe(0);
    expect(after.separateDecks[0]!.topInstanceId).toBe(topBefore);
    expect(after.separateDecks[0]!.topArt).not.toBeNull();
  });
});
