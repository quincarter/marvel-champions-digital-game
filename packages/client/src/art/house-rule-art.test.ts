import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BALANCED_FACE_CODES, type PackManifest } from "@mc/content";
import { BALANCED_SCANS } from "./balanced-scans.js";
import { CARDS_BY_ID } from "../content/pool.js";
import { artFor, balancedScanOf, defaultFaceFor, setShownBalancedScans, setShownHouseRules } from "./art-source.js";
import { balancedTextOf } from "./balanced-art.js";
import { HouseRuleArtGate, houseRuleFacesOf } from "./house-rule-art.js";
import { houseRuleFaceFor, resetPackArt, setPackArt, type PackArtStore } from "./pack-art.js";

const manifest = (
  id: string,
  houseRule: PackManifest["houseRule"],
  codes: readonly string[],
  version = "1.0.0",
): PackManifest =>
  ({
    schema: 1,
    id,
    version,
    kind: "house-rule",
    name: id,
    authors: [],
    description: "",
    requires: { app: ">=0.1.0", dslFeatures: [], packs: [] },
    contents: { cards: "data/cards.json" },
    languages: { base: "en", available: ["en"] },
    houseRule,
    files: codes.map((code) => ({ path: `cards/en/${code}.webp`, bytes: 1, sha256: "" })),
    totalBytes: codes.length,
    license: "x",
  }) as unknown as PackManifest;

const store: PackArtStore = {
  objectUrl: async (id, path) => `blob:test/${id}/${path}`,
  revoke: () => undefined,
};

const LOST = manifest("lost-traits-bf", { traitAdditions: [{ code: "01001a", traits: ["Web-Warrior"] }] }, ["01001a"]);
// A mode pack that also ships pictures of cards that are not Balanced cards (validate refuses them; the client ignores
// them).
const GMW = manifest("gmw-fixes-gg", { enablesMode: "balanced" }, ["16070", "16106a", "16107a", "01001a", "01019a"]);

const card = (id: string) => CARDS_BY_ID.get(id)!;
const urlOf = (id: string) => artFor(card(id), defaultFaceFor(card(id)))?.url;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  resetPackArt();
  setShownHouseRules([]);
  setShownBalancedScans(new Set());
  vi.useRealTimers();
});

async function withPacks(...manifests: PackManifest[]): Promise<void> {
  setPackArt(manifests, store);
  await vi.advanceTimersByTimeAsync(200);
}

describe("a trait house rule's rebuilt faces (Lost Traits)", () => {
  it("show only while a game with the rule on is up", async () => {
    await withPacks(LOST);
    const printed = urlOf("01001a");
    expect(printed).not.toMatch(/^blob:/);
    setShownHouseRules([{ id: "lost-traits-bf", version: "1.0.0" }]);
    expect(urlOf("01001a")).toBe("blob:test/lost-traits-bf/cards/en/01001a.webp");
    // A card the rule does not rebuild keeps its picture.
    expect(urlOf("01019a")).not.toMatch(/^blob:/);
    setShownHouseRules([]);
    expect(urlOf("01001a")).toBe(printed);
  });

  it("show only a face the rule lists, even if the pack ships a picture of another official card", async () => {
    // 01019a is not in Lost Traits' traitAdditions here: the pack carries its picture, the rule does not own it.
    await withPacks(manifest("lost-traits-bf", LOST.houseRule, ["01001a", "01019a"]));
    setShownHouseRules([{ id: "lost-traits-bf", version: "1.0.0" }]);
    expect(urlOf("01001a")).toMatch(/^blob:/);
    expect(urlOf("01019a")).not.toMatch(/^blob:/);
  });

  it("show only when the installed version is the one the game was set up with", async () => {
    await withPacks(manifest("lost-traits-bf", LOST.houseRule, ["01001a"], "1.1.0"));
    const printed = urlOf("01001a");
    // Started with v1.0.0, installed v1.1.0: the printed face.
    setShownHouseRules([{ id: "lost-traits-bf", version: "1.0.0" }]);
    expect(urlOf("01001a")).toBe(printed);
    expect(printed).not.toMatch(/^blob:/);
    setShownHouseRules([{ id: "lost-traits-bf", version: "1.1.0" }]);
    expect(urlOf("01001a")).toMatch(/^blob:/);
  });

  it("follow the game's own packs and the game screens' lifetime", () => {
    const shown: (readonly { id: string; version: string }[])[] = [];
    const gate = new HouseRuleArtGate((ids) => shown.push(ids));
    const config = {
      packs: [{ id: "lost-traits-bf", version: "1.0.0", houseRule: { traitAdditions: [{}] } }, { id: "sample-hero" }],
    };
    expect(houseRuleFacesOf(config)).toEqual([{ id: "lost-traits-bf", version: "1.0.0" }]);
    expect(houseRuleFacesOf({ packs: [{ id: "gmw-fixes-gg", houseRule: {} }] })).toEqual([]);
    gate.setConfig(config);
    expect(shown).toEqual([]);
    gate.enter();
    expect(shown).toEqual([[{ id: "lost-traits-bf", version: "1.0.0" }]]);
    gate.leave();
    expect(shown).toEqual([[{ id: "lost-traits-bf", version: "1.0.0" }], []]);
  });
});

describe("GMW Fixes' rebuilt faces in a Balanced game", () => {
  it("replace the edited scans of the Balanced cards on screen, and their text stays the Balanced text", async () => {
    setShownBalancedScans(new Set(["16070"]));
    const scan = artFor(card("16070"), defaultFaceFor(card("16070")));
    expect(scan?.url).toMatch(/16070-balanced\.png$/);
    await withPacks(GMW);
    const rebuilt = artFor(card("16070"), defaultFaceFor(card("16070")));
    expect(rebuilt?.url).toBe("blob:test/gmw-fixes-gg/cards/en/16070.webp");
    expect(balancedScanOf(rebuilt)).toBe("16070");
    expect(balancedTextOf(rebuilt)).toMatch(/^Forced Interrupt/);
  });

  it("rebuild only the Balanced cards: a mode pack's picture of any other card is ignored", async () => {
    await withPacks(GMW);
    setShownBalancedScans(new Set(["16070"]));
    expect(urlOf("01001a")).not.toMatch(/^blob:/);
    expect(urlOf("01019a")).not.toMatch(/^blob:/);
    // The fixed scheme's stage 16107a is a Balanced card whose text is unchanged.
    expect(houseRuleFaceFor("gmw-fixes-gg", "16107a", "en")?.url).toBe("blob:test/gmw-fixes-gg/cards/en/16107a.webp");
  });

  it("allow the content package's list to agree with the Balanced scans", () => {
    for (const entry of BALANCED_SCANS) expect(BALANCED_FACE_CODES.has(entry.scan)).toBe(true);
    expect(BALANCED_FACE_CODES.has("16107a")).toBe(true);
  });

  it("show nothing outside a Balanced game, and leave a scan version they do not rebuild alone", async () => {
    await withPacks(GMW);
    expect(urlOf("16070")).not.toMatch(/^blob:|balanced/);
    // Kree Supremacy off: Interception Imminent 1A shows its "no Kree" scan, which the pack does not rebuild.
    setShownBalancedScans(new Set(["16070", "16106a-nokree"]));
    expect(urlOf("16106a")).not.toMatch(/^blob:/);
  });
});
