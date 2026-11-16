/**
 * "Allow extra modular sets" (issue #761): a house rule, off by default, that lets Table setup add modular sets beyond the
 * number a scenario calls for. Off, nothing changes; on, a pick past the count is added beside the picks and shuffled
 * into the encounter deck by the session (the scenario builders refuse such a pick).
 */
import { describe, expect, test } from "vitest";
import { POOL_SCENARIOS, CARDS_BY_ID } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { defaultSettings } from "../settings.js";
import { houseModularAllowed, houseModularSetIdsOf } from "./house-modular-sets.js";
import { modularHeaderRightLabel } from "./modular-summary.js";
import {
  cardCountForSet,
  effectiveModularSetIds,
  houseSetCount,
  modularCardLabel,
  modularDealBlockOf,
  modularSetOptionsFor,
  pickedSetCount,
  toggleModularSet,
} from "./modular-sets.js";
import { offerOf, reconcileWithOffer } from "./setup-options.js";
import { initialSetupDraft, setScenario, toSessionConfig, type SetupDraft } from "./setup-draft.js";

const scenarioOf = (id: string) => POOL_SCENARIOS.find((s) => (s.id as string) === id)!;
const draftFor = (id: string): SetupDraft =>
  initialSetupDraft({ scenarioId: id, seatDeckId: "precon:cap-leadership", seed: 11 });
const players = [{ starterDeckId: "core-spider-man-justice" }];
const rhino = scenarioOf("rhino");
const optionsOf = (draft: SetupDraft, allowMore: boolean) =>
  modularSetOptionsFor(draft, rhino, CARDS_BY_ID, { allowMore });
const toggle = (draft: SetupDraft, id: string, allowMore: boolean) =>
  toggleModularSet(draft, rhino, id, undefined, allowMore);

describe("the setting", () => {
  test("is off by default", () => {
    expect(defaultSettings().allowExtraModularSets).toBe(false);
  });
});

describe("with the rule off (the printed game)", () => {
  test("a second pick replaces the first, as it always has, and nothing is held beyond the count", () => {
    const first = toggle(draftFor("rhino"), "masters_of_evil", false);
    expect(first.modularSetIds).toEqual(["masters_of_evil"]);
    const second = toggle(first, "under_attack", false);
    expect(second.modularSetIds).toEqual(["under_attack"]);
    expect(houseModularSetIdsOf(second)).toEqual([]);
    expect(toSessionConfig(second, players, rhino).houseModularSetIds).toBeUndefined();
  });

  test("the count stays one and no tile is marked as an extra", () => {
    const options = optionsOf(toggle(draftFor("rhino"), "masters_of_evil", false), false);
    expect(pickedSetCount(options)).toBe(1);
    expect(houseSetCount(options)).toBe(0);
  });
});

describe("with the rule on", () => {
  test("a pick past the count is added beside the picks, and the count the scenario calls for is untouched", () => {
    // Rhino calls for one modular set, Bomb Scare by default; two more are added beside it.
    let draft = toggle(draftFor("rhino"), "masters_of_evil", true);
    draft = toggle(draft, "under_attack", true);
    expect(effectiveModularSetIds(draft, rhino)).toEqual(["bomb_scare"]);
    expect(houseModularSetIdsOf(draft)).toEqual(["masters_of_evil", "under_attack"]);
    const options = optionsOf(draft, true);
    expect(pickedSetCount(options)).toBe(1);
    expect(houseSetCount(options)).toBe(2);
    expect(options.filter((o) => o.selected).map((o) => o.id)).toEqual(
      expect.arrayContaining(["bomb_scare", "masters_of_evil", "under_attack"]),
    );
    expect(modularDealBlockOf(draft, rhino)).toBeNull();
  });

  test("an added set can be taken back out, and the tile says it is an extra", () => {
    let draft = toggle(toggle(draftFor("rhino"), "masters_of_evil", true), "under_attack", true);
    const tile = optionsOf(draft, true).find((o) => o.id === "under_attack")!;
    expect(tile.house).toBe(true);
    expect(modularCardLabel(tile)).toMatch(/^Chosen · extra · \d+ cards?/);
    draft = toggle(draft, "under_attack", true);
    expect(houseModularSetIdsOf(draft)).toEqual(["masters_of_evil"]);
    expect(effectiveModularSetIds(draft, rhino)).toEqual(["bomb_scare"]);
  });

  test("taking out a pick the scenario counts steps an extra into the count", () => {
    let draft = toggle(toggle(draftFor("rhino"), "masters_of_evil", true), "under_attack", true);
    draft = toggle(draft, "bomb_scare", true);
    expect(effectiveModularSetIds(draft, rhino)).toEqual(["masters_of_evil"]);
    expect(houseModularSetIdsOf(draft)).toEqual(["under_attack"]);
    expect(modularDealBlockOf(draft, rhino)).toBeNull();
  });

  test("the header says how many are extra", () => {
    expect(modularHeaderRightLabel(rhino, 1, 1, 1, null)).toBe("1 required · 1 chosen");
    expect(modularHeaderRightLabel(rhino, 1, 1, 1, 0)).toBe("1 required · 1 chosen · house rule: add more");
    expect(modularHeaderRightLabel(rhino, 1, 1, 1, 2)).toBe("1 required · 1 chosen + 2 extra (house rule)");
  });

  test("a scenario that calls for no modular set takes them all as extras, and only with the rule on", () => {
    const breakout = scenarioOf("breakout");
    const fresh = initialSetupDraft({ scenarioId: "breakout", seatDeckId: "precon:cap-leadership", seed: 3 });
    expect(houseModularSetIdsOf(toggleModularSet(fresh, breakout, "masters_of_evil", undefined, true))).toEqual([
      "masters_of_evil",
    ]);
    expect(toggleModularSet(fresh, breakout, "masters_of_evil", undefined, false).houseModularSetIds).toBeUndefined();
  });

  test("scenarios that pool or set aside their sets are left out", () => {
    expect(houseModularAllowed(rhino)).toBe(true);
    for (const id of ["mojo", "spiral", "the-hood"]) expect(houseModularAllowed(scenarioOf(id))).toBe(false);
    const mojo = scenarioOf("mojo");
    const draft = initialSetupDraft({ scenarioId: "mojo", seatDeckId: "precon:cap-leadership", seed: 3 });
    expect(houseModularSetIdsOf(toggleModularSet(draft, mojo, "crime", undefined, true))).toEqual([]);
  });

  test("the sets ride the session config, and stay with their own scenario only", () => {
    const draft = toggle(toggle(draftFor("rhino"), "masters_of_evil", true), "under_attack", true);
    expect(toSessionConfig(draft, players, rhino).houseModularSetIds).toEqual(["masters_of_evil", "under_attack"]);
    expect(setScenario(draft, scenarioOf("klaw"), "klaw").houseModularSetIds).toBeUndefined();
    expect(setScenario(draft, rhino, "rhino").houseModularSetIds).toEqual(["masters_of_evil", "under_attack"]);
  });
});

describe("a real game with an extra modular set", () => {
  const deal = async (houseModularSetIds?: readonly string[]) => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players,
      seed: 7,
      modularSetIds: ["bomb_scare"],
      ...(houseModularSetIds ? { houseModularSetIds } : {}),
    });
    expect(store.state.status).not.toBe("failed");
    const state = store.state.game!;
    return Object.values(state.instances).filter((instance) => {
      const card = CARDS_BY_ID.get(instance.cardId as string);
      return card !== undefined && "encounterSetIds" in card;
    });
  };
  const inSet = (cards: Awaited<ReturnType<typeof deal>>, set: string): number =>
    cards.filter((instance) =>
      (CARDS_BY_ID.get(instance.cardId as string) as { encounterSetIds: readonly string[] }).encounterSetIds.includes(
        set,
      ),
    ).length;

  test("without the rule the extra set is not in the game; with it, every card of it is", async () => {
    const plain = await deal();
    expect(inSet(plain, "under_attack")).toBe(0);
    const more = await deal(["under_attack"]);
    expect(inSet(more, "under_attack")).toBe(cardCountForSet("under_attack", CARDS_BY_ID));
    expect(inSet(more, "under_attack")).toBeGreaterThan(0);
    // The scenario's own modular set is in the game once, as in the plain game.
    expect(inSet(more, "bomb_scare")).toBe(inSet(plain, "bomb_scare"));
  });

  test("an extra set with its own deck (Infinity Gauntlet's stones) sets the deck aside, as when it is the counted pick", async () => {
    const stonesOf = async (opts: { modularSetIds: string[]; houseModularSetIds?: string[] }) => {
      const store = new SessionStore(new LocalEngineHost());
      await store.start({ scenarioId: "rhino", difficulty: "standard", players, seed: 7, ...opts });
      expect(store.state.status).not.toBe("failed");
      const state = store.state.game!;
      const stoneDeck = state.scenarioDecks["Infinity Stone"]?.deck ?? [];
      const inEncounterDeck = state.encounterDeckOrder.flatMap((id) => state.encounterDecks[id]?.deck ?? []);
      return { stoneDeck, inEncounterDeck };
    };
    const counted = await stonesOf({ modularSetIds: ["infinity_gauntlet"] });
    expect(counted.stoneDeck).toHaveLength(6);
    const extra = await stonesOf({ modularSetIds: ["bomb_scare"], houseModularSetIds: ["infinity_gauntlet"] });
    expect(extra.stoneDeck).toHaveLength(6);
    for (const stone of extra.stoneDeck) expect(extra.inEncounterDeck).not.toContain(stone);
  });
});

describe("Infinites and the Gene Pool threat follow the set between a counted pick and an extra", () => {
  const withThreat = (draft: SetupDraft): SetupDraft => ({ ...draft, genePoolThreatPerPlayer: 2 });
  const sent = (draft: SetupDraft) => toSessionConfig(draft, players, rhino);

  test("a game with Infinites only as an extra is offered the threat and sends it", () => {
    let draft = toggle(draftFor("rhino"), "infinites", true);
    expect(effectiveModularSetIds(draft, rhino)).toEqual(["bomb_scare"]);
    expect(houseModularSetIdsOf(draft)).toEqual(["infinites"]);
    expect(offerOf(draft).genePoolThreat).not.toBeNull();
    draft = withThreat(draft);
    expect(reconcileWithOffer(draft).genePoolThreatPerPlayer).toBe(2);
    expect(sent(draft).genePoolThreatPerPlayer).toBe(2);
    expect(sent(draft).houseModularSetIds).toEqual(["infinites"]);
  });

  test("moving Infinites between the count and the extras keeps the chosen amount", () => {
    // Counted Infinites with 2 per player; Bomb Scare then added beside it as an extra.
    let draft = withThreat(toggle(draftFor("rhino"), "infinites", true));
    draft = toggle(draft, "bomb_scare", true); // current is [bomb_scare]: deselect it, the extra steps in
    expect(effectiveModularSetIds(draft, rhino)).toEqual(["infinites"]);
    expect(sent(draft).genePoolThreatPerPlayer).toBe(2);
    // Add Bomb Scare back as an extra, then take Infinites out of the count: Bomb Scare steps in, Infinites is gone.
    draft = toggle(draft, "bomb_scare", true);
    expect(houseModularSetIdsOf(draft)).toEqual(["bomb_scare"]);
    expect(offerOf(draft).genePoolThreat).not.toBeNull();
    expect(sent(draft).genePoolThreatPerPlayer).toBe(2);
    draft = toggle(draft, "infinites", true);
    expect(effectiveModularSetIds(draft, rhino)).toEqual(["bomb_scare"]);
    expect(offerOf(draft).genePoolThreat).toBeNull();
    expect(sent(draft).genePoolThreatPerPlayer).toBeUndefined();
  });

  test("a real game builds the threat on Gene Pool whether Infinites is counted or an extra", async () => {
    const threatOf = async (opts: { modularSetIds: string[]; houseModularSetIds?: string[] }) => {
      const store = new SessionStore(new LocalEngineHost());
      await store.start({
        scenarioId: "rhino",
        difficulty: "standard",
        players,
        seed: 7,
        genePoolThreatPerPlayer: 2,
        ...opts,
      });
      expect(store.state.status).not.toBe("failed");
      const state = store.state.game!;
      return state.villainArea
        .map((id) => state.instances[id]!)
        .find((instance) => (instance.cardId as string) === "45071")?.threat;
    };
    const counted = await threatOf({ modularSetIds: ["infinites"] });
    expect(counted).toBeGreaterThan(0);
    expect(await threatOf({ modularSetIds: ["bomb_scare"], houseModularSetIds: ["infinites"] })).toBe(counted);
  });
});
