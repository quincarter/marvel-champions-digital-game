/**
 * QA of release v0.20.0 / PR #131's finding: scripts that mark a printed sentence "covered by an engine rule / data"
 * when no such rule exists (the Sleeper Awakened class of bug).
 *
 * Sources: RRG 1.8 "Max, Maximum" (p. 28): "'Max 1 per [game element]' restricts the number of copies of that card that
 * can be attached to each indicated game element"; "Acceleration" icon rules (RRG 1.8 "Acceleration Icon"): each
 * acceleration icon on a card in play adds 1 threat at the villain phase's step one.
 */
import { cardId, PLAYABLE_CARDS } from "@mc/content";
import { createGame, type GameSetupConfig } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { firstLegal, moveToHand, P1, payWith, play, playerOf, settle } from "./testing/harness.js";
import { driveEventsPicking } from "./testing/staging.js";
import { wave1Scenario } from "./wave1/setup.js";
import { WAVE1_DEPS } from "./wave1/testing.js";

vi.setConfig({ testTimeout: 120_000 });

describe("'covered by data' claims on 'Max 1 per scheme' (RRG 1.8 'Max, Maximum' p. 28)", () => {
  it("Under Surveillance (06031) 'Max 1 per scheme': a second copy cannot be attached to the same main scheme", () => {
    const config = wave1Scenario("klaw", { players: [{ starterDeckId: "thor-aggression" }], seed: 11 });
    const patched: GameSetupConfig = {
      ...config,
      requireLegalDecks: false,
      players: config.players.map((p) => ({
        ...p,
        deck: [...p.deck, cardId("06031"), cardId("06031")],
      })),
    };
    const created = createGame(patched, WAVE1_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const started = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE1_DEPS);
    const given = moveToHand(started, P1, "06031", "06031");
    const [first, second] = given.ids as [never, never];
    const scheme = given.state.mainScheme.instanceId;
    const attached = driveEventsPicking(
      WAVE1_DEPS,
      given.state,
      firstLegal,
      play(P1, first, payWith(given.state, P1, 2, [first, second]), { attachToInstanceId: scheme }),
    ).state;
    expect(playerOf(attached, P1).hand).toContain(second);
    // The second copy must be refused (play throws on a rejected command).
    expect(() =>
      driveEventsPicking(
        WAVE1_DEPS,
        attached,
        firstLegal,
        play(P1, second, payWith(attached, P1, 2, [second]), { attachToInstanceId: scheme }),
      ),
    ).toThrow();
  });

  it("every upgrade/attachment printed 'Max 1 per scheme' or 'per identity' carries playRestrictions.maxPerHost", () => {
    const missing = (PLAYABLE_CARDS as readonly any[])
      .filter((c) => /Max \d per (scheme|identity)/i.test(c.text?.printed ?? ""))
      .filter((c) => c.playRestrictions?.maxPerHost === undefined)
      .map((c) => `${c.id} ${c.name}`);
    // Observed at time of writing: 03032 Followed, 06031 Under Surveillance, 26034 Chance Encounter, 30018 Followed,
    // 30019 Overwatch, 32150 Wrapped in Metal.
    expect(missing).toEqual([]);
  });
});

describe("printed icons the data dropped", () => {
  it("Zola's Algorithm (04163) prints an acceleration icon (scan assets/card-art/bundles/cards/04163.png)", () => {
    const card = (PLAYABLE_CARDS as readonly any[]).find((c) => c.id === "04163");
    expect(card.schemeIcons).toEqual(["acceleration"]);
  });
});
