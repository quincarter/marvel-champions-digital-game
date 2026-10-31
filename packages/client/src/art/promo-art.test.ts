import { readFileSync } from "node:fs";
import { describe, expect, test, afterEach } from "vitest";
import { CARDS_BY_ID, POOL_SCENARIOS } from "../content/pool.js";
import { allArtFor, artFor, artPathOf, setShownPromos, standInArt } from "./art-source.js";
import { bundledArtPaths } from "./bundled-art.js";
import { PROMO_ART, PROMO_SETS, promoArtByScan, promoFaceArt, withPromoToggled } from "./promo-art.js";

const set = (id: string) => PROMO_SETS.find((one) => one.id === id)!;
const scanOf = (url: string): string => url.slice(url.lastIndexOf("/") + 1).replace(/\.\w+$/, "");

describe("the promo catalog (#192)", () => {
  test("every row of promo-scans.tsv is a picture of a set, and the other way round", () => {
    const tsv = readFileSync(new URL("../../../../assets/card-art/promo-scans.tsv", import.meta.url), "utf8");
    const rows = tsv
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && !line.startsWith("scan\t"))
      .map((line) => line.split("\t"));
    expect(rows.map(([scan, printing]) => `promos/${scan}-${printing}.webp`).sort()).toEqual(
      PROMO_ART.map(artPathOf).sort(),
    );
  });

  test("set ids are unique, and every picture is a different file", () => {
    expect(new Set(PROMO_SETS.map((one) => one.id)).size).toBe(PROMO_SETS.length);
    expect(new Set(PROMO_ART.map((art) => art.key)).size).toBe(PROMO_ART.length);
  });

  test("every face stands in for a scan a card in the pool really uses", () => {
    const scans = new Set([...CARDS_BY_ID.values()].flatMap((card) => allArtFor(card).map((art) => scanOf(art.url))));
    for (const one of PROMO_SETS) for (const face of one.faces) expect(scans, face.scan).toContain(face.scan);
  });

  test("what earns a set names a real hero, scenario or card", () => {
    const scenarios = new Set(POOL_SCENARIOS.map((scenario) => scenario.id as string));
    for (const { earn, id } of PROMO_SETS) {
      if (earn.kind === "heroWins") expect(CARDS_BY_ID.get(earn.identityCardId)?.type, id).toBe("hero_identity");
      if (earn.kind === "cardWins") for (const card of earn.cardIds) expect(CARDS_BY_ID.has(card), card).toBe(true);
      if (earn.kind === "scenarioWins") for (const scenario of earn.scenarioIds) expect(scenarios).toContain(scenario);
    }
  });

  test("a hero's second printing takes more wins than the first", () => {
    expect(set("cable").earn).toMatchObject({ wins: 3 });
    expect(set("cable-2").earn).toMatchObject({ wins: 10 });
  });

  test("the build carries every promo picture", () => {
    expect(bundledArtPaths([])).toEqual(expect.arrayContaining(PROMO_ART.map(artPathOf)));
  });
});

describe("drawing a promo", () => {
  afterEach(() => setShownPromos(new Map()));
  const spiderMan = CARDS_BY_ID.get("01001a");
  const goblin = CARDS_BY_ID.get("02014");

  test("a chosen set replaces each face it was printed for, and nothing else", () => {
    const before = artFor(spiderMan, { kind: "hero" });
    setShownPromos(promoArtByScan([set("spider-man")]));
    expect(artFor(spiderMan, { kind: "hero" })?.url).toBe("/card-art/promos/01001a-1.webp");
    expect(artFor(spiderMan, { kind: "alterEgo" })?.url).toBe("/card-art/promos/01001b-1.webp");
    expect(artFor(CARDS_BY_ID.get("01010a"), { kind: "hero" })?.url).not.toContain("promos");
    setShownPromos(new Map());
    expect(artFor(spiderMan, { kind: "hero" })).toEqual(before);
  });

  test("a villain's stages each take their own picture, and a stage with no promo keeps its scan", () => {
    setShownPromos(promoArtByScan([set("sabretooth")]));
    const sabretooth = CARDS_BY_ID.get("32060");
    const stage = (stageIndex: number) => artFor(sabretooth, { kind: "villainStage", sideIndex: 0, stageIndex })?.url;
    expect(stage(1)).toBe("/card-art/promos/32061-1.webp");
    expect(stage(2)).not.toContain("promos");
    setShownPromos(promoArtByScan([set("green-goblin")]));
    expect(artFor(goblin, { kind: "villainStage", sideIndex: 0, stageIndex: 2 })?.url).toContain("02016-1");
  });

  test("a reprint on the same scan takes the promo too", () => {
    setShownPromos(promoArtByScan([set("tackle")]));
    expect(artFor(CARDS_BY_ID.get("56049"), { kind: "front" })?.url).toBe("/card-art/promos/05015-1.webp");
  });

  test("a facedown card never shows a promo", () => {
    setShownPromos(promoArtByScan([set("spider-man")]));
    expect(artFor(spiderMan, { kind: "back", back: "player" })?.url).toContain("marvel-player-back");
    expect(standInArt({ kind: "ultronDrone", atk: 1 }).url).not.toContain("promos");
  });

  test("the first face of a set is its own picture", () => {
    expect(promoFaceArt(set("angel-2"), set("angel-2").faces[2]!).url).toBe("/card-art/promos/42001c-2.webp");
  });
});

describe("picking a promo", () => {
  test("turns on and off", () => {
    expect(withPromoToggled([], "cable")).toEqual(["cable"]);
    expect(withPromoToggled(["cable"], "cable")).toEqual([]);
  });

  test("a card shows one printing: the other is dropped, and other cards are left alone", () => {
    expect(withPromoToggled(["cable", "thor"], "cable-2")).toEqual(["thor", "cable-2"]);
  });
});
