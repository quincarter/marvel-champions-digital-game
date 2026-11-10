/**
 * What the store screen shows for one catalog pack (docs/custom-content-packs.md §11.6). Pure: the catalog entry, the
 * installed record, the app's version and the client's DSL feature list in, one state and a size string out.
 */
import type { PackIndexEntry, PackIndexVersion } from "@mc/content";
import { compareVersions } from "../engine/app-version.js";
import type { InstalledPack } from "./pack-store.js";

export type PackState = "install" | "installed" | "update" | "needs-app-update" | "withdrawn";

export interface PackStateInput {
  readonly entry: PackIndexEntry;
  readonly installed?: Pick<InstalledPack, "version" | "withdrawn"> | undefined;
  readonly appVersion: string;
  readonly supportedDslFeatures: readonly string[];
}

export interface PackStateView {
  readonly state: PackState;
  /** The catalog version the action would install (the latest). */
  readonly version: string;
  readonly size: string;
  readonly sizeBytes: number;
  /** For `needs-app-update`: why, in a short line. */
  readonly reason?: string;
}

/** `1.4 MB`, `820 KB`, `12 B`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

function core(version: string): number[] {
  return version
    .replace(/^v/, "")
    .split(/[-+]/)[0]!
    .split(".")
    .map((n) => Number(n) || 0);
}

/**
 * Whether `version` satisfies a range. Supported: comparators `>= > <= < =`, caret `^`, tilde `~`, a bare version (equal),
 * `*`, a space after the operator (`>= 0.40.0`), and space-separated ANDs. Not supported: `||`, x-ranges, hyphen ranges.
 */
export function satisfiesApp(range: string, version: string): boolean {
  const parts = range
    .trim()
    .replace(/(>=|<=|>|<|=|\^|~)\s+/g, "$1")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0 || range.trim() === "*") return true;
  return parts.every((part) => {
    const match = /^(>=|<=|>|<|=|\^|~)?(.+)$/.exec(part);
    if (!match) return false;
    const op = match[1] ?? "=";
    const target = match[2]!;
    const cmp = compareVersions(version, target);
    if (cmp === null) return false;
    switch (op) {
      case ">=":
        return cmp >= 0;
      case ">":
        return cmp > 0;
      case "<=":
        return cmp <= 0;
      case "<":
        return cmp < 0;
      case "=":
        return cmp === 0;
      case "^":
      case "~": {
        if (cmp < 0) return false;
        const t = core(target);
        const v = core(version);
        if (op === "~") return v[0] === t[0] && (v[1] ?? 0) === (t[1] ?? 0);
        if ((t[0] ?? 0) > 0) return v[0] === t[0];
        if ((t[1] ?? 0) > 0) return v[0] === 0 && v[1] === t[1];
        return v[0] === 0 && v[1] === 0 && (v[2] ?? 0) === (t[2] ?? 0);
      }
      default:
        return false;
    }
  });
}

/** Why this client cannot load `version` of a pack, or undefined when it can. */
export function unmetRequirement(
  version: PackIndexVersion,
  appVersion: string,
  supportedDslFeatures: readonly string[],
): string | undefined {
  if (!satisfiesApp(version.requires.app, appVersion)) return `Needs app ${version.requires.app}`;
  const missing = (version.requires.dslFeatures ?? []).filter((f) => !supportedDslFeatures.includes(f));
  if (missing.length > 0) return `Needs newer app features: ${missing.join(", ")}`;
  return undefined;
}

/**
 * The pack kinds this client can put into a game. Scenario and modular packs list their scenarios and sets in the
 * scenario and modular pickers; a campaign pack validates but no campaign flow plays it yet, so it is refused rather than
 * installed and silently unplayable.
 */
export const PLAYABLE_PACK_KINDS: readonly string[] = ["hero", "art", "scenario", "modular"];

export function packStateOf(input: PackStateInput): PackStateView {
  const { entry, installed } = input;
  const latest = entry.versions[entry.latest];
  const sizeBytes = latest?.zipBytes ?? 0;
  const base = { version: entry.latest, size: formatBytes(sizeBytes), sizeBytes };
  // An installed pack keeps working whatever the catalog says; a withdrawn one is only labelled.
  if (installed) {
    if (entry.withdrawn || installed.withdrawn) return { ...base, state: "withdrawn" };
    if (latest && compareVersions(entry.latest, installed.version) === 1) {
      const reason = unmetRequirement(latest, input.appVersion, input.supportedDslFeatures);
      return reason ? { ...base, state: "needs-app-update", reason } : { ...base, state: "update" };
    }
    return { ...base, state: "installed" };
  }
  if (entry.withdrawn) return { ...base, state: "withdrawn" };
  if (!PLAYABLE_PACK_KINDS.includes(entry.kind))
    return { ...base, state: "needs-app-update", reason: `This game can't play ${entry.kind} packs yet` };
  if (!latest) return { ...base, state: "needs-app-update", reason: "No downloadable version" };
  const reason = unmetRequirement(latest, input.appVersion, input.supportedDslFeatures);
  return reason ? { ...base, state: "needs-app-update", reason } : { ...base, state: "install" };
}
