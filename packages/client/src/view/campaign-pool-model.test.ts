import { describe, expect, it } from "vitest";
import { MTS_CAMPAIGN_DEFINITION, TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import type { CampaignLog } from "@mc/engine";
import {
  campaignBriefingPool,
  campaignDossierPool,
  poolFieldsOf,
  type CardMetaOf,
  type PoolCopy,
} from "./campaign-pool-model.js";

const flag = (value: boolean) => ({ kind: "flag" as const, value });

const shared = (set: Readonly<Record<string, boolean>>): Pick<CampaignLog, "shared"> => ({
  shared: Object.fromEntries(Object.entries(set).map(([id, value]) => [id, flag(value)])),
});

/** The real card types behind MC21's own seven pool cards (`packages/content/src/data/mts/cards.ts`). */
const MTS_CARD_META: CardMetaOf = (name) => {
  switch (name) {
    case "Cosmo":
      return { type: "ally" };
    case "Odin":
      return { type: "ally" };
    case "Black Swan":
      return { type: "minion" };
    case "Security Breach":
      return { type: "side_scheme" };
    case "Shawarma":
      return { type: "resource" };
    case "System Shock":
      return { type: "obligation" };
    case "Norn Stone":
      return { type: "upgrade" };
    default:
      return undefined;
  }
};

const nodeOf = (id: string) => MTS_CAMPAIGN_DEFINITION.graph.nodes.find((node) => node.id === id)!;

describe("poolFieldsOf", () => {
  it("finds MC21's seven pool fields, in declared order, by their shared label suffix", () => {
    expect(poolFieldsOf(MTS_CAMPAIGN_DEFINITION).map((field) => field.name)).toEqual([
      "Cosmo",
      "Security Breach",
      "Shawarma",
      "Black Swan",
      "System Shock",
      "Norn Stone",
      "Odin",
    ]);
  });

  it("finds none on a box with no pool-shaped fields (MC10)", () => {
    expect(poolFieldsOf(TRORS_CAMPAIGN_DEFINITION)).toEqual([]);
  });
});

describe("campaignDossierPool", () => {
  it("is null for a box with no pool fields", () => {
    expect(campaignDossierPool(shared({}), TRORS_CAMPAIGN_DEFINITION, MTS_CARD_META)).toBeNull();
  });

  it("shows the empty-pool state before anything has been won", () => {
    const overview = campaignDossierPool(shared({}), MTS_CAMPAIGN_DEFINITION, MTS_CARD_META)!;
    expect(overview.totalSlots).toBe(7);
    expect(overview.filledSlots).toBe(0);
    expect(overview.cards).toEqual([]);
    expect(overview.emptySlots.map((slot) => slot.name)).toEqual([
      "Cosmo",
      "Security Breach",
      "Shawarma",
      "Black Swan",
      "System Shock",
      "Norn Stone",
      "Odin",
    ]);
    // Every slot names the real printed instruction that can still fill it — never invented prose.
    const cosmo = overview.emptySlots.find((slot) => slot.name === "Cosmo")!;
    expect(cosmo.note).toBe("#1 · If Secure the Landing Pad was defeated, add Cosmo to the campaign pool.");
  });

  it("after issue #2 (design tile 23): two helping cards then two hurting cards, and the right 'still in play for' list", () => {
    const overview = campaignDossierPool(
      shared({ cosmoInPool: true, shawarmaInPool: true, securityBreachInPool: true, blackSwanInPool: true }),
      MTS_CAMPAIGN_DEFINITION,
      MTS_CARD_META,
    )!;
    expect(overview.filledSlots).toBe(4);
    expect(overview.helpsCount).toBe(2);
    expect(overview.hurtsCount).toBe(2);
    expect(overview.cards.map((card) => [card.name, card.helps])).toEqual([
      ["Cosmo", true],
      ["Shawarma", true],
      ["Security Breach", false],
      ["Black Swan", false],
    ]);
    const cosmo = overview.cards.find((card) => card.name === "Cosmo")!;
    expect(cosmo.destination).toBe("Put him into play under the first player's control.");
    expect(cosmo.source).toBe("#1 · If Secure the Landing Pad was defeated, add Cosmo to the campaign pool.");

    expect(overview.stillInPlayFor.map((row) => row.name)).toEqual(["System Shock", "Norn Stone", "Odin"]);
    const systemShock = overview.stillInPlayFor.find((row) => row.name === "System Shock")!;
    expect(systemShock.note).toBe(
      "#3 · If Defensive Protocols is NOT in the victory display, add System Shock to the campaign pool.",
    );
  });

  it("classifies helps/hurts by the card's own printed type, defaulting to 'helps' with no lookup at all", () => {
    const overview = campaignDossierPool(shared({ blackSwanInPool: true }), MTS_CAMPAIGN_DEFINITION)!;
    expect(overview.cards[0]!.helps).toBe(true);
  });

  it("cites the reading/writing instruction's own page, never the log field's own citation (MC21 p. 28)", () => {
    const withOneWon = campaignDossierPool(shared({ cosmoInPool: true }), MTS_CAMPAIGN_DEFINITION, MTS_CARD_META)!;
    const systemShock = withOneWon.stillInPlayFor.find((row) => row.name === "System Shock")!;
    expect(systemShock.citation).toBe("MC21 p. 17");
    const nornStone = withOneWon.stillInPlayFor.find((row) => row.name === "Norn Stone")!;
    expect(nornStone.citation).toBe("MC21 p. 21");
  });

  it("an authored PoolCopy overrides destination/source/stillInPlayFor, substituting {firstPlayer}", () => {
    const copy: PoolCopy = {
      cosmoInPool: {
        destination: "In play, under {firstPlayer}'s control.",
        source: "Won in #1 · landing pad held",
        stillInPlayFor: "#1 · hold the landing pad",
      },
    };
    const empty = campaignDossierPool(shared({}), MTS_CAMPAIGN_DEFINITION, MTS_CARD_META, copy, "Adam Warlock")!;
    expect(empty.emptySlots.find((slot) => slot.name === "Cosmo")!.note).toBe("#1 · hold the landing pad");
    const resolved = campaignDossierPool(
      shared({ cosmoInPool: true }),
      MTS_CAMPAIGN_DEFINITION,
      MTS_CARD_META,
      copy,
      "Adam Warlock",
    )!;
    const cosmo = resolved.cards.find((card) => card.name === "Cosmo")!;
    expect(cosmo.destination).toBe("In play, under Adam Warlock's control.");
    expect(cosmo.source).toBe("Won in #1 · landing pad held");
  });
});

describe("campaignBriefingPool", () => {
  it("is null for issue #1 (setup only ever writes pool flags, never reads one back)", () => {
    expect(campaignBriefingPool(shared({}), MTS_CAMPAIGN_DEFINITION, nodeOf("ebony-maw"), MTS_CARD_META)).toBeNull();
  });

  it("issue #3 (design tile 24): the four cards resolved by then, each ✓/✗ matching its stripe", () => {
    const view = campaignBriefingPool(
      shared({ cosmoInPool: true, shawarmaInPool: true, securityBreachInPool: true, blackSwanInPool: true }),
      MTS_CAMPAIGN_DEFINITION,
      nodeOf("thanos"),
      MTS_CARD_META,
    )!;
    expect(view.rows.map((row) => [row.name, row.helps])).toEqual([
      ["Cosmo", true],
      ["Security Breach", false],
      ["Shawarma", true],
      ["Black Swan", false],
    ]);
    expect(view.groups).toBeNull();
  });

  it("a resolved-but-not-yet-read field produces no row (Odin true before issue #5 reads it)", () => {
    const view = campaignBriefingPool(
      shared({ odinInPool: true }),
      MTS_CAMPAIGN_DEFINITION,
      nodeOf("hela"),
      MTS_CARD_META,
    );
    expect(view).toBeNull();
  });

  it("the finale (design tile 26), grouped by destination into play / encounter deck / each player's deck / upgrades", () => {
    const view = campaignBriefingPool(
      shared({
        cosmoInPool: true,
        odinInPool: true,
        blackSwanInPool: true,
        securityBreachInPool: true,
        shawarmaInPool: true,
        systemShockInPool: true,
        nornStoneInPool: true,
      }),
      MTS_CAMPAIGN_DEFINITION,
      nodeOf("loki"),
      MTS_CARD_META,
      true,
    )!;
    expect(view.groups).not.toBeNull();
    expect(view.groups!.map((group) => [group.title, group.rows.map((row) => row.name)])).toEqual([
      ["Into play", ["Cosmo", "Black Swan", "Odin"]],
      ["Encounter deck", ["Security Breach"]],
      ["Each player's deck", ["Shawarma", "System Shock"]],
      ["Upgrades", ["Norn Stone"]],
    ]);
    // ALLY/ENEMY for cards that become real game objects; HELPS/AGAINST for cards that only ride in a deck.
    const byName = new Map(view.rows.map((row) => [row.name, row.badgeLabel]));
    expect(byName.get("Cosmo")).toBe("ALLY");
    expect(byName.get("Black Swan")).toBe("ENEMY");
    expect(byName.get("Security Breach")).toBe("ENEMY");
    expect(byName.get("Shawarma")).toBe("HELPS");
    expect(byName.get("System Shock")).toBe("AGAINST");
    expect(view.groups!.find((group) => group.kind === "encounterDeck")!.subtitle).toBe("Shuffled in.");
  });
});
