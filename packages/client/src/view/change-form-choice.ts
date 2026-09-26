/**
 * "Which form?" — every legal `changeForm` action right now, labeled.
 *
 * `legalActions` lists one `changeForm` entry per destination form (RRG 1.8 "Form, Change Form"): the ordinary
 * two-faced identity offers exactly one (`{ kind: "changeForm" }`, a plain hero/alter-ego flip, unambiguous), but a
 * three-or-more-sided identity — Spectrum's energy/density/mass forms (`mts` 21001a), Ant-Man/Wasp's Giant form
 * (docs/phase7-wave2.md §3.2) — offers a distinct entry per hero face plus, while in hero form, one back to
 * alter-ego. The action bar used to take `legal.find(entry => entry.action.kind === "changeForm")`, i.e. whichever
 * came first, so a three-sided identity's player could never pick *which* other form to become — the same
 * "distinct decisions must not collapse into one interaction" gap `attacker-choice.ts`'s own doc comment names for
 * "who attacks?". This is that fix, mirrored for form change.
 */
import type { EngineDeps, GameState, LegalAction, LegalActions } from "@mc/engine";
import { cardOf, heroFacesOf } from "@mc/engine";

export interface FormSource {
  /** "Alter-ego", or the hero face's own printed name ("Density Form"). */
  readonly label: string;
  readonly entry: LegalAction;
}

/** Every legal `changeForm` entry right now, in `legalActions`' order. */
export function formEntries(actions: LegalActions | null | undefined): readonly LegalAction[] {
  if (actions?.kind !== "turn") return [];
  return actions.legal.filter((entry) => entry.action.kind === "changeForm");
}

/**
 * `formEntries`, labeled from the acting identity's own printed faces. `_deps` is unused today (labeling reads
 * printed data only) but kept for parity with `attacker-choice.ts`'s own `powerSources(state, entries, power,
 * deps)` — every "every legal X, described" model in this file's family takes one, so a future label that needs a
 * lasting-effect override doesn't change every call site's shape.
 */
export function formSources(
  state: GameState,
  entries: readonly LegalAction[],
  _deps: EngineDeps,
): readonly FormSource[] {
  const built = entries.map((entry): FormSource & { readonly traits?: readonly string[] } => {
    const ref = entry.action;
    if (ref.kind !== "changeForm") throw new Error(`formSources: ${ref.kind} is not changeForm`);
    if (ref.to === "alterEgo") return { label: "Alter-ego", entry };
    if (ref.to === undefined) return { label: "Change form", entry };
    const player = state.players.find((seat) => seat.playerId === entry.example.playerId);
    const card = player ? cardOf(state, player.identity.instanceId) : undefined;
    const face = card?.type === "hero_identity" ? heroFacesOf(card)[ref.to.heroForm] : undefined;
    return {
      label: face?.faceName ?? `Form ${ref.to.heroForm + 1}`,
      entry,
      ...(face ? { traits: face.traits as readonly string[] } : {}),
    };
  });
  // Ant-Man's own small and Giant hero faces both print the same faceName ("Ant-Man"); disambiguate by the one
  // trait that tells them apart (GIANT/TINY) rather than showing two identical, unpickable buttons.
  return built.map((source, i) => {
    const sharing = built.filter((other, j) => j !== i && other.label === source.label);
    if (sharing.length === 0 || !source.traits) return { label: source.label, entry: source.entry };
    const distinguishing = source.traits.find(
      (trait) => !sharing.every((other) => other.traits?.includes(trait) ?? false),
    );
    return { label: distinguishing ? `${source.label} (${distinguishing})` : source.label, entry: source.entry };
  });
}

/** True once there is a real choice to make — a single entry dispatches immediately, no picker needed. */
export function needsFormChoice(entries: readonly LegalAction[]): boolean {
  return entries.length > 1;
}
