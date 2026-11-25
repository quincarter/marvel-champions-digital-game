import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareVersions, keepOpenVersion } from "./release-version.mjs";

describe("the release PR's version", () => {
  it("keeps a major bump picked by hand when a later merge regenerates the PR", () => {
    assert.equal(keepOpenVersion({ open: "v1.0.0", auto: "v0.56.0", released: "v0.55.0" }), true);
  });

  it("takes the auto version when it is the same or higher", () => {
    assert.equal(keepOpenVersion({ open: "v0.56.0", auto: "v0.56.0", released: "v0.55.0" }), false);
    assert.equal(keepOpenVersion({ open: "v0.55.1", auto: "v0.56.0", released: "v0.55.0" }), false);
  });

  it("never keeps a version that is already released", () => {
    assert.equal(keepOpenVersion({ open: "v1.0.0", auto: "v0.56.0", released: "v1.0.0" }), false);
  });

  it("takes the auto version when no release PR is open", () => {
    assert.equal(keepOpenVersion({ open: "", auto: "v0.56.0", released: "v0.55.0" }), false);
  });

  it("orders versions numerically, with or without a v", () => {
    assert.ok(compareVersions("v0.10.0", "v0.9.9") > 0);
    assert.equal(compareVersions("1.0.0", "v1.0.0"), 0);
  });
});
