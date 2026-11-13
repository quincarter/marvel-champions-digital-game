import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PackManifest } from "@mc/content";
import { CARDS_BY_ID } from "../content/pool.js";
import { artFor, balancedScanOf, defaultFaceFor, setShownBalancedScans, setShownHouseRules } from "./art-source.js";
import { balancedTextOf } from "./balanced-art.js";
import { HouseRuleArtGate, houseRuleFacesOf } from "./house-rule-art.js";
import { resetPackArt, setPackArt, type PackArtStore } from "./pack-art.js";

const manifest = (id: string, houseRule: PackManifest["houseRule"], codes: readonly string[]): PackManifest =>
  ({
    schema: 1,
    id,
    version: "1.0.0",
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
const GMW = manifest("gmw-fixes-gg", { enablesMode: "balanced" }, ["16070", "16106a", "16107a"]);

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
    setShownHouseRules(["lost-traits-bf"]);
    expect(urlOf("01001a")).toBe("blob:test/lost-traits-bf/cards/en/01001a.webp");
    // A card the rule does not rebuild keeps its picture.
    expect(urlOf("01019a")).not.toMatch(/^blob:/);
    setShownHouseRules([]);
    expect(urlOf("01001a")).toBe(printed);
  });

  it("follow the game's own packs and the game screens' lifetime", () => {
    const shown: (readonly string[])[] = [];
    const gate = new HouseRuleArtGate((ids) => shown.push(ids));
    const config = { packs: [{ id: "lost-traits-bf", houseRule: { traitAdditions: [{}] } }, { id: "sample-hero" }] };
    expect(houseRuleFacesOf(config)).toEqual(["lost-traits-bf"]);
    expect(houseRuleFacesOf({ packs: [{ id: "gmw-fixes-gg", houseRule: {} }] })).toEqual([]);
    gate.setConfig(config);
    expect(shown).toEqual([]);
    gate.enter();
    expect(shown).toEqual([["lost-traits-bf"]]);
    gate.leave();
    expect(shown).toEqual([["lost-traits-bf"], []]);
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

  it("show nothing outside a Balanced game, and leave a scan version they do not rebuild alone", async () => {
    await withPacks(GMW);
    expect(urlOf("16070")).not.toMatch(/^blob:|balanced/);
    // Kree Supremacy off: Interception Imminent 1A shows its "no Kree" scan, which the pack does not rebuild.
    setShownBalancedScans(new Set(["16070", "16106a-nokree"]));
    expect(urlOf("16106a")).not.toMatch(/^blob:/);
  });
});
