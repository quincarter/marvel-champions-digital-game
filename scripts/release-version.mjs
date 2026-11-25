#!/usr/bin/env node
// node scripts/release-version.mjs keep <open release PR version> <auto version> <last released tag>
// Exits 0 when the release PR should stay at the open PR's version (scripts/lib/release-version.mjs), 1 when it
// should take the auto version, 2 on bad input.
import { keepOpenVersion } from "./lib/release-version.mjs";

const [command, open, auto, released] = process.argv.slice(2);
if (command !== "keep" || !auto || !released) {
  console.error("Usage: node scripts/release-version.mjs keep <open> <auto> <released>");
  process.exit(2);
}
try {
  process.exit(keepOpenVersion({ open, auto, released }) ? 0 : 1);
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
