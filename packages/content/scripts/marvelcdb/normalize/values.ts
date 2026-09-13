/** Small conversions from MarvelCDB field values to schema values, shared by the card-type modules. */
import type { CoreAspect, ErrataStatus, ResourceIconCounts, ScalingValue, SchemeIcon } from "../../../src/schema/index.ts";
import type { Errata } from "../curation/types.ts";
import type { RawCard } from "../raw-types.ts";

export const ROMAN: Readonly<Record<string, number>> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
export const CORE_ASPECTS: readonly CoreAspect[] = ["aggression", "justice", "leadership", "protection", "basic", "pool"];
export const PLAYER_TYPES = new Set(["ally", "event", "support", "upgrade", "resource", "player_side_scheme"]);

export const scalingOf = (value: number, perPlayer: boolean): ScalingValue =>
  perPlayer ? { base: 0, perPlayer: value } : { base: value, perPlayer: 0 };

export const stripQuotes = (s: string): string => s.replace(/^["“](.*)["”]$/, "$1");

export function collector(codes: readonly string[]): string {
  return codes.map((c) => c.slice(2).replace(/^0+/, "").toUpperCase()).join("/");
}

export function resourceIcons(r: RawCard): ResourceIconCounts {
  const out: { -readonly [K in keyof ResourceIconCounts]: number } = {};
  if (r.resource_energy) out.energy = r.resource_energy;
  if (r.resource_mental) out.mental = r.resource_mental;
  if (r.resource_physical) out.physical = r.resource_physical;
  if (r.resource_wild) out.wild = r.resource_wild;
  return out;
}

/** An ally stat: absent = printed "—" (null), MarvelCDB -1 = printed "X". */
export function printedStat(value: number | null | undefined): number | "X" | null {
  if (value === null || value === undefined) return null;
  return value === -1 ? "X" : value;
}

export function schemeIcons(r: RawCard): SchemeIcon[] {
  const icons: SchemeIcon[] = [];
  for (let i = 0; i < (r.scheme_crisis ?? 0); i++) icons.push("crisis");
  for (let i = 0; i < (r.scheme_acceleration ?? 0); i++) icons.push("acceleration");
  for (let i = 0; i < (r.scheme_hazard ?? 0); i++) icons.push("hazard");
  return icons;
}

export function errataStatus(e: Errata): ErrataStatus {
  return { currentVersion: e.version, history: [{ version: e.version, changedFields: [...e.changedFields], note: e.note }] };
}
