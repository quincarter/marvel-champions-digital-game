import { describe, expect, it } from "vitest";
import { groupByBatch, type BatchMod, type ModBatch } from "./mod-batches.js";

const mod = (id: string, kind: string, name: string): BatchMod => ({ id, kind, name, creator: "someone" });

const ONE: ModBatch = { number: 1, poster: "one.jpg", ids: ["punisher-pk", "carnage-nep"], announced: [] };
const TWO: ModBatch = {
  number: 2,
  poster: "two.jpg",
  ids: [],
  announced: [
    { ...mod("soon-punisher", "hero", "The Punisher"), soon: true },
    { ...mod("soon-rose", "scenario", "The Rose"), soon: true },
  ],
};

describe("groupByBatch", () => {
  it("puts the newest batch first, with its announced packs while the store has none of them", () => {
    const groups = groupByBatch(
      [mod("carnage-nep", "hero", "Carnage"), mod("punisher-pk", "scenario", "The Punisher")],
      [ONE, TWO],
    );
    expect(groups.map((group) => group.batch.number)).toEqual([2, 1]);
    expect(groups[0]!.mods.map((m) => m.id)).toEqual(["soon-punisher", "soon-rose"]);
    expect(groups[1]!.mods.map((m) => m.id)).toEqual(["carnage-nep", "punisher-pk"]);
  });

  it("files a store pack in no batch's list under the newest batch, in place of its announced pack", () => {
    const groups = groupByBatch(
      [mod("punisher-pk", "scenario", "The Punisher"), mod("punisher-msp", "hero", "The Punisher")],
      [ONE, TWO],
    );
    expect(groups[0]!.mods.map((m) => m.id)).toEqual(["punisher-msp", "soon-rose"]);
    // The older batch's scenario of the same name doesn't stand in for the announced hero pack.
    expect(groups[1]!.mods.map((m) => m.id)).toEqual(["punisher-pk"]);
  });

  it("matches an announced pack by kind and name, ignoring case and spaces", () => {
    const groups = groupByBatch([mod("rose-bd", "scenario", " the rose ")], [ONE, TWO]);
    expect(groups[0]!.mods.map((m) => m.id)).toEqual(["soon-punisher", "rose-bd"]);
  });

  it("keeps an announced pack hidden once its store pack is withdrawn", () => {
    const listed = groupByBatch([mod("punisher-msp", "hero", "The Punisher")], [ONE, TWO]);
    expect(listed[0]!.mods.map((m) => m.id)).toEqual(["punisher-msp", "soon-rose"]);
    // Withdrawn later: the catalog leaves it out, and its announcement doesn't come back.
    const withdrawn = groupByBatch([], [ONE, TWO], [{ id: "punisher-msp", kind: "hero", name: "The Punisher" }]);
    expect(withdrawn[0]!.mods.map((m) => m.id)).toEqual(["soon-rose"]);
    // A withdrawn pack of an older batch with the same kind and name doesn't hide it.
    const older = groupByBatch(
      [],
      [{ ...ONE, ids: [...ONE.ids, "punisher-old"] }, TWO],
      [{ id: "punisher-old", kind: "hero", name: "The Punisher" }],
    );
    expect(older[0]!.mods.map((m) => m.id)).toEqual(["soon-punisher", "soon-rose"]);
  });

  it("has nothing to show without batches", () => {
    expect(groupByBatch([mod("x", "hero", "X")], [])).toEqual([]);
  });
});
