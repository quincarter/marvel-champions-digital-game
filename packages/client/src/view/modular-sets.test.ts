import { describe, expect, test } from "vitest";
import {
  cardCountForSet,
  descriptorForSet,
  modularCardLabel,
  modularSetCandidateIdsFor,
  modularSetOptionsFor,
  requiredCardLabel,
  requiredEncounterSetsFor,
  toggleModularSet,
} from "./modular-sets.js";
import { initialSetupDraft } from "./setup-draft.js";
import { CARDS_BY_ID, POOL_SCENARIOS } from "../content/pool.js";

const rhino = POOL_SCENARIOS.find((s) => (s.id as string) === "rhino")!;
const riskyBusiness = POOL_SCENARIOS.find((s) => (s.id as string) === "risky-business")!;
const breakout = POOL_SCENARIOS.find((s) => (s.id as string) === "breakout")!;

function draftFor(scenarioId: string) {
  return initialSetupDraft({ scenarioId, seatDeckId: "precon:core-spider-man-justice", seed: 1 });
}

describe("modularSetCandidateIdsFor", () => {
  test("Rhino: the five Core modulars, its own recommendation already among them", () => {
    const ids = modularSetCandidateIdsFor(rhino);
    expect(ids).toContain("bomb_scare");
    expect(ids.length).toBe(5);
  });

  test("a wave 1 scenario's own recommended set is added to the five Core modulars", () => {
    const ids = modularSetCandidateIdsFor(riskyBusiness);
    expect(ids).toContain("power_drain");
    expect(ids).toContain("bomb_scare");
    expect(ids.length).toBe(6);
  });
});

describe("modularSetOptionsFor", () => {
  test("the recommended set is selected by default (draft hasn't overridden it)", () => {
    const options = modularSetOptionsFor(draftFor("rhino"), rhino, CARDS_BY_ID);
    const bombScare = options.find((o) => o.id === "bomb_scare")!;
    expect(bombScare.selected).toBe(true);
    expect(bombScare.recommended).toBe(true);
    expect(options.filter((o) => o.selected).length).toBe(1);
  });

  test("Breakout offers the five Core modulars, none selected, none recommended", () => {
    const options = modularSetOptionsFor(draftFor("breakout"), breakout, CARDS_BY_ID);
    expect(options.length).toBe(5);
    expect(options.every((o) => !o.selected && !o.recommended)).toBe(true);
  });

  test("every candidate carries a real, positive card count", () => {
    const options = modularSetOptionsFor(draftFor("rhino"), rhino, CARDS_BY_ID);
    for (const option of options) expect(option.cardCount).toBeGreaterThan(0);
  });

  test("Bomb Scare's descriptor is one of the real, derived labels — not a hand-written guess", () => {
    const options = modularSetOptionsFor(draftFor("rhino"), rhino, CARDS_BY_ID);
    const bombScare = options.find((o) => o.id === "bomb_scare")!;
    expect(["Minions", "Side schemes", "Treacheries", "Attachments", "Environment", "Obligations"]).toContain(
      bombScare.descriptor,
    );
  });
});

describe("cardCountForSet / descriptorForSet", () => {
  test("Klaw's own required set has a real count and a descriptor derived from its cards, never invented copy", () => {
    const count = cardCountForSet("klaw", CARDS_BY_ID);
    expect(count).toBeGreaterThan(0);
    // Whatever descriptorForSet says, it must be one of the real labels this module knows how to derive — never a
    // hand-written string for this specific set.
    const descriptor = descriptorForSet("klaw", CARDS_BY_ID);
    if (descriptor !== null)
      expect(["Minions", "Side schemes", "Treacheries", "Attachments", "Environment", "Obligations"]).toContain(
        descriptor,
      );
  });

  test("an id with no cards in the pool has a zero count and no descriptor", () => {
    expect(cardCountForSet("not-a-real-set", CARDS_BY_ID)).toBe(0);
    expect(descriptorForSet("not-a-real-set", CARDS_BY_ID)).toBeNull();
  });
});

describe("requiredEncounterSetsFor", () => {
  test("Klaw's scenario names exactly its own villain set as required, with a real count", () => {
    const required = requiredEncounterSetsFor(
      POOL_SCENARIOS.find((s) => (s.id as string) === "klaw")!,
      CARDS_BY_ID,
    );
    expect(required.map((r) => r.id)).toEqual(["klaw"]);
    expect(required[0]!.cardCount).toBeGreaterThan(0);
  });
});

describe("requiredCardLabel / modularCardLabel", () => {
  test("required label names the villain and pluralizes the card count", () => {
    expect(requiredCardLabel("Klaw", 8)).toBe("Required by Klaw · 8 cards");
    expect(requiredCardLabel("Klaw", 1)).toBe("Required by Klaw · 1 card");
  });

  test("chosen vs available modular cards, with and without a descriptor", () => {
    expect(modularCardLabel({ selected: true, cardCount: 7, descriptor: "Side schemes" })).toBe(
      "Chosen · 7 cards · Side schemes",
    );
    expect(modularCardLabel({ selected: false, cardCount: 7, descriptor: "Side schemes" })).toBe(
      "7 cards · Side schemes",
    );
    expect(modularCardLabel({ selected: false, cardCount: 9, descriptor: null })).toBe("9 cards");
  });
});

describe("toggleModularSet", () => {
  test("picking a non-recommended set at cap 1 swaps it in", () => {
    const draft = toggleModularSet(draftFor("rhino"), rhino, "under_attack");
    const options = modularSetOptionsFor(draft, rhino, CARDS_BY_ID);
    expect(options.find((o) => o.id === "under_attack")?.selected).toBe(true);
    expect(options.find((o) => o.id === "bomb_scare")?.selected).toBe(false);
    expect(options.filter((o) => o.selected).length).toBe(1);
  });

  test("toggling the same set off leaves nothing selected", () => {
    const chosen = toggleModularSet(draftFor("rhino"), rhino, "under_attack");
    const cleared = toggleModularSet(chosen, rhino, "under_attack");
    expect(modularSetOptionsFor(cleared, rhino, CARDS_BY_ID).some((o) => o.selected)).toBe(false);
  });

  test("Breakout (cap 0) never gains a modular set from a toggle", () => {
    const draft = toggleModularSet(draftFor("breakout"), breakout, "bomb_scare");
    expect(modularSetOptionsFor(draft, breakout, CARDS_BY_ID).some((o) => o.selected)).toBe(false);
  });
});
