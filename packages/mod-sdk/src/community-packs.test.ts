import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { CORE_SCENARIOS, type PackManifest } from "@mc/content";
import { buildPack } from "./build.js";
import { packModularSetChoices } from "./game.js";
import { smokeTestPack } from "./smoke.js";
import { readPackInput, validatePack, type PackInput } from "./validate.js";

/**
 * Every community pack in content-packs/community (a folder per pack, the SDK's source layout): build it, validate
 * the built output, then play 3 seeds of each of its decks and each of its modular sets, on the real engine with the
 * pack's cards and abilities read back from the built JSON (what `mc-pack test` plays).
 *
 * The art is not in git (.gitignore: the pack folders' cards/<lang>/ and alt-art/). A checkout without the images
 * builds the pack without its alternate-art list and skips the picture check; one with them builds the pack as it
 * ships, and every card face must then have its picture.
 */
const COMMUNITY_DIR = fileURLToPath(new URL("../../../content-packs/community", import.meta.url));
const CORE_RHINO = CORE_SCENARIOS.find((s) => String(s.id) === "rhino")!;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const packFolders = existsSync(COMMUNITY_DIR)
  ? readdirSync(COMMUNITY_DIR).filter(
      // A pack still being scripted carries a DRAFT file: it is neither tested nor published until it is removed.
      (name) => statSync(join(COMMUNITY_DIR, name)).isDirectory() && !existsSync(join(COMMUNITY_DIR, name, "DRAFT")),
    )
  : [];

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** The pack's folder copied to a scratch folder, without its alternate-art list when the images are not there. */
function stage(name: string): { readonly src: string; readonly hasArt: boolean } {
  const root = mkdtempSync(join(tmpdir(), `mc-community-${name}-`));
  dirs.push(root);
  const src = join(root, name);
  cpSync(join(COMMUNITY_DIR, name), src, { recursive: true });
  const hasArt = existsSync(join(src, "alt-art"));
  if (!hasArt) {
    const file = join(src, "pack.json");
    const manifest = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    delete manifest.altArt;
    writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return { src, hasArt };
}

async function builtPack(src: string): Promise<PackInput> {
  const out = mkdtempSync(join(tmpdir(), "mc-community-out-"));
  dirs.push(out);
  await buildPack(src, out);
  const manifest = JSON.parse(readFileSync(join(out, "pack.json"), "utf8")) as PackManifest;
  const files = new Map<string, Uint8Array>();
  for (const full of walk(out)) {
    const path = relative(out, full).split(sep).join("/");
    if (!["pack.json", "preview.json", "thumb.webp"].includes(path) && !path.endsWith(".zip"))
      files.set(path, new Uint8Array(readFileSync(full)));
  }
  return readPackInput(manifest, files);
}

describe("community packs", () => {
  it("has at least one pack folder", () => {
    expect(packFolders.length).toBeGreaterThan(0);
  });

  for (const name of packFolders) {
    describe(name, () => {
      let pack: PackInput;
      let hasArt = false;
      beforeAll(async () => {
        const staged = stage(name);
        hasArt = staged.hasArt;
        pack = await builtPack(staged.src);
      });

      it("has the credits and the creator's permission", () => {
        const source = join(COMMUNITY_DIR, name);
        for (const file of ["CREDITS.md", "PERMISSION.md"]) expect(existsSync(join(source, file)), file).toBe(true);
        expect(pack.manifest.permission, "permission in pack.json").toBeDefined();
      });

      it("validates as built, every ability scripted", () => {
        expect(validatePack(pack)).toEqual([]);
      });

      it("has a picture for every card face in each language, when the art is present", () => {
        if (!hasArt) return;
        for (const lang of pack.manifest.languages?.available ?? []) {
          for (const card of pack.cards) {
            // A hero identity is one record with two faces (01a, 01b), each with its own picture.
            const base = String(card.id).replace(/a$/, "");
            const codes = card.type === "hero_identity" ? [`${base}a`, `${base}b`] : [String(card.id)];
            for (const code of codes)
              expect(pack.files.has(`cards/${lang}/${code}.webp`), `${lang}: ${code}`).toBe(true);
          }
        }
      });

      it("plays 3 seeds of each of its decks and each of its modular sets to an outcome, and replays", () => {
        const result = smokeTestPack(pack, { games: 3 });
        const failures = result.games.filter((g) => !g.ok).map((g) => `${g.deck} seed ${g.seed}: ${g.error}`);
        expect(failures).toEqual([]);
        expect(result.ok).toBe(true);
        const played = result.games.filter((g) => !g.modularSet).map((g) => g.deck);
        for (const deck of pack.decks ?? []) expect(played, `deck ${String(deck.id)}`).toContain(String(deck.id));
        // A pack's modular set (not a hero's nemesis set) is picked at the Core scenario with a base precon.
        const modularPlayed = result.games.flatMap((g) => (g.modularSet ? [g.modularSet] : []));
        for (const set of packModularSetChoices(CORE_RHINO, [pack]))
          expect(modularPlayed, `modular set ${String(set.id)}`).toContain(String(set.id));
        for (const seed of [1, 2, 3]) expect(result.games.some((g) => g.seed === seed)).toBe(true);
      });
    });
  }
});
