import { describe, expect, it } from "vitest";
import { validateCard } from "./index.js";
import type { AllyCard, AnyCard, CardFlipSide } from "./index.js";
import { FNE_CARDS } from "../data/fne/cards.js";
import { MTS_CARDS } from "../data/mts/cards.js";
import { NEXT_EVOL_CARDS } from "../data/next_evol/cards.js";
import { SYNTHEZOID_CARDS } from "../data/synthezoid/cards.js";
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

/**
 * A double-sided attachment's flip side prints its own stat boxes where they differ from the front's
 * (`CardFlipSide.statModifiers`): Dense 57046a +1 ATK, Intangible 57046b +1 SCH (scan 57046b.png). RRG 1.8 "Flip" (p. 20).
 */
describe("CardFlipSide.statModifiers", () => {
  const dense = byId(SYNTHEZOID_CARDS, "57046a");

  it("emits Intangible's +1 SCH (57046b) beside Dense's +1 ATK, and validates", () => {
    expect(dense).toMatchObject({
      statModifiers: { atk: 1 },
      flipSide: { name: "Intangible", statModifiers: { sch: 1 } },
    });
    expect(validateCard(dense).errors).toEqual([]);
    expect(validateCard(withBack(dense, { statModifiers: {} })).errors).toEqual([]);
  });

  it("Hope's Captor 40105b prints +1 SCH and +1 ATK behind a front with none (the star beside ATK marks its [star] ability)", () => {
    const captor = byId(NEXT_EVOL_CARDS, "40105a");
    expect("statModifiers" in captor).toBe(false);
    expect(captor).toMatchObject({ flipSide: { name: "Hope's Captor", statModifiers: { atk: 1, sch: 1 } } });
    expect(validateCard(captor).errors).toEqual([]);
  });

  it("no other double-sided card in the pool carries flip-side stat boxes", () => {
    const carriers = PLAYABLE_CARDS.filter(
      (c) => (c as { readonly flipSide?: CardFlipSide }).flipSide?.statModifiers !== undefined,
    ).map((c) => c.id as string);
    expect([...carriers].sort()).toEqual(["40105a", "57046a"]);
  });

  it("refuses a set that repeats the front's, a non-stat key, and stat boxes on a card that is not an attachment", () => {
    expect(validateCard(withBack(dense, { statModifiers: { atk: 1 } })).errors).toContain(
      "attachment flip side statModifiers repeat the front face's; leave them out",
    );
    expect(validateCard(withBack(dense, { statModifiers: { def: 1 } as never })).valid).toBe(false);
    expect(validateCard(withBack(typhoidMary, { statModifiers: { atk: 1 } })).errors).toContain(
      "ally flip side statModifiers are only for a double-sided attachment",
    );
  });
});
