import { describe, expect, it } from "vitest";
import { validateAttachmentHost, validateCard } from "./index.js";
import type { HeroIdentityCard } from "./index.js";
import { FNE_CARDS } from "../data/fne/cards.js";

/**
 * Wave 11 schema additions (docs/phase7-wave11.md section 1.1, 1.2): the Sense deck's two flags, the star cost, and the
 * host qualifier for an attachment named by trait (Fear No Evil's Drive set).
 */
const daredevil = FNE_CARDS.find((c) => (c.id as string) === "60001a") as HeroIdentityCard;
const reflexes = FNE_CARDS.find((c) => (c.id as string) === "60040a")!;

describe("IdentitySeparateDeck.fixedOrder and ownerMayLookThrough", () => {
  const withDeck = (patch: Record<string, unknown>): HeroIdentityCard => {
    const [sense] = daredevil.separateDecks!;
    return { ...daredevil, separateDecks: [{ ...sense!, ...patch }] } as HeroIdentityCard;
  };

  it("accepts the Sense deck as emitted, and a deck without either flag", () => {
    expect(validateCard(daredevil).errors).toEqual([]);
    const { fixedOrder: _a, ownerMayLookThrough: _b, ...plain } = daredevil.separateDecks![0]!;
    expect(validateCard({ ...daredevil, separateDecks: [plain] }).errors).toEqual([]);
  });

  it("refuses a flag that is not a boolean", () => {
    expect(validateCard(withDeck({ fixedOrder: "yes" })).valid).toBe(false);
    expect(validateCard(withDeck({ ownerMayLookThrough: 1 })).valid).toBe(false);
  });
});

describe('SpecialCost "star"', () => {
  it("accepts a star cost of 0 (Photographic Reflexes)", () => {
    expect(validateCard(reflexes).errors).toEqual([]);
  });

  it("refuses a star cost with a non-zero value and an unknown special cost", () => {
    expect(validateCard({ ...reflexes, cost: 2 } as never).valid).toBe(false);
    expect(validateCard({ ...reflexes, specialCost: "moon" } as never).valid).toBe(false);
  });
});

describe("HostQualifiers.withoutAttachmentTrait", () => {
  const vehicle = {
    kind: "superlative",
    among: "enemy",
    order: "highest",
    measure: "atk",
    withoutAttachmentTrait: "VEHICLE",
  };

  it("accepts a superlative host without a Vehicle attachment and a qualified host with only that qualifier", () => {
    expect(validateAttachmentHost(vehicle, "card")).toEqual([]);
    expect(
      validateAttachmentHost({ kind: "qualified", category: "enemy", withoutAttachmentTrait: "VEHICLE" }, "card"),
    ).toEqual([]);
  });

  it("refuses an empty trait", () => {
    expect(validateAttachmentHost({ ...vehicle, withoutAttachmentTrait: "" }, "card")).not.toEqual([]);
  });

  it("is what Sports Car, Motorcycle and Utility Van emit (60186 to 60188)", () => {
    const host = (id: string) =>
      (FNE_CARDS.find((c) => (c.id as string) === id) as { attachesTo?: unknown }).attachesTo;
    expect(host("60186")).toMatchObject({
      kind: "superlative",
      measure: "atk",
      order: "highest",
      withoutAttachmentTrait: "VEHICLE",
    });
    expect(host("60187")).toMatchObject({
      kind: "superlative",
      measure: "sch",
      order: "highest",
      withoutAttachmentTrait: "VEHICLE",
    });
    expect(host("60188")).toMatchObject({
      kind: "superlative",
      measure: "remainingHp",
      order: "lowest",
      withoutAttachmentTrait: "VEHICLE",
    });
  });
});
