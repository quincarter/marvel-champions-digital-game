import { describe, expect, it } from "vitest";
import type { AnyCard } from "@mc/content";
import type { PackRuntime } from "../packs/pack-runtime.js";
import { poolWithRunPacks, runPacksOf } from "./run-packs.js";
import { summaryOf, type CampaignRecord } from "../engine/campaign-storage.js";
import { marketCatalogOf } from "../view/campaign-market-model.js";

const card = (id: string, name = id): AnyCard => ({ id, name, type: "event" }) as unknown as AnyCard;

const pack = (id: string, cards: readonly AnyCard[], version = "1.0.0"): PackRuntime =>
  ({ id, version, name: id, requires: [], cards, abilities: {}, decks: [] }) as unknown as PackRuntime;

const ids = (cards: readonly AnyCard[]): string[] => cards.map((c) => c.id as string);

describe("poolWithRunPacks (#978)", () => {
  const base = [card("01001a"), card("x.hero.01a", "Hero v2"), card("x.hero.02", "Card v2"), card("x.hero.99")];
  const installedOther = card("x.other.01");

  it("takes a carried pack's cards from the run's copy, without cards a newer installed version added", () => {
    const run = pack("hero", [card("x.hero.01a", "Hero v1"), card("x.hero.02", "Card v1")]);
    const pool = poolWithRunPacks([...base, installedOther], [run]);
    expect(ids(pool).sort()).toEqual(["01001a", "x.hero.01a", "x.hero.02", "x.other.01"]);
    expect(pool.find((c) => c.id === "x.hero.01a")?.name).toBe("Hero v1");
  });

  it("keeps base cards and installed packs the run doesn't carry, and returns the pool itself for no packs", () => {
    expect(poolWithRunPacks(base, [])).toBe(base);
    const pool = poolWithRunPacks([card("01001a"), installedOther], [pack("hero", [card("x.hero.01a")])]);
    expect(ids(pool)).toEqual(["01001a", "x.other.01", "x.hero.01a"]);
  });

  it("lists a card two run packs share once, the first pack's copy", () => {
    const pool = poolWithRunPacks([], [pack("a", [card("x.a.01", "first")]), pack("b", [card("x.a.01", "second")])]);
    expect(pool.map((c) => c.name)).toEqual(["first"]);
  });

  it("puts the campaign's own packs first and lists each pack id once", () => {
    const own = pack("camp", []);
    const record = {
      pack: { id: "camp", version: "1", name: "camp", packs: [own] },
      heroPacks: [own, pack("hero", [])],
    };
    expect(runPacksOf(record).map((p) => p.id)).toEqual(["camp", "hero"]);
  });
});

describe("the Market over a run's pool (#978)", () => {
  it("sells a priced card from the run's own pack copy, after the pack is removed", () => {
    const priced = { ...card("x.hero.05", "Gadget"), unitCost: 2 } as unknown as AnyCard;
    const catalog = marketCatalogOf(poolWithRunPacks([card("01001a")], [pack("hero", [priced])]));
    expect(ids(catalog)).toEqual(["x.hero.05"]);
  });
});

describe("a run's summary names its custom heroes (#978)", () => {
  it("keeps a custom hero's name from the run's own pack copy, and none for a base hero", () => {
    const record = {
      seats: [
        { seatNumber: 1, identityCardId: "x.hero.01a" },
        { seatNumber: 2, identityCardId: "01001a" },
      ],
      heroPacks: [pack("hero", [card("x.hero.01a", "Hero v1")])],
    } as unknown as CampaignRecord;
    expect(summaryOf(record).seats).toEqual([
      { seatNumber: 1, identityCardId: "x.hero.01a", identityName: "Hero v1" },
      { seatNumber: 2, identityCardId: "01001a" },
    ]);
  });
});
