import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { PackManifest } from "@mc/content";
import { inject } from "vitest";
import { buildPack } from "../build.js";
import { readPackInput, type PackInput } from "../validate.js";

/**
 * The community packs (content-packs/community, fetched by `pnpm packs:fetch`), built the way a client installs them,
 * once per test run. Building one takes a few seconds (its abilities bundled, its files hashed and zipped), and both
 * `community-packs.test.ts` and the pack's own rulings file need it, so the first file to ask builds it into the run's
 * folder (`community-pack-builds.setup.ts`) and every other file, in any worker, reads that build back.
 *
 * The art is not in git (.gitignore: the pack folders' cards/<lang>/, alt-art/ and the store cover). A checkout without
 * the images builds the pack without its alternate-art list and its cover; one with them builds the pack as it ships.
 */
export const COMMUNITY_DIR = fileURLToPath(new URL("../../../../content-packs/community", import.meta.url));

declare module "vitest" {
  interface ProvidedContext {
    /** The folder this run's community pack builds go in (community-pack-builds.setup.ts). */
    communityPackBuilds: string;
  }
}

/** The pack folders to test: every folder in content-packs/community without a DRAFT file (a pack still scripted). */
export const communityPackNames = (): readonly string[] =>
  existsSync(COMMUNITY_DIR)
    ? readdirSync(COMMUNITY_DIR).filter(
        (name) => statSync(join(COMMUNITY_DIR, name)).isDirectory() && !existsSync(join(COMMUNITY_DIR, name, "DRAFT")),
      )
    : [];

export interface BuiltCommunityPack {
  readonly pack: PackInput;
  /** Whether the checkout has the pack's pictures, so the build carries them. */
  readonly hasArt: boolean;
}

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

/** The run's build folder; a run without the global setup (a one-off config) gets one of its own per worker. */
let fallbackRoot: string | undefined;
function buildsRoot(): string {
  let provided: string | undefined;
  try {
    provided = inject("communityPackBuilds");
  } catch {
    provided = undefined;
  }
  return provided ?? (fallbackRoot ??= mkdtempSync(join(tmpdir(), "mc-community-builds-")));
}

/** Copies the pack to `src`, without its alternate-art list and cover when the files are not in the checkout. */
function stage(name: string, src: string): boolean {
  cpSync(join(COMMUNITY_DIR, name), src, { recursive: true });
  const hasArt = existsSync(join(src, "alt-art"));
  const file = join(src, "pack.json");
  const manifest = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const coverMissing = typeof manifest.cover === "string" && !existsSync(join(src, ...manifest.cover.split("/")));
  if (!hasArt) delete manifest.altArt;
  if (coverMissing) delete manifest.cover;
  if (!hasArt || coverMissing) writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  return hasArt;
}

/** Reads a built pack's output folder back as a client would install it. */
function readBuilt(out: string): PackInput {
  const manifest = JSON.parse(readFileSync(join(out, "pack.json"), "utf8")) as PackManifest;
  const files = new Map<string, Uint8Array>();
  for (const full of walk(out)) {
    const path = relative(out, full).split(sep).join("/");
    if (!["pack.json", "preview.json", "thumb.webp"].includes(path) && !path.endsWith(".zip"))
      files.set(path, new Uint8Array(readFileSync(full)));
  }
  return readPackInput(manifest, files);
}

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
const inWorker = new Map<string, Promise<BuiltCommunityPack>>();

/**
 * The community pack `name`, built once for the run. The first caller takes the pack's lock (an atomic `mkdir`) and
 * builds it; a caller in another worker waits for the build's `done.json` (or `failed.json`, and then throws the same
 * error). Both markers are written to a temporary name and renamed, so a waiter never reads half a file. If neither
 * comes (the builder crashed), the waiter builds the pack itself rather than hang.
 */
export function builtCommunityPack(name: string): Promise<BuiltCommunityPack> {
  let pending = inWorker.get(name);
  if (!pending) {
    pending = load(name);
    inWorker.set(name, pending);
  }
  return pending;
}

const writeMarker = (file: string, value: unknown): void => {
  writeFileSync(`${file}.tmp`, JSON.stringify(value));
  renameSync(`${file}.tmp`, file);
};

async function load(name: string): Promise<BuiltCommunityPack> {
  const root = buildsRoot();
  const dir = join(root, name);
  const done = join(dir, "done.json");
  const failed = join(dir, "failed.json");
  const read = (): BuiltCommunityPack => ({
    pack: readBuilt(join(dir, "out")),
    hasArt: (JSON.parse(readFileSync(done, "utf8")) as { hasArt: boolean }).hasArt,
  });
  let owner = true;
  try {
    mkdirSync(dir, { recursive: false });
  } catch {
    owner = false;
  }
  if (!owner) {
    for (let waited = 0; waited < 180_000; waited += 100) {
      if (existsSync(done)) return read();
      if (existsSync(failed))
        throw new Error((JSON.parse(readFileSync(failed, "utf8")) as { message: string }).message);
      await sleep(100);
    }
    // The other worker never finished: build a copy of our own, in the run's folder so the teardown removes it.
    const own = mkdtempSync(join(root, `${name}-own-`));
    const hasArt = stage(name, join(own, "src"));
    await buildPack(join(own, "src"), join(own, "out"));
    return { pack: readBuilt(join(own, "out")), hasArt };
  }
  try {
    const hasArt = stage(name, join(dir, "src"));
    await buildPack(join(dir, "src"), join(dir, "out"));
    writeMarker(done, { hasArt });
  } catch (error) {
    writeMarker(failed, {
      message: `${name} failed to build: ${error instanceof Error ? error.message : String(error)}`,
    });
    throw error;
  }
  return read();
}
