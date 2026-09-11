import type { AbilityId } from "./ids.js";

/**
 * An opaque handle into the engine-side ability registry (`@mc/cards` builds
 * it, the engine receives it through `EngineDeps`). Content data never encodes
 * *behavior* or timing — the registry entry for `id` is authoritative for when
 * and how the ability fires (Phase 2 decision: the old `trigger` field was
 * dropped because it could not express resource / when-defeated / forced vs
 * optional and would have drifted from the registry).
 *
 * `id` convention (stable, never renumbered): `<cardCode>.<slug>`, e.g.
 * `01001a.spider-sense`, `01099.boost`, `01097a.setup`.
 */
export interface AbilityReference {
  readonly id: AbilityId;
  /** Printed ability name, when the card names it (e.g. "Spider-Sense", "Rechannel"). */
  readonly label?: string;
  /** Plain-language handoff for the ability-scripting stage. Documentation only. */
  readonly notesForScripting?: string;
}
