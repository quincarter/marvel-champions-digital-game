#!/usr/bin/env node
/**
 * Uploads the packs publish-packs.yml's build job staged (`<staging>/<id>/<version>/`) to R2 under `<id>/<version>/`
 * (docs/custom-content-packs.md §11.5, "Published versions are immutable"). Safe to re-run after a failure part way:
 *
 *   - Published versions are immutable. Every object of every staged pack (pack.json, preview.json, thumb.webp, the
 *     card pictures and the zip) is checked before anything is uploaded: a version whose objects are all there with
 *     the same sha256 (a retry after the upload went through) is skipped; one with any object there with other bytes
 *     fails the run ("bump the version") and nothing of any pack is uploaded; otherwise only the objects not there
 *     yet are uploaded.
 *   - Every object goes up with its sha256 as object metadata, so a later run compares without downloading it (an
 *     object uploaded without the metadata, as this workflow did before, is downloaded and hashed). The zip goes up
 *     last, so its presence marks the version complete.
 *   - Every put is conditional (If-None-Match: *), so it never overwrites an object already there. The registry repo
 *     (quincarter/marvel-champions-mods, scripts/upload-staged.mjs) writes the same bucket: if both publish a new
 *     <id>/<version> at once, both pass the check above and only one put of each object succeeds; the other gets a
 *     412 (or 409), hashes the object that won and goes on only when it is the same bytes. So the bucket never holds
 *     one publisher's zip with the other's pack.json, preview or pictures. (A publisher that stops may leave objects
 *     the winner's pack does not have, such as a card picture only it staged; nothing the winner's pack.json or
 *     preview.json names is ever another's.)
 *
 * With `--check` it only plans: it prints what it would do and fails on a version already published with other
 * bytes, uploading nothing (the workflow's dry run and its check before the upload). No staged pack (a run that only
 * unwithdraws) does nothing and succeeds.
 *
 * Runs in the publish job, which holds the R2 secrets and runs no pack code: Node built-ins and the aws cli only.
 *
 *   node scripts/upload-staged-packs.mjs [--check] <staging dir>
 *
 * Environment: ENDPOINT, BUCKET (R2) and the AWS_* credentials.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const IMMUTABLE = "public, max-age=31536000, immutable";

const sha256File = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const isDir = (at) => fs.existsSync(at) && fs.statSync(at).isDirectory();
const dirs = (at) =>
  isDir(at)
    ? fs
        .readdirSync(at)
        .sort()
        .filter((name) => isDir(path.join(at, name)))
    : [];

/**
 * The staged packs under `dir` (`<dir>/<id>/<version>/`): `[{ id, version, zipName, zipPath, zipSha, files }]`,
 * where `files` is `[{ path, key, name, contentType, sha256 }]` in upload order, the zip last (`name` is the key under
 * `<id>/<version>/`). A missing folder, or one with no pack folders, is none.
 */
export function readStaged(dir) {
  const packs = [];
  for (const id of dirs(dir)) {
    const versions = dirs(path.join(dir, id));
    if (versions.length !== 1) throw new Error(`${id}: expected one staged version, found ${versions.length}`);
    const [version] = versions;
    const at = path.join(dir, id, version);
    const manifest = JSON.parse(fs.readFileSync(path.join(at, "pack.json"), "utf8"));
    if (manifest.id !== id || manifest.version !== version) {
      throw new Error(`${id}/${version}: its staged pack.json says ${manifest.id} ${manifest.version}`);
    }
    const zipName = `${id}-${version}.zip`;
    const zipPath = path.join(at, zipName);
    if (!fs.existsSync(zipPath)) throw new Error(`${id} ${version}: ${zipName} is not staged`);
    const prefix = `${id}/${version}/`;
    const files = [{ path: path.join(at, "pack.json"), key: `${prefix}pack.json`, contentType: "application/json" }];
    for (const [name, contentType] of [
      ["preview.json", "application/json"],
      ["thumb.webp", "image/webp"],
    ]) {
      const file = path.join(at, name);
      if (fs.existsSync(file)) files.push({ path: file, key: prefix + name, contentType });
    }
    const cards = path.join(at, "cards");
    for (const lang of dirs(cards)) {
      for (const name of fs.readdirSync(path.join(cards, lang)).sort()) {
        if (!name.endsWith(".webp")) continue;
        const key = `${prefix}cards/${lang}/${name}`;
        files.push({ path: path.join(cards, lang, name), key, contentType: "image/webp" });
      }
    }
    files.push({ path: zipPath, key: prefix + zipName, contentType: "application/zip" });
    for (const file of files) {
      Object.assign(file, { name: file.key.slice(prefix.length), sha256: sha256File(file.path) });
    }
    packs.push({ id, version, zipName, zipPath, zipSha: files.at(-1).sha256, files });
  }
  return packs;
}

/** How a file is named in a message: "zip" for the zip, its key under `<id>/<version>/` otherwise. */
const fileLabel = (pack, file) => (file.path === pack.zipPath ? "zip" : file.name);

/**
 * What to do with each staged pack, from every one of its objects. `store.sha256(key)` resolves the sha256 of the
 * object already in the bucket, or null when there is none. Resolves `{ plan: [{ pack, action: "upload" | "skip",
 * files }], errors }`: `files` are the ones to upload (the zip last), the ones not in the bucket yet. A pack with any
 * object already there with other bytes is an error, and nothing of any pack should be uploaded then.
 */
export async function planUploads(packs, store) {
  const plan = [];
  const errors = [];
  for (const pack of packs) {
    const missing = [];
    const differ = [];
    for (const file of pack.files) {
      const published = await store.sha256(file.key);
      if (published == null) missing.push(file);
      else if (published !== file.sha256) differ.push({ file, published });
    }
    if (differ.length > 0) {
      const what = differ
        .map(({ file, published }) => `${fileLabel(pack, file)} (${published}, built ${file.sha256})`)
        .join(", ");
      errors.push(
        `${pack.id} ${pack.version} is already published with a different ${what}: bump the version in its pack.json`,
      );
    } else if (missing.length === 0) plan.push({ pack, action: "skip", files: [] });
    else plan.push({ pack, action: "upload", files: missing });
  }
  return { plan, errors };
}

/**
 * Checks every object of every pack, then (unless `check`) uploads the new ones, each put conditional and the zip
 * last. Throws before uploading anything when a pack is refused. Resolves `[{ id, version, action }]`.
 */
export async function publishStaged(packs, { store, check = false, log = () => {} }) {
  const { plan, errors } = await planUploads(packs, store);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const done = [];
  for (const { pack, action, files } of plan) {
    if (action === "skip") {
      log(`${pack.id} ${pack.version} is already published with the same files; skipped.`);
    } else if (check) {
      const what = files.length === pack.files.length ? "new" : `${files.length} of ${pack.files.length} files to go`;
      log(`${pack.id} ${pack.version}: ${what}.`);
    } else {
      for (const file of files) {
        if ((await store.put(file)) === "written") continue;
        // Another publisher's object got there first (between the check above and now): keep going only if it is
        // the same bytes as ours, so this version's objects all come from one build.
        const published = await store.sha256(file.key);
        if (published !== file.sha256) {
          throw new Error(
            `${pack.id} ${pack.version} was published by someone else while this run uploaded it, with a different ` +
              `${fileLabel(pack, file)} (${published}, built ${file.sha256}): the bucket keeps theirs; ` +
              "bump the version in its pack.json",
          );
        }
        log(
          `${pack.id} ${pack.version}: the same ${fileLabel(pack, file)} was uploaded by another publisher meanwhile.`,
        );
      }
      log(`Published ${pack.id} ${pack.version} (${files.length} of ${pack.files.length} files uploaded).`);
    }
    done.push({ id: pack.id, version: pack.version, action });
  }
  return done;
}

const run = (file, args) =>
  new Promise((resolve) => {
    execFile(file, args, { maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) =>
      resolve({ code: error ? (typeof error.code === "number" ? error.code : 1) : 0, stdout, stderr }),
    );
  });

/** The bucket over the aws cli. `exec(file, args)` resolves `{ code, stdout, stderr }`. */
export function awsStore({ endpoint, bucket, dir, exec = run }) {
  const aws = (args) => exec("aws", [...args, "--endpoint-url", endpoint]);
  return {
    /** The sha256 of the object at `key`: its metadata, or its bytes hashed when it has none; null when none. */
    async sha256(key) {
      const head = await aws(["s3api", "head-object", "--bucket", bucket, "--key", key]);
      if (head.code !== 0) {
        if (/\(404\)|Not Found|NoSuchKey/i.test(head.stderr)) return null;
        throw new Error(`aws s3api head-object ${key} failed: ${head.stderr.trim()}`);
      }
      const stored = JSON.parse(head.stdout).Metadata?.sha256;
      if (stored) return stored;
      const file = path.join(dir, "published-object");
      const get = await aws(["s3", "cp", "--only-show-errors", `s3://${bucket}/${key}`, file]);
      if (get.code !== 0) throw new Error(`aws s3 cp ${key} failed: ${get.stderr.trim()}`);
      const sha = sha256File(file);
      fs.rmSync(file, { force: true });
      return sha;
    },
    /**
     * Uploads one file `{ key, path, contentType, sha256 }`, with its sha256 as metadata, only if there is no object
     * at the key yet (If-None-Match: *; R2 evaluates it atomically; `s3api put-object --if-none-match` needs aws cli
     * 2.22+). Resolves "exists" on a 412 or a 409 (a put that raced ours), "written" otherwise.
     */
    async put(file) {
      const args = ["s3api", "put-object", "--bucket", bucket, "--key", file.key, "--body", file.path];
      args.push("--content-type", file.contentType, "--cache-control", IMMUTABLE, "--if-none-match", "*");
      args.push("--metadata", `sha256=${file.sha256}`);
      const { code, stderr } = await aws(args);
      if (code === 0) return "written";
      if (/PreconditionFailed|\(412\)|ConditionalRequestConflict|\(409\)/i.test(stderr)) return "exists";
      throw new Error(`aws s3api put-object ${file.key} failed: ${stderr.trim()}`);
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const [stagingDir] = args.filter((arg) => arg !== "--check");
  if (!stagingDir) throw new Error("usage: node scripts/upload-staged-packs.mjs [--check] <staging dir>");
  const packs = readStaged(stagingDir);
  if (packs.length === 0) {
    console.log("No packs staged: nothing to upload.");
    return;
  }
  for (const name of ["ENDPOINT", "BUCKET"]) {
    if (!process.env[name]) throw new Error(`${name} is not set`);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "upload-staged-packs-"));
  try {
    await publishStaged(packs, {
      store: awsStore({ endpoint: process.env.ENDPOINT, bucket: process.env.BUCKET, dir }),
      check,
      log: (line) => console.log(line),
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    for (const line of error.message.split("\n")) console.error(`::error::${line}`);
    process.exit(1);
  });
}
