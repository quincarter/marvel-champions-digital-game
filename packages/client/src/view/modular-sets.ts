/**
 * Table setup's modular set picker (docs/phase4-screen-gaps.md §3 W2, D05):
 * which encounter sets a table may choose between, and toggling the draft's
 * choice.
 *
 * **Candidates** (owner decision 2026-10-04): every modular set of every unlocked pack, the scenario's recommended ones
 * first, then the rest by cycle (`modular-candidates.ts` holds the rule and the reasons). A scenario that calls for no
 * modular sets (Breakout, The Hood) keeps Core's five with a cap of 0 — shown, not omitted (PLAN.md's "dashed, not
 * omitted"); a restricted pool (Spiral, Mojo) offers only its own six genre sets. A pairing rules QA bars
 * (`modular-exclusions.ts`) is listed disabled with its short reason.
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
import type { AnyCard, Campaign, EncounterSet, Scenario } from "@mc/content";
import { POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { modularSetCountRangeOf, setAsideModularSetCountFor } from "@mc/content";
import { modularPickCountProblem } from "@mc/cards";
import {
  ALL_OPEN,
  EXTRAS_GROUP_ID,
  RECOMMENDED_GROUP_ID,
  POOL_GROUP_ID,
  extraSetIsOffered,
  modularCandidatesFor,
  type ModularScope,
} from "./modular-candidates.js";
import { MODULAR_SET_EXCLUSIONS, modularExclusionReason, type ModularSetExclusion } from "./modular-exclusions.js";
import type { ModularGridSection } from "./modular-grid-plan.js";
import type { CompactModularEntry } from "./table-setup-layout.js";
import { modularPicksAreSetAside } from "./modular-summary.js";
import { setModularSetIds, setSetAsideModularSetIds, toggleExtraModularSet, type SetupDraft } from "./setup-draft.js";

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
  return [...cardsById.values()].filter(
    (card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId),
  );
}

/** The set's real printed card count (`quantityInSet` summed, not "one row per unique card"). */
export function cardCountForSet(setId: string, cardsById: ReadonlyMap<string, AnyCard>): number {
  return cardsInSet(setId, cardsById).reduce((sum, card) => sum + card.quantityInSet, 0);
}

/** The set's dominant printed card type, worded for the card's own label line — null when the set has no cards in this pool, or its most common type isn't one `SET_TYPE_LABELS` names. */
export function descriptorForSet(setId: string, cardsById: ReadonlyMap<string, AnyCard>): string | null {
  const counts = new Map<string, number>();
  for (const card of cardsInSet(setId, cardsById))
    counts.set(card.type, (counts.get(card.type) ?? 0) + card.quantityInSet);
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

/** The "Random" chip's id: a pooled scenario's way to say "draw the sets at random" (clears the picks). */
export const RANDOM_MODULAR_OPTION_ID = "random";

export interface ModularSetOption {
  /**
   * `"set"` is an encounter set; `"random"` is the Random chip (pooled scenarios only); `"extra"` is an extra modular set
   * (Longshot) with its own on/off. Neither of the last two counts as one of the scenario's modular sets.
   */
  readonly kind: "set" | "random" | "extra";
  readonly id: string;
  readonly name: string;
  readonly selected: boolean;
  readonly recommended: boolean;
  readonly cardCount: number;
  readonly descriptor: string | null;
  /** The group this tile sits in (`modular-candidates.ts`): options are listed group by group, in this order. */
  readonly groupId: string;
  /** The small label over the group's first tile; null for an unlabeled group or a tile that is not its first. */
  readonly groupLabel: string | null;
  /** Why this scenario may not use the set (`modular-exclusions.ts`), a few words; null when it may. The tile is drawn disabled. */
  readonly disabledReason: string | null;
}

/** What the picker knows about the table beyond the draft: which waves are open and which pairings are barred. */
export interface ModularPickerContext {
  readonly scope?: ModularScope;
  readonly exclusions?: readonly ModularSetExclusion[];
  /** The encounter sets known (default: the app's pool); a test or the builder may pass a wider list. */
  readonly encounterSets?: readonly EncounterSet[];
  /** The campaign the game is played in: a set it bars is listed disabled (`modularCandidatesFor`). Absent: standalone. */
  readonly campaign?: Pick<Campaign, "name" | "prohibited">;
}

export interface RequiredEncounterSet {
  readonly id: string;
  readonly name: string;
  readonly cardCount: number;
  readonly descriptor: string | null;
}

/** `scenario.encounterSetIds` — the villain's own set(s), always shuffled in, never a modular pick — with the same real counts/descriptor the candidate cards carry, so the section can draw them side by side without a second data shape. */
export function requiredEncounterSetsFor(
  scenario: Scenario,
  cardsById: ReadonlyMap<string, AnyCard>,
): readonly RequiredEncounterSet[] {
  const setsById = new Map(POOL_ENCOUNTER_SETS.map((set) => [set.id as string, set.name]));
  return scenario.encounterSetIds.map((id) => ({
    id: id as string,
    name: setsById.get(id as string) ?? (id as string),
    cardCount: cardCountForSet(id as string, cardsById),
    descriptor: descriptorForSet(id as string, cardsById),
  }));
}

/** Every set id a table setup for this scenario may pick between, recommended first (see `modular-candidates.ts`). */
export function modularSetCandidateIdsFor(scenario: Scenario, scope: ModularScope = ALL_OPEN): readonly string[] {
  return modularCandidatesFor(scenario, scope).map((c) => c.id);
}

/** The draft's modular set(s) in effect right now: its own choice, or the scenario's recommendation when the draft hasn't overridden it (matches `coreScenario`/`wave1Scenario`'s own default). */
export function effectiveModularSetIds(draft: SetupDraft, scenario: Scenario): readonly string[] {
  // A scenario with a pool (MojoMania) draws its sets at random from it when the draft has not chosen: nothing is
  // "recommended" (its `recommendedModularSetIds` lists the whole pool), so no chip reads as chosen until a pick.
  // Mojo's picks are the sets it sets aside (it shuffles none in), kept in the draft's set-aside field.
  if (modularPicksAreSetAside(scenario)) return draft.setAsideModularSetIds ?? [];
  if (scenario.modularSetPool) return draft.modularSetIds ?? [];
  return draft.modularSetIds ?? scenario.recommendedModularSetIds;
}

/** How many sets the table picks on the picker: the scenario's modular count, or Mojo's 1 + 1 per hero set aside. */
export function modularPickCountFor(scenario: Scenario, playerCount: number): number {
  if (modularPicksAreSetAside(scenario)) return setAsideModularSetCountFor(scenario, Math.max(1, playerCount));
  return scenario.modularSetCount ?? 1;
}

/** The number of sets the table may pick: a fixed count has `min === max`; a Civil War scenario has 3 to 4 (MC56 p. 4). */
export interface ModularPickRange {
  readonly min: number;
  readonly max: number;
}

/** The pick range for `scenario`; a fixed-count scenario (everything but Civil War) is `{ n, n }`, as `modularPickCountFor`. */
export function modularPickRangeFor(scenario: Scenario, playerCount: number): ModularPickRange {
  if (modularPicksAreSetAside(scenario)) {
    const n = modularPickCountFor(scenario, playerCount);
    return { min: n, max: n };
  }
  const range = modularSetCountRangeOf(scenario);
  return { min: range.min, max: range.max };
}

const COUNT_WORDS: Readonly<Record<number, string>> = {
  1: "One",
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
  6: "Six",
};

/** Why an unchosen tile is disabled once a range is full: "Four is the most (MC56 p. 4)". Null below the maximum or for a fixed count. */
export function modularAtMaxReason(range: ModularPickRange, picked: number): string | null {
  if (range.min === range.max || picked < range.max) return null;
  return `${COUNT_WORDS[range.max] ?? String(range.max)} is the most (MC56 p. 4)`;
}

export interface ModularPickStatus {
  /** "3 or 4 sets" for a range, "4 sets" for a fixed count. */
  readonly rangeLabel: string;
  /** "3 to 4 sets. Chosen: 4." (a fixed count: "4 sets. Chosen: 2."). */
  readonly line: string;
  /** How many more are needed to reach the minimum. */
  readonly needed: number;
  /** How many more may still be added before the maximum. */
  readonly allowedMore: number;
  /** "Pick 2 more", "Room for 1 more", or null when the maximum is reached. */
  readonly hint: string | null;
  /** The cards package's own text for a count outside the range ("uses 3 to 4 modular sets, got 2"); null when allowed. */
  readonly problem: string | null;
}

/** What the picker says about the count: how many are chosen, how many more are needed or allowed. */
export function modularPickStatus(scenario: Scenario, picked: number, playerCount: number): ModularPickStatus {
  const range = modularPickRangeFor(scenario, playerCount);
  const noun = (n: number): string => `${n} set${n === 1 ? "" : "s"}`;
  const rangeLabel = range.min === range.max ? noun(range.max) : `${range.min} or ${range.max} sets`;
  const lead = range.min === range.max ? noun(range.max) : `${range.min} to ${range.max} sets`;
  const needed = Math.max(0, range.min - picked);
  const allowedMore = Math.max(0, range.max - picked);
  return {
    rangeLabel,
    line: `${lead}. Chosen: ${picked}.`,
    needed,
    allowedMore,
    hint: needed > 0 ? `Pick ${needed} more` : allowedMore > 0 ? `Room for ${allowedMore} more` : null,
    problem: modularPicksAreSetAside(scenario) ? null : modularPickCountProblem(scenario, picked),
  };
}

/**
 * Why "Deal it out" waits on the modular picks ("Pick 1 more modular set to deal it out"), or null when the picks make a
 * game. Deselecting a chosen set leaves the draft short of the scenario's count, and the game builder refuses a short
 * pick, so Table setup draws no preview and holds the deal until the count is back (#161). A pooled scenario never
 * waits: a half-made pick there is not sent (`toSessionConfig`), so its sets come at random.
 */
export function modularDealBlockOf(
  draft: SetupDraft,
  scenario: Scenario,
  playerCount: number = draft.seats.length,
): string | null {
  if (scenario.modularSetPool) return null;
  const status = modularPickStatus(scenario, effectiveModularSetIds(draft, scenario).length, playerCount);
  if (status.problem === null) return null;
  if (status.needed === 0) return status.problem;
  return `Pick ${status.needed} more modular set${status.needed === 1 ? "" : "s"} to deal it out`;
}

/** Every candidate, with its display name, real card count/descriptor, and whether it's currently chosen. Listed group by group. */
export function modularSetOptionsFor(
  draft: SetupDraft,
  scenario: Scenario,
  cardsById: ReadonlyMap<string, AnyCard>,
  context: ModularPickerContext = {},
): readonly ModularSetOption[] {
  const scope = context.scope ?? ALL_OPEN;
  const exclusions = context.exclusions ?? MODULAR_SET_EXCLUSIONS;
  const chosen = new Set(effectiveModularSetIds(draft, scenario));
  const encounterSets = context.encounterSets ?? POOL_ENCOUNTER_SETS;
  const setsById = new Map(encounterSets.map((set) => [set.id as string, set.name]));
  const scenarioId = scenario.id as string;
  const candidates = modularCandidatesFor(scenario, scope, encounterSets, context.campaign);
  const atMaxReason = modularAtMaxReason(
    modularPickRangeFor(scenario, draft.seats.length),
    candidates.filter((c) => chosen.has(c.id)).length,
  );
  const asOption = (c: (typeof candidates)[number], index: number): ModularSetOption => ({
    kind: "set" as const,
    id: c.id,
    name: setsById.get(c.id) ?? c.id,
    selected: chosen.has(c.id),
    recommended: c.recommended,
    cardCount: cardCountForSet(c.id, cardsById),
    descriptor: descriptorForSet(c.id, cardsById),
    groupId: c.groupId,
    // Only the group's first tile carries its label.
    groupLabel: index === 0 || candidates[index - 1]!.groupId !== c.groupId ? c.groupLabel : null,
    disabledReason:
      c.disabledReason ??
      modularExclusionReason(scenarioId, c.id, exclusions) ??
      (chosen.has(c.id) ? null : atMaxReason),
  });
  // The first group (recommended, or a restricted pool's own sets) takes the Random chip right after its sets.
  const firstGroupId = candidates[0]?.groupId ?? RECOMMENDED_GROUP_ID;
  const firstGroupEnd = candidates.findIndex((c) => c.groupId !== firstGroupId);
  const split = firstGroupEnd === -1 ? candidates.length : firstGroupEnd;
  const sets: ModularSetOption[] = candidates.slice(0, split).map(asOption);

  // A pooled scenario draws its sets at random unless the table picks: the Random chip says so and clears the picks.
  if (scenario.modularSetPool && modularPickCountFor(scenario, draft.seats.length) > 0)
    sets.push({
      kind: "random",
      id: RANDOM_MODULAR_OPTION_ID,
      name: "Random",
      selected: chosen.size === 0,
      recommended: false,
      cardCount: 0,
      descriptor: null,
      groupId: firstGroupId === POOL_GROUP_ID ? POOL_GROUP_ID : RECOMMENDED_GROUP_ID,
      groupLabel: null,
      disabledReason: null,
    });

  // An extra modular set (Longshot) can be added to any scenario and never counts toward a required number.
  let firstExtra = true;
  for (const set of POOL_ENCOUNTER_SETS) {
    if (!set.extraModular || !extraSetIsOffered(set, scope)) continue;
    sets.push({
      kind: "extra",
      id: set.id as string,
      name: set.name,
      selected: draft.extraModularSetIds.includes(set.id as string),
      recommended: false,
      cardCount: cardCountForSet(set.id as string, cardsById) || 1,
      descriptor: null,
      groupId: EXTRAS_GROUP_ID,
      groupLabel: firstExtra ? "Extras" : null,
      disabledReason: modularExclusionReason(scenarioId, set.id as string, exclusions),
    });
    firstExtra = false;
  }
  sets.push(...candidates.slice(split).map((c, i) => asOption(c, split + i)));
  return sets;
}

/**
 * The grid's sections, in draw order: the required sets (no label) when there are any, then one section per run of
 * options sharing a group, labeled with the group's name and its tile count ("Wave 1 · 12"). Both the wide grid and
 * the phone list read their structure from here. A group's tiles are contiguous in `options` by construction.
 */
export function modularSectionsFor(
  requiredCount: number,
  options: readonly ModularSetOption[],
): readonly ModularGridSection[] {
  const sections: { id: string; label: string | null; itemCount: number }[] = [];
  if (requiredCount > 0) sections.push({ id: "required", label: null, itemCount: requiredCount });
  for (const option of options) {
    const last = sections[sections.length - 1];
    if (last && last.id === option.groupId) {
      last.itemCount += 1;
      last.label ??= option.groupLabel;
    } else sections.push({ id: option.groupId, label: option.groupLabel, itemCount: 1 });
  }
  return sections.map((s) => (s.label === null ? s : { ...s, label: `${s.label} · ${s.itemCount}` }));
}

/** A labeled group of options, as the phone's group row reads it. */
export interface ModularGroupSummary {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly selectedCount: number;
}

/** The labeled groups of `options`, in order, with their tile and chosen counts (an unlabeled group has no row). */
export function modularGroupsOf(options: readonly ModularSetOption[]): readonly ModularGroupSummary[] {
  const groups = new Map<string, { label: string | null; count: number; selectedCount: number }>();
  for (const option of options) {
    const group = groups.get(option.groupId) ?? { label: null, count: 0, selectedCount: 0 };
    group.label ??= option.groupLabel;
    group.count += 1;
    if (option.selected) group.selectedCount += 1;
    groups.set(option.groupId, group);
  }
  return [...groups]
    .filter(([, g]) => g.label !== null)
    .map(([id, g]) => ({ id, label: g.label!, count: g.count, selectedCount: g.selectedCount }));
}

/** Whether a group starts open on the phone: the recommended and extra groups always, any group holding a chosen set; the rest start folded so the page does not run to hundreds of rows. */
export function groupStartsOpen(group: ModularGroupSummary): boolean {
  return group.id === RECOMMENDED_GROUP_ID || group.id === EXTRAS_GROUP_ID || group.selectedCount > 0;
}

/** The phone's rows for the candidates: a group row before each labeled group, then the sets of the groups that `isOpen`. */
export function compactModularEntriesFor(
  options: readonly ModularSetOption[],
  isOpen: (group: ModularGroupSummary) => boolean,
): readonly CompactModularEntry[] {
  const groups = new Map(modularGroupsOf(options).map((g) => [g.id, g]));
  const entries: CompactModularEntry[] = [];
  const announced = new Set<string>();
  for (const option of options) {
    const group = groups.get(option.groupId);
    if (!group) {
      entries.push({ kind: "set", id: option.id });
      continue;
    }
    if (!announced.has(group.id)) {
      announced.add(group.id);
      entries.push({ kind: "group", id: group.id });
    }
    if (isOpen(group)) entries.push({ kind: "set", id: option.id });
  }
  return entries;
}

/** The sets (not the Random or extra chips) among `options` that are chosen. */
export const pickedSetCount = (options: readonly ModularSetOption[]): number =>
  options.filter((o) => o.kind === "set" && o.selected).length;

/** The uppercase label line a modular-set card draws under its name (D05: "REQUIRED BY KLAW · 8 CARDS", "CHOSEN · 7 CARDS · SIDE SCHEMES", "7 CARDS · MINION-HEAVY"). Plain text formatting over already-derived real data, not a rule — belongs beside the data it formats so a test can hold the exact wording once. */
export function requiredCardLabel(villainName: string, cardCount: number): string {
  return `Required by ${villainName} · ${cardCount} card${cardCount === 1 ? "" : "s"}`;
}

export function modularCardLabel(
  option: Pick<ModularSetOption, "selected" | "cardCount" | "descriptor"> & {
    readonly kind?: ModularSetOption["kind"];
    readonly disabledReason?: string | null;
  },
): string {
  if (option.disabledReason) return option.disabledReason;
  if (option.kind === "random") return option.selected ? "Chosen · drawn when the game is dealt" : "Clears your picks";
  if (option.kind === "extra") return option.selected ? "Chosen · not counted" : "Optional · not counted";
  const base = option.selected
    ? `Chosen · ${option.cardCount} card${option.cardCount === 1 ? "" : "s"}`
    : `${option.cardCount} card${option.cardCount === 1 ? "" : "s"}`;
  return option.descriptor ? `${base} · ${option.descriptor}` : base;
}

/**
 * Toggles one set in or out of the draft's choice, capped at
 * `scenario.modularSetCount` (absent = 1). A scenario that calls for zero
 * modular sets (Breakout) never gains one from this — every toggle is a no-op.
 */
export function toggleModularSet(
  draft: SetupDraft,
  scenario: Scenario,
  setId: string,
  playerCount: number = draft.seats.length,
): SetupDraft {
  // Mojo sets its picks aside, so they go to the set-aside field; every other scenario's are the modular sets.
  const write = modularPicksAreSetAside(scenario) ? setSetAsideModularSetIds : setModularSetIds;
  if (setId === RANDOM_MODULAR_OPTION_ID) return scenario.modularSetPool ? write(draft, null) : draft;
  if (POOL_ENCOUNTER_SETS.some((set) => set.extraModular && (set.id as string) === setId)) {
    if (!draft.extraModularSetIds.includes(setId) && modularExclusionReason(scenario.id as string, setId) !== null)
      return draft;
    return toggleExtraModularSet(draft, setId);
  }
  const range = modularPickRangeFor(scenario, playerCount);
  const cap = range.max;
  const current = [...effectiveModularSetIds(draft, scenario)];
  if (!current.includes(setId)) {
    // The other side's sets are never added; a range never rolls the oldest pick out (deselect first to swap).
    if (modularCandidatesFor(scenario).find((c) => c.id === setId)?.disabledReason !== undefined) return draft;
    if (range.min !== range.max && current.length >= cap) return draft;
  }
  // A pairing rules QA barred (`modular-exclusions.ts`) can be taken back out but never added.
  if (!current.includes(setId) && modularExclusionReason(scenario.id as string, setId) !== null) return draft;
  if (current.includes(setId)) {
    const rest = current.filter((id) => id !== setId);
    return write(draft, scenario.modularSetPool && rest.length === 0 ? null : rest);
  }
  if (cap <= 0) return draft;
  const next = current.length >= cap ? [...current.slice(current.length - cap + 1), setId] : [...current, setId];
  return write(draft, next);
}
