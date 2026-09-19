/**
 * Table setup's modular set picker (docs/phase4-screen-gaps.md §3 W2, D05):
 * which encounter sets a table may choose between, and toggling the draft's
 * choice.
 *
 * **Candidates.** `CORE_MODULAR_SET_IDS` (`content/pool.ts`) is always
 * offered — the five general-purpose Core modulars — plus whatever the
 * scenario itself recommends, since a wave 1 scenario (Green Goblin's Risky
 * Business/Mutagen Formula) recommends a set of its own ("Power Drain",
 * "Goblin Gimmicks") that isn't one of the five. The Wrecking Crew's Breakout
 * recommends none and calls for zero (`Scenario.modularSetCount`), so its
 * candidate list is exactly the five Core modulars with a cap of 0 — the
 * screen should show them all disabled/hidden behind "not used", not omit the
 * picker's own presence entirely (PLAN.md's "dashed, not omitted").
 *
 * **Selection.** Capped at `Scenario.modularSetCount` (absent = 1, RRG
 * Appendix II's usual "one modular encounter set"). At the default cap of 1
 * this reads as a single-select: choosing a new set replaces the old one. A
 * cap above 1 (none in this pool yet) is a small rolling window — the oldest
 * pick drops when a new one is added past the cap — rather than refusing the
 * click outright, so a keyboard/pad user toggling through chips never hits a
 * dead button.
 *
 * **The owner's D05 correction (2026-09-18)** draws the modular-set section as
 * a card grid, each card carrying a real card count and a one-word descriptor
 * ("SIDE SCHEMES", "MINIONS", "ATTACHMENTS" — the set's own dominant printed
 * card type, `descriptorForSet`), never invented copy. `scenario.encounterSetIds`
 * — the villain's own set, always in the deck, never a modular pick — is drawn
 * alongside the candidates as non-toggleable "required" cards
 * (`requiredEncounterSetsFor`), so the section reads as "every set entering
 * this deck", the required ones first and fixed, the rest togglable up to the
 * scenario's own cap.
 */
import type { AnyCard, Scenario } from "@mc/content";
import { CORE_MODULAR_SET_IDS, POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { setModularSetIds, type SetupDraft } from "./setup-draft.js";

/** The handful of encounter-card types a modular/required set is actually built from, each with a plural label a card can carry ("7 CARDS · SIDE SCHEMES"). Any other/mixed dominant type (or a set with no cards in this pool) omits the descriptor rather than guessing — PLAN.md's "don't invent copy". */
const SET_TYPE_LABELS: Readonly<Partial<Record<AnyCard["type"], string>>> = {
  minion: "Minions",
  side_scheme: "Side schemes",
  treachery: "Treacheries",
  attachment: "Attachments",
  environment: "Environment",
  obligation: "Obligations",
};

/** Every card belonging to encounter set `setId`, in `cardsById`'s pool. */
function cardsInSet(setId: string, cardsById: ReadonlyMap<string, AnyCard>): readonly AnyCard[] {
  return [...cardsById.values()].filter((card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId));
}

/** The set's real printed card count (`quantityInSet` summed, not "one row per unique card"). */
export function cardCountForSet(setId: string, cardsById: ReadonlyMap<string, AnyCard>): number {
  return cardsInSet(setId, cardsById).reduce((sum, card) => sum + card.quantityInSet, 0);
}

/** The set's dominant printed card type, worded for the card's own label line — null when the set has no cards in this pool, or its most common type isn't one `SET_TYPE_LABELS` names. */
export function descriptorForSet(setId: string, cardsById: ReadonlyMap<string, AnyCard>): string | null {
  const counts = new Map<string, number>();
  for (const card of cardsInSet(setId, cardsById)) counts.set(card.type, (counts.get(card.type) ?? 0) + card.quantityInSet);
  let best: string | null = null;
  let bestCount = 0;
  for (const [type, count] of counts) {
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  }
  return best ? (SET_TYPE_LABELS[best as AnyCard["type"]] ?? null) : null;
}

export interface ModularSetOption {
  readonly id: string;
  readonly name: string;
  readonly selected: boolean;
  readonly recommended: boolean;
  readonly cardCount: number;
  readonly descriptor: string | null;
}

export interface RequiredEncounterSet {
  readonly id: string;
  readonly name: string;
  readonly cardCount: number;
  readonly descriptor: string | null;
}

/** `scenario.encounterSetIds` — the villain's own set(s), always shuffled in, never a modular pick — with the same real counts/descriptor the candidate cards carry, so the section can draw them side by side without a second data shape. */
export function requiredEncounterSetsFor(scenario: Scenario, cardsById: ReadonlyMap<string, AnyCard>): readonly RequiredEncounterSet[] {
  const setsById = new Map(POOL_ENCOUNTER_SETS.map((set) => [set.id as string, set.name]));
  return scenario.encounterSetIds.map((id) => ({
    id: id as string,
    name: setsById.get(id as string) ?? (id as string),
    cardCount: cardCountForSet(id as string, cardsById),
    descriptor: descriptorForSet(id as string, cardsById),
  }));
}

/** Every set id a table setup for this scenario may pick between, Core's five modulars first, then any of the scenario's own recommended sets not already among them. */
export function modularSetCandidateIdsFor(scenario: Scenario): readonly string[] {
  const ids = [...CORE_MODULAR_SET_IDS];
  for (const id of scenario.recommendedModularSetIds) {
    if (!ids.includes(id as string)) ids.push(id as string);
  }
  return ids;
}

/** The draft's modular set(s) in effect right now: its own choice, or the scenario's recommendation when the draft hasn't overridden it (matches `coreScenario`/`wave1Scenario`'s own default). */
export function effectiveModularSetIds(draft: SetupDraft, scenario: Scenario): readonly string[] {
  return draft.modularSetIds ?? scenario.recommendedModularSetIds;
}

/** Every candidate, with its display name, real card count/descriptor, and whether it's currently chosen. */
export function modularSetOptionsFor(draft: SetupDraft, scenario: Scenario, cardsById: ReadonlyMap<string, AnyCard>): readonly ModularSetOption[] {
  const chosen = new Set(effectiveModularSetIds(draft, scenario));
  const recommended = new Set(scenario.recommendedModularSetIds as readonly string[]);
  const setsById = new Map(POOL_ENCOUNTER_SETS.map((set) => [set.id as string, set.name]));
  return modularSetCandidateIdsFor(scenario).map((id) => ({
    id,
    name: setsById.get(id) ?? id,
    selected: chosen.has(id),
    recommended: recommended.has(id),
    cardCount: cardCountForSet(id, cardsById),
    descriptor: descriptorForSet(id, cardsById),
  }));
}

/** The uppercase label line a modular-set card draws under its name (D05: "REQUIRED BY KLAW · 8 CARDS", "CHOSEN · 7 CARDS · SIDE SCHEMES", "7 CARDS · MINION-HEAVY"). Plain text formatting over already-derived real data, not a rule — belongs beside the data it formats so a test can hold the exact wording once. */
export function requiredCardLabel(villainName: string, cardCount: number): string {
  return `Required by ${villainName} · ${cardCount} card${cardCount === 1 ? "" : "s"}`;
}

export function modularCardLabel(option: Pick<ModularSetOption, "selected" | "cardCount" | "descriptor">): string {
  const base = option.selected ? `Chosen · ${option.cardCount} card${option.cardCount === 1 ? "" : "s"}` : `${option.cardCount} card${option.cardCount === 1 ? "" : "s"}`;
  return option.descriptor ? `${base} · ${option.descriptor}` : base;
}

/**
 * Toggles one set in or out of the draft's choice, capped at
 * `scenario.modularSetCount` (absent = 1). A scenario that calls for zero
 * modular sets (Breakout) never gains one from this — every toggle is a no-op.
 */
export function toggleModularSet(draft: SetupDraft, scenario: Scenario, setId: string): SetupDraft {
  const cap = scenario.modularSetCount ?? 1;
  const current = [...effectiveModularSetIds(draft, scenario)];
  if (current.includes(setId)) {
    return setModularSetIds(draft, current.filter((id) => id !== setId));
  }
  if (cap <= 0) return draft;
  const next = current.length >= cap ? [...current.slice(current.length - cap + 1), setId] : [...current, setId];
  return setModularSetIds(draft, next);
}
