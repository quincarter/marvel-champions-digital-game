import { afterEach, describe, expect, it } from "vitest";
import { CARDS_BY_ID } from "../content/pool.js";
import {
  allArtFor,
  artFor,
  defaultFaceFor,
  setArtLanguage,
  setShownBalancedScans,
  type CardFace,
} from "./art-source.js";
import { BALANCED_TEXT, BalancedArtGate, balancedScansOf, balancedTextOf } from "./balanced-art.js";
import { BALANCED_SCANS } from "./balanced-scans.js";

type Config = Parameters<typeof balancedScansOf>[0];

const flag = { kind: "flag", value: true } as const;
const config = (balanced: boolean, toggles: readonly string[] = [], campaignId = "gmw"): Config =>
  ({
    modes: { campaign: { campaignId, ...(balanced ? { balanced: true } : {}) } },
    campaign: {
      log: {
        // The runner hands the game an unsealed hidden field in `shared` (`logViewFor`).
        shared: Object.fromEntries(toggles.map((field) => [field, flag])),
        perSeat: [],
      },
    },
  }) as unknown as Config;

const ALWAYS = ["16070", "16071", "16072", "16093", "16106a-nokree", "16106b", "16107b"];

afterEach(() => {
  setShownBalancedScans(new Set());
  setArtLanguage("en");
});

describe("which Balanced scans a game shows", () => {
  it("shows none in a Normal run, another campaign, or no game", () => {
    expect([...balancedScansOf(config(false))]).toEqual([]);
    expect([...balancedScansOf(config(true, [], "trors"))]).toEqual([]);
    expect([...balancedScansOf(null)]).toEqual([]);
    expect([...balancedScansOf({} as Config)]).toEqual([]);
  });

  it("shows the always-on scans in a Balanced run, and no toggle's", () => {
    expect([...balancedScansOf(config(true))].sort()).toEqual([...ALWAYS].sort());
  });

  it.each([
    ["balancedSpacePirates", ["16073a", "16073b"], []],
    ["balancedMilanoExhausted", ["16142"], []],
    // The Kree toggle swaps one 16106a scan for the other: one of them shows in every Balanced Ronan game.
    ["balancedKreeSupremacy", ["16106a"], ["16106a-nokree"]],
  ])("adds a toggle's scans only with %s on", (field, added, removed) => {
    const on = balancedScansOf(config(true, [field]));
    const expected = [...ALWAYS.filter((id) => !removed.includes(id)), ...added];
    expect([...on].sort()).toEqual([...expected].sort());
    // A toggle without Balanced does nothing.
    expect(balancedScansOf(config(false, [field])).size).toBe(0);
  });

  it("shows the no-Kree 16106a with the toggle off and the Kree one with it on, never both", () => {
    const off = balancedScansOf(config(true));
    expect(off.has("16106a-nokree")).toBe(true);
    expect(off.has("16106a")).toBe(false);
    const on = balancedScansOf(config(true, ["balancedKreeSupremacy"]));
    expect(on.has("16106a")).toBe(true);
    expect(on.has("16106a-nokree")).toBe(false);
  });

  it("swaps 16106a's picture and text for the variant that matches the toggle", () => {
    const card = CARDS_BY_ID.get("16106a");
    const face = { kind: "mainSchemeStage", stageIndex: 0, side: "A" } as const;
    setShownBalancedScans(balancedScansOf(config(true)));
    expect(artFor(card, face)?.url).toBe("/card-art/bundles/cards/16106a-balanced-nokree.png");
    const text = balancedTextOf(artFor(card, face))!;
    expect(text).toMatch(/Remove the Kree Command Ship from the game.$/);
    expect(text).not.toMatch(/Kree Supremacy/);
    setShownBalancedScans(balancedScansOf(config(true, ["balancedKreeSupremacy"])));
    expect(artFor(card, face)?.url).toBe("/card-art/bundles/cards/16106a-balanced.png");
    expect(balancedTextOf(artFor(card, face))).toMatch(/shuffle Kree Supremacy into the encounter deck.$/);
  });

  it("every scan in the table has a gate and a written text", () => {
    for (const entry of BALANCED_SCANS) expect(BALANCED_TEXT[entry.id], entry.id).toBeTruthy();
  });
});

describe("the swap in artFor", () => {
  const card = CARDS_BY_ID.get("16070");
  const front: CardFace = defaultFaceFor(card);

  it("draws the normal scan until a Balanced game sets the swap", () => {
    expect(artFor(card, front)?.url).toBe("/card-art/bundles/cards/16070.png");
  });

  it("draws the Balanced scan while it is set, and the normal one again once it is cleared", () => {
    setShownBalancedScans(balancedScansOf(config(true)));
    expect(artFor(card, front)?.url).toBe("/card-art/bundles/cards/16070-balanced.png");
    setShownBalancedScans(balancedScansOf(null));
    expect(artFor(card, front)?.url).toBe("/card-art/bundles/cards/16070.png");
  });

  it("keeps a toggle's card normal with the toggle off", () => {
    const milano = CARDS_BY_ID.get("16142");
    const milanoFace = defaultFaceFor(milano);
    setShownBalancedScans(balancedScansOf(config(true)));
    expect(artFor(milano, milanoFace)?.url).toBe("/card-art/bundles/cards/16142.png");
    setShownBalancedScans(balancedScansOf(config(true, ["balancedMilanoExhausted"])));
    expect(artFor(milano, milanoFace)?.url).toBe("/card-art/bundles/cards/16142-balanced.png");
  });

  it("follows the card language, with its own texture key", () => {
    setShownBalancedScans(balancedScansOf(config(true)));
    const english = artFor(card, front)!;
    setArtLanguage("es");
    const spanish = artFor(card, front)!;
    // A build without Spanish stays on its own language; one with it asks the Spanish folder.
    if (spanish.url !== english.url) {
      expect(spanish.url).toBe("/card-art-es/bundles/cards/16070-balanced.png");
      expect(spanish.key).not.toBe(english.key);
    }
  });

  it("is carried in the build, beside the normal scan", () => {
    const urls = allArtFor(card!).map((art) => art.url);
    expect(urls).toContain("/card-art/bundles/cards/16070.png");
    expect(urls).toContain("/card-art/bundles/cards/16070-balanced.png");
  });
});

describe("the Balanced text", () => {
  it("is for a Balanced scan only", () => {
    const card = CARDS_BY_ID.get("16070");
    expect(balancedTextOf(artFor(card, defaultFaceFor(card)))).toBeNull();
    setShownBalancedScans(balancedScansOf(config(true)));
    expect(balancedTextOf(artFor(card, defaultFaceFor(card)))).toMatch(/put it faceup into The Collection instead/);
  });
});

describe("two-sided cards", () => {
  it("swaps each side of a main scheme for its own Balanced scan", () => {
    setShownBalancedScans(new Set(["16073a", "16073b", "16106a", "16106b", "16107b"]));
    const scan = (id: string, side: "A" | "B", stageIndex = 0): string | null => {
      const art = artFor(CARDS_BY_ID.get(id), { kind: "mainSchemeStage", stageIndex, side });
      return art?.url.match(/\/(\w+?)(-balanced)?\.png$/)?.[1] ?? null;
    };
    expect(scan("16073a", "A")).toBe("16073a");
    expect(scan("16073a", "B")).toBe("16073b");
    expect(scan("16106a", "A")).toBe("16106a");
    expect(scan("16106a", "B")).toBe("16106b");
    expect(artFor(CARDS_BY_ID.get("16106a"), { kind: "mainSchemeStage", stageIndex: 0, side: "A" })?.url).toContain(
      "-balanced",
    );
  });

  it("shows the Balanced text for the side on screen", () => {
    setShownBalancedScans(new Set(["16073b"]));
    const card = CARDS_BY_ID.get("16073a");
    expect(balancedTextOf(artFor(card, { kind: "mainSchemeStage", stageIndex: 0, side: "B" }))).toMatch(
      /at least 5\[per_hero\] cards/,
    );
    expect(balancedTextOf(artFor(card, { kind: "mainSchemeStage", stageIndex: 0, side: "A" }))).toBeNull();
  });
});

describe("when the scans show (BalancedArtGate)", () => {
  const harness = () => {
    const calls: string[][] = [];
    const gate = new BalancedArtGate((scans) => calls.push([...scans].sort()));
    return { gate, calls };
  };
  const balanced = config(true, ["balancedMilanoExhausted"]);

  it("shows nothing until a game screen is up, then the game's scans", () => {
    const { gate, calls } = harness();
    gate.setConfig(balanced);
    expect(calls).toEqual([]);
    gate.enter();
    expect(calls).toEqual([[...ALWAYS, "16142"].sort()]);
  });

  it("puts the normal scans back when the game screens close, even though the store still holds the config", () => {
    const { gate, calls } = harness();
    gate.setConfig(balanced);
    gate.enter();
    gate.leave();
    expect(calls.at(-1)).toEqual([]);
    // Save & quit, then a Normal run's briefing or the card browser: nothing shows.
    gate.setConfig(balanced);
    expect(calls).toHaveLength(2);
  });

  it("restores them on resume, and a Normal game after a Balanced one shows none", () => {
    const { gate, calls } = harness();
    gate.setConfig(balanced);
    gate.enter();
    gate.leave();
    gate.enter();
    expect(calls.at(-1)).toEqual([...ALWAYS, "16142"].sort());
    gate.leave();
    gate.setConfig(config(false));
    gate.enter();
    expect(calls.at(-1)).toEqual([]);
  });

  it("holds through a hand-off from the setup deal to the Board, and only acts on a change", () => {
    const { gate, calls } = harness();
    gate.setConfig(config(true));
    gate.enter();
    gate.enter();
    gate.leave();
    expect(calls).toHaveLength(1);
    gate.setConfig(config(true));
    expect(calls).toHaveLength(1);
    gate.leave();
    expect(calls.at(-1)).toEqual([]);
  });
});
