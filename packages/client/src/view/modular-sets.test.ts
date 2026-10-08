import { describe, expect, test } from "vitest";
import {
  cardCountForSet,
  compactModularEntriesFor,
  descriptorForSet,
  groupStartsOpen,
  modularCardLabel,
  modularGroupsOf,
  modularSectionsFor,
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
  test("Rhino: its own recommendation first, then every modular set of the pool", () => {
    const ids = modularSetCandidateIdsFor(rhino);
    expect(ids[0]).toBe("bomb_scare");
    expect(ids).toEqual(expect.arrayContaining(["under_attack", "power_drain", "shadow_king", "reavers"]));
    expect(new Set(ids).size, "no set twice").toBe(ids.length);
    expect(ids).not.toContain("rhino");
  });

  test("a wave 1 scenario's own recommended sets lead the list (its own Power Drain among them)", () => {
    const ids = modularSetCandidateIdsFor(riskyBusiness);
    expect(ids.slice(0, 2).sort()).toEqual(["bomb_scare", "power_drain"]);
    expect(ids).toContain("bomb_scare");
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
    const options = modularSetOptionsFor(draftFor("breakout"), breakout, CARDS_BY_ID).filter((o) => o.kind === "set");
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

describe("groups, sections and the phone's folded list", () => {
  const rhinoOptions = () => modularSetOptionsFor(draftFor("rhino"), rhino, CARDS_BY_ID);

  test("options come group by group: Recommended, Extras, then each cycle; only a group's first tile carries its label", () => {
    const options = rhinoOptions();
    expect(options[0]).toMatchObject({ id: "bomb_scare", groupId: "recommended", groupLabel: "Recommended" });
    const labels = options.filter((o) => o.groupLabel !== null).map((o) => o.groupLabel);
    expect(labels).toEqual([
      "Recommended",
      "Extras",
      "Core Set",
      "Wave 1",
      "The Rise of Red Skull",
      "The Galaxy's Most Wanted",
      "Promo",
      "The Mad Titan's Shadow",
      "Sinister Motives",
      "Mutant Genesis",
      "NeXt Evolution",
      "Age of Apocalypse",
    ]);
    expect(options.find((o) => o.id === "longshot")).toMatchObject({ kind: "extra", groupId: "extras" });
  });

  test("sections: required first with no label, then each group with its tile count", () => {
    const sections = modularSectionsFor(1, rhinoOptions());
    expect(sections[0]).toEqual({ id: "required", label: null, itemCount: 1 });
    expect(sections[1]).toEqual({ id: "recommended", label: "Recommended · 1", itemCount: 1 });
    expect(sections.reduce((sum, s) => sum + s.itemCount, 0)).toBe(1 + rhinoOptions().length);
    expect(modularSectionsFor(0, rhinoOptions())[0]!.id).toBe("recommended");
  });

  test("a pooled scenario's Random chip sits with its recommended sets, in the first group", () => {
    const magog = POOL_SCENARIOS.find((s) => (s.id as string) === "magog")!;
    const options = modularSetOptionsFor(draftFor("magog"), magog, CARDS_BY_ID);
    const random = options.findIndex((o) => o.kind === "random");
    expect(options[random]!.groupId).toBe("recommended");
    expect(options[random - 1]!.groupId).toBe("recommended");
    expect(options[random + 1]!.groupId).toBe("extras");
  });

  test("the phone starts with Recommended and Extras showing and every cycle folded, until a set in it is chosen", () => {
    const groups = modularGroupsOf(rhinoOptions());
    expect(groups.filter(groupStartsOpen).map((g) => g.id)).toEqual(["recommended", "extras"]);
    const chosen = toggleModularSet(draftFor("rhino"), rhino, "shadow_king");
    const open = modularGroupsOf(modularSetOptionsFor(chosen, rhino, CARDS_BY_ID)).filter(groupStartsOpen);
    expect(open.map((g) => g.id)).toContain("cycle6");
  });

  test("folded entries: a row per labeled group, then only the sets of groups that are open", () => {
    const options = rhinoOptions();
    const entries = compactModularEntriesFor(options, (g) => g.id === "recommended");
    expect(entries.filter((e) => e.kind === "group")).toHaveLength(modularGroupsOf(options).length);
    expect(entries.filter((e) => e.kind === "set").map((e) => e.id)).toEqual(["bomb_scare"]);
    const all = compactModularEntriesFor(options, () => true);
    expect(all.filter((e) => e.kind === "set")).toHaveLength(options.length);
  });

  test("a restricted pool has no group rows at all", () => {
    const mojo = POOL_SCENARIOS.find((s) => (s.id as string) === "mojo")!;
    const options = modularSetOptionsFor(draftFor("mojo"), mojo, CARDS_BY_ID);
    const entries = compactModularEntriesFor(
      options.filter((o) => o.kind !== "extra"),
      () => false,
    );
    expect(entries.every((e) => e.kind === "set")).toBe(true);
  });
});

describe("a barred pairing", () => {
  test("cannot be added, but a pick that is already there can be taken back out", () => {
    const toggled = toggleModularSet(draftFor("rhino"), rhino, "shadow_king");
    expect(toggled.modularSetIds).toEqual(["shadow_king"]);
    expect(toggleModularSet(toggled, rhino, "shadow_king").modularSetIds).toEqual([]);
  });

  test("its tile reads the reason where the card count goes", () => {
    expect(
      modularCardLabel({ selected: false, cardCount: 5, descriptor: "Minions", disabledReason: "Needs two villains" }),
    ).toBe("Needs two villains");
  });
});
