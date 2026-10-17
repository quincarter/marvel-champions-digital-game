/**
 * Rules audit chunk 39 (FFG rulings post-RRG 1.5, October 2023 - January 2024), proofs that need real cards. Each
 * `it.fails` marks something the engine does that an official source forbids; it flips to a failure when fixed.
 */
import { cardId } from "@mc/content";
import {
  applyCommand,
  activeEncounterDeck,
  activeEncounterDeckId,
  activeVillain,
  createGame,
  type GameState,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  payWith,
  play,
  patchInstance,
  runWith,
  stackEncounterDeck,
  settle,
  toHero,
} from "../testing/harness.js";
import type { Picker } from "../testing/harness.js";
import { playFromHand as playFromHandWith } from "../testing/staging.js";
import { driveEvents, encounterCardInVillainArea, withForm } from "../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../wave7/index.js";
import { wave3Scenario } from "../wave3/setup.js";
import { startWave3Game, WAVE3_DEPS } from "../wave3/testing.js";

import { WAVE4_DEPS } from "../wave4/index.js";
import { playFromHand, startWave4Game } from "../wave4/testing.js";
import { adamWarlockScenario } from "../wave4/mts/support.js";
import { spectrumScenario } from "../wave4/mts/support.js";

describe("audit 39.21 Gamma Blast: the Gamma response waits for the whole first sentence (FFG ruling December 8, 2023 - Ruling 126)", () => {
  /** Accepts the Gamma response and picks the villain whenever a target is asked. */
  const accepting =
    (villain: string): Picker =>
    (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      const hits = choice.options
        .filter((o) => o.optionId.includes("21002.gamma-response") || o.optionId === villain)
        .map((o) => o.optionId);
      return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
    };

  it.fails("a tough villain: the 7 damage meets the tough card first, the response's 1 damage comes after (total 1, not 7)", () => {
    // Change to hero form choosing the Pulsar energy form to flip faceup, so Gamma Blast is a real change of form.
    const start = startWave4Game(spectrumScenario("rhino", { seed: 8 }));
    const pulsarId = instancesOf(start, "21004")[0]!;
    const toPulsar: Picker = (st) => {
      const choice = st.pendingChoice;
      if (!choice) return [];
      const hits = choice.options.filter((o) => o.optionId === pulsarId).map((o) => o.optionId);
      return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(st);
    };
    const hero: GameState = settle(runWith(WAVE4_DEPS, start, toHero()), toPulsar, undefined, WAVE4_DEPS);
    const villain = activeVillain(hero).instanceId;
    const tough = patchInstance(hero, villain, { statuses: { ...inst(hero, villain).statuses, tough: 1 } });
    // Staging sanity: Spectrum is not yet in Gamma form (the Gamma form upgrade is facedown).
    expect(inst(tough, instancesOf(tough, "21002")[0]!).faceup).toBe(false);
    expect(identityOf(tough, P1)).toBeTruthy();
    const before = inst(tough, villain).damage;
    const { state } = playFromHand(tough, "21007", 3, accepting(villain));
    // Ruling: resolve the first sentence of Gamma Blast in full (the 7 damage discards the tough card and is prevented),
    // then the response deals 1 damage. If the response came first it would discard tough and let the 7 through (8 total).
    expect(inst(state, villain).statuses.tough).toBe(0);
    expect(inst(state, villain).damage - before).toBe(1);
  });
});

describe("audit 39.22 Frenemies: the two threat removals are simultaneous (FFG ruling December 8, 2023 - Ruling 127)", () => {
  const CABLE = { starterDeckId: "cable-leadership" } as const;
  /** Cable in hero form with Deadpool (40024) in play, the main scheme at 20, and Crowd Control (crisis icon, 3 threat). */
  function stage() {
    const created = createGame(
      wave7Scenario("juggernaut", { players: [CABLE], seed: 1, difficulty: "standard", modularSetIds: [] }),
      WAVE7_DEPS,
    );
    if (!created.ok) throw new Error(created.error.message);
    const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
    const hero = patchInstance(withForm(settled, { heroForm: 0 }), settled.mainScheme.instanceId, { threat: 20 });
    // Deadpool (Frenemies' Team-Up partner) paid for from the hand.
    const withDeadpool = playFromHandWith(WAVE7_DEPS, hero, "40024", 3).state;
    // Crowd Control (01108, crisis icon): turn the top encounter card into it, then put it in the villain area.
    const deckId = activeEncounterDeckId(withDeadpool);
    const top = withDeadpool.encounterDecks[deckId]!.deck[0]!;
    const swapped = patchInstance(withDeadpool, top, { cardId: cardId("01108") });
    return { ...encounterCardInVillainArea(swapped, "01108", 3), main: swapped.mainScheme.instanceId };
  }

  it.fails("a crisis icon side scheme thwarted by the first removal still bars the main scheme from the second (RRG p. 43 'Target'; Ruling 127 answer 2)", () => {
    const { state, id: crowd, main } = stage();
    const offers: string[][] = [];
    const pick: Picker = (s) => {
      const c = s.pendingChoice;
      if (c?.prompt.kind === "chooseTarget") {
        offers.push(c.options.map((o) => o.optionId));
        if (offers.length === 1) return [crowd];
      }
      return firstLegal(s);
    };
    const mainBefore = inst(state, main).threat;
    const { state: after } = playFromHandWith(WAVE7_DEPS, state, "40026", 1, pick);
    // Staging sanity: the first prompt did not offer the main scheme (crisis icon in play), and Crowd Control was defeated.
    expect(offers[0]).not.toContain(main);
    expect(inst(after, crowd).threat).toBe(0);
    // Ruling: the two instances are simultaneous, so the main scheme was still barred for the second; it loses nothing.
    expect(inst(after, main).threat).toBe(mainBefore);
  });
});

describe("audit 39.32 Planetary Invasion: a Quickstrike attack only initiates in the reveal sentence (FFG ruling January 11, 2024 - Ruling 137)", () => {
  /**
   * Ruling: the revealed minion's Quickstrike "initiat[es] its attack. (The steps of the attack will then resolve at the
   * next available opportunity.) The minion is given a Tough status card immediately after this, because it's in the same
   * sentence as the reveal effect". RRG 1.8 p. 4 ("resolve the ability one sentence at a time") does not say otherwise.
   * Teamwork ruling December 8, 2023 - Ruling 129 gives the same "initiates, resolves later" model.
   */
  it.fails("Vulture (quickstrike, ATK 3) revealed by Planetary Invasion gets its tough status card before its attack deals damage", () => {
    const base0 = startWave3Game(
      wave3Scenario("rhino", { players: [{ starterDeckId: "rocket-raccoon-aggression" }], seed: 2026 }),
    );
    const base = runWith(WAVE3_DEPS, base0, toHero());
    const invasion = base.players[0]!.setAside.find((id) => inst(base, id).cardId === "16057")!;
    const deckId = activeEncounterDeckId(base);
    const stacked = stackEncounterDeck(base, "01186", "01101");
    const mercenary = activeEncounterDeck(stacked).deck.find((i) => inst(stacked, i).cardId === cardId("01101"))!;
    // The Hydra Mercenary stands in for Vulture (01167, quickstrike, ATK 3): same instance, other printing.
    const swapped = patchInstance(stacked, mercenary, { cardId: cardId("01167") });
    const piles = activeEncounterDeck(swapped);
    const state: GameState = {
      ...swapped,
      players: swapped.players.map((p) =>
        p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== invasion) } : p,
      ),
      encounterDecks: {
        ...swapped.encounterDecks,
        [deckId]: { ...piles, deck: [piles.deck[0]!, invasion, ...piles.deck.slice(1)] },
      },
    };
    const { events } = driveEvents(WAVE3_DEPS, state, endTurn());
    const after = events.findIndex((e) => e.type === "encounterCardRevealed" && e.cardId === "01167");
    expect(after, "Vulture was revealed").toBeGreaterThan(-1);
    const next = events.slice(after + 1).find((e) => e.type === "statusGiven" || e.type === "damageDealt");
    // Staging sanity: the revealed minion's step produced one of the two events at all.
    expect(next).toBeDefined();
    // Actual: damageDealt (3) first, then statusGiven tough.
    expect(next!.type).toBe("statusGiven");
  });
});

describe("audit 39.9 Cosmic Awareness: the 3 threat is the cost, so a scheme needs 3 (FFG ruling November 29, 2023 - Ruling 114)", () => {
  /**
   * Ruling: "the cost requires Adam Warlock to remove 3 threat from a scheme while paying the card's cost. If he can't do
   * that, he can't play the card", and he "can't target a scheme with less than 3 threat". Engine: the 3 threat is part of
   * the effect after the cost arrow (`thwart(sum(3, ...))` on any scheme), so the event is playable against 2 threat.
   */
  const playable = (threat: number): boolean => {
    const base = settle(
      runWith(WAVE4_DEPS, startWave4Game(adamWarlockScenario("rhino", { seed: 21 })), toHero()),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    const staged = patchInstance(base, base.mainScheme.instanceId, { threat });
    const given = moveToHand(staged, P1, "21039");
    const [card] = given.ids as [never];
    return applyCommand(given.state, play(P1, card, payWith(given.state, P1, 2, [card])), WAVE4_DEPS).ok;
  };

  it("control: with 10 threat on the only scheme the event is playable", () => {
    expect(playable(10)).toBe(true);
  });

  it("with only 2 threat on the only scheme (the main scheme) the event cannot be played", () => {
    expect(playable(2)).toBe(false);
  });
});
