/**
 * Node-only: loads a pack's `abilities/index.ts` without a build step, for the `mc-pack` CLI.
 *
 * jiti (rather than tsx) because it is a plain in-process API with no loader hooks to register and no native
 * binaries, and its `virtualModules` hand the pack's `import ... from "<sdk>"` the SDK module that is already running.
 * That keeps one copy of the SDK in memory and makes a pack resolve the SDK whatever name it was installed under
 * (`@mc/mod-sdk` in this repo, the published package name in a creator's repo).
 */
import { createJiti } from "jiti";
import type { ModuleImporter } from "./build.js";
import * as sdk from "./index.js";

/** The names a pack may import the SDK by. The bundle defines `MC_SDK_PACKAGE_NAME` to its published name. */
export function sdkModuleNames(): readonly string[] {
  const published = process.env.MC_SDK_PACKAGE_NAME;
  return published && published !== "@mc/mod-sdk" ? ["@mc/mod-sdk", published] : ["@mc/mod-sdk"];
}

/** An importer for `loadPackSource` / `buildPack` that loads TypeScript with jiti. */
export function packModuleImporter(): ModuleImporter {
  const virtualModules = Object.fromEntries(sdkModuleNames().map((name) => [name, sdk]));
  return (path) => {
    // A fresh instance per pack, with no caches, so a pack edited between two runs in one process is read again and
    // nothing is written into the pack's own node_modules/.cache.
    const jiti = createJiti(path, { virtualModules, fsCache: false, moduleCache: false, interopDefault: false });
    return jiti.import(path);
  };
}
