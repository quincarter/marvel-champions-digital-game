// Moves the README's version badge, its release link and its download buttons (the links and the version on each
// .github/assets/readme/download-*.svg) to a release. readme-downloads.yml runs it once that release is published with
// its installers: the release PR used to make this change through changie's replacements, so the buttons pointed at
// files that wouldn't exist for most of an hour (#789).

/** The SVG download buttons, each showing the version it fetches. */
export const BUTTON_SVGS = [
  "download-windows",
  "download-macos-apple-silicon",
  "download-macos-intel",
  "download-linux",
  "download-android",
  "download-windows-es",
  "download-macos-apple-silicon-es",
  "download-macos-intel-es",
  "download-linux-es",
  "download-android-es",
].map((name) => `.github/assets/readme/${name}.svg`);

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;

/** `v1.2.3` or `1.2.3` as `v1.2.3`; throws on anything else (a prerelease never goes on the README). */
export function normalizeTag(tag) {
  const match = SEMVER.exec(String(tag).trim());
  if (!match) throw new Error(`${tag} is not a release version (vX.Y.Z).`);
  return `v${match[1]}.${match[2]}.${match[3]}`;
}

/** Negative, zero or positive as `a` is older than, the same as or newer than `b`. */
export function compareVersions(a, b) {
  const [x, y] = [normalizeTag(a), normalizeTag(b)].map((tag) => SEMVER.exec(tag).slice(1).map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** The version the README's badge shows, or null when it has none. */
export function readmeVersion(readme) {
  const match = /badge\/version-(v\d+\.\d+\.\d+)-/.exec(readme);
  return match ? match[1] : null;
}

/** The README pointed at `tag`: the same rewrites the release PR's changie replacements used to make. */
export function bumpReadme(readme, tag) {
  const version = normalizeTag(tag);
  const bare = version.slice(1);
  return (
    readme
      .replace(/badge\/version-v\d+\.\d+\.\d+-/g, `badge/version-${version}-`)
      .replace(/releases\/tag\/v\d+\.\d+\.\d+\)/g, `releases/tag/${version})`)
      // The top buttons are the English downloads; names carry `-EN-` from the first release with Spanish builds
      // (#337). The OS has to follow, so the Spanish buttons' `-ES-` names don't match here.
      .replace(
        /releases\/download\/v\d+\.\d+\.\d+\/MarvelChampions-\d+\.\d+\.\d+-(EN-)?(Windows|macOS|Linux|Android)/g,
        `releases/download/${version}/MarvelChampions-${bare}-EN-$2`,
      )
      // The Spanish buttons, in the README's folded Spanish installs section.
      .replace(
        /releases\/download\/v\d+\.\d+\.\d+\/MarvelChampions-\d+\.\d+\.\d+-ES-/g,
        `releases/download/${version}/MarvelChampions-${bare}-ES-`,
      )
  );
}

/** A download button's SVG showing `tag`. */
export function bumpButton(svg, tag) {
  return svg.replace(/v\d+\.\d+\.\d+/g, normalizeTag(tag));
}

/** The file names the README downloads from `tag`'s release, in order and without repeats. */
export function linkedAssets(readme, tag) {
  const version = normalizeTag(tag).replace(/\./g, "\\.");
  const links = new RegExp(`releases/download/${version}/([^)"'\\s]+)`, "g");
  return [...new Set([...readme.matchAll(links)].map((match) => decodeURIComponent(match[1])))];
}

/** Why `release` isn't public as a full release yet: a draft or a prerelease never goes on the README. */
export function publicationProblems(release) {
  const problems = [];
  if (release.isDraft) problems.push(`${release.tagName} is still a draft.`);
  if (release.isPrerelease) problems.push(`${release.tagName} is a prerelease.`);
  return problems;
}

/**
 * Why the README can't point at `release` yet (`gh release view --json tagName,isDraft,isPrerelease,assets`), or an
 * empty list when it can: the release has to be public and carry every file the bumped README links to.
 */
export function releaseProblems(release, bumpedReadme) {
  const problems = publicationProblems(release);
  const uploaded = new Set((release.assets ?? []).map((asset) => asset.name));
  const missing = linkedAssets(bumpedReadme, release.tagName).filter((name) => !uploaded.has(name));
  if (missing.length > 0) problems.push(`${release.tagName} has no ${missing.join(", ")}.`);
  return problems;
}

/**
 * Why the README should stay as it is for `tag`, or null when it should move. The README follows GitHub's latest
 * release only (`latest`), and never moves back: not while main (`current`) or the open README pull request
 * (`pending`) already shows that version or a newer one. A hand-published or retried older release is skipped, not
 * an error.
 */
export function skipReason({ tag, latest, current, pending }) {
  const version = normalizeTag(tag);
  if (!latest) return `GitHub has no latest release, so ${version} can't be confirmed as latest.`;
  if (compareVersions(latest, version) !== 0) return `${version} is not GitHub's latest release (${latest} is).`;
  for (const [where, shown] of [
    ["The README", current],
    ["The open README pull request", pending],
  ]) {
    if (shown && compareVersions(shown, version) >= 0) return `${where} already shows ${shown}.`;
  }
  return null;
}
