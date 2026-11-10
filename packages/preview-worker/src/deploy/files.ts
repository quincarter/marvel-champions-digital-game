/** The client build's `dist/` as the files a preview deploy wants in the bucket. */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { contentTypeOf, keyFor, sniffImageType } from "../layout.ts";
import type { LocalFile } from "./plan.ts";

/** Every file under `dir`, as `/`-separated paths relative to it, sorted. */
export async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
    .sort();
}

export function md5Of(bytes: Uint8Array): string {
  return createHash("md5").update(bytes).digest("hex");
}

async function md5OfFile(file: string): Promise<string> {
  const hash = createHash("md5");
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

/** The type to store: sniffed for images (scans are WebP under `.png` names), else from the extension. */
async function contentTypeOfFile(file: string, relative: string): Promise<string> {
  const byName = contentTypeOf(relative);
  if (!byName.startsWith("image/") || byName === "image/svg+xml") return byName;
  const handle = await open(file, "r");
  try {
    const head = new Uint8Array(16);
    const { bytesRead } = await handle.read(head, 0, 16, 0);
    return sniffImageType(head.subarray(0, bytesRead)) ?? byName;
  } finally {
    await handle.close();
  }
}

/** `dist/`'s files with their bucket keys, MD5s and types. Runs `concurrency` files at a time. */
export async function distFiles(dist: string, pr: number, lang: string, concurrency = 16): Promise<LocalFile[]> {
  const paths = await walk(dist);
  const files: LocalFile[] = Array.from({ length: paths.length });
  let next = 0;
  async function worker(): Promise<void> {
    while (next < paths.length) {
      const index = next++;
      const relative = paths[index]!;
      const key = keyFor(relative, pr, lang);
      if (key === null) throw new Error(`dist/${relative} has no bucket key`);
      const file = path.join(dist, relative);
      const [md5, info, contentType] = await Promise.all([
        md5OfFile(file),
        stat(file),
        contentTypeOfFile(file, relative),
      ]);
      files[index] = { key, md5, size: info.size, contentType, file };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, paths.length) }, worker));
  return files;
}

/** A file the deploy writes itself. */
export function generated(key: string, text: string, contentType: string): LocalFile {
  const body = new TextEncoder().encode(text);
  return { key, md5: md5Of(body), size: body.byteLength, contentType, body };
}
