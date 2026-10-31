import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  buildReleaseHistory,
  compareVersions,
  inlineHtml,
  parseChangelog,
  parseHeader,
  REPO_URL,
  type ReleaseHighlight,
} from "./release-history-notes.js";

const CHANGELOG = `## [v0.33.0] - 2026-10-21
### Fixed
* One fix (#326).
* Another fix
  that wraps.
### Added
* A new thing
### Docs
`;

describe("parseChangelog", () => {
  test("reads the version, the date and each section, dropping an empty one", () => {
    expect(parseChangelog(CHANGELOG)).toEqual({
      version: "v0.33.0",
      date: "2026-10-21",
      sections: [
        { kind: "Fixed", items: ["One fix (#326).", "Another fix that wraps."] },
        { kind: "Added", items: ["A new thing"] },
      ],
    });
  });

  test("takes the dash bullets of the first changelogs", () => {
    const parsed = parseChangelog("## [v0.1.0] - 2026-09-21\n\n### Added\n\n- First\n- Second\n");
    expect(parsed.sections).toEqual([{ kind: "Added", items: ["First", "Second"] }]);
  });
});

describe("parseHeader", () => {
  test("takes the heading, the first paragraph and the images", () => {
    const header = "## Big news\n\nIt is here.\n\n**[Read it](https://x.test)**\n\n![A shot](https://x.test/a.jpg)\n";
    expect(parseHeader(header)).toEqual({
      title: "Big news",
      summary: "It is here.",
      images: [{ alt: "A shot", src: "https://x.test/a.jpg" }],
    });
  });

  test("a header with no heading gives nothing", () => expect(parseHeader("Just text")).toBeNull());
});

describe("inlineHtml", () => {
  test("escapes first, then links issues and handles", () => {
    expect(inlineHtml("Fix <b> by @zackburnley (#326)")).toBe(
      `Fix &lt;b&gt; by <a href="https://github.com/zackburnley">@zackburnley</a> (<a href="${REPO_URL}/issues/326">#326</a>)`,
    );
  });

  test("code stays literal, and a scoped package is not a person", () => {
    expect(inlineHtml("`#12` in @mc/client")).toBe("<code>#12</code> in @mc/client");
  });

  test("code inside a link", () => {
    expect(inlineHtml("[`x`](https://x.test)")).toBe('<a href="https://x.test"><code>x</code></a>');
  });

  test("bold and links", () => {
    expect(inlineHtml("**New** [site](https://x.test/#1)")).toBe('<b>New</b> <a href="https://x.test/#1">site</a>');
  });
});

describe("buildReleaseHistory", () => {
  const backfill: Record<string, ReleaseHighlight> = {
    "v0.33.0": { title: "Backfilled", summary: "Old words" },
  };

  test("a release's own header beats the backfill", () => {
    const { manifest } = buildReleaseHistory({
      changelogs: [CHANGELOG],
      backfill,
      headers: { "v0.33.0": "## From the header\n\nWords\n" },
      reports: new Set(),
    });
    expect(manifest[0]!.title).toBe("From the header");
  });

  test("sections read in a fixed order, with the long technical ones folded", () => {
    const changelog = "## [v0.2.0] - 2026-09-21\n### Engine\n* E\n### Fixed\n* F\n### Added\n* A\n";
    const [notes] = buildReleaseHistory({ changelogs: [changelog], backfill, headers: {}, reports: new Set() }).notes;
    expect(notes!.sections.map((s) => [s.kind, s.open])).toEqual([
      ["Added", true],
      ["Fixed", true],
      ["Engine", false],
    ]);
  });

  test("a new release with no headline yet still gets a page", () => {
    const [entry] = buildReleaseHistory({
      changelogs: ["## [v9.0.0] - 2027-01-01\n### Added\n* Something new\n"],
      backfill,
      headers: {},
      reports: new Set(),
    }).notes;
    expect(entry).toMatchObject({ title: "Release v9.0.0", summaryHtml: "Something new" });
  });

  test("a tag with no GitHub release links to its source", () => {
    const [entry] = buildReleaseHistory({
      changelogs: ["## [v0.5.1] - 2026-09-24\n### Fixed\n* F\n"],
      backfill: { "v0.5.1": { title: "T", summary: "S", noGithubRelease: true } },
      headers: {},
      reports: new Set(),
    }).notes;
    expect(entry!.linkUrl).toBe(`${REPO_URL}/tree/v0.5.1`);
  });

  test("versions sort as numbers, newest first", () => {
    expect(["v0.9.0", "v0.40.0", "v0.10.1", "v0.10.0"].sort(compareVersions)).toEqual([
      "v0.40.0",
      "v0.10.1",
      "v0.10.0",
      "v0.9.0",
    ]);
  });
});

describe("the repo's own releases", () => {
  const changes = new URL("../../../../.changes/", import.meta.url);
  const versions = readdirSync(changes)
    .filter((name) => /^v[\d.]+\.md$/.test(name))
    .map((name) => name.replace(/\.md$/, ""));
  const backfill = JSON.parse(
    readFileSync(new URL("../../../../docs/releases/history.json", import.meta.url), "utf8"),
  ) as Record<string, ReleaseHighlight>;

  test("every changelog parses, and every written headline belongs to a release", () => {
    for (const version of versions) {
      const parsed = parseChangelog(readFileSync(new URL(`${version}.md`, changes), "utf8"));
      expect(parsed.version).toBe(version);
      expect(parsed.sections.length, version).toBeGreaterThan(0);
    }
    expect(Object.keys(backfill).filter((version) => !versions.includes(version))).toEqual([]);
  });

  test("every release up to v0.38.1 has a headline written for it", () => {
    const old = versions.filter((version) => compareVersions(version, "v0.38.1") >= 0);
    expect(old.filter((version) => !backfill[version])).toEqual([]);
  });
});
