import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { SCHEMA_VERSION } from "./index.js";

const changie = readFileSync(new URL("../../../.changie.yaml", import.meta.url), "utf8");

describe("SCHEMA_VERSION", () => {
  test("no release replacement in .changie.yaml rewrites it", () => {
    // It versions the card-data shape, not the release: a replacement would bump it on every release (#1024 review).
    expect(changie).not.toMatch(/SCHEMA_VERSION/);
  });

  test("is a semver string", () => {
    expect(SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
