// node --test scripts/lib/ (pnpm test:scripts). The media bundle library: manifest checks, selection, path mapping,
// the zip round trip and the install rules for files a checkout already has.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  bundleOwns,
  cacheDir,
  extractZip,
  installBundle,
  isCurrent,
  parseManifest,
  readState,
  readUnpacked,
  releaseUrl,
  selectBundles,
  sameFile,
  sha256File,
  tagFor,
  unpackInto,
  writeState,
  writeZip,
} from "./assets.mjs";

const SHA = "a".repeat(64);
const temps = [];
async function temp() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mc-assets-test-"));
  temps.push(dir);
  return dir;
}
after(() => Promise.all(temps.map((dir) => fs.rm(dir, { recursive: true, force: true }))));

async function writeFiles(base, files) {
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(base, ...rel.split("/"));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  }
}

const CARDS = "assets/card-art/bundles/cards";
const manifest = parseManifest({
  repo: "owner/content",
  bundles: [
    { name: "card-art-core", group: "card-art", dir: CARDS, prefixes: ["01"] },
    { name: "card-art-wave1", group: "card-art", dir: CARDS, prefixes: ["02", "03"] },
    { name: "music-title", group: "music", dir: "music/title" },
    { name: "artifacts", group: "artifacts", kind: "archive", dir: "artifacts" },
  ],
});

describe("parseManifest", () => {
  it("defaults the repo and the kind", () => {
    const m = parseManifest({ bundles: [{ name: "art-title", group: "art", dir: "art/title" }] });
    assert.equal(m.repo, "quincarter/marvel-champions-content");
    assert.equal(m.bundles[0].kind, "media");
  });

  it("rejects a duplicate name", () => {
    const b = { name: "music-title", group: "music", dir: "music/title" };
    assert.throws(() => parseManifest({ bundles: [b, { ...b, dir: "music/other" }] }), /duplicate name/);
  });

  it("rejects two bundles that could claim the same scan", () => {
    const bundles = [
      { name: "a", group: "card-art", dir: CARDS, prefixes: ["01"] },
      { name: "b", group: "card-art", dir: CARDS, prefixes: ["010"] },
    ];
    assert.throws(() => parseManifest({ bundles }), /overlap on prefix/);
    assert.throws(
      () => parseManifest({ bundles: [bundles[0], { name: "c", group: "card-art", dir: CARDS }] }),
      /both own all/,
    );
  });

  it("rejects nested folders and paths out of the repo", () => {
    const bundles = [
      { name: "a", group: "art", dir: "art" },
      { name: "b", group: "art", dir: "art/title" },
    ];
    assert.throws(() => parseManifest({ bundles }), /nested/);
    assert.throws(() => parseManifest({ bundles: [{ name: "a", group: "art", dir: "../art" }] }), /inside the repo/);
    assert.throws(() => parseManifest({ bundles: [{ name: "a", group: "art", dir: "C:/art" }] }), /inside the repo/);
  });

  it("checks a packed bundle's release fields", () => {
    const b = { name: "a", group: "art", dir: "art/a", sha256: SHA, tag: "a-aaaaaaaaaaaa", file: "a.zip", size: 10 };
    assert.equal(parseManifest({ bundles: [b] }).bundles[0].sha256, SHA);
    assert.throws(() => parseManifest({ bundles: [{ ...b, sha256: "abc" }] }), /64 hex/);
    assert.throws(() => parseManifest({ bundles: [{ ...b, size: 3 * 1024 ** 3 }] }), /bad size/);
    assert.throws(() => parseManifest({ bundles: [{ ...b, file: "a.tar" }] }), /\.zip/);
  });
});

describe("selectBundles", () => {
  const names = (selector) => selectBundles(manifest, selector).map((b) => b.name);

  it("takes every media bundle by default, never the archive", () => {
    assert.deepEqual(names(undefined), ["card-art-core", "card-art-wave1", "music-title"]);
    assert.deepEqual(names("all"), names(""));
  });

  it("takes nothing for none", () => {
    assert.deepEqual(names("none"), []);
  });

  it("takes groups and names, comma- or space-separated", () => {
    assert.deepEqual(names("music"), ["music-title"]);
    assert.deepEqual(names("card-art-wave1, music"), ["card-art-wave1", "music-title"]);
    assert.deepEqual(names("artifacts"), ["artifacts"]);
    assert.deepEqual(names("all artifacts").at(-1), "artifacts");
  });

  it("refuses a name it doesn't know", () => {
    assert.throws(() => names("musik"), /no bundle or group named musik/);
  });
});

describe("path mapping", () => {
  const [core, wave1] = manifest.bundles;
  it("gives a scan to the bundle whose prefix starts its card code", () => {
    assert.ok(bundleOwns(core, "01001a.png"));
    assert.ok(!bundleOwns(core, "02001a.png"));
    assert.ok(bundleOwns(wave1, "03010.jpg"));
  });

  it("leaves non-media files (and the card backs, which no prefix names) in git", () => {
    const title = manifest.bundles[2];
    assert.ok(bundleOwns(title, "sub/theme.mp3"));
    assert.ok(!bundleOwns(title, "README.md"));
    assert.ok(!bundleOwns(title, ".gitkeep"));
    assert.ok(!manifest.bundles.some((b) => b.dir === CARDS && bundleOwns(b, "marvel-player-back.webp")));
  });

  it("archives everything in an archive bundle", () => {
    assert.ok(bundleOwns(manifest.bundles[3], "qa/notes.md"));
  });

  it("builds the release URL and the content-addressed tag", () => {
    const tag = tagFor("music-title", "0123456789abcdef".repeat(4));
    assert.equal(tag, "music-title-0123456789ab");
    assert.equal(
      releaseUrl("owner/content", { tag, file: "music-title.zip" }),
      "https://github.com/owner/content/releases/download/music-title-0123456789ab/music-title.zip",
    );
  });

  it("puts the cache under LOCALAPPDATA on Windows and XDG/.cache elsewhere, unless overridden", () => {
    assert.equal(cacheDir({ LOCALAPPDATA: "C:\\L" }, "win32", "C:\\H"), path.join("C:\\L", "mc-assets"));
    assert.equal(cacheDir({}, "linux", "/home/q"), path.join("/home/q", ".cache", "mc-assets"));
    assert.equal(cacheDir({ XDG_CACHE_HOME: "/x" }, "linux", "/home/q"), path.join("/x", "mc-assets"));
    assert.equal(cacheDir({ MC_ASSETS_CACHE: "/c" }, "linux", "/home/q"), path.resolve("/c"));
  });
});

describe("zip", () => {
  it("is deterministic and round-trips", async () => {
    const base = await temp();
    await writeFiles(base, { "b.png": "bee", "a/c.mp3": Buffer.alloc(70000, 7), "empty.png": "" });
    const files = ["b.png", "empty.png", "a/c.mp3"];
    const out = await temp();
    const first = await writeZip(base, files, path.join(out, "1.zip"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await writeZip(base, [...files].reverse(), path.join(out, "2.zip"));
    assert.equal(first.sha256, second.sha256);
    assert.equal(first.sha256, await sha256File(path.join(out, "1.zip")));
    assert.equal(first.size, (await fs.stat(path.join(out, "1.zip"))).size);

    const dest = await temp();
    assert.deepEqual(await extractZip(path.join(out, "1.zip"), dest), ["a/c.mp3", "b.png", "empty.png"]);
    assert.equal(await fs.readFile(path.join(dest, "b.png"), "utf8"), "bee");
    assert.deepEqual(await fs.readFile(path.join(dest, "a", "c.mp3")), Buffer.alloc(70000, 7));
  });

  it("refuses a corrupted file", async () => {
    const base = await temp();
    await writeFiles(base, { "x.png": "original" });
    const zip = path.join(await temp(), "x.zip");
    await writeZip(base, ["x.png"], zip);
    const bytes = await fs.readFile(zip);
    bytes[30 + "x.png".length] ^= 0xff; // the first data byte
    await fs.writeFile(zip, bytes);
    await assert.rejects(extractZip(zip, await temp()), /fails its crc/);
  });
});

describe("installBundle and isCurrent", () => {
  async function setup() {
    const source = await temp();
    await writeFiles(source, { "01001.png": "one", "01002.png": "two" });
    const root = await temp();
    const bundle = { name: "card-art-core", dir: CARDS, sha256: SHA };
    return { source, root, bundle, target: path.join(root, CARDS) };
  }

  it("places every file, then skips without touching anything", async () => {
    const { source, root, bundle, target } = await setup();
    const files = ["01001.png", "01002.png"];
    const { record, counts } = await installBundle({ sourceDir: source, files, targetDir: target });
    assert.equal(counts.installed, 2);
    assert.equal(await fs.readFile(path.join(target, "01002.png"), "utf8"), "two");
    const state = { bundles: { [bundle.name]: { sha256: SHA, complete: true, files: record } } };
    assert.equal(await isCurrent(root, bundle, state), true);
    assert.equal(await isCurrent(root, { ...bundle, sha256: "b".repeat(64) }, state), false);
    await fs.rm(path.join(target, "01001.png"));
    assert.equal(await isCurrent(root, bundle, state), false);
  });

  it("hard-links into the checkout so worktrees share the bytes", async () => {
    const { source, target } = await setup();
    const result = await installBundle({ sourceDir: source, files: ["01001.png"], targetDir: target });
    assert.equal(result.counts.installed, 1);
    const [a, b] = await Promise.all([
      fs.stat(path.join(source, "01001.png")),
      fs.stat(path.join(target, "01001.png")),
    ]);
    assert.equal(a.ino, b.ino);
    const again = await installBundle({ sourceDir: source, files: ["01001.png"], targetDir: target });
    assert.equal(again.counts.same, 1);
  });

  it("copies when told to", async () => {
    const { source, target } = await setup();
    await installBundle({ sourceDir: source, files: ["01001.png"], targetDir: target, copy: true });
    const [a, b] = await Promise.all([
      fs.stat(path.join(source, "01001.png")),
      fs.stat(path.join(target, "01001.png")),
    ]);
    assert.notEqual(a.ino, b.ino);
  });

  it("adopts an identical file it didn't place, and keeps a different one unless forced", async () => {
    const { source, target } = await setup();
    await writeFiles(target, { "01001.png": "one", "01002.png": "my new scan" });
    const files = ["01001.png", "01002.png"];
    const { counts } = await installBundle({ sourceDir: source, files, targetDir: target, copy: true });
    assert.equal(counts.same, 1);
    assert.deepEqual(counts.kept, ["01002.png"]);
    assert.equal(await fs.readFile(path.join(target, "01002.png"), "utf8"), "my new scan");
    await installBundle({ sourceDir: source, files, targetDir: target, force: true });
    assert.equal(await fs.readFile(path.join(target, "01002.png"), "utf8"), "two");
  });

  it("replaces its own untouched file on an update and removes the ones the new version dropped", async () => {
    const { source, target } = await setup();
    const first = await installBundle({
      sourceDir: source,
      files: ["01001.png", "01002.png"],
      targetDir: target,
      copy: true,
    });
    const next = await temp();
    await writeFiles(next, { "01001.png": "one, rescanned" });
    const { counts } = await installBundle({
      sourceDir: next,
      files: ["01001.png"],
      targetDir: target,
      previousFiles: first.record,
      copy: true,
    });
    assert.equal(counts.installed, 1);
    assert.equal(counts.removed, 1);
    assert.equal(await fs.readFile(path.join(target, "01001.png"), "utf8"), "one, rescanned");
    await assert.rejects(fs.stat(path.join(target, "01002.png")), { code: "ENOENT" });
  });

  it("keeps a dropped file that was edited since it was placed", async () => {
    const { source, target } = await setup();
    const first = await installBundle({ sourceDir: source, files: ["01002.png"], targetDir: target, copy: true });
    await fs.writeFile(path.join(target, "01002.png"), "edited locally");
    const { counts } = await installBundle({
      sourceDir: source,
      files: [],
      targetDir: target,
      previousFiles: first.record,
    });
    assert.equal(counts.removed, 0);
    assert.equal(await fs.readFile(path.join(target, "01002.png"), "utf8"), "edited locally");
  });
});

describe("more install rules", () => {
  it("leaves a dropped file alone when another bundle owns it now (a pack prefix moved)", async () => {
    const source = await temp();
    await writeFiles(source, { "04001.png": "trors" });
    const target = await temp();
    const first = await installBundle({ sourceDir: source, files: ["04001.png"], targetDir: target, copy: true });
    const { counts } = await installBundle({
      sourceDir: source,
      files: [],
      targetDir: target,
      previousFiles: first.record,
      ownedElsewhere: (rel) => rel.startsWith("04"),
    });
    assert.equal(counts.removed, 0);
    assert.equal(await fs.readFile(path.join(target, "04001.png"), "utf8"), "trors");
  });

  it("tells a hard link from a copy", async () => {
    const dir = await temp();
    await writeFiles(dir, { "a.png": "x" });
    await fs.link(path.join(dir, "a.png"), path.join(dir, "b.png"));
    await fs.copyFile(path.join(dir, "a.png"), path.join(dir, "c.png"));
    assert.equal(await sameFile(path.join(dir, "a.png"), path.join(dir, "b.png")), true);
    assert.equal(await sameFile(path.join(dir, "a.png"), path.join(dir, "c.png")), false);
  });

  it("starts over from an unreadable state file, and writes it whole", async () => {
    const root = await temp();
    await writeFiles(root, { "assets/.fetched.json": '{"bundles": {"a": ' });
    assert.deepEqual(await readState(root), { bundles: {} });
    await writeState(root, { bundles: { a: { sha256: SHA } } });
    assert.equal((await readState(root)).bundles.a.sha256, SHA);
    assert.deepEqual(await fs.readdir(path.join(root, "assets")), [".fetched.json"]);
  });
});

describe("the shared cache's unpacked bundles", () => {
  async function zipOf(files) {
    const base = await temp();
    await writeFiles(base, files);
    const zip = path.join(await temp(), "b.zip");
    await writeZip(base, Object.keys(files), zip);
    return zip;
  }

  it("unpacks once and is whole afterwards", async () => {
    const zip = await zipOf({ "01001.png": "one", "sub/x.mp3": "two" });
    const dir = path.join(await temp(), SHA);
    assert.equal(await readUnpacked(dir), undefined);
    assert.deepEqual(await unpackInto(zip, dir), ["01001.png", "sub/x.mp3"]);
    assert.deepEqual(await readUnpacked(dir), ["01001.png", "sub/x.mp3"]);
    assert.deepEqual(await unpackInto(zip, dir), ["01001.png", "sub/x.mp3"]);
    assert.deepEqual((await fs.readdir(path.dirname(dir))).sort(), [SHA]);
  });

  it("notices a cached file rewritten in place through a checkout's hard link, and unpacks it again", async () => {
    const zip = await zipOf({ "01001.png": "one" });
    const dir = path.join(await temp(), SHA);
    await unpackInto(zip, dir);
    const checkout = await temp();
    await installBundle({ sourceDir: dir, files: ["01001.png"], targetDir: checkout });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await fs.writeFile(path.join(checkout, "01001.png"), "edited in place"); // the same inode as the cache's
    assert.equal(await fs.readFile(path.join(dir, "01001.png"), "utf8"), "edited in place");
    assert.equal(await readUnpacked(dir), undefined);
    await unpackInto(zip, dir);
    assert.equal(await fs.readFile(path.join(dir, "01001.png"), "utf8"), "one");
    assert.equal(await sameFile(path.join(dir, "01001.png"), path.join(checkout, "01001.png")), false);
  });

  it("survives two checkouts unpacking the same bundle at once", async () => {
    const zip = await zipOf({ "a.png": "a", "b.png": "b" });
    const dir = path.join(await temp(), SHA);
    const results = await Promise.all([unpackInto(zip, dir), unpackInto(zip, dir)]);
    assert.deepEqual(results, [
      ["a.png", "b.png"],
      ["a.png", "b.png"],
    ]);
    assert.deepEqual(await readUnpacked(dir), ["a.png", "b.png"]);
  });
});
