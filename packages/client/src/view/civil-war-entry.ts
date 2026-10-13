/**
 * How a player reaches the Civil War scenario builder, and where it leads (docs/phase7-wave10-client.md 2.1, 2.10 and
 * question 23A): a "Customize" button on a ready-made Civil War scenario's detail, one "Build your own" tile at the
 * head of the Civil War shelf, and the last build remembered for the session (question 26A, no named saves).
 *
 * Everything here is a plain decision the scene only carries out. A Civil War scenario is one whose record names a side
 * *and* whose offer states its main scheme stages (`@mc/cards`); the entry points therefore appear exactly when such a
 * scenario is in the pool and are inert (absent) until then.
 */
import { playableScenarioOffer, type PlayableScenarioOffer } from "@mc/cards";
import type { Scenario } from "@mc/content";
import { openBuilderBuildYourOwn, openBuilderOn } from "./civil-war-builder-model.js";
import type { BuilderStep } from "./civil-war-builder-layout.js";
import type { Shelf } from "./roster-shelves.js";
import { setCivilWarBlind, setMainSchemeStage, setModularSetIds, setScenario, type SetupDraft } from "./setup-draft.js";

export const CUSTOMIZE_LABEL = "Customize this scenario";
export const BUILD_YOUR_OWN_TITLE = "Build your own Civil War scenario";
export const BUILD_YOUR_OWN_SUBTITLE = "Pick a side, a leader, two main scheme stages and three or four modular sets.";
/** The focus/stop id suffix and the roster id of the tile (`scenario:<id>`). */
export const BUILD_YOUR_OWN_TILE_ID = "civil-war-builder";
export const NOT_IN_POOL_MESSAGE = "The Civil War scenarios are not in this build's scenario list yet.";

/** The tile at the head of the Civil War shelf: a roster entry that is not a scenario. */
export interface BuilderTile {
  readonly builderTile: true;
  readonly id: typeof BUILD_YOUR_OWN_TILE_ID;
}

export const BUILDER_TILE: BuilderTile = { builderTile: true, id: BUILD_YOUR_OWN_TILE_ID };

export type RosterEntry = Scenario | BuilderTile;

export const isBuilderTile = (entry: RosterEntry): entry is BuilderTile => "builderTile" in entry;

type OfferLookup = (scenarioId: string) => PlayableScenarioOffer | null;

const defaultOffer: OfferLookup = (id) => {
  try {
    return playableScenarioOffer(id);
  } catch {
    return null;
  }
};

/** True for a Civil War leader scenario the builder can open on: a side on the record and stages on the offer. */
export function isCivilWarScenario(scenario: Scenario | undefined, offerFor: OfferLookup = defaultOffer): boolean {
  if (!scenario || scenario.side === undefined) return false;
  return Boolean(offerFor(scenario.id as string)?.mainSchemeStages);
}

/** The "Customize" button: present only on a ready-made Civil War scenario. */
export function customizeEntryOf(
  scenario: Scenario | undefined,
  offerFor: OfferLookup = defaultOffer,
): { readonly scenarioId: string; readonly label: string } | null {
  return scenario && isCivilWarScenario(scenario, offerFor)
    ? { scenarioId: scenario.id as string, label: CUSTOMIZE_LABEL }
    : null;
}

/** The shelf (by id, a pack code) that carries the tile: the first shelf holding a Civil War scenario; null when none does. */
export function builderTileShelfOf(
  shelves: readonly Shelf<Scenario>[],
  offerFor: OfferLookup = defaultOffer,
): string | null {
  return shelves.find((shelf) => shelf.items.some((s) => isCivilWarScenario(s, offerFor)))?.id ?? null;
}

/** The shelves with the "Build your own" tile at the head of the Civil War shelf. Every other shelf is untouched. */
export function shelvesWithBuilderTile(
  shelves: readonly Shelf<Scenario>[],
  offerFor: OfferLookup = defaultOffer,
): readonly Shelf<RosterEntry>[] {
  const tileShelf = builderTileShelfOf(shelves, offerFor);
  return shelves.map((shelf) => (shelf.id === tileShelf ? { ...shelf, items: [BUILDER_TILE, ...shelf.items] } : shelf));
}

/** What opening the builder does to the draft, and which step it opens on. */
export interface BuilderEntry {
  readonly draft: SetupDraft;
  readonly step: BuilderStep;
}

/** The last build of this session: leader, stages, sets and the blind flag (question 26A). Not saved to disk. */
export interface RememberedBuild {
  readonly scenarioId: string;
  readonly stageIds: readonly string[];
  readonly modularSetIds: readonly string[] | null;
  readonly blind: boolean;
}

export function rememberedBuildOf(draft: SetupDraft): RememberedBuild | null {
  if (!draft.civilWar) return null;
  return {
    scenarioId: draft.scenarioId,
    stageIds: draft.civilWar.stageIds,
    modularSetIds: draft.modularSetIds,
    blind: draft.civilWar.blind,
  };
}

/** Puts a remembered build back on `draft` through the setup-draft functions, so the offer reconciles it. */
export function recallBuild(draft: SetupDraft, build: RememberedBuild): SetupDraft {
  let next = setScenario(draft, undefined, build.scenarioId);
  next = setModularSetIds(next, build.modularSetIds);
  build.stageIds.forEach((id, i) => {
    next = setMainSchemeStage(next, i + 1, id);
  });
  return setCivilWarBlind(next, build.blind);
}

let lastBuild: RememberedBuild | null = null;
/** Remembers the draft's build for the rest of the session (the scene calls this on every way out). */
export function rememberBuild(draft: SetupDraft): void {
  lastBuild = rememberedBuildOf(draft) ?? lastBuild;
}
export const lastRememberedBuild = (): RememberedBuild | null => lastBuild;
export function forgetLastBuild(): void {
  lastBuild = null;
}

/**
 * "Customize" opens on that scenario exactly as printed, at the review step. "Build your own" resumes the last build of
 * the session at the side step, or the first leader as printed when there is none.
 */
export function enterBuilder(
  kind: "customize" | "build",
  draft: SetupDraft,
  scenarioId: string,
  offerFor: OfferLookup = defaultOffer,
  remembered: RememberedBuild | null = lastBuild,
): BuilderEntry {
  if (kind === "customize") return openBuilderOn(draft, scenarioId);
  if (remembered) return { draft: recallBuild(draft, remembered), step: 1 };
  const offer = offerFor(scenarioId);
  return offer ? openBuilderBuildYourOwn(draft, offer) : openBuilderOn(draft, scenarioId);
}

/** Where Start leads: Take your seats with the draft (docs 2.10), or nowhere while the scenario is not in the pool. */
export type BuilderHandoff =
  | { readonly kind: "seats"; readonly draft: SetupDraft }
  | { readonly kind: "blocked"; readonly message: string };

export function handoffOf(draft: SetupDraft, poolScenarioIds: ReadonlySet<string>): BuilderHandoff {
  return poolScenarioIds.has(draft.scenarioId)
    ? { kind: "seats", draft }
    : { kind: "blocked", message: NOT_IN_POOL_MESSAGE };
}

/** The Title's own row for the box (owner, 2026-10-13): directly under Campaign. */
export const CIVIL_WAR_TITLE_LABEL = "Civil War!";
/** The unlock wave of the Civil War box (`progression/unlocks.ts`). */
export const CIVIL_WAR_CYCLE_ID = "cycle10";

/**
 * The Title's "Civil War!" row: present once the box is open (`waveLock` null: the same wave lock that opens the Civil
 * War shelf on Scenario select) and a Civil War scenario is in the pool; absent, never disabled, before. Names the
 * leader the builder opens on when there is no remembered build.
 */
export function civilWarTitleEntryOf(
  waveLock: string | null,
  scenarios: readonly Scenario[],
  offerFor: OfferLookup = defaultOffer,
): { readonly scenarioId: string } | null {
  if (waveLock !== null) return null;
  const first = scenarios.find((s) => isCivilWarScenario(s, offerFor));
  return first ? { scenarioId: first.id as string } : null;
}

/** Where the builder's Back leads: the screen the player came from. */
export type BuilderOrigin = "title" | "scenarioSelect";
let builderOrigin: BuilderOrigin = "scenarioSelect";
/** Remembered for the session, so coming back from hero select (or Table setup) to the builder still backs out to the same place. */
export const setBuilderOrigin = (origin: BuilderOrigin): void => {
  builderOrigin = origin;
};
export const lastBuilderOrigin = (): BuilderOrigin => builderOrigin;
