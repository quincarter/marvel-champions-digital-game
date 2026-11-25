// Which version the release PR is prepared at (release-on-merge.yml). A bump picked by hand on a manual run (such as
// bump=major for v1.0.0) has to survive the merges that follow it: each one regenerates the release PR with `auto`,
// which would otherwise drop it back to the next minor or patch.

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;

function parts(tag) {
  const match = SEMVER.exec(String(tag).trim());
  if (!match) throw new Error(`${tag} is not a release version (vX.Y.Z).`);
  return match.slice(1).map(Number);
}

/** Negative, zero or positive as `a` is older than, the same as or newer than `b`. */
export function compareVersions(a, b) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/**
 * Whether to keep the open release PR's version (`open`) instead of the one `changie next auto` gives (`auto`): only
 * when it is higher than `auto`, so it was picked by hand, and still unreleased, newer than the last tag (`released`).
 */
export function keepOpenVersion({ open, auto, released }) {
  if (!open) return false;
  return compareVersions(open, auto) > 0 && compareVersions(open, released) > 0;
}
