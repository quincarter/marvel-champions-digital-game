import { describe, expect, it } from "vitest";
import { activeEncounterDeckId, type GameEvent, type GameState } from "@mc/engine";
import { cardId } from "@mc/content";
import { firstLegal, P1, patchInstance, runWith, stackEncounterDeck, toHero } from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { WAVE6_DEPS } from "../index.js";
import { mansionAttackGame, withoutDealtCards } from "./mansion-attack-testing.js";
import { engageMinion } from "./project-wideawake-testing.js";

/**
 * Ruling 2026-02-28 R6 (Pirate Lackey): "If a Villainous minion activates and draws Pirate Lackey as a boost card (which
 * gives a boost card to the villain while it has 1+ boost cards), does the villain receive a boost card? No. Because the
 * villain is not activating, do not give it a boost card." Every "give the villain an additional boost card for this
 * activation" boost reads `extraBoostCardsForVillain`, so the extra card is dealt only to the villain's own activation.
 */
const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(WAVE6_DEPS, state, ...commands);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const endTurnP1 = { type: "endTurn", playerId: P1 } as const;
const PLAIN_BOOST = "01186";
const PIRATE_LACKEY = "16139";
const BASTION = "32167"; // villainous minion
const QUIET = "32136";
const HOST = "32132"; // a deck card turned into Pirate Lackey

describe("ruling 2026-02-28 R6: Pirate Lackey's boost gives the villain an extra boost card only when the villain activates", () => {
  const setup = () => {
    const base = mansionAttackGame({ villain: "Avalanche", modularSetIds: ["future_past"] });
    const hero = run(base, toHero(P1));
    return { hero, villainId: hero.villains[0]!.instanceId };
  };

  it("a villainous minion activating with Pirate Lackey as its boost card: the villain is dealt nothing extra", () => {
    const { hero, villainId } = setup();
    const { state: withBastion, id: bastion } = engageMinion(withoutDealtCards(hero), BASTION);
    // The villain activates first (plain boost), then Bastion (Pirate Lackey), then a quiet reveal.
    const staged = stackWithLackey(withBastion, [PLAIN_BOOST, HOST, QUIET], [1]);
    const { events } = driveEventsPicking(WAVE6_DEPS, staged, firstLegal, endTurnP1);
    const dealt = of(events, "boostCardDealt");
    expect(of(events, "boostCardFlipped").some((e) => e.enemyInstanceId === bastion)).toBe(true);
    expect(dealt.filter((e) => e.enemyInstanceId === villainId)).toHaveLength(1);
    expect(dealt.filter((e) => e.enemyInstanceId === bastion)).toHaveLength(1);
  });

  it("a villainous minion activating with Masterful Mirage (27090, names Mysterio) as its boost card: it is dealt nothing extra", () => {
    const { hero, villainId } = setup();
    const { state: withBastion, id: bastion } = engageMinion(withoutDealtCards(hero), BASTION);
    const staged = stackWithLackey(withBastion, [PLAIN_BOOST, HOST, QUIET], [1], "27090");
    const { events } = driveEventsPicking(WAVE6_DEPS, staged, firstLegal, endTurnP1);
    const dealt = of(events, "boostCardDealt");
    expect(of(events, "boostCardFlipped").some((e) => e.enemyInstanceId === bastion)).toBe(true);
    expect(dealt.filter((e) => e.enemyInstanceId === villainId)).toHaveLength(1);
    expect(dealt.filter((e) => e.enemyInstanceId === bastion)).toHaveLength(1);
  });

  it("the villain activating with Pirate Lackey as its boost card: it is dealt one additional boost card", () => {
    const { hero, villainId } = setup();
    const staged = stackWithLackey(withoutDealtCards(hero), [HOST, PLAIN_BOOST, QUIET], [0]);
    const { events } = driveEventsPicking(WAVE6_DEPS, staged, firstLegal, endTurnP1);
    const dealt = of(events, "boostCardDealt");
    expect(dealt.filter((e) => e.enemyInstanceId === villainId)).toHaveLength(2);
  });
});

/**
 * Stacks `codes` on the encounter deck, then turns the cards at `lackeyAt` into Pirate Lackey (the scenario's deck does
 * not hold one), so the boost ability under test is the card's own script.
 */
function stackWithLackey(
  state: GameState,
  codes: readonly string[],
  lackeyAt: readonly number[],
  code = PIRATE_LACKEY,
): GameState {
  const stacked = stackEncounterDeck(state, ...codes);
  const deck = stacked.encounterDecks[activeEncounterDeckId(stacked)]!.deck;
  return lackeyAt.reduce((s, i) => patchInstance(s, deck[i]!, { cardId: cardId(code) }), stacked);
}
