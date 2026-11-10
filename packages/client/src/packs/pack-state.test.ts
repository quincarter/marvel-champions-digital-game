import { describe, expect, it } from "vitest";
import { formatBytes, packStateOf, satisfiesApp } from "./pack-state.js";
import { buildPack } from "./test-zip.js";

const base = buildPack().entry;
const withVersion = (patch: object, entryPatch: object = {}) => ({
  ...base,
  ...entryPatch,
  versions: { "1.0.0": { ...base.versions["1.0.0"]!, ...patch } },
});
const input = (entry = base, installed?: { version: string; withdrawn: boolean }) => ({
  entry,
  installed,
  appVersion: "0.50.0",
  supportedDslFeatures: ["a", "b"],
});

describe("packStateOf", () => {
  it("offers install, then shows installed", () => {
    expect(packStateOf(input()).state).toBe("install");
    expect(packStateOf(input(base, { version: "1.0.0", withdrawn: false })).state).toBe("installed");
  });

  it("offers an update when the catalog is newer", () => {
    const entry = {
      ...base,
      latest: "1.1.0",
      versions: { "1.1.0": { ...base.versions["1.0.0"]! } },
    };
    expect(packStateOf(input(entry, { version: "1.0.0", withdrawn: false })).state).toBe("update");
  });

  it("needs an app update when the app or DSL features fall short", () => {
    const tooNew = packStateOf(input(withVersion({ requires: { app: ">=9.0.0" } })));
    expect(tooNew).toMatchObject({ state: "needs-app-update", reason: "Needs app >=9.0.0" });
    const feature = packStateOf(input(withVersion({ requires: { app: ">=0.1.0", dslFeatures: ["a", "zzz"] } })));
    expect(feature.state).toBe("needs-app-update");
    expect(feature.reason).toContain("zzz");
    const ok = packStateOf(input(withVersion({ requires: { app: ">=0.1.0", dslFeatures: ["a"] } })));
    expect(ok.state).toBe("install");
  });

  it("an update the app cannot load is needs-app-update, and an installed old version stays installed otherwise", () => {
    const entry = {
      ...base,
      latest: "1.1.0",
      versions: { "1.1.0": { ...base.versions["1.0.0"]!, requires: { app: ">=9.0.0" } } },
    };
    expect(packStateOf(input(entry, { version: "1.0.0", withdrawn: false })).state).toBe("needs-app-update");
  });

  it("labels withdrawn packs, installed or not", () => {
    const entry = { ...base, withdrawn: true };
    expect(packStateOf(input(entry)).state).toBe("withdrawn");
    expect(packStateOf(input(entry, { version: "1.0.0", withdrawn: false })).state).toBe("withdrawn");
    expect(packStateOf(input(base, { version: "1.0.0", withdrawn: true })).state).toBe("withdrawn");
  });

  it("formats the size of the zip", () => {
    const view = packStateOf(input(withVersion({ zipBytes: 3 * 1024 * 1024 })));
    expect(view.size).toBe("3.0 MB");
  });
});

describe("formatBytes and satisfiesApp", () => {
  it("formats bytes", () => {
    expect(formatBytes(12)).toBe("12 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(15 * 1024 * 1024)).toBe("15 MB");
  });

  it("checks ranges", () => {
    expect(satisfiesApp(">=0.40.0", "0.50.0")).toBe(true);
    expect(satisfiesApp(">=0.40.0", "0.39.9")).toBe(false);
    expect(satisfiesApp("^1.2.0", "1.9.0")).toBe(true);
    expect(satisfiesApp("^1.2.0", "2.0.0")).toBe(false);
    expect(satisfiesApp("^0.2.0", "0.2.5")).toBe(true);
    expect(satisfiesApp("^0.2.0", "0.3.0")).toBe(false);
    expect(satisfiesApp("~1.2.0", "1.2.9")).toBe(true);
    expect(satisfiesApp("~1.2.0", "1.3.0")).toBe(false);
    expect(satisfiesApp(">=1.0.0 <2.0.0", "1.5.0")).toBe(true);
    expect(satisfiesApp(">=1.0.0 <2.0.0", "2.0.0")).toBe(false);
    expect(satisfiesApp("*", "0.0.1")).toBe(true);
  });
});

describe("pack kinds this game can't play yet", () => {
  const entryOf = (kind: "scenario" | "modular" | "campaign") => {
    const entry = {
      id: "fan-pack",
      kind,
      name: "Fan Pack",
      creator: "x",
      summary: "",
      tags: [],
      approved: "2026-11-10",
      latest: "1.0.0",
      versions: {
        "1.0.0": {
          manifest: "m",
          base: "b",
          zip: "z",
          zipBytes: 10,
          zipSha256: "0".repeat(64),
          requires: { app: ">=0.1.0" },
        },
      },
      withdrawn: false,
    };
    return packStateOf({ entry, appVersion: "1.0.0", supportedDslFeatures: [] });
  };

  it("offers scenario and modular packs for install: the pickers list their scenarios and sets", () => {
    expect(entryOf("scenario").state).toBe("install");
    expect(entryOf("modular").state).toBe("install");
  });

  it("offers a campaign pack for install: the Saga shelf lists its campaigns under Custom campaigns", () => {
    expect(entryOf("campaign").state).toBe("install");
  });
});
