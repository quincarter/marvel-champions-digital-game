// TEMPORARY (the owner, 2026-11-11): a stand-in until the production catalog on R2 has packs; remove it, its step in
// netlify-deploy.yml and VITE_PACK_CATALOG once the R2 integration is tested. Don't build more on it.
//
// Builds the repo's own content packs (content-packs/sample-*, content-packs/community/*) into a Mod Store catalog
// served by the web build itself, so a Netlify build (non-production: PR previews and the main site) has packs to
// install without the production catalog on R2 (docs/custom-content-packs.md §11).
//
//   node scripts/build-pack-catalog.mjs <out dir, e.g. packages/client/dist/packs>
//
// Each pack is built with the mod SDK's `mc-pack build` (validated, deterministic zip) into
// <out>/<id>/<version>/{pack.json,<id>-<version>.zip}, and <out>/index.json lists them with same-origin URLs. A
// community pack's pictures are not in git: its fetch-art.sh fetches them first when they are missing.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const out = resolve(process.argv[2] ?? "packages/client/dist/packs");
const root = resolve(import.meta.dirname, "..");
const packsRoot = join(root, "content-packs");
const route = "/packs";

const dirs = [
  ...readdirSync(packsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "community")
    .map((entry) => join(packsRoot, entry.name)),
  ...(existsSync(join(packsRoot, "community"))
    ? readdirSync(join(packsRoot, "community"), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(packsRoot, "community", entry.name))
    : []),
].filter((dir) => existsSync(join(dir, "pack.json")));

const pnpm = "pnpm";
const work = mkdtempSync(join(tmpdir(), "mc-pack-catalog-"));
const today = new Date().toISOString().slice(0, 10);
const entries = [];

try {
  for (const dir of dirs) {
    let source = dir;
    if (existsSync(join(dir, "fetch-art.sh")) && !existsSync(join(dir, "cards", "en"))) {
      try {
        execFileSync("sh", [join(dir, "fetch-art.sh")], { stdio: "inherit" });
      } catch {
        // The source repo is private, so CI can't fetch the pictures: build without them (generated card frames), from
        // a copy without the alternate-art list, whose files would be missing.
        console.warn(`::warning::${dir}: pictures unavailable, building the pack without them.`);
        source = join(work, "src", basename(dir));
        cpSync(dir, source, { recursive: true });
        const manifest = JSON.parse(readFileSync(join(source, "pack.json"), "utf8"));
        delete manifest.altArt;
        writeFileSync(
          join(source, "pack.json"),
          `${JSON.stringify(manifest, null, 2)}
`,
        );
      }
    }
    const author = JSON.parse(readFileSync(join(source, "pack.json"), "utf8"));
    const built = join(work, author.id);
    execFileSync(pnpm, ["--silent", "--filter", "@mc/mod-sdk", "mc-pack", "build", source, "--out", built], {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    const manifest = JSON.parse(readFileSync(join(built, "pack.json"), "utf8"));
    const zipName = `${manifest.id}-${manifest.version}.zip`;
    const zip = readFileSync(join(built, zipName));
    const base = `${route}/${manifest.id}/${manifest.version}/`;
    const target = join(out, manifest.id, manifest.version);
    mkdirSync(target, { recursive: true });
    copyFileSync(join(built, zipName), join(target, zipName));
    copyFileSync(join(built, "pack.json"), join(target, "pack.json"));
    // The store screen reads the preview (and the thumbnail, when the pack ships a picture) before an install.
    copyFileSync(join(built, "preview.json"), join(target, "preview.json"));
    const hasThumb = existsSync(join(built, "thumb.webp"));
    if (hasThumb) copyFileSync(join(built, "thumb.webp"), join(target, "thumb.webp"));
    entries.push({
      id: manifest.id,
      kind: manifest.kind,
      name: manifest.name,
      creator: manifest.authors?.[0] ?? "Unknown",
      summary: String(manifest.description ?? "").split("\n")[0],
      tags: [manifest.kind],
      ...(hasThumb ? { thumbnail: `${base}thumb.webp` } : {}),
      approved: today,
      latest: manifest.version,
      versions: {
        [manifest.version]: {
          manifest: `${base}pack.json`,
          base,
          zip: `${base}${zipName}`,
          zipBytes: zip.length,
          zipSha256: createHash("sha256").update(zip).digest("hex"),
          requires: manifest.requires,
          preview: `${base}preview.json`,
        },
      },
      withdrawn: false,
    });
    console.log(`Built ${manifest.id}@${manifest.version} (${zip.length} bytes).`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

mkdirSync(out, { recursive: true });
const index = {
  schema: 2,
  generated: new Date().toISOString(),
  packs: entries.sort((a, b) => a.name.localeCompare(b.name)),
};
writeFileSync(join(out, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
console.log(`Wrote ${join(out, "index.json")} with ${entries.length} packs.`);
