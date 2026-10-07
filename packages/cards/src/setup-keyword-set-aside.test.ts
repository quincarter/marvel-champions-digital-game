/**
 * RRG 1.8 Appendix II step 11 (p. 51) searches "each deck and the set aside area" for setup-keyword cards
 * (docs/phase7-wave7.md §4.1 Q20 = B). One test per finding of docs/setup-keyword-set-aside-audit.md, on the real
 * scenarios, in standard and expert:
 *
 * - (a) Brotherhood of Badoon, Nebula, Ronan the Accuser: the Milano (16142, "Permanent. Setup.") begins in play by its
 *   keyword, before the 1A Setup that also names it resolves.
 * - (b) Escape the Museum and Mister Sinister: the scenario's own text keeps the cards aside; nothing changed. Nor
 *   for a campaign's supply (MC21's Norn Stone), which `campaigns/mts.qa.test.ts` plays in a real campaign game.
 * - (c) The Hood with a setup-bearing set among its seven set-aside sets: kept aside with its set, pending the owner.
 */
import { PLAYABLE_CARDS, cardId } from "@mc/content";
import { createGame, locateCard, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { PLAYABLE_DEPS, playableScenario, type PlayableScenarioOptions } from "./playable/index.js";

const DIFFICULTIES = ["standard", "expert"] as const;
const SEATS = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
const nameOf = new Map(PLAYABLE_CARDS.map((card) => [card.id as string, card.name]));

function created(scenarioId: string, options: Partial<PlayableScenarioOptions> = {}) {
  const config = playableScenario(scenarioId, { seed: 7, players: SEATS, ...options });
  const result = createGame(config, PLAYABLE_DEPS);
  if (!result.ok) throw new Error(result.error.message);
  return { config, state: result.state as GameState, events: result.events as readonly GameEvent[] };
}
const instancesNamed = (state: GameState, name: string): readonly InstanceId[] =>
  Object.values(state.instances)
    .filter((instance) => nameOf.get(instance.cardId) === name)
    .map((instance) => instance.instanceId);
const only = (state: GameState, name: string): InstanceId => {
  const found = instancesNamed(state, name);
  expect(found, name).toHaveLength(1);
  return found[0]!;
};
const movesOf = (events: readonly GameEvent[], id: InstanceId): readonly string[] =>
  events.flatMap((event) => (event.type === "cardMoved" && event.instanceId === id ? [event.to.kind] : []));

describe("(a) the Milano begins in play by its setup keyword, from the set-aside area", () => {
  const cases = [
    ["brotherhood-of-badoon", "16061a.setup"],
    ["nebula", "16091a.setup"],
    ["ronan-the-accuser", "16106a.setup"],
  ] as const;
  for (const [scenarioId, setupAbilityId] of cases) {
    for (const difficulty of DIFFICULTIES) {
      test(`${scenarioId} (${difficulty})`, () => {
        const { config, state, events } = created(scenarioId, { difficulty });
        expect(config.setAsideUntilCalled).toBeUndefined();
        const milano = only(state, "Milano");
        const first = state.firstPlayerId;
        expect(locateCard(state, milano)).toEqual({ kind: "playArea", playerId: first });
        expect(state.instances[milano]!.controllerId).toBe(first);
        expect(state.instances[milano]!.ownerId).toBe(first);
        expect(state.instances[milano]!.exhausted).toBe(false);
        // Once, at step 11: before the 1A Setup ability, whose "and the Milano support" then finds it in play.
        expect(movesOf(events, milano)).toEqual(["playArea"]);
        const entered = events.findIndex((event) => event.type === "cardMoved" && event.instanceId === milano);
        const setup = events.findIndex(
          (event) => event.type === "abilityResolved" && event.abilityId === setupAbilityId,
        );
        expect(setup).toBeGreaterThan(-1);
        expect(entered).toBeLessThan(setup);
        expect(state.encounterSetAside).not.toContain(milano);
        // The rest of the 1A Setup still resolved: the scenario's ship environment is in play.
        expect(state.villainArea.some((id) => (nameOf.get(state.instances[id]!.cardId) ?? "").endsWith("Ship"))).toBe(
          true,
        );
      });
    }
  }
});

describe("(b) a scenario's own text keeps its setup-keyword cards aside: unchanged", () => {
  for (const difficulty of DIFFICULTIES) {
    test(`Escape the Museum (${difficulty}): the Milano waits for stage 2A`, () => {
      const { config, state, events } = created("escape-the-museum", { difficulty });
      expect(config.setAsideUntilCalled).toEqual({ encounterSetIds: ["ship_command"] });
      const milano = only(state, "Milano");
      expect(locateCard(state, milano)).toEqual({ kind: "encounterSetAside" });
      expect(movesOf(events, milano)).toEqual([]);
      expect(state.instances[milano]!.controllerId).toBeNull();
      // The whole Ship Command set is aside with it (1A's Setup), none of it in the deck.
      expect(
        instancesNamed(state, "Rogue Vessel").every((id) => locateCard(state, id)?.kind === "encounterSetAside"),
      ).toBe(true);
    });

    test(`Mister Sinister (${difficulty}): one Superpower attached by its stage, the others aside`, () => {
      const { config, state, events } = created("mister-sinister", { difficulty });
      expect(config.setAsideUntilCalled).toEqual({ encounterSetIds: ["flight", "super_strength", "telepathy"] });
      const powers = ["Flight", "Super Strength", "Telepathy"].map((name) => only(state, name));
      const places = powers.map((id) => locateCard(state, id)?.kind);
      // Stage 1B removes one stage 2 and advances to another, whose 2B attaches its own set's attachment.
      expect(places.filter((kind) => kind === "attachment")).toHaveLength(1);
      expect(places.filter((kind) => kind === "encounterSetAside")).toHaveLength(2);
      for (const [index, id] of powers.entries())
        expect(movesOf(events, id)).toEqual(places[index] === "attachment" ? ["attachment"] : []);
      // Hope Summers, found in the encounter deck, still begins in play under the first player.
      expect(locateCard(state, only(state, "Hope Summers"))).toEqual({
        kind: "playArea",
        playerId: state.firstPlayerId,
      });
    });
  }
});

describe("(b) a campaign's supply of a setup-keyword card is not the scenario's set-aside card: unchanged", () => {
  test("MC21's Norn Stone (21187a), set aside for Find the Norn Stones to hand out, is not put into play", () => {
    const base = playableScenario("hela", { seed: 7, players: SEATS });
    const result = createGame({ ...base, setAside: [...(base.setAside ?? []), cardId("21187a")] }, PLAYABLE_DEPS);
    if (!result.ok) throw new Error(result.error.message);
    const stone = only(result.state, "Norn Stone");
    expect(locateCard(result.state, stone)).toEqual({ kind: "encounterSetAside" });
    expect(movesOf(result.events, stone)).toEqual([]);
  });
});

describe("(c) The Hood: a setup-keyword card in a set-aside modular set stays with its set (pending the owner)", () => {
  const others = [
    "beasty_boys",
    "brothers_grimm",
    "crossfire_crew",
    "mister_hyde",
    "ransacked_armory",
    "sinister_syndicate",
  ];
  const cases = [
    ["power_stone", "Power Stone"],
    ["infinity_gauntlet", "Infinity Gauntlet"],
    ["flight", "Flight"],
  ] as const;
  for (const [setId, cardName] of cases) {
    test(`${cardName} is not put into play at setup`, () => {
      let stayedAside = 0;
      for (let seed = 1; seed <= 8; seed++) {
        const { config, state } = created("the-hood", { seed, setAsideModularSetIds: [setId, ...others] });
        expect(config.setAsideUntilCalled?.encounterSetIds).toContain(setId);
        // Aside with its set, or in the encounter deck when 1A's random pick shuffled its set in.
        const place = locateCard(state, only(state, cardName))?.kind;
        expect(["encounterSetAside", "encounterDeck"]).toContain(place);
        if (place === "encounterSetAside") stayedAside++;
      }
      expect(stayedAside).toBeGreaterThan(0);
    });
  }
});
