import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT_OK, EXIT_PACK_PROBLEM, EXIT_USAGE, runCli } from "./cli.js";
import { TINY_PACK_DIR } from "./fixtures/load.js";

const SAMPLE_DIR = fileURLToPath(new URL("../../../content-packs/sample-hero", import.meta.url));
const MARVELCDB_DIR = fileURLToPath(new URL("./fixtures/marvelcdb-pack", import.meta.url));

const dirs: string[] = [];
const tmp = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "mc-pack-cli-"));
  dirs.push(dir);
  return dir;
};
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const TINY_ABILITIES = `import { definePackAbilities, heroAction, thwartAScheme } from "@mc/mod-sdk";
export default definePackAbilities({
  "x.tiny-pack.02.test-rally-action": heroAction({ label: "thwart" }, thwartAScheme(2)),
});
`;

/**
 * A copy of the tiny pack whose abilities import the SDK by name, as a creator's pack does (the fixture itself imports
 * the workspace sources by path, which jiti would transform from scratch: far too slow for a unit test).
 */
function tinyPack(abilities = TINY_ABILITIES): string {
  const dir = tmp();
  cpSync(TINY_PACK_DIR, dir, { recursive: true });
  writeFileSync(join(dir, "abilities", "index.ts"), abilities);
  return dir;
}

async function cli(...argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(argv, { out: (l) => out.push(l), err: (l) => err.push(l) });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("mc-pack", () => {
  it("validates a good pack (abilities/index.ts loaded through jiti)", async () => {
    const run = await cli("validate", tinyPack());
    expect(run.err).toBe("");
    expect(run.code).toBe(EXIT_OK);
    expect(run.out).toMatch(/tiny-pack@1\.0\.0: valid \(2 cards, 1 abilities\)/);
  });

  it("reports a broken card and groups unscripted abilities apart, exit 1", async () => {
    const dir = tinyPack("export default {};\n");
    rmSync(join(dir, "PERMISSION.md"));
    const run = await cli("validate", dir);
    expect(run.code).toBe(EXIT_PACK_PROBLEM);
    expect(run.err).toMatch(/1 problem:\n {2}PERMISSION\.md/);
    expect(run.err).toMatch(/1 unscripted ability \(write them in abilities\/\):\n {2}cards\/x\.tiny-pack\.02/);
    // --allow-unscripted does not hide a real defect.
    expect((await cli("validate", dir, "--allow-unscripted")).code).toBe(EXIT_PACK_PROBLEM);
  });

  it("--allow-unscripted passes a pack whose only issues are unscripted abilities", async () => {
    const dir = tinyPack("export default {};\n");
    expect((await cli("validate", dir)).code).toBe(EXIT_PACK_PROBLEM);
    const run = await cli("validate", dir, "--allow-unscripted");
    expect(run.code).toBe(EXIT_OK);
    expect(run.out).toMatch(/valid, 1 ability to script/);
  });

  it("reports an abilities module that throws as a pack problem", async () => {
    const dir = tinyPack(TINY_ABILITIES.replace("x.tiny-pack.02.test-rally-action", "nope"));
    const run = await cli("validate", dir);
    expect(run.code).toBe(EXIT_PACK_PROBLEM);
    expect(run.err).toMatch(/invalid pack ability definitions/);
  });

  it("builds into --out", async () => {
    const out = tmp();
    const run = await cli("build", tinyPack(), "--out", out);
    expect(run.code).toBe(EXIT_OK);
    expect(existsSync(join(out, "tiny-pack-1.0.0.zip"))).toBe(true);
    expect(existsSync(join(out, "pack.json"))).toBe(true);
  });

  it("plays smoke games of the sample pack's precon", async () => {
    const run = await cli("test", SAMPLE_DIR, "--games", "1", "--scenario", "klaw");
    expect(run.err).toBe("");
    expect(run.code).toBe(EXIT_OK);
    expect(run.out).toMatch(/sample-hero-justice seed 1: (win|loss) /);
    expect(run.out).toMatch(/all 1 game\(s\) passed/);
  });

  it("imports a MarvelCDB-shaped pack (dry run without --out)", async () => {
    const run = await cli("import-marvelcdb", MARVELCDB_DIR, "--id", "ember-test");
    expect(run.code).toBe(EXIT_OK);
    expect(run.out).toMatch(/Ember Warden \(ember-test\)/);
    expect(run.out).toMatch(/abilities to script/);
    expect(run.out).toMatch(/dry run/);
  });

  it("usage errors exit 2", async () => {
    expect((await cli()).code).toBe(EXIT_USAGE);
    expect((await cli("frobnicate")).code).toBe(EXIT_USAGE);
    expect((await cli("validate")).code).toBe(EXIT_USAGE);
    expect((await cli("build", TINY_PACK_DIR)).code).toBe(EXIT_USAGE);
    expect((await cli("test", SAMPLE_DIR, "--games", "0")).code).toBe(EXIT_USAGE);
    expect((await cli("test", SAMPLE_DIR, "--scenario", "galactus")).code).toBe(EXIT_USAGE);
    expect((await cli("validate", TINY_PACK_DIR, "--out", "x")).code).toBe(EXIT_USAGE);
    expect((await cli("validate", join(TINY_PACK_DIR, "missing"))).code).toBe(EXIT_USAGE);
    expect((await cli("--help")).code).toBe(EXIT_OK);
  });
});
