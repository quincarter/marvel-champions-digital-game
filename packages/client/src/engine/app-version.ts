/**
 * App versions as device sync meets them (#276): devices routinely run different builds (the web updates at once, the
 * desktop and Android shells lag), so a build has to tell "written by a build newer than me" from the rest.
 *
 * A small semver comparison, no dependency: `major.minor.patch` numbers compared in turn, a pre-release
 * (`1.2.0-beta.1`) before its release, build metadata (`+abc`) ignored. A version that does not parse is never "newer"
 * than anything: an unknown writer is treated as compatible rather than locking the player out of a game.
 */

interface Parsed {
  readonly core: readonly [number, number, number];
  readonly pre: readonly (string | number)[];
}

const SEMVER = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function parse(version: string): Parsed | null {
  const match = SEMVER.exec(version.trim());
  if (!match) return null;
  const pre = (match[4] ?? "").split(".").filter((part) => part !== "");
  return {
    core: [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)],
    pre: pre.map((part) => (/^\d+$/.test(part) ? Number(part) : part)),
  };
}

/** -1, 0 or 1 as `a` is older than, the same as or newer than `b`; null when either does not parse. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 | null {
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i++) {
    if (left.core[i]! !== right.core[i]!) return left.core[i]! < right.core[i]! ? -1 : 1;
  }
  // A release outranks its own pre-releases; between pre-releases, identifier by identifier (numbers before words).
  if (left.pre.length === 0 || right.pre.length === 0) {
    return left.pre.length === right.pre.length ? 0 : left.pre.length === 0 ? 1 : -1;
  }
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
    const x = left.pre[i];
    const y = right.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x < y ? -1 : 1;
    if (typeof x === "number") return -1;
    if (typeof y === "number") return 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

/** Whether `version` is strictly newer than `than`; false when either is missing or does not parse. */
export function isNewerVersion(version: string | undefined | null, than: string): boolean {
  return typeof version === "string" && compareVersions(version, than) === 1;
}
