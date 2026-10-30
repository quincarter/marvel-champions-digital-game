import { describe, expect, test } from "vitest";
import { GLOBAL_ID_PATTERN, GLOBAL_MAX_ASPECTS, GLOBAL_MAX_MODULARS } from "@mc/sync-worker/global-protocol";
import { globalIdOf, globalResultOf } from "./global-result.js";
import { NAMES, meta } from "./fixtures.js";

const ID = "0123456789abcdef0123456789abcdef";

describe("globalResultOf", () => {
  test("a win carries exactly the protocol's keys and nothing identifying", () => {
    const result = globalResultOf(meta(), NAMES, ID)!;
    expect(Object.keys(result).sort()).toEqual(
      ["cause", "difficulty", "id", "modulars", "seats", "v", "villain", "won"].sort(),
    );
    expect(Object.keys(result.seats[0]!).sort()).toEqual(["aspects", "deck", "hero"]);
    expect(result).toEqual({
      v: 1,
      id: ID,
      villain: "Rhino",
      difficulty: "expert",
      modulars: ["bomb_scare"],
      seats: [{ hero: "spidey", aspects: ["justice"], deck: ["webs", "aunt"] }],
      won: true,
      cause: null,
    });
    const text = JSON.stringify(result);
    for (const leak of ["987654", "save-", "1000"]) expect(text).not.toContain(leak);
  });

  test("a loss names its cause as Your stats does", () => {
    const scheme = meta({ status: "lost" }, { lossReason: "schemeCompleted" });
    expect(globalResultOf(scheme, NAMES, ID)?.cause).toBe("scheme");
    const wiped = meta({ status: "lost" }, { lossReason: "playersDefeated", defeatedBy: "minionAttack" });
    expect(globalResultOf(wiped, NAMES, ID)).toMatchObject({ won: false, cause: "minions" });
    const unknown = meta({ status: "lost" }, { lossReason: "playersDefeated" });
    expect(globalResultOf(unknown, NAMES, ID)?.cause).toBe("unknown");
  });

  test("not a result: active, abandoned, guided", () => {
    expect(globalResultOf(meta({ status: "active" }), NAMES, ID)).toBeNull();
    expect(globalResultOf(meta({ status: "abandoned" }), NAMES, ID)).toBeNull();
    expect(globalResultOf(meta({ guided: { kind: "tutorial" } as never }), NAMES, ID)).toBeNull();
  });

  test("an older summary, or none, or no seats is null", () => {
    expect(globalResultOf(meta({}, { version: 4 }), NAMES, ID)).toBeNull();
    expect(globalResultOf(meta({}, null), NAMES, ID)).toBeNull();
    expect(
      globalResultOf({ ...meta(), summary: { ...meta().summary!, seats: undefined } } as never, NAMES, ID),
    ).toBeNull();
  });

  test("seats that sat out are left out; all sitting out is null", () => {
    const base = meta().summary!.seats![0]!;
    const two = meta({}, { seats: [base, { ...base, identityCardId: "cap", satOut: true }] });
    expect(globalResultOf(two, NAMES, ID)?.seats.map((s) => s.hero)).toEqual(["spidey"]);
    expect(globalResultOf(meta({}, { seats: [{ ...base, satOut: true }] }), NAMES, ID)).toBeNull();
  });

  test("modulars fall back to the scenario's when the game names none", () => {
    const m = meta();
    const { modularSetIds: _dropped, ...config } = m.config;
    const noModulars = { ...m, config };
    expect(globalResultOf(noModulars, NAMES, ID)?.modulars).toEqual(["bomb_scare"]);
  });

  test("ids outside plain keys (anything custom) are not sent", () => {
    const base = meta().summary!.seats![0]!;
    expect(globalResultOf(meta({}, { seats: [{ ...base, deck: ["my card!"] }] }), NAMES, ID)).toBeNull();
    expect(globalResultOf(meta({}, { seats: [{ ...base, identityCardId: "x/y" }] }), NAMES, ID)).toBeNull();
    expect(globalResultOf(meta({}, { villains: ["Rh<ino>"] }), NAMES, ID)).toBeNull();
  });

  test("more modulars or aspects than the caps is null, not trimmed", () => {
    const m = meta();
    const modulars = Array.from({ length: GLOBAL_MAX_MODULARS + 1 }, (_, i) => `m${i}`);
    expect(globalResultOf({ ...m, config: { ...m.config, modularSetIds: modulars } }, NAMES, ID)).toBeNull();
    const base = m.summary!.seats![0]!;
    const aspects = Array.from({ length: GLOBAL_MAX_ASPECTS + 1 }, (_, i) => `a${i}`);
    expect(globalResultOf(meta({}, { seats: [{ ...base, aspects }] }), NAMES, ID)).toBeNull();
  });

  test("two seats of one hero is null (the Worker would refuse it)", () => {
    const base = meta().summary!.seats![0]!;
    expect(globalResultOf(meta({}, { seats: [base, base] }), NAMES, ID)).toBeNull();
  });

  test("trims to the protocol's caps", () => {
    const base = meta().summary!.seats![0]!;
    const deck = Array.from({ length: 100 }, (_, i) => `c${i}`);
    const seats = Array.from({ length: 6 }, (_, i) => ({ ...base, identityCardId: `h${i}`, deck }));
    const m = meta({}, { seats });
    const result = globalResultOf(m, NAMES, ID)!;
    expect(result.seats).toHaveLength(4);
    expect(result.seats[0]!.deck).toHaveLength(80);
  });
});

describe("globalIdOf", () => {
  test("is 32 hex characters, stable, and differs by save", async () => {
    const a = await globalIdOf("save-1");
    expect(a).toMatch(GLOBAL_ID_PATTERN);
    expect(await globalIdOf("save-1")).toBe(a);
    expect(await globalIdOf("save-2")).not.toBe(a);
    expect(a).not.toContain("save");
  });
});
