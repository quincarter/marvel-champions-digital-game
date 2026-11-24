import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";

/**
 * Vitest global setup (vitest.config.ts): one scratch folder per run for the community pack builds
 * (./community-pack.ts), handed to every worker, and removed when the run ends. Nothing is built here: a pack is built
 * the first time a test file asks for it, so a run that touches no community pack pays nothing.
 */
export default function setup(project: TestProject): () => void {
  const root = mkdtempSync(join(tmpdir(), "mc-community-builds-"));
  project.provide("communityPackBuilds", root);
  return () => rmSync(root, { recursive: true, force: true });
}
