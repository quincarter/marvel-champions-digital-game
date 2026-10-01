import { characterProfile, handSize, maxHitPoints, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { playFromAnotherHerosDeck, type CrossHeroGame } from "../../testing/cross-hero.js";
import { wave5Scenario } from "../setup.js";
import { WAVE5_CARDS } from "../cards.js";
import { WAVE5_DEPS } from "../index.js";

/**
 * Venom (Eddie Brock, 27190) and Symbiote Suit (27191), Sinister Motives' basic cards outside a hero kit, each played
 * from a Core hero's deck (they're in no precon).
 */

const gameAt = (scenarioId: string): CrossHeroGame => ({
  deps: WAVE5_DEPS,
  cards: WAVE5_CARDS,
  buildScenario: (players) => wave5Scenario(scenarioId, { seed: 7, players }),
});

const VENOM_RESPONSE = "27190.venom-response";

const villainOf = (state: GameState): InstanceId => state.activeVillainId!;

/** Accepts Venom's response the first time it's offered and aims it at the villain; everything else `firstLegal`. */
function acceptingVenomOnce(): { readonly pick: (state: GameState) => readonly string[]; offers: number } {
  const tracker = {
    offers: 0,
    pick: (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      const offer = choice.options.find((o) => o.optionId.endsWith(VENOM_RESPONSE));
      if (offer) {
        tracker.offers++;
        return tracker.offers === 1 ? [offer.optionId] : [];
      }
      const villain = choice.options.find((o) => o.optionId === villainOf(state));
      if (villain && tracker.offers === 1) return [villain.optionId];
      return firstLegal(state);
    },
  };
  return tracker;
}

/** Venom in play in Spider-Man's deck at `scenarioId`, then the villain phase with `code` the card P1 reveals. */
function revealWithVenom(scenarioId: string, code: string) {
  const game = gameAt(scenarioId);
  const { state: played, cardInstanceId: venom } = playFromAnotherHerosDeck("27190", game);
  // Stays in alter-ego form, so the villain schemes and takes the filler as its boost card; `code` is then dealt.
  const stacked = stackEncounterDeck(played, "01186", code);
  const before = inst(stacked, villainOf(stacked)).damage;
  const tracker = acceptingVenomOnce();
  const ended = runWith(WAVE5_DEPS, stacked, { type: "endTurn", playerId: P1 });
  return { ended, venom, before, tracker };
}

describe("Venom (Eddie Brock, 27190)", () => {
  it("after you reveal False Alarm (1 boost icon), deals 1 damage to Venom → 1 damage to the villain", () => {
    const { ended, venom, before, tracker } = revealWithVenom("rhino", "01112");
    const after = settle(ended, tracker.pick, undefined, WAVE5_DEPS);
    expect(tracker.offers).toBeGreaterThanOrEqual(1);
    expect(inst(after, venom).damage).toBe(1);
    expect(inst(after, villainOf(after)).damage - before).toBe(1);
  });

  it('is offered only once the reveal has fully resolved (RRG 1.8 "Reveal", p. 38)', () => {
    const { ended } = revealWithVenom("rhino", "01112");
    const offered = settle(
      ended,
      firstLegal,
      (s) => s.pendingChoice?.options.some((o) => o.optionId.endsWith(VENOM_RESPONSE)) ?? false,
      WAVE5_DEPS,
    );
    expect(offered.pendingChoice).toBeTruthy();
    // False Alarm's When Revealed has confused P1 and step 4 has discarded it.
    expect(inst(offered, identityOf(offered)).statuses.confused).toBe(1);
    const discard = Object.values(offered.encounterDecks).flatMap((piles) => piles.discard);
    expect(discard.some((id) => offered.instances[id]?.cardId === "01112")).toBe(true);
  });

  it("counts the [star] icon too: Sonic Boom (no boost icons, a star) deals 1", () => {
    const { ended, venom, before, tracker } = revealWithVenom("klaw", "01123");
    const after = settle(ended, tracker.pick, undefined, WAVE5_DEPS);
    expect(inst(after, venom).damage).toBe(1);
    expect(inst(after, villainOf(after)).damage - before).toBe(1);
  });
});

describe("Symbiote Suit (27191)", () => {
  it("your identity gets +1 to each basic power, +1 hand size and +10 hit points", () => {
    const game = gameAt("rhino");
    const { state: aePlayed } = playFromAnotherHerosDeck("27191", game);
    const identity = identityOf(aePlayed);
    // Alter-ego: Peter Parker's REC 3, hand size 6, 10 hit points.
    expect(characterProfile(aePlayed, identity, WAVE5_DEPS)!.rec).toBe(4);
    expect(handSize(aePlayed, P1, WAVE5_DEPS)).toBe(7);
    expect(maxHitPoints(aePlayed, identity, WAVE5_DEPS)).toBe(20);
    // Hero: Spider-Man's THW 1, ATK 2, DEF 3, hand size 5.
    const hero = runWith(WAVE5_DEPS, aePlayed, toHero(P1));
    const profile = characterProfile(hero, identity, WAVE5_DEPS)!;
    expect([profile.thw, profile.atk, profile.def]).toEqual([2, 3, 4]);
    expect(handSize(hero, P1, WAVE5_DEPS)).toBe(6);
    expect(maxHitPoints(hero, identity, WAVE5_DEPS)).toBe(20);
  });
});
