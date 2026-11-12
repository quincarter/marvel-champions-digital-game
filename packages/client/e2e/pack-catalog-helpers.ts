import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
// @ts-expect-error: a plain .mjs script with no declarations
import { stagePackSource } from "../../../scripts/lib/stage-pack.mjs";
// @ts-expect-error: a plain .mjs script with no declarations
import { readStagedPacks, upsertPackIndex } from "../../../scripts/lib/pack-index.mjs";

/**
 * A local Mod Store for the e2e suite: community packs built from `content-packs/community/<id>` with the SDK, staged
 * the way the publish workflow stages them (`<id>/<version>/{zip,pack.json,preview.json,thumb.webp}`), and served from
 * the page's own origin through `page.route`, so no spec depends on R2 or the network.
 */
const COMMUNITY = fileURLToPath(new URL("../../../content-packs/community", import.meta.url));
const SDK = fileURLToPath(new URL("../../mod-sdk/", import.meta.url));
const JITI = join(SDK, "node_modules/jiti/lib/jiti-cli.mjs");
const MC_PACK = join(SDK, "src/bin.ts");
const SERVED = "/e2e-packs";

export const communityPackIds = (): string[] =>
  readdirSync(COMMUNITY).filter(
    // A pack still being scripted carries a DRAFT file (content-packs/community/<id>/DRAFT): skipped until it is removed.
    (name) => statSync(join(COMMUNITY, name)).isDirectory() && !existsSync(join(COMMUNITY, name, "DRAFT")),
  );

export interface StagedCatalog {
  readonly dir: string;
  readonly index: unknown;
  /** The version each pack was staged at. */
  readonly versions: Readonly<Record<string, string>>;
  /** Each pack's name, which is its hero's name in the hero search. */
  readonly heroName: Readonly<Record<string, string>>;
  dispose(): void;
}

/** Builds the packs and the catalog that lists them, with every URL under `<origin>/e2e-packs/`. */
export async function stageCatalog(origin: string, packIds: readonly string[]): Promise<StagedCatalog> {
  const dir = mkdtempSync(join(tmpdir(), "mc-e2e-packs-"));
  const versions: Record<string, string> = {};
  const heroName: Record<string, string> = {};
  const sources: string[] = [];
  for (const id of packIds) {
    const manifest = JSON.parse(readFileSync(join(COMMUNITY, id, "pack.json"), "utf8")) as {
      version: string;
      name: string;
    };
    versions[id] = manifest.version;
    heroName[id] = manifest.name;
    const staged = stagePackSource(join(COMMUNITY, id), id);
    sources.push(staged.root);
    // The SDK is TypeScript ESM that Playwright's own loader cannot import, so the build runs as the `mc-pack` CLI does.
    execFileSync(process.execPath, [JITI, MC_PACK, "build", staged.src, "--out", join(dir, id, manifest.version)], {
      stdio: "pipe",
    });
  }
  const today = new Date().toISOString().slice(0, 10);
  const built = await readStagedPacks(dir, `${origin}${SERVED}`, today);
  const index = upsertPackIndex(undefined, built, { today, now: `${today}T00:00:00Z` });
  return {
    dir,
    index,
    versions,
    heroName,
    dispose: () => {
      for (const path of [dir, ...sources]) rmSync(path, { recursive: true, force: true });
    },
  };
}

/** Serves the catalog (dev's `/packs/index.json` and the production URL) and every staged file. */
export async function serveCatalog(page: Page, staged: StagedCatalog): Promise<void> {
  const json = JSON.stringify(staged.index);
  await page.route(/\/packs\/index\.json(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: json,
    }),
  );
  await page.route(new RegExp(`${SERVED}/`), (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname.slice(SERVED.length + 1));
    try {
      const body = readFileSync(join(staged.dir, path));
      const type = path.endsWith(".json")
        ? "application/json"
        : path.endsWith(".zip")
          ? "application/zip"
          : "image/webp";
      return route.fulfill({ status: 200, contentType: type, headers: { "access-control-allow-origin": "*" }, body });
    } catch {
      return route.fulfill({ status: 404, body: "not found" });
    }
  });
}

/** The id of a community pack's first suggested deck (its precon), read from `decks/`: the file name is the deck id. */
export const communityPreconId = (packId: string): string => {
  const [file] = readdirSync(join(COMMUNITY, packId, "decks")).filter((name) => name.endsWith(".json"));
  return JSON.parse(readFileSync(join(COMMUNITY, packId, "decks", file!), "utf8")).id as string;
};
