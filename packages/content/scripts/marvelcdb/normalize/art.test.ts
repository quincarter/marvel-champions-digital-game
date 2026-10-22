import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MTS_CARDS } from "../../../src/data/mts/cards.ts";
import type { RawCard } from "../raw-types.ts";
import { reprintImages } from "./art.ts";

const rawCards = (pack: string): RawCard[] =>
  (
    JSON.parse(readFileSync(new URL(`../../../raw/marvelcdb/${pack}.json`, import.meta.url), "utf8")) as {
      cards: RawCard[];
    }
  ).cards;
const rawFace = (pack: string, code: string): RawCard => {
  for (const c of rawCards(pack)) {
    if (c.code === code) return c;
    if (c.linked_card?.code === code) return c.linked_card;
  }
  throw new Error(`no raw record ${code} in ${pack}`);
};

describe("reprint art borrowed by name (issue #296)", () => {
  it("gives the campaign Cosmo none of Star-Lord's basic Cosmo art: same name, different printed stats", () => {
    const campaignCosmo = rawFace("mts", "21180b");
    expect(campaignCosmo.imagesrc ?? null).toBeNull();
    expect(reprintImages(campaignCosmo)).toBeUndefined();
  });

  it("still lends art to a namesake with the same printed stats (Avengers Tower's errata record)", () => {
    expect(reprintImages(rawFace("mts", "21100a"))?.front).toBe("/bundles/cards/21100.png");
  });

  it("points the campaign Cosmo reward at its own scan", () => {
    const cosmo = MTS_CARDS.find((c) => c.id === "21180b");
    expect(cosmo?.images?.front).toBe("/bundles/cards/21180b.png");
  });
});

describe("Mad Titan's Shadow faces MarvelCDB has no scan for (issue #356)", () => {
  const card = (id: string) => MTS_CARDS.find((c) => c.id === id);

  it("points each campaign card back at its bundled Hall of Heroes scan", () => {
    for (const id of ["21182b", "21184b", "21186b", "21189b"])
      expect(card(id)?.images?.front, id).toBe(`/bundles/cards/${id}.png`);
  });

  it("gives the flip sides their own scans: Avengers Tower damaged, Odin's King side, Norn Stone's back", () => {
    for (const [id, back] of [
      ["21100a", "21100b"],
      ["21139a", "21139b"],
      ["21187a", "21187b"],
    ] as const) {
      const face = card(id);
      expect(face && "flipSide" in face ? face.flipSide?.image : undefined, id).toBe(`/bundles/cards/${back}.png`);
    }
  });
});
