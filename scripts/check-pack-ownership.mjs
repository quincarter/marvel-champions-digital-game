#!/usr/bin/env node
/**
 * Fails when the Mod Store's index.json lists one of the given pack ids under another publisher than this repo
 * (docs/custom-content-packs.md §11.5: a pack id has one publisher, `source` "game" or "registry"). The
 * publish-packs workflow runs it before it builds or uploads anything; scripts/lib/pack-index.mjs has the rule.
 *
 * Usage: node scripts/check-pack-ownership.mjs <current index.json> <pack id> [<pack id>…]
 *   current   the index.json now published; a missing file means there is no catalog yet, so nothing conflicts
 */
import fs from "node:fs/promises";
import { PACK_INDEX_SCHEMA, ownershipConflicts, ownershipMessage } from "./lib/pack-index.mjs";

const [currentPath, ...ids] = process.argv.slice(2);
if (!currentPath) {
  console.error("Usage: node scripts/check-pack-ownership.mjs <current index.json> <pack id> [<pack id>…]");
  process.exit(2);
}
let current;
try {
  current = JSON.parse(await fs.readFile(currentPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (current !== undefined && (current?.schema !== PACK_INDEX_SCHEMA || !Array.isArray(current.packs))) {
  console.error(`::error::${currentPath} is not a schema ${PACK_INDEX_SCHEMA} index.json`);
  process.exit(1);
}
const conflicts = ownershipConflicts(current, ids);
for (const conflict of conflicts) console.error(`::error::${ownershipMessage(conflict)}`);
if (conflicts.length > 0) process.exit(1);
console.log(
  current === undefined
    ? "No index.json yet: no pack id is taken."
    : `None of ${ids.length} pack id(s) is published by another source.`,
);
