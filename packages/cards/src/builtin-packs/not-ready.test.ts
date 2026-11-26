import { describe, expect, it } from "vitest";
import { BUILTIN_PACKS, NOT_READY_PACK_CODES, isNotReadyCard } from "./index.js";

describe("not-ready built-in packs", () => {
  // Elektra and Iron Fist were the last not-ready packs; they were released on 2026-11-25. The gate stays for the next
  // pack that lands before its card list is known.
  it("are none right now", () => {
    expect([...NOT_READY_PACK_CODES]).toEqual([]);
    expect(BUILTIN_PACKS.filter((pack) => pack.manifest.status !== undefined)).toEqual([]);
  });

  it("no longer flag Elektra or Iron Fist cards", () => {
    expect(isNotReadyCard({ setCode: "elektra" })).toBe(false);
    expect(isNotReadyCard({ setCode: "iron_fist" })).toBe(false);
    expect(isNotReadyCard({ setCode: "luke_cage" })).toBe(false);
  });
});
