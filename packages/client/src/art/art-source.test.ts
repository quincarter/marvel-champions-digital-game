/**
 * Which picture a face resolves to. Exercised against real Core content rather
 * than fixtures, so a change to how the ingest stores refs shows up here.
 */

import { describe, expect, it } from "vitest";
import {
  CORE_CARDS,
  artRef,
  imageRef,
  type AnyCard,
  type HeroIdentityCard,
  type MainSchemeCard,
  type VillainCard,
} from "@mc/content";
import { artFor, CARD_BACKS } from "./art-source.js";

const byId = (id: string): AnyCard => {
  const card = CORE_CARDS.find((candidate) => (candidate.id as string) === id);
  if (!card) throw new Error(`no core card ${id}`);
  return card;
};

describe("artFor", () => {
  it("serves every reference from this app's own origin", () => {
    // The upstream host sends no CORS header, so a scan that isn't same-origin
    // can be decoded and then not uploaded as a WebGL texture.
    const source = artFor(byId("01001a"), { kind: "hero" });
    expect(source?.url.startsWith("/card-art/")).toBe(true);
    expect(source?.url).not.toContain("marvelcdb.com");
  });

  it("gives a hero identity's two faces two different scans", () => {
    const spiderMan = byId("01001a") as HeroIdentityCard;
    const hero = artFor(spiderMan, { kind: "hero" });
    const alterEgo = artFor(spiderMan, { kind: "alterEgo" });
    expect(hero).not.toBeNull();
    expect(alterEgo).not.toBeNull();
    expect(hero!.url).not.toEqual(alterEgo!.url);
  });

  it("prefers a local ArtRef over the published image", () => {
    const withScan = { ...byId("01001a"), art: artRef("core/01a-spider-man") } as AnyCard;
    expect(artFor(withScan, { kind: "front" })?.url).toBe("/card-art/core/01a-spider-man.png");
  });

  it("takes a villain's scan from the stage in play, not the card", () => {
    const villain = CORE_CARDS.find((card): card is VillainCard => card.type === "villain")!;
    const first = artFor(villain, { kind: "villainStage", sideIndex: 0, stageIndex: 0 });
    const second = artFor(villain, { kind: "villainStage", sideIndex: 0, stageIndex: 1 });
    expect(first?.url).toBe(`/card-art/${(villain.sides[0]!.stages[0]!.image as string).replace(/^\//, "")}`);
    expect(second?.url).not.toEqual(first?.url);
  });

  it("takes a main scheme's A and B sides from the stage", () => {
    const scheme = CORE_CARDS.find((card): card is MainSchemeCard => card.type === "main_scheme")!;
    const a = artFor(scheme, { kind: "mainSchemeStage", stageIndex: 0, side: "A" });
    const b = artFor(scheme, { kind: "mainSchemeStage", stageIndex: 0, side: "B" });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.url).not.toEqual(b!.url);
  });

  it("shares one texture key between two cards pointing at the same scan", () => {
    const card = { ...byId("01002"), images: { front: imageRef("/bundles/cards/01002.png") } } as AnyCard;
    expect(artFor(card, { kind: "front" })?.key).toBe(artFor(byId("01002"), { kind: "front" })?.key);
  });

  it("never lets a hidden card fall through to its own front", () => {
    const spiderMan = byId("01001a");
    const front = artFor(spiderMan, { kind: "front" });
    // The regression this guards: `back` used to read `images.back ?? front`,
    // and almost no card has a back — so a facedown card showed its face.
    for (const back of ["player", "encounter", "villain"] as const) {
      const hidden = artFor(spiderMan, { kind: "back", back });
      expect(hidden).not.toBeNull();
      expect(hidden!.url).not.toEqual(front!.url);
      expect(hidden!.url).toBe(CARD_BACKS[back].url);
    }
  });

  it("resolves a back without being given a card at all", () => {
    // The caller must not need the card to draw its back, because needing it is
    // how the face leaks.
    expect(artFor(undefined, { kind: "back", back: "encounter" })).toEqual(CARD_BACKS.encounter);
  });

  it("gives the three decks three different backs, all served from this origin", () => {
    const urls = Object.values(CARD_BACKS).map((back) => back.url);
    expect(new Set(urls).size).toBe(3);
    for (const url of urls) expect(url.startsWith("/card-art/")).toBe(true);
  });

  it("returns null rather than a guess when there is no reference", () => {
    const { images: _images, art: _art, ...rest } = byId("01002") as AnyCard & { art?: unknown };
    expect(artFor(rest as AnyCard, { kind: "front" })).toBeNull();
    expect(artFor(undefined, { kind: "front" })).toBeNull();
  });
});
