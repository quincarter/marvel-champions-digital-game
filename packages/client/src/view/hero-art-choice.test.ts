import { afterEach, describe, expect, test } from "vitest";
import { setShownPromos } from "../art/art-source.js";
import { PROMO_SETS, promoArtByScan } from "../art/promo-art.js";
import { CARDS_BY_ID } from "../content/pool.js";
import { heroArtChoicesOf, heroArtInForce, heroTilePicture, nextHeroArt } from "./hero-art-choice.js";

const set = (id: string) => PROMO_SETS.find((one) => one.id === id)!;
const cable = CARDS_BY_ID.get("40001a");

describe("the hero art choice (#192)", () => {
  afterEach(() => setShownPromos(new Map()));

  test("Promo art is on offer only once a promo is earned and shown", () => {
    expect(heroArtChoicesOf(false)).toEqual(["game", "card"]);
    expect(heroArtChoicesOf(true)).toEqual(["game", "card", "promo"]);
  });

  test("a press steps through the choices and wraps", () => {
    expect(nextHeroArt("game", false)).toBe("card");
    expect(nextHeroArt("card", false)).toBe("game");
    expect(nextHeroArt("card", true)).toBe("promo");
    expect(nextHeroArt("promo", true)).toBe("game");
  });

  test("Promo art saved while none is on offer reads as Game art, and steps from there", () => {
    expect(heroArtInForce("promo", false)).toBe("game");
    expect(nextHeroArt("promo", false)).toBe("card");
  });

  test("Game art picks nothing, so the tile keeps its own picture", () => {
    expect(heroTilePicture("game", cable, [set("cable")], [])).toBeNull();
  });

  test("Card art is the hero's card, on a key of its own", () => {
    const picture = heroTilePicture("card", cable, [], []);
    expect(picture?.url).toBe("/card-art/bundles/cards/40001a.png");
    expect(picture?.key.startsWith("tile:")).toBe(true);
  });

  test("Card art shows a promo in use, as the card is drawn in play", () => {
    setShownPromos(promoArtByScan([set("cable")]));
    expect(heroTilePicture("card", cable, [set("cable")], ["cable"])?.url).toContain("promos/40001a-1");
  });

  test("Promo art is the printing in use, else the first earned, else the game art", () => {
    const earned = [set("cable"), set("cable-2")];
    expect(heroTilePicture("promo", cable, earned, ["cable-2"])?.url).toContain("promos/40001a-2");
    expect(heroTilePicture("promo", cable, earned, [])?.url).toContain("promos/40001a-1");
    expect(heroTilePicture("promo", cable, [set("thor")], [])).toBeNull();
  });
});
