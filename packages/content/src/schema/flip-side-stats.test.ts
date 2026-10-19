import { describe, expect, it } from "vitest";
import { validateCard } from "./index.js";
import type { AllyCard, AnyCard, CardFlipSide } from "./index.js";
import { FNE_CARDS } from "../data/fne/cards.js";
import { MTS_CARDS } from "../data/mts/cards.js";
import { PLAYABLE_CARDS } from "../data/index.js";

/**
 * A double-sided ally's flip side prints its own THW / ATK / hit points where they differ from the front's
 * (`CardFlipSide.thw` / `atk` / `hp`). RRG 1.8 "Flip" (p. 20): the new face's characteristics apply.
 */
const byId = (cards: readonly AnyCard[], id: string): AnyCard => cards.find((c) => (c.id as string) === id)!;
const typhoidMary = byId(FNE_CARDS, "60210a") as AllyCard;
const odin = byId(MTS_CARDS, "21139a") as AllyCard;
const withBack = (card: AnyCard, patch: Partial<CardFlipSide>): AnyCard =>
  ({ ...card, flipSide: { ...(card as AllyCard).flipSide!, ...patch } }) as AnyCard;

describe("CardFlipSide.thw / atk / hp", () => {
  it("emits only the stats a face changes: Bloody Mary THW 1 / ATK 2 (60210b), Odin's King side THW 3 / ATK 4 (21139b)", () => {
    expect([typhoidMary.thw, typhoidMary.atk, typhoidMary.hp]).toEqual([2, 1, 3]);
    expect(typhoidMary.flipSide).toMatchObject({ name: "Bloody Mary", thw: 1, atk: 2 });
    expect(typhoidMary.flipSide && "hp" in typhoidMary.flipSide).toBe(false);
    expect([odin.thw, odin.atk]).toEqual([2, 3]);
    expect(odin.flipSide).toMatchObject({ thw: 3, atk: 4 });
    expect(validateCard(typhoidMary).errors).toEqual([]);
    expect(validateCard(odin).errors).toEqual([]);
  });

  it("no other double-sided card in the pool carries flip-side stats", () => {
    const carriers = PLAYABLE_CARDS.filter((c) => {
      const back = (c as { readonly flipSide?: CardFlipSide }).flipSide;
      return back !== undefined && (back.thw !== undefined || back.atk !== undefined || back.hp !== undefined);
    }).map((c) => c.id as string);
    expect([...carriers].sort()).toEqual(["21139a", "60210a"]);
  });

  it("accepts a printed dash or X on the flip side", () => {
    expect(validateCard(withBack(typhoidMary, { atk: null })).errors).toEqual([]);
    expect(validateCard(withBack(typhoidMary, { thw: "X" })).errors).toEqual([]);
    expect(validateCard(withBack(typhoidMary, { hp: 5 })).errors).toEqual([]);
  });

  it("refuses a stat that repeats the front's, an invalid value, and stats on a card that is not an ally", () => {
    expect(validateCard(withBack(typhoidMary, { thw: 2 })).errors).toContain(
      "ally flip side thw repeats the front face's; leave it out",
    );
    expect(validateCard(withBack(typhoidMary, { hp: 3 })).valid).toBe(false);
    expect(validateCard(withBack(typhoidMary, { atk: -1 })).valid).toBe(false);
    expect(validateCard(withBack(typhoidMary, { hp: 0 })).valid).toBe(false);
    const environment = FNE_CARDS.find((c) => c.type === "environment" && "flipSide" in c && c.flipSide)!;
    expect(validateCard(withBack(environment, { atk: 1 })).errors).toContain(
      "environment flip side thw/atk/hp are only for a double-sided ally",
    );
  });
});
