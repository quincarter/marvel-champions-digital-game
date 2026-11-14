import { describe, expect, it } from "vitest";
import { BUILTIN_PACKS, NOT_READY_PACK_CODES, isNotReadyCard } from "./index.js";

describe("not-ready built-in packs", () => {
  it("are exactly Elektra and Iron Fist", () => {
    expect([...NOT_READY_PACK_CODES].sort()).toEqual(["elektra", "iron_fist"]);
  });

  it("are the only packs with a status", () => {
    const withStatus = BUILTIN_PACKS.filter((pack) => pack.manifest.status !== undefined);
    expect(withStatus.map((pack) => pack.manifest.id).sort()).toEqual(["elektra", "iron_fist"]);
    for (const pack of withStatus) expect(pack.manifest.status).toBe("not-ready");
  });

  it("flags a card by its set code", () => {
    expect(isNotReadyCard({ setCode: "elektra" })).toBe(true);
    expect(isNotReadyCard({ setCode: "iron_fist" })).toBe(true);
    expect(isNotReadyCard({ setCode: "luke_cage" })).toBe(false);
  });
});
