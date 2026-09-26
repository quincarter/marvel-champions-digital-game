/**
 * Galaxy's Most Wanted encounter cards whose printed "Then" waits on something other than a required choice
 * (docs/then-sweep.md, RRG 1.8 "'Then'", p. 44). "Discard … until you discard a minion. Reveal that minion, then …":
 * a discard that finds none is "fulfilled" (RRG 1.8 "Encounter Deck", p. 17), but "Reveal that minion" then has no
 * minion, so the post-"then" text is skipped (`revealFoundNothing`). Badoon Ship's threshold "if" is post-"then" text
 * that gates itself.
 */

import type { AnyCard } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { endTurn, inst, instancesOf, P1, patchInstance, stackEncounterDeck } from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { wave3Scenario } from "../setup.js";
import { startWave3Game, WAVE3_DEPS } from "../testing.js";

const skipped = (events: readonly GameEvent[]) => events.some((e) => e.type === "thenSkipped");
const causes = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "preThenUnresolved" ? [e.cause] : []));
const toughGiven = (events: readonly GameEvent[]) =>
  events.some((e) => e.type === "statusGiven" && e.status === "tough");

/** Takes every card matching `drop` out of the active encounter deck and discard pile (test surgery). */
function withoutEncounterCards(state: GameState, drop: (card: AnyCard) => boolean): GameState {
  const deckId = activeEncounterDeckId(state);
  const piles = activeEncounterDeck(state);
  const keep = (id: InstanceId) => {
    const card = state.cardPool[inst(state, id).cardId];
    return !card || !drop(card);
  };
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: piles.deck.filter(keep), discard: piles.discard.filter(keep) },
    },
  };
}
const hasTrait = (card: AnyCard, name: string) =>
  "traits" in card && (card.traits as readonly string[]).some((t) => t.toUpperCase() === name);

describe("Planetary Invasion (16057): 'then give it a tough status card' waits on the reveal", () => {
  const rocketVsRhino = () =>
    startWave3Game(wave3Scenario("rhino", { players: [{ starterDeckId: "rocket-raccoon-aggression" }], seed: 2026 }));

  /** Planetary Invasion (Rocket's nemesis set, set aside) second on the encounter deck, behind the boost draw. */
  function staged(state: GameState): GameState {
    const invasion = state.players[0]!.setAside.find((id) => inst(state, id).cardId === "16057")!;
    const deckId = activeEncounterDeckId(state);
    const piles = activeEncounterDeck(state);
    return {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, setAside: p.setAside.filter((id) => id !== invasion) } : p,
      ),
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { ...piles, deck: [piles.deck[0]!, invasion, ...piles.deck.slice(1)] },
      },
    };
  }

  it("with no minion left to discard, nothing is revealed and the 'then' is skipped", () => {
    const state = staged(withoutEncounterCards(rocketVsRhino(), (card) => card.type === "minion"));
    const { events } = driveEvents(WAVE3_DEPS, state, endTurn());
    expect(causes(events)).toContain("revealFoundNothing");
    expect(skipped(events)).toBe(true);
    expect(toughGiven(events)).toBe(false);
  });

  it("with a minion to discard, it is revealed and then given a tough status card", () => {
    const state = staged(stackEncounterDeck(rocketVsRhino(), "01186", "01101"));
    const { events } = driveEvents(WAVE3_DEPS, state, endTurn());
    expect(skipped(events)).toBe(false);
    expect(toughGiven(events)).toBe(true);
  });
});

const nebula = () =>
  startWave3Game(wave3Scenario("nebula", { players: [{ starterDeckId: "groot-protection" }], seed: 2026 }));

describe("Combat Ready (16101): 'then resolve its Special ability' waits on the reveal", () => {
  it("with no Technique attachment left to discard, nothing is revealed and no Special resolves", () => {
    const state = withoutEncounterCards(
      stackEncounterDeck(nebula(), "01186", "16101"),
      (card) => card.type === "attachment" && hasTrait(card, "TECHNIQUE"),
    );
    const { events } = driveEvents(WAVE3_DEPS, state, endTurn());
    expect(causes(events)).toContain("revealFoundNothing");
    expect(skipped(events)).toBe(true);
  });

  it("with one, it is revealed and its Special resolves", () => {
    const { events } = driveEvents(WAVE3_DEPS, stackEncounterDeck(nebula(), "01186", "16101", "16097"), endTurn());
    expect(skipped(events)).toBe(false);
    expect(events.some((e) => e.type === "abilityResolved" && e.abilityId === "16097.weapon-mastery-special")).toBe(
      true,
    );
  });
});

describe("Honor Among Thieves (16141): the tough status and the villain's boost card both wait on the reveal", () => {
  it("with no Criminal minion left to discard, neither is given", () => {
    const state = withoutEncounterCards(
      stackEncounterDeck(nebula(), "01186", "16141"),
      (card) => card.type === "minion" && hasTrait(card, "CRIMINAL"),
    );
    const { state: after, events } = driveEvents(WAVE3_DEPS, state, endTurn());
    expect(causes(events)).toContain("revealFoundNothing");
    expect(skipped(events)).toBe(true);
    expect(toughGiven(events)).toBe(false);
    expect(inst(after, after.villains[0]!.instanceId).boostCards).toHaveLength(0);
  });

  it("with one, it is revealed, then given a tough status card, and the villain gets a facedown boost card", () => {
    const { state: after, events } = driveEvents(
      WAVE3_DEPS,
      stackEncounterDeck(nebula(), "01186", "16141", "16139"),
      endTurn(),
    );
    expect(skipped(events)).toBe(false);
    expect(toughGiven(events)).toBe(true);
    expect(inst(after, after.villains[0]!.instanceId).boostCards.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Badoon Ship (16063): the threshold 'if' is post-'then' text", () => {
  it("the fourth barrage counter deals the indirect damage and clears the counters; the 'then' always runs", () => {
    const state = startWave3Game(
      wave3Scenario("brotherhood-of-badoon", { players: [{ starterDeckId: "groot-protection" }], seed: 2026 }),
    );
    const [ship] = instancesOf(state, "16063") as [InstanceId];
    const { state: after, events } = driveEvents(
      WAVE3_DEPS,
      patchInstance(state, ship, { counters: { barrage: 3 } }),
      endTurn(),
    );
    expect(skipped(events)).toBe(false);
    expect(inst(after, ship).counters.barrage ?? 0).toBeLessThan(4);
  });
});
