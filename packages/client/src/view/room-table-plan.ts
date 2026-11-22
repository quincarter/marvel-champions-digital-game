/**
 * The table plan a room host publishes so everyone in the lobby sees what they are up against: the kept setup draft as
 * ids only (each client names and draws them from its own content). `modularSetIds` is the resolved list: a draft that
 * leaves it `null` means the scenario's recommended sets. A client that cannot resolve an id shows the id.
 */
import type { AnyCard, EncounterSet, Scenario } from "@mc/content";
import { ART_CATALOG, villainArtFor } from "../art/scenario-art.js";
import { CARD_BACKS, artFor, type CardFace } from "../art/art-source.js";
import type { TablePlan } from "../live/room-state.js";
import { cardsBySet, setFacesOf } from "./civil-war-builder-art.js";
import { hasRandomChosenVillain } from "./random-villain.js";
import { scenarioDetailOf } from "./scenario-detail.js";
import type { SetupDraft } from "./setup-draft.js";

export function tablePlanOf(draft: SetupDraft, scenario: Scenario | undefined): TablePlan {
  const sets = draft.modularSetIds ?? scenario?.recommendedModularSetIds ?? [];
  return {
    scenarioId: draft.scenarioId as string,
    modularSetIds: sets.map((id) => id as string),
    difficulty: draft.difficulty,
    ...(draft.heroicLevel ? { heroicLevel: draft.heroicLevel } : {}),
    ...(draft.skirmish ? { skirmish: true } : {}),
  };
}

/** One picture of the plan: a name, the scan to draw, and the card the hover popover shows (null for none). */
export interface PlanPicture {
  readonly key: string;
  readonly name: string;
  readonly artUrl: string | null;
  readonly cardId: string | null;
  readonly face?: CardFace;
}

export interface PlanPictures {
  readonly villain: PlanPicture;
  readonly sets: readonly PlanPicture[];
}

export interface PlanContent {
  readonly scenarios: readonly Scenario[];
  readonly cards: ReadonlyMap<string, AnyCard>;
  readonly encounterSets: readonly EncounterSet[];
}

/** The pictures and names for a plan, from this client's own content. Unknown ids fall back to the id and no picture. */
export function planPictures(plan: TablePlan, content: PlanContent): PlanPictures {
  const scenario = content.scenarios.find((s) => (s.id as string) === plan.scenarioId);
  let villain: PlanPicture = { key: "villain", name: plan.scenarioId, artUrl: null, cardId: null };
  if (scenario) {
    const name = scenarioDetailOf(scenario, content.cards, content.encounterSets).displayName;
    const villainId = scenario.villainCardId as string;
    // A villain drawn at random (Shadows in the Night) is not known: the encounter card back, and no hover.
    const unknown = hasRandomChosenVillain(scenario);
    const artUrl = unknown
      ? CARD_BACKS.encounter.url
      : (villainArtFor(ART_CATALOG, plan.scenarioId, () => 0)?.url ??
        artFor(content.cards.get(villainId), { kind: "villainStage", sideIndex: 0, stageIndex: 0 })?.url ??
        null);
    villain = { key: "villain", name, artUrl, cardId: unknown ? null : villainId };
  }
  const bySet = cardsBySet(content.cards);
  const sets = plan.modularSetIds.map((id): PlanPicture => {
    const name = content.encounterSets.find((set) => (set.id as string) === id)?.name ?? id;
    const face = setFacesOf(bySet.get(id) ?? [], 1)[0];
    if (!face) return { key: `set:${id}`, name, artUrl: null, cardId: null };
    return {
      key: `set:${id}`,
      name,
      artUrl: artFor(content.cards.get(face.cardId), face.face)?.url ?? null,
      cardId: face.cardId,
      face: face.face,
    };
  });
  return { villain, sets };
}

/** How many pictures fit in a row `width` wide at `minSize` each with `gap` between, and how big they are then. */
export function planGrid(
  count: number,
  width: number,
  minSize = 72,
  maxSize = 104,
  gap = 8,
): { readonly cols: number; readonly size: number } {
  const fit = Math.max(1, Math.floor((width + gap) / (minSize + gap)));
  const cols = Math.max(1, Math.min(count, fit));
  const size = Math.max(40, Math.min(maxSize, Math.floor((width - gap * (cols - 1)) / cols)));
  return { cols, size };
}
