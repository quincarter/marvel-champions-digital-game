/**
 * Pull request previews in the `mc-previews` bucket, from CI (netlify-deploy.yml, cloudflare-preview-cleanup.yml).
 * Runs straight under Node 24's type stripping, with nothing but Node's own modules, so CI can call it before
 * `pnpm install`:
 *
 *   node packages/preview-worker/src/deploy/cli.ts probe
 *   node packages/preview-worker/src/deploy/cli.ts deploy --pr 123 --dist packages/client/dist --lang en --sha <sha>
 *   node packages/preview-worker/src/deploy/cli.ts cleanup --pr 123
 *   node packages/preview-worker/src/deploy/cli.ts sweep --open "120 123 130"
 *
 * Reads CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Without them, or when the token may not use R2 or the bucket
 * doesn't exist yet, it prints a notice and exits 0, so CI stays green until the owner finishes the setup.
 */

import { appendFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { FILES_FILE, PREVIEW_FILE, prPrefix, SHARED_PREFIX, type PreviewInfo } from "../layout.ts";
import { distFiles, generated } from "./files.ts";
import { filesManifest, parseFilesManifest, planDeploy, planSweep, prOfFolder, type LocalFile } from "./plan.ts";
import { ApiError, R2Api, type RemoteObject } from "./r2-api.ts";

const JSON_TYPE = "application/json; charset=utf-8";
const UPLOADS_AT_ONCE = 8;

function notice(message: string): void {
  console.log(`::notice::${message}`);
}

function output(name: string, value: string): void {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function summary(line: string): void {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

function prNumber(value: string | undefined): number {
  const pr = Number(value);
  if (!Number.isInteger(pr) || pr <= 0) throw new Error(`--pr must be a pull request number (got "${value}")`);
  return pr;
}

/** Runs `task` on every item, `limit` at a time, logging every 500. */
async function pool<T>(items: readonly T[], limit: number, label: string, task: (item: T) => Promise<void>) {
  let next = 0;
  let done = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      await task(items[next++]!);
      if (++done % 500 === 0) console.log(`${label}: ${done} of ${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function bodyOf(file: LocalFile): Promise<Uint8Array> {
  return file.body ?? (await readFile(file.file!));
}

/** Every key under `pr-<n>/`, deleted. */
async function deletePr(api: R2Api, pr: number): Promise<number> {
  const keys = (await api.list(prPrefix(pr))).map((object) => object.key);
  // preview.json first, so the Worker stops serving the PR before its files go.
  const preview = `${prPrefix(pr)}${PREVIEW_FILE}`;
  if (keys.includes(preview)) await api.delete(preview);
  await pool(
    keys.filter((key) => key !== preview),
    UPLOADS_AT_ONCE,
    "Deleted",
    (key) => api.delete(key),
  );
  return keys.length;
}

async function deploy(api: R2Api, values: Record<string, string | undefined>): Promise<void> {
  const pr = prNumber(values.pr);
  const lang = values.lang || "en";
  const dist = values.dist || "packages/client/dist";
  const own = prPrefix(pr);

  const local = await distFiles(dist, pr, lang);
  const manifest = generated(`${own}${FILES_FILE}`, filesManifest(local), JSON_TYPE);
  const wanted = [...local, manifest];

  // One listing per prefix the build writes under (card art by language): about 15 calls for a full build.
  const prefixes = new Set([own, `${SHARED_PREFIX}assets/`]);
  for (const { key } of local) {
    const art = /^shared\/card-art\/[a-z]{2}\//.exec(key);
    if (art) prefixes.add(art[0]);
  }
  const remote: RemoteObject[] = [];
  for (const prefix of prefixes) remote.push(...(await api.list(prefix)));

  const plan = planDeploy(pr, wanted, remote);
  // files.json before anything else, so the sweep never deletes a shared file this build is about to rely on.
  const first = plan.uploads.filter((file) => file.key === manifest.key);
  const rest = plan.uploads.filter((file) => file.key !== manifest.key);
  for (const file of first) await api.put(file.key, await bodyOf(file), file.contentType);
  await pool(rest, UPLOADS_AT_ONCE, "Uploaded", async (file) =>
    api.put(file.key, await bodyOf(file), file.contentType),
  );
  await pool(plan.deletes, UPLOADS_AT_ONCE, "Deleted", (key) => api.delete(key));

  const info: PreviewInfo = { pr, sha: values.sha ?? "", lang, deployedAt: new Date().toISOString() };
  const preview = generated(`${own}${PREVIEW_FILE}`, `${JSON.stringify(info)}\n`, JSON_TYPE);
  await api.put(preview.key, preview.body!, preview.contentType);

  output("deployed", "true");
  const bytes = plan.uploads.reduce((sum, file) => sum + file.size, 0);
  summary(
    `Cloudflare preview of PR #${pr}: ${local.length} files, ${plan.uploads.length} uploaded ` +
      `(${(bytes / 1024 / 1024).toFixed(1)} MB), ${plan.unchanged} unchanged, ${plan.deletes.length} removed, ` +
      `${api.calls} R2 API calls.`,
  );
}

async function sweep(api: R2Api, values: Record<string, string | undefined>): Promise<void> {
  const open = new Set(
    (values.open ?? "")
      .split(/[\s,]+/)
      .filter((value) => value !== "")
      .map(prNumber),
  );
  const folders = (await api.folders("pr-")).map(prOfFolder).filter((pr): pr is number => pr !== null);
  const manifests = new Map<number, readonly string[] | null>();
  for (const pr of folders) {
    if (open.has(pr)) manifests.set(pr, parseFilesManifest(await api.getText(`${prPrefix(pr)}${FILES_FILE}`)));
  }
  const shared = await api.list(SHARED_PREFIX);
  const plan = planSweep({ folders, open, manifests, shared, now: Date.now() });
  let prFiles = 0;
  for (const pr of plan.closed) prFiles += await deletePr(api, pr);
  await pool(plan.sharedDeletes, UPLOADS_AT_ONCE, "Deleted", (key) => api.delete(key));
  const unreadable = [...manifests].filter(([, keys]) => keys === null).map(([pr]) => `#${pr}`);
  summary(
    `Preview sweep: ${plan.closed.length} closed pull requests' previews deleted (${prFiles} files` +
      `${plan.closed.length ? `: ${plan.closed.map((pr) => `#${pr}`).join(", ")}` : ""}), ` +
      `${plan.sharedDeletes.length} of ${shared.length} shared files no open preview uses deleted, ${api.calls} R2 API calls.` +
      (unreadable.length ? ` Shared files kept: unreadable files.json for ${unreadable.join(", ")}.` : ""),
  );
}

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      pr: { type: "string" },
      dist: { type: "string" },
      lang: { type: "string" },
      sha: { type: "string" },
      open: { type: "string" },
      bucket: { type: "string" },
    },
  });
  const command = positionals[0];
  if (!["probe", "deploy", "cleanup", "sweep"].includes(command ?? "")) {
    console.error(
      "usage: cli.ts probe | deploy --pr <n> --dist <dir> --lang <lang> --sha <sha> | cleanup --pr <n> | sweep --open <numbers>",
    );
    return 2;
  }
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const bucket = values.bucket || process.env.PREVIEW_BUCKET || "mc-previews";
  if (!token || !accountId) {
    notice("No Cloudflare secrets yet; skipping the Cloudflare preview.");
    output("ready", "false");
    return 0;
  }
  // CLOUDFLARE_API_BASE_URL points it at a fake API for a local dry run.
  const baseUrl = process.env.CLOUDFLARE_API_BASE_URL;
  const api = new R2Api({ accountId, token, bucket, ...(baseUrl ? { baseUrl } : {}) });
  try {
    if (command === "probe") {
      await api.folders("pr-");
      output("ready", "true");
    } else if (command === "deploy") {
      await deploy(api, values);
    } else if (command === "cleanup") {
      const pr = prNumber(values.pr);
      summary(`Deleted the Cloudflare preview of PR #${pr} (${await deletePr(api, pr)} files).`);
    } else {
      await sweep(api, values);
    }
    return 0;
  } catch (error) {
    if (error instanceof ApiError && (error.isPermission || error.isMissingBucket)) {
      notice(
        error.isMissingBucket
          ? `The R2 bucket "${bucket}" doesn't exist yet; skipping the Cloudflare preview (CONTRIBUTING.md).`
          : `The Cloudflare token may not use the R2 bucket "${bucket}"; skipping the Cloudflare preview (CONTRIBUTING.md). ${error.message}`,
      );
      output("ready", "false");
      return 0;
    }
    throw error;
  }
}

process.exitCode = await main();
