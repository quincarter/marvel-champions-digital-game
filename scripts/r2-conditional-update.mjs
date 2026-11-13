#!/usr/bin/env node
/**
 * Read-merge-write of one R2 object (the Mod Store's index.json) without losing a concurrent writer's change
 * (docs/custom-content-packs.md §11.5, "Two publishers, one index.json"). This repo's publish-packs workflow and the
 * registry repo's publish workflow both upsert into the same index.json, and a GitHub `concurrency` group only
 * serializes runs inside one repo, so each write is conditional:
 *
 *   1. read the object and its ETag (`aws s3api get-object`), or note that there is none;
 *   2. run the merge command on what was read;
 *   3. put the result with `--if-match <ETag>`, or `--if-none-match '*'` when there was no object;
 *   4. on 412 PreconditionFailed (someone wrote in between) or 409 ConditionalRequestConflict (a write raced ours),
 *      wait (exponential backoff with jitter) and go back to 1, at most `attempts` times.
 *
 * R2 evaluates If-Match / If-None-Match on PutObject atomically; aws cli v2 has `--if-match` / `--if-none-match` on
 * `s3api put-object` since 2.22 (ubuntu-latest carries 2.39 as of 2026-11). The registry repo
 * (quincarter/marvel-champions-mods) carries a copy of this file: keep the two the same.
 *
 * Usage: node scripts/r2-conditional-update.mjs --endpoint <url> --bucket <name> --key <key>
 *          [--cache-control <value>] [--content-type <type>] [--attempts <n>] -- <merge command…>
 * The merge command gets `{current}` replaced by the path of the object as read (a path that does not exist when
 * there is no object yet) and prints the new body on stdout. AWS credentials come from the environment.
 */
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** A put that lost the race: the caller re-reads, re-merges and tries again. */
export const CONFLICT = "conflict";

/**
 * The retry loop, with the store injected so it can be tested. `get()` resolves `{ body, etag }`, or `{ body: null }`
 * when there is no object. `merge(body)` resolves the new body (`body` is null when there is none). `put(body, cond)`
 * resolves `"ok"` or `CONFLICT`, `cond` being `{ ifMatch: etag }` or `{ ifNoneMatch: "*" }`; any other failure
 * throws. Resolves `{ body, attempts }` for the body written.
 */
export async function conditionalUpdate({
  get,
  merge,
  put,
  attempts = 6,
  baseDelayMs = 500,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random = Math.random,
  log = () => {},
}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const current = await get();
    const next = await merge(current.body ?? null);
    const cond = current.body == null ? { ifNoneMatch: "*" } : { ifMatch: current.etag };
    const result = await put(next, cond);
    if (result === "ok") return { body: next, attempts: attempt };
    if (result !== CONFLICT) throw new Error(`put returned ${String(result)}`);
    if (attempt === attempts) break;
    const delay = Math.round(baseDelayMs * 2 ** (attempt - 1) * (1 + random()));
    log(`Another publish changed the object since it was read (attempt ${attempt}); re-reading in ${delay} ms.`);
    await sleep(delay);
  }
  throw new Error(`gave up after ${attempts} attempts: the object kept changing between read and write`);
}

const run = (file, args) =>
  new Promise((resolve) => {
    execFile(file, args, { maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) =>
      resolve({ code: error ? (typeof error.code === "number" ? error.code : 1) : 0, stdout, stderr }),
    );
  });

const isMissing = (stderr) => /NoSuchKey|\(404\)|Not Found/i.test(stderr);
const isConflict = (stderr) => /PreconditionFailed|\(412\)|ConditionalRequestConflict|\(409\)/i.test(stderr);

/**
 * `get` and `put` over the aws cli, for `conditionalUpdate`. `exec(file, args)` resolves `{ code, stdout, stderr }`.
 */
export function awsCliStore({ endpoint, bucket, key, dir, cacheControl, contentType, exec = run }) {
  const common = ["--endpoint-url", endpoint, "--bucket", bucket, "--key", key];
  return {
    async get() {
      const out = path.join(dir, `get-${randomUUID()}`);
      const { code, stdout, stderr } = await exec("aws", ["s3api", "get-object", ...common, out]);
      if (code !== 0) {
        if (isMissing(stderr)) return { body: null };
        throw new Error(`aws s3api get-object failed: ${stderr.trim()}`);
      }
      const etag = JSON.parse(stdout).ETag;
      if (!etag) throw new Error("aws s3api get-object returned no ETag");
      const body = await fs.readFile(out, "utf8");
      await fs.rm(out, { force: true });
      return { body, etag };
    },
    async put(body, cond) {
      const file = path.join(dir, `put-${randomUUID()}`);
      await fs.writeFile(file, body);
      const args = ["s3api", "put-object", ...common, "--body", file];
      if (contentType) args.push("--content-type", contentType);
      if (cacheControl) args.push("--cache-control", cacheControl);
      if (cond.ifMatch) args.push("--if-match", cond.ifMatch);
      else args.push("--if-none-match", cond.ifNoneMatch);
      const { code, stderr } = await exec("aws", args);
      await fs.rm(file, { force: true });
      if (code === 0) return "ok";
      if (isConflict(stderr)) return CONFLICT;
      throw new Error(`aws s3api put-object failed: ${stderr.trim()}`);
    },
  };
}

/** Runs the merge command with `{current}` replaced, and resolves its stdout. */
export function commandMerge(command, dir, exec = run) {
  return async (body) => {
    const current = path.join(dir, `current-${randomUUID()}.json`);
    if (body != null) await fs.writeFile(current, body);
    const [file, ...args] = command.map((arg) => arg.replaceAll("{current}", current));
    const { code, stdout, stderr } = await exec(file, args);
    await fs.rm(current, { force: true });
    if (stderr) process.stderr.write(stderr);
    if (code !== 0) throw new Error(`the merge command exited with ${code}`);
    return stdout;
  };
}

function parseArgs(argv) {
  const dash = argv.indexOf("--");
  if (dash < 0 || dash === argv.length - 1) throw new Error("give the merge command after --");
  const options = {};
  const own = argv.slice(0, dash);
  for (let i = 0; i < own.length; i += 2) {
    const name = own[i];
    const value = own[i + 1];
    if (!name.startsWith("--") || value === undefined) throw new Error(`bad option ${name}`);
    options[name.slice(2)] = value;
  }
  for (const required of ["endpoint", "bucket", "key"]) {
    if (!options[required]) throw new Error(`--${required} is required`);
  }
  return { options, command: argv.slice(dash + 1) };
}

async function main() {
  const { options, command } = parseArgs(process.argv.slice(2));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "r2-update-"));
  try {
    const store = awsCliStore({
      endpoint: options.endpoint,
      bucket: options.bucket,
      key: options.key,
      dir,
      cacheControl: options["cache-control"],
      contentType: options["content-type"] ?? "application/json",
    });
    const { attempts } = await conditionalUpdate({
      get: store.get,
      put: store.put,
      merge: commandMerge(command, dir),
      attempts: options.attempts ? Number(options.attempts) : undefined,
      log: (line) => console.error(line),
    });
    console.error(`Wrote ${options.key} (attempt ${attempts}).`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`::error::${error.message}`);
    process.exit(1);
  });
}
