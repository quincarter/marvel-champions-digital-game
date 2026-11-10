import {
  filesManifest,
  parseFilesManifest,
  planDeploy,
  planSweep,
  prOfFolder,
  SWEEP_GRACE_MS,
  type LocalFile,
} from "./plan.ts";
import type { RemoteObject } from "./r2-api.ts";

function local(key: string, md5 = `md5-${key}`, size = 10): LocalFile {
  return { key, md5, size, contentType: "text/plain", file: `/dist/${key}` };
}

function remote(key: string, etag = `md5-${key}`, size = 10, lastModified = 0): RemoteObject {
  return { key, etag, size, lastModified };
}

describe("planDeploy", () => {
  it("uploads only what is missing or changed", () => {
    const plan = planDeploy(
      5,
      [local("pr-5/index.html", "new"), local("shared/assets/a-AAAAAAAA.js"), local("shared/card-art/en/x.png")],
      [remote("pr-5/index.html", "old"), remote("shared/assets/a-AAAAAAAA.js"), remote("shared/card-art/en/x.png")],
    );
    expect(plan.uploads.map((file) => file.key)).toEqual(["pr-5/index.html"]);
    expect(plan.unchanged).toBe(2);
  });

  it("uploads a file whose size differs even with the same etag", () => {
    const plan = planDeploy(5, [local("pr-5/a", "same", 3)], [remote("pr-5/a", "same", 4)]);
    expect(plan.uploads).toHaveLength(1);
  });

  it("removes the PR's dropped files but never shared ones or its own metadata", () => {
    const plan = planDeploy(
      5,
      [local("pr-5/index.html")],
      [
        remote("pr-5/index.html"),
        remote("pr-5/old.html"),
        remote("pr-5/preview.json"),
        remote("pr-5/files.json"),
        remote("pr-50/index.html"),
        remote("shared/assets/old-AAAAAAAA.js"),
      ],
    );
    expect(plan.deletes).toEqual(["pr-5/old.html"]);
  });

  it("uploads a key once when two files map to it", () => {
    const plan = planDeploy(5, [local("pr-5/a"), local("pr-5/a")], []);
    expect(plan.uploads).toHaveLength(1);
  });
});

describe("files.json", () => {
  it("lists the shared keys, sorted and unique", () => {
    const text = filesManifest([
      local("shared/card-art/en/b.png"),
      local("pr-5/index.html"),
      local("shared/assets/a-AAAAAAAA.js"),
      local("shared/assets/a-AAAAAAAA.js"),
    ]);
    expect(parseFilesManifest(text)).toEqual(["shared/assets/a-AAAAAAAA.js", "shared/card-art/en/b.png"]);
  });

  it("reads a missing or malformed list as null", () => {
    expect(parseFilesManifest(null)).toBeNull();
    expect(parseFilesManifest("{")).toBeNull();
    expect(parseFilesManifest('{"shared":[1]}')).toBeNull();
  });
});

describe("planSweep", () => {
  const now = 10 * SWEEP_GRACE_MS;
  const old = now - SWEEP_GRACE_MS;

  it("deletes closed PRs' folders and shared files no open PR uses", () => {
    const plan = planSweep({
      folders: [3, 5, 9],
      open: new Set([5, 7]),
      manifests: new Map([[5, ["shared/assets/a-AAAAAAAA.js"]]]),
      shared: [remote("shared/assets/a-AAAAAAAA.js", "x", 1, old), remote("shared/assets/b-BBBBBBBB.js", "x", 1, old)],
      now,
    });
    expect(plan.closed).toEqual([3, 9]);
    expect(plan.sharedDeletes).toEqual(["shared/assets/b-BBBBBBBB.js"]);
  });

  it("keeps shared files uploaded within the grace period", () => {
    const plan = planSweep({
      folders: [],
      open: new Set(),
      manifests: new Map(),
      shared: [remote("shared/assets/new-AAAAAAAA.js", "x", 1, now - 1000)],
      now,
    });
    expect(plan.sharedDeletes).toEqual([]);
  });

  it("deletes no shared file while an open preview's list can't be read", () => {
    const plan = planSweep({
      folders: [5, 6],
      open: new Set([5, 6]),
      manifests: new Map<number, readonly string[] | null>([
        [5, []],
        [6, null],
      ]),
      shared: [remote("shared/assets/b-BBBBBBBB.js", "x", 1, old)],
      now,
    });
    expect(plan.sharedDeletes).toEqual([]);
  });

  it("deletes every shared file once no PR is open", () => {
    const plan = planSweep({
      folders: [4],
      open: new Set(),
      manifests: new Map(),
      shared: [remote("shared/card-art/en/x.png", "x", 1, old)],
      now,
    });
    expect(plan).toEqual({ closed: [4], sharedDeletes: ["shared/card-art/en/x.png"] });
  });
});

describe("prOfFolder", () => {
  it("reads pr-<n>/ folders only", () => {
    expect(prOfFolder("pr-12/")).toBe(12);
    expect(prOfFolder("pr-12")).toBeNull();
    expect(prOfFolder("pr-x/")).toBeNull();
    expect(prOfFolder("shared/")).toBeNull();
  });
});
