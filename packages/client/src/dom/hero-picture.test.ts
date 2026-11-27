import { describe, expect, it } from "vitest";
import type { AnyCard } from "@mc/content";
import { HERO_ART } from "../art/hero-art.js";
import { PackLeases } from "../art/pack-art.js";
import { heroPictureOf, heroTilePictureOf } from "./hero-picture.js";

const card = (id: string): AnyCard => ({ id, type: "hero_identity", name: id }) as unknown as AnyCard;

describe("heroPictureOf", () => {
  const leases = new PackLeases();

  it("crops a hero's picture toward the face, the upper fifth down, when its folder names no focus", () => {
    const plain = [...HERO_ART.heroes].find(([, pictures]) => pictures[0]?.focus === undefined);
    expect(plain, "a hero picture with no focus.json").toBeTruthy();
    const picture = heroPictureOf(card(plain![0]), leases);
    expect(picture.src).toBe(plain![1][0]!.tileUrl ?? plain![1][0]!.url);
    expect(picture.cover).toEqual({ x: 0.5, y: 0.22, centered: false });
  });

  it("centers the crop on the point a focus.json gives", () => {
    const focused = [...HERO_ART.heroes].find(([, pictures]) => pictures[0]?.focus?.y !== undefined);
    expect(focused, "a hero picture with a focus.json").toBeTruthy();
    const focus = focused![1][0]!.focus!;
    const picture = heroPictureOf(card(focused![0]), leases);
    expect(picture.cover).toEqual({ x: focus.x ?? 0.5, y: focus.y, centered: true });
  });

  it("has no picture to show for an unknown identity", () => {
    expect(heroPictureOf(undefined, leases).src).toBeNull();
  });
});

describe("heroPictureOf sizes", () => {
  it("uses the tile copy for a tile and the original for a large picture, and falls back when there is no copy", () => {
    const [id, pictures] = [...HERO_ART.heroes][0]!;
    const leases = new PackLeases();
    const original = pictures[0]!;
    expect(heroPictureOf(card(id), leases, "large").src).toBe(original.url);
    expect(heroPictureOf(card(id), leases).src).toBe(original.tileUrl ?? original.url);
  });
});

describe("heroTilePictureOf", () => {
  const leases = new PackLeases();

  it("takes the chosen picture's tile copy, cropped at the tile's own height when it has no focus", () => {
    const picture = { key: "scene-art:heroes/a/hero.jpg", url: "/full.jpg", tileUrl: "/tile.webp" };
    const shown = heroTilePictureOf(picture, card("01001a"), leases);
    expect(shown.src).toBe("/tile.webp");
    expect(shown.cover).toEqual({ x: 0.5, y: 0.34, centered: false });
  });

  it("falls back to the full picture where it has no copy, and centers on a focus point", () => {
    const picture = { key: "scene-art:heroes/b/hero.jpg", url: "/full.jpg", focus: { x: 0.4, y: 0.3 } };
    const shown = heroTilePictureOf(picture, card("01001b"), leases);
    expect(shown.src).toBe("/full.jpg");
    expect(shown.cover).toEqual({ x: 0.4, y: 0.3, centered: true });
  });

  it("has nothing to show for no picture and no identity", () => {
    expect(heroTilePictureOf(null, undefined, leases).src).toBeNull();
  });
});
