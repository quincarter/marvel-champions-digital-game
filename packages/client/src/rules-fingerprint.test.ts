import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { RULES_ROOTS, isRulesSource, rulesFingerprintOf } from "./rules-fingerprint.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mc-rules-"));
  mkdirSync(join(dir, "sub"));
  writeFileSync(join(dir, "a.ts"), "export const a = 1;\n");
  writeFileSync(join(dir, "sub", "b.json"), '{"x":1}\n');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("rulesFingerprintOf", () => {
  it("is a short stable hex string", () => {
    const f = rulesFingerprintOf([dir]);
    expect(f).toMatch(/^[0-9a-f]{16}$/);
    expect(rulesFingerprintOf([dir])).toBe(f);
  });

  it("changes when rules source changes", () => {
    const before = rulesFingerprintOf([dir]);
    writeFileSync(join(dir, "a.ts"), "export const a = 2;\n");
    expect(rulesFingerprintOf([dir])).not.toBe(before);
  });

  it("does not depend on line endings", () => {
    const before = rulesFingerprintOf([dir]);
    writeFileSync(join(dir, "a.ts"), "export const a = 1;\r\n");
    writeFileSync(join(dir, "sub", "b.json"), '{"x":1}\r\n');
    expect(rulesFingerprintOf([dir])).toBe(before);
  });

  it("ignores tests, docs and declaration files", () => {
    const before = rulesFingerprintOf([dir]);
    writeFileSync(join(dir, "a.test.ts"), "expect(1)");
    writeFileSync(join(dir, "README.md"), "# docs");
    writeFileSync(join(dir, "types.d.ts"), "declare const x: 1;");
    expect(rulesFingerprintOf([dir])).toBe(before);
  });

  it("notices a new source file", () => {
    const before = rulesFingerprintOf([dir]);
    writeFileSync(join(dir, "c.ts"), "export {};\n");
    expect(rulesFingerprintOf([dir])).not.toBe(before);
  });
});

describe("RULES_ROOTS", () => {
  it("names real directories, with the mod SDK and the client's session code, and no UI", () => {
    const packages = join(__dirname, "..", "..");
    for (const root of RULES_ROOTS) expect(existsSync(join(packages, root)), root).toBe(true);
    expect(RULES_ROOTS).toEqual(expect.arrayContaining(["mod-sdk/src", "client/src/engine", "client/src/content"]));
    expect(RULES_ROOTS.some((r) => /scenes|view|ui/.test(r))).toBe(false);
  });
});

describe("isRulesSource", () => {
  it("keeps source and card data, drops tests", () => {
    expect(isRulesSource("src/x.ts")).toBe(true);
    expect(isRulesSource("src/data/cards.json")).toBe(true);
    expect(isRulesSource("src\\x.spec.ts")).toBe(false);
    expect(isRulesSource("src/x.test.ts")).toBe(false);
    expect(isRulesSource("src/x.md")).toBe(false);
  });
});
