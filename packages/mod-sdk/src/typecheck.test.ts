import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TypecheckUnavailableError, findTsc, sdkTypesEntry, typecheckPack } from "./typecheck.js";

const SAMPLE_DIR = fileURLToPath(new URL("../../../content-packs/sample-hero", import.meta.url));

const dirs: string[] = [];
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** A pack folder holding only the given abilities/ files: the type check reads nothing else. */
function pack(files: Readonly<Record<string, string>>): string {
  const dir = mkdtempSync(join(tmpdir(), "mc-pack-typecheck-test-"));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) {
    const file = join(dir, "abilities", ...name.split("/"));
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, text);
  }
  return dir;
}

describe("typecheckPack", () => {
  it("passes the sample pack, which imports the SDK by name", () => {
    expect(typecheckPack(SAMPLE_DIR)).toEqual([]);
  });

  it("has nothing to check without abilities/", () => {
    // No tsc run: a bogus compiler would throw.
    expect(typecheckPack(pack({}), { tsc: join(tmpdir(), "no-such-tsc.js") })).toEqual([]);
  });

  it("reports each error in the pack's own files, a chained message on one line, and writes nothing into the pack", () => {
    const dir = pack({
      "index.ts": `import { definePackAbilities, gainsKeyword, constant } from "@mc/mod-sdk";
import { THWART } from "./amounts.ts";
export default definePackAbilities({
  "x.p.01.guard": constant(gainsKeyword("guard", { hostOfSelf: true })),
});
export const n: number = THWART;
`,
      "amounts.ts": `export const THWART: string = "2";
const source = { a: { b: "x" } };
export const wrong: { readonly a: { readonly b: number } } = source;
`,
    });
    const issues = typecheckPack(dir);
    expect(issues.map((i) => i.path).sort()).toEqual([
      "abilities/amounts.ts:3:14",
      "abilities/index.ts:4:41",
      "abilities/index.ts:6:14",
    ]);
    expect(issues.find((i) => i.path === "abilities/index.ts:4:41")?.message).toBe(
      "TS2345: Argument of type 'string' is not assignable to parameter of type 'KeywordInstance'.",
    );
    const chained = issues.find((i) => i.path === "abilities/amounts.ts:3:14")?.message ?? "";
    expect(chained).toMatch(/^TS2322: .* Type 'string' is not assignable to type 'number'\.$/);
    expect(chained).not.toContain("\n");
    // Every issue is a defect, never "unscripted".
    expect(issues.every((i) => i.category === undefined)).toBe(true);
    expect(readdirSync(dir)).toEqual(["abilities"]);
  });

  it("throws, rather than passing the pack, when tsc cannot run", () => {
    const dir = pack({ "index.ts": "export default {};\n" });
    expect(() => typecheckPack(dir, { tsc: join(tmpdir(), "no-such-tsc.js") })).toThrow(TypecheckUnavailableError);
  });

  it("finds tsc and the SDK's type entry from the SDK itself", () => {
    expect(findTsc(tmpdir())).toMatch(/typescript[\\/]bin[\\/]tsc$/);
    expect(sdkTypesEntry()).toMatch(/mod-sdk[\\/]src[\\/]index\.ts$/);
  });
});
