/**
 * The Civil War scenario builder's view model (docs/phase7-wave10-client.md sections 2.2 to 2.6 and 6.1): everything the
 * scene draws and every intent it can send, as plain data. No Phaser, no rules.
 *
 * **The builder asks, it never decides.** What a leader may use, which stages exist, how many sets a game takes and the
 * words of every refusal come from `PlayableScenarioOffer` (`@mc/cards`, asked again after every change with
 * `offerOf`); the picks live on the `SetupDraft` and change only through the setup-draft functions. This module adds
 * the five steps, the tiles, the review lines and the action strings.
 *
 * Every control is an action string (`civil:side:resistance`, `civil:stage:2:56064b`, `civil:set:paladin`): the scene
 * hands the string to `applyBuilderAction` and never interprets it, and `focusOrder` lists the same strings.
 * Navigation and Random are returned as an `effect` for the scene (or task C9) to carry out; the draft is untouched by
 * them unless a randomizer is supplied (`BuilderContext.random`).
 */
import type { ModularSetLegality, PlayableScenarioOffer } from "@mc/cards";
import type { AnyCard, EncounterSet, Scenario, VillainCard } from "@mc/content";
import { scale } from "@mc/engine";
import type { CorePlayer } from "@mc/cards";
import type { SessionConfig } from "../engine/host.js";
import {
  cardsBySet,
  faceRefOf,
  setFacesOf,
  setSheetOf,
  type FaceRef,
  type SetSheetView,
} from "./civil-war-builder-art.js";
import { BUILDER_STEP_COUNT, type BuilderStep } from "./civil-war-builder-layout.js";
import { gameModeOptionsView, selectMode, type GameModeOptionRow } from "./game-mode-options.js";
import { foeWord } from "./foe-words.js";
import { modularAtMaxReason, cardCountForSet, descriptorForSet } from "./modular-sets.js";
import { formatScaling } from "./scaling-text.js";
import {
  setCivilWarBlind,
  setDifficulty,
  setMainSchemeStage,
  setModularSetIds,
  setScenario,
  toSessionConfig,
  type SetupDraft,
} from "./setup-draft.js";
import { civilWarPickProblems, offerOf } from "./setup-options.js";
import { difficultyCardsFor } from "./table-setup-preview.js";

export const BUILDER_TITLE = "Build a Civil War scenario";
export const OTHER_SIDE_COLLAPSED_LINE = (count: number, otherSide: string, leader: string): string =>
  `${count} sets from the ${otherSide} are not used with ${leader}`;

const NUMERALS: Readonly<Record<number, string>> = { 1: "I", 2: "II", 3: "III", 4: "IV" };
const PLAYER_COUNTS = [1, 2, 3, 4] as const;
export const STEP_TITLES: readonly string[] = ["Side", "Leader", "Main scheme", "Modular sets", "Review and play"];
export const EXPERT_NOTE = "Expert uses leader stages III and IV";

/** What a randomizer is asked (main spec 3.3): the pins the player locked, and the seed of this press. */
export interface CivilWarRandomRequest {
  readonly seed: number;
  readonly side?: string;
  readonly leaderId?: string;
  readonly modularCount?: number;
}

/** What a randomizer returns: an ordinary set of picks, loaded into the builder as if the player had made them. */
export interface CivilWarRandomPicks {
  readonly leaderId: string;
  readonly stageIds: readonly string[];
  readonly modularSetIds: readonly string[];
}

export type CivilWarRandomizer = (request: CivilWarRandomRequest) => CivilWarRandomPicks;

/** Random's lock toggles and the "Sets: 3 / 4" stepper (docs 2.5). */
export interface RandomPins {
  readonly side?: boolean;
  readonly leader?: boolean;
  readonly modularCount?: number;
}

/** One of the three controls above the foot's Random buttons: what it says, what it sends, and whether it is on. */
export interface RandomPinView {
  readonly action: string;
  readonly label: string;
  readonly on: boolean;
}

/** The modular count a roll draws when the stepper was not touched (question 9). */
export const DEFAULT_RANDOM_COUNT = 4;

/** Everything the model reads besides the draft. */
export interface BuilderContext {
  /** Card pool including the cw cards (leaders, set sizes). */
  readonly cards: ReadonlyMap<string, AnyCard>;
  /** The Civil War scenario records. */
  readonly scenarios: readonly Scenario[];
  /** Encounter sets (names of the leader's own set and the Standard / Expert sets). */
  readonly encounterSets: readonly EncounterSet[];
  /** The offer for the draft; derived with `offerOf` when absent. */
  readonly offer?: PlayableScenarioOffer;
  /** The active step; default 1. */
  readonly step?: BuilderStep;
  readonly otherSideExpanded?: boolean;
  /** The one-line notice from the last action. */
  readonly status?: string | null;
  /** Random's lock toggles and the "Sets: 3 / 4" stepper. */
  readonly pins?: RandomPins;
  /** Tiles in the "Extra sets (not counted)" row; the scene counts them from `modular-candidates`. */
  readonly extraSets?: number;
  /** Supplied by task C9; without it Random reports an effect and changes nothing. */
  readonly random?: CivilWarRandomizer;
}

/** One difficulty choice: Table setup's own card (`difficultyCardsFor`: its name and description) with the action to take it. */
export interface DifficultyChoice {
  readonly id: "standard" | "expert";
  readonly name: string;
  readonly description: string;
  readonly action: string;
  readonly selected: boolean;
}

export interface BuilderStepView {
  readonly step: BuilderStep;
  readonly action: string;
  readonly title: string;
  /** The step's current pick as one line, for the rail. */
  readonly line: string;
  readonly complete: boolean;
  readonly active: boolean;
}

export interface SideChoice {
  readonly side: string;
  readonly name: string;
  readonly action: string;
  readonly selected: boolean;
  /** The two leaders' names. */
  readonly leaderNames: readonly string[];
  /** The two leaders, for their pictures (`art/scenarios/<scenarioId>/villain.*`, else the leader card's own scan). */
  readonly leaders: readonly { readonly scenarioId: string; readonly cardId: string; readonly name: string }[];
}

export interface LeaderStageView {
  readonly numeral: string;
  readonly hp: string;
  /** Hit points at 1, 2, 3 and 4 players. */
  readonly hpByPlayers: readonly number[];
  /** The leader's own printed card for this stage: opens Inspect. Null when the card is not in the pool. */
  readonly face: FaceRef | null;
}

export interface LeaderChoice {
  readonly scenarioId: string;
  readonly cardId: string;
  readonly name: string;
  /** "Leader". */
  readonly word: string;
  readonly action: string;
  readonly selected: boolean;
  /** The two stages this difficulty plays (I and II, or III and IV). */
  readonly stages: readonly LeaderStageView[];
  /** The stage the leader opens on: "I" or "III". */
  readonly openingStage: string;
  /** "Iron Man set, 10 cards": always in. */
  readonly ownSet: string;
}

export interface StageOptionView {
  readonly printedCardId: string;
  readonly name: string;
  readonly targetThreat: string;
  readonly gist: string;
  readonly action: string;
  readonly selected: boolean;
  readonly recommended: boolean;
  /** The stage's own printed card (`MainSchemeStage.printedCardId`, its B side: the one with the threat). */
  readonly face: FaceRef | null;
}

export interface StageRowView {
  readonly stageNumber: number;
  readonly label: string;
  /** Empty when `hidden`. */
  readonly options: readonly StageOptionView[];
  readonly hidden: boolean;
}

export interface SetTileView {
  readonly id: string;
  readonly name: string;
  readonly cardCount: number;
  /** The dominant card type word (`descriptorForSet`). */
  readonly descriptor: string | null;
  readonly action: string;
  readonly selected: boolean;
  readonly recommended: boolean;
  readonly enabled: boolean;
  /** Up to three faces from the set, most recognizable first (`setFacesOf`). */
  readonly faces: readonly FaceRef[];
  /** Why a disabled tile cannot be picked (the offer's refusal, or "Four is the most (MC56 p. 4)"). Absent when enabled. */
  readonly disabledReason?: string;
  /** "4 of 4 chosen": present when the set is only unavailable because the cap is reached. The tile is dimmed, never padlocked. */
  readonly capNote?: string;
}

export interface SetSectionView {
  readonly key: "side" | "other" | "otherSide";
  readonly label: string;
  readonly tiles: readonly SetTileView[];
  /** `otherSide` only: one collapsed line, the tiles show when expanded. */
  readonly collapsedLine?: string;
  readonly expanded?: boolean;
}

/** What the summary draws besides its text: the leader, the two stages and the chosen sets. A hidden item has no face. */
export interface SummaryArt {
  readonly leader: { readonly scenarioId: string; readonly cardId: string; readonly name: string };
  readonly stages: readonly {
    readonly label: string;
    readonly name: string;
    readonly face: FaceRef | null;
    readonly hidden: boolean;
  }[];
  /** Blind: the sets are not named, only counted; the scene draws that many card backs. */
  readonly setsHidden: boolean;
  readonly sets: readonly { readonly id: string; readonly name: string; readonly faces: readonly FaceRef[] }[];
  readonly setCount: number;
}

export interface ModularStepView {
  readonly counterLine: string;
  readonly hint: string | null;
  readonly chosen: number;
  readonly rangeLabel: string;
  readonly sections: readonly SetSectionView[];
  readonly hidden: boolean;
}

export type BuilderEffect =
  | { readonly kind: "step"; readonly step: BuilderStep }
  | { readonly kind: "toggleOtherSide" }
  | { readonly kind: "start" }
  | { readonly kind: "back" }
  | { readonly kind: "random"; readonly blind: boolean; readonly request: CivilWarRandomRequest }
  | { readonly kind: "pins"; readonly pins: RandomPins };

export interface BuilderView {
  readonly title: string;
  readonly step: BuilderStep;
  readonly steps: readonly BuilderStepView[];
  readonly sideChoices: readonly SideChoice[];
  readonly leaderChoices: readonly LeaderChoice[];
  /** Shown beside the leaders in Expert; null otherwise. */
  readonly expertNote: string | null;
  readonly stageRows: readonly StageRowView[];
  /** "Public Outrage, then No Going Back."; "" when stage 2 is hidden. */
  readonly stageSummary: string;
  readonly modular: ModularStepView;
  readonly modeOptions: readonly GameModeOptionRow[];
  readonly difficulty: "standard" | "expert" | "extreme";
  /** Standard and Expert as Table setup words them; the draft's `difficulty` is the one state both screens share. */
  readonly difficultyChoices: readonly DifficultyChoice[];
  readonly blind: boolean;
  /** Keep side / Keep leader / the set count, as Random will read them. */
  readonly randomPins: readonly RandomPinView[];
  readonly isPreconstructed: boolean;
  readonly preconstructedEnabled: boolean;
  readonly summary: readonly string[];
  readonly summaryArt: SummaryArt;
  /** Every problem the offer states, in its own words; `problems[0]` is what Start shows. */
  readonly problems: readonly string[];
  readonly canStart: boolean;
  readonly startProblem: string | null;
  readonly statusLine: string | null;
  /** Every control once, in tab order: rail, the active step, then the foot. */
  readonly focusOrder: readonly string[];
  /** The counts the layout needs (`civilWarBuilderLayout` input). */
  readonly layout: {
    readonly step: BuilderStep;
    readonly setCounts: { readonly side: number; readonly other: number; readonly otherSide: number };
    readonly otherSideExpanded: boolean;
    readonly extraSets: number;
  };
}

/** The draft's Civil War leader scenario record; null when the draft is not at one. */
export function leaderScenarioOf(draft: SetupDraft, ctx: Pick<BuilderContext, "scenarios">): Scenario | null {
  return ctx.scenarios.find((s) => (s.id as string) === draft.scenarioId && s.side !== undefined) ?? null;
}

const ids = (list: readonly unknown[]): string[] => list.map((x) => x as string);

/** The sets in effect: the draft's own, or the offer's recommended four. */
export function effectiveSetIds(draft: SetupDraft, offer: PlayableScenarioOffer): readonly string[] {
  return draft.modularSetIds ?? (offer.modularSets ?? []).filter((s) => s.recommended).map((s) => s.id);
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x) => b.includes(x));

/** True when the picks are the leader's ready-made scenario: stages as recorded, sets as a set (order is irrelevant). */
export function isReadyMade(draft: SetupDraft, offer: PlayableScenarioOffer): boolean {
  const stages = offer.mainSchemeStages;
  if (!stages || !draft.civilWar) return false;
  return (
    draft.civilWar.stageIds.length === stages.recommended.length &&
    draft.civilWar.stageIds.every((id, i) => id === stages.recommended[i]) &&
    sameSet(
      effectiveSetIds(draft, offer),
      (offer.modularSets ?? []).filter((s) => s.recommended).map((s) => s.id),
    )
  );
}

function sideOfLeader(offer: PlayableScenarioOffer, scenarioId: string): string | null {
  return offer.sides?.find((s) => s.leaders.some((l) => l.scenarioId === scenarioId))?.side ?? null;
}

function leaderNameOf(offer: PlayableScenarioOffer, scenarioId: string): string {
  for (const side of offer.sides ?? []) for (const l of side.leaders) if (l.scenarioId === scenarioId) return l.name;
  return scenarioId;
}

const sideName = (offer: PlayableScenarioOffer, side: string): string =>
  offer.sides?.find((s) => s.side === side)?.name ?? side;

/** Every problem the offer states for the draft, in its words: the stage pair, the count, then each refused set. */
function problemsOf(draft: SetupDraft, offer: PlayableScenarioOffer): readonly string[] {
  const out: string[] = [];
  if (offer.mainSchemeStages?.problem) out.push(offer.mainSchemeStages.problem);
  if (offer.modularSetCount.problem) out.push(offer.modularSetCount.problem);
  for (const p of civilWarPickProblems(draft, offer)) if (!out.includes(p)) out.push(p);
  return out;
}

const stageNameOf = (offer: PlayableScenarioOffer, number: number, id: string | undefined): string =>
  offer.mainSchemeStages?.stages.find((s) => s.stageNumber === number)?.options.find((o) => o.printedCardId === id)
    ?.name ?? "";

function leaderStages(
  ctx: BuilderContext,
  scenario: Scenario,
  difficulty: BuilderView["difficulty"],
): readonly LeaderStageView[] {
  const card = ctx.cards.get(scenario.villainCardId as string) as VillainCard | undefined;
  const numbers = difficulty === "expert" ? scenario.villainStages.expert : scenario.villainStages.standard;
  return numbers.map((n) => {
    const stageIndex = card?.sides[0].stages.findIndex((s) => s.stageNumber === n) ?? -1;
    const stage = stageIndex >= 0 ? card?.sides[0].stages[stageIndex] : undefined;
    return {
      face:
        card && stageIndex >= 0
          ? faceRefOf(
              card,
              { kind: "villainStage", sideIndex: 0, stageIndex },
              `${card.name}, stage ${NUMERALS[n] ?? n}`,
            )
          : null,
      numeral: NUMERALS[n] ?? String(n),
      hp: stage ? formatScaling(stage.hp) : "",
      hpByPlayers: stage ? PLAYER_COUNTS.map((p) => scale(stage.hp, p)) : [],
    };
  });
}

/** A main scheme stage's own printed card, drawn as its B side (the one that carries the threat). */
function stageFaceOf(ctx: BuilderContext, scenario: Scenario, printedCardId: string, name: string): FaceRef | null {
  const card = ctx.cards.get(scenario.mainSchemeCardId as string);
  if (card?.type !== "main_scheme") return null;
  const stageIndex = card.stages.findIndex((stage) => stage.printedCardId === printedCardId);
  return stageIndex < 0 ? null : faceRefOf(card, { kind: "mainSchemeStage", stageIndex, side: "B" }, name);
}

/** The "cards in this set" sheet for one modular set. */
export function setSheetFor(ctx: Pick<BuilderContext, "cards" | "encounterSets">, setId: string): SetSheetView {
  const name = ctx.encounterSets.find((s) => (s.id as string) === setId)?.name ?? setId;
  return setSheetOf(setId, name, cardsBySet(ctx.cards).get(setId) ?? []);
}

function setNameOf(ctx: BuilderContext, id: string): string {
  return ctx.encounterSets.find((s) => (s.id as string) === id)?.name ?? id;
}

/** The builder, or null when the draft is not at a Civil War leader. */
/** A leader set's cards without the leader: what goes into the encounter deck. */
const encounterCardCountForSet = (setId: string, cards: ReadonlyMap<string, AnyCard>): number =>
  cardCountForSet(setId, new Map([...cards].filter(([, card]) => card.type !== "villain")));

export function builderViewOf(draft: SetupDraft, ctx: BuilderContext): BuilderView | null {
  const offer = ctx.offer ?? offerOf(draft);
  const scenario = leaderScenarioOf(draft, ctx);
  if (!scenario || !offer.sides || !offer.mainSchemeStages || !offer.modularSets || !draft.civilWar) return null;
  const step = ctx.step ?? 1;
  const blind = draft.civilWar.blind;
  const mySide = sideOfLeader(offer, draft.scenarioId) ?? scenario.side!;
  const otherSideKey = offer.sides.find((s) => s.side !== mySide)?.side ?? "";
  const leaderName = leaderNameOf(offer, draft.scenarioId);
  const chosenIds = effectiveSetIds(draft, offer);
  const range = { min: offer.modularSetCount.min, max: offer.modularSetCount.max };
  const atMax = modularAtMaxReason(range, chosenIds.length);
  const problems = problemsOf(draft, offer);
  const ready = isReadyMade(draft, offer);

  // Side (step 1) and leader (step 2) choices.
  const sideChoices = offer.sides.map<SideChoice>((s) => ({
    side: s.side,
    name: s.name,
    action: `civil:side:${s.side}`,
    selected: s.side === mySide,
    leaderNames: s.leaders.map((l) => l.name),
    leaders: s.leaders.map((l) => ({ scenarioId: l.scenarioId, cardId: l.leaderCardId, name: l.name })),
  }));
  const leaderChoices = (offer.sides.find((s) => s.side === mySide)?.leaders ?? []).map<LeaderChoice>((l) => {
    const rec = ctx.scenarios.find((x) => (x.id as string) === l.scenarioId);
    const own = rec ? ids(rec.encounterSetIds)[0] : undefined;
    const stages = rec ? leaderStages(ctx, rec, draft.difficulty) : [];
    return {
      scenarioId: l.scenarioId,
      cardId: l.leaderCardId,
      name: l.name,
      word: foeWord(ctx.cards.get(l.leaderCardId)),
      action: `civil:leader:${l.scenarioId}`,
      selected: l.scenarioId === draft.scenarioId,
      stages,
      openingStage: stages[0]?.numeral ?? "",
      // The leader card itself belongs to the set in the data; the set a player shuffles in is the other ten (MC56 p. 3).
      ownSet: own ? `${setNameOf(ctx, own)} set, ${encounterCardCountForSet(own, ctx.cards)} cards` : "",
    };
  });

  // Main scheme (step 3).
  const stageRows = offer.mainSchemeStages.stages.map<StageRowView>((row, i) => {
    const picked = draft.civilWar!.stageIds[i];
    const hidden = blind && i === 1;
    return {
      stageNumber: row.stageNumber,
      label: i === 0 ? "Stage 1 (it goes on top)" : `Stage ${row.stageNumber}`,
      hidden,
      options: hidden
        ? []
        : row.options.map((o) => ({
            printedCardId: o.printedCardId,
            name: o.name,
            targetThreat: formatScaling(o.targetThreat),
            gist: o.gist,
            action: `civil:stage:${row.stageNumber}:${o.printedCardId}`,
            selected: o.printedCardId === picked,
            recommended: o.printedCardId === offer.mainSchemeStages!.recommended[i],
            face: stageFaceOf(ctx, scenario, o.printedCardId, o.name),
          })),
    };
  });
  const stage1 = stageNameOf(offer, 1, draft.civilWar.stageIds[0]);
  const stage2 = stageNameOf(offer, 2, draft.civilWar.stageIds[1]);
  const stageSummary = blind ? "" : `${stage1}, then ${stage2}.`;

  // Modular sets (step 4).
  const bySet = cardsBySet(ctx.cards);
  const tile = (s: ModularSetLegality): SetTileView => {
    const selected = chosenIds.includes(s.id);
    const reason = !s.ok ? s.problem : !selected ? atMax : null;
    return {
      id: s.id,
      name: s.name,
      cardCount: s.cardCount,
      descriptor: descriptorForSet(s.id, ctx.cards),
      action: `civil:set:${s.id}`,
      selected,
      recommended: s.recommended,
      enabled: reason === null,
      // Only the cap is in the way: dimmed with a count, not the padlock a set that cannot be picked at all wears.
      ...(s.ok && !selected && atMax ? { capNote: `${chosenIds.length} of ${range.max} chosen` } : {}),
      faces: setFacesOf(bySet.get(s.id) ?? []),
      ...(reason !== null ? { disabledReason: reason } : {}),
    };
  };
  const sets = offer.modularSets;
  const byRecommended = (a: SetTileView, b: SetTileView): number => Number(b.recommended) - Number(a.recommended);
  const ownTiles = sets
    .filter((s) => s.side === mySide)
    .map(tile)
    .sort(byRecommended);
  const neutralTiles = sets.filter((s) => s.side === null).map(tile);
  const otherTiles = sets.filter((s) => s.side !== null && s.side !== mySide).map(tile);
  const expanded = ctx.otherSideExpanded ?? false;
  const sections: SetSectionView[] = [
    { key: "side", label: `${sideName(offer, mySide)} sets`, tiles: ownTiles },
    { key: "other", label: "Other products", tiles: neutralTiles },
    {
      key: "otherSide",
      label: `The ${sideName(offer, otherSideKey)} sets`,
      tiles: otherTiles,
      collapsedLine: OTHER_SIDE_COLLAPSED_LINE(otherTiles.length, sideName(offer, otherSideKey), leaderName),
      expanded,
    },
  ];
  const count = chosenIds.length;
  const noun =
    range.min === range.max ? `${range.max} set${range.max === 1 ? "" : "s"}` : `${range.min} or ${range.max} sets`;
  const lead = range.min === range.max ? noun : `${range.min} to ${range.max} sets`;
  const needed = Math.max(0, range.min - count);
  const allowedMore = Math.max(0, range.max - count);
  const modular: ModularStepView = {
    counterLine: `${lead}. Chosen: ${count}.`,
    hint: needed > 0 ? `Pick ${needed} more` : allowedMore > 0 ? `Room for ${allowedMore} more` : null,
    chosen: count,
    rangeLabel: noun,
    sections: blind ? [] : sections,
    hidden: blind,
  };

  // Review (step 5) and the rail's lines.
  const modeOptions = gameModeOptionsView().rows;
  const difficultyChoices = difficultyCardsFor(scenario)
    .filter((card): card is typeof card & { id: "standard" | "expert" } => card.id !== "extreme")
    .map<DifficultyChoice>((card) => ({
      id: card.id,
      name: card.name,
      description: card.description,
      action: `civil:difficulty:${card.id}`,
      selected: draft.difficulty === card.id,
    }));
  const expertNote = draft.difficulty === "expert" ? EXPERT_NOTE : null;
  const difficultyNote = draft.difficulty === "expert" ? "Expert" : "Standard";
  const standardSet = setNameOf(ctx, ids(scenario.standardEncounterSetIds)[0] ?? "");
  const expertSet = setNameOf(ctx, ids(scenario.expertEncounterSetIds)[0] ?? "");
  const ownSetId = ids(scenario.encounterSetIds)[0] ?? "";
  const chosenNames = chosenIds.map((id) => sets.find((s) => s.id === id)?.name ?? id);
  const leader = leaderChoices.find((l) => l.selected);
  const summary: string[] = [
    ready ? "Ready-made" : "Custom",
    `${foeWord(ctx.cards.get(scenario.villainCardId as string))}: ${leaderName}${leader?.openingStage ? ` (stage ${leader.openingStage})` : ""}`,
    `Side: ${sideName(offer, mySide)}`,
    `Stage 1: ${stage1}`,
    blind ? "Stage 2: hidden" : `Stage 2: ${stage2}`,
    `${leaderName} set: ${setNameOf(ctx, ownSetId)}`,
    draft.difficulty === "expert" ? `Encounter set: ${expertSet}` : `Encounter set: ${standardSet}`,
    blind ? `Modular sets: ${count} hidden` : `Modular sets: ${chosenNames.join(", ")}`,
    `Difficulty: ${difficultyNote}`,
  ];

  const canStart = problems.length === 0 && count >= range.min && count <= range.max;
  const stagesOk = !offer.mainSchemeStages.problem;
  const setsOk = !offer.modularSetCount.problem && count >= range.min && count <= range.max && problems.length === 0;
  const done: readonly boolean[] = [true, true, stagesOk, setsOk, canStart];
  const lines: readonly string[] = [
    sideName(offer, mySide),
    leaderName,
    blind ? `${stage1}, stage 2 hidden` : `${stage1}, ${stage2}`,
    blind ? `${count} sets hidden` : `${count} set${count === 1 ? "" : "s"}`,
    ready ? "Ready-made" : "Custom",
  ];
  const stageRowsFirst = stageRows[0];
  const stageRowsSecond = stageRows[1];
  const stageEntry = (
    row: StageRowView | undefined,
    number: number,
    name: string,
    hidden: boolean,
  ): SummaryArt["stages"][number] => ({
    label: `Stage ${number}`,
    name: hidden ? "Hidden" : name,
    face: hidden ? null : (row?.options.find((o) => o.selected)?.face ?? null),
    hidden,
  });
  const summaryArt: SummaryArt = {
    leader: { scenarioId: draft.scenarioId, cardId: scenario.villainCardId as string, name: leaderName },
    stages: [stageEntry(stageRowsFirst, 1, stage1, false), stageEntry(stageRowsSecond, 2, stage2, blind)],
    setsHidden: blind,
    sets: blind
      ? []
      : chosenIds.map((id) => ({
          id,
          name: sets.find((x) => x.id === id)?.name ?? id,
          faces: setFacesOf(bySet.get(id) ?? [], 1),
        })),
    setCount: count,
  };
  const steps = Array.from({ length: BUILDER_STEP_COUNT }, (_, i): BuilderStepView => {
    const n = (i + 1) as BuilderStep;
    return {
      step: n,
      action: `civil:step:${n}`,
      title: STEP_TITLES[i]!,
      line: lines[i]!,
      complete: done[i]!,
      active: n === step,
    };
  });

  // Focus order: rail, the active step's controls, the foot.
  const stepControls: string[] =
    step === 1
      ? sideChoices.map((s) => s.action)
      : step === 2
        ? leaderChoices.map((l) => l.action)
        : step === 3
          ? stageRows.flatMap((r) => r.options.map((o) => o.action))
          : step === 4
            ? modular.sections.flatMap((s) =>
                s.key === "otherSide"
                  ? ["civil:other-side", ...(expanded ? s.tiles.map((t) => t.action) : [])]
                  : s.tiles.map((t) => t.action),
              )
            : [...difficultyChoices.map((d) => d.action), ...modeOptions.map((m) => `civil:mode:${m.id}`)];
  const pins = ctx.pins ?? {};
  const rollCount = pins.modularCount ?? DEFAULT_RANDOM_COUNT;
  const randomPins: RandomPinView[] = [
    {
      action: "civil:lock:side",
      label: pins.side ? "Random keeps the side" : "Random may change the side",
      on: !!pins.side,
    },
    {
      action: "civil:lock:leader",
      label: pins.leader ? "Random keeps the leader" : "Random may change the leader",
      on: !!pins.leader,
    },
    { action: `civil:count:${rollCount === 3 ? 4 : 3}`, label: `Random draws ${rollCount} sets`, on: rollCount === 3 },
  ];
  const focusOrder = [
    ...steps.map((s) => s.action),
    ...stepControls,
    ...(step === 5 ? randomPins.map((p) => p.action) : []),
    "civil:random",
    "civil:random-blind",
    ...(blind ? ["civil:blind:show"] : []),
    "civil:preconstructed",
    "civil:back",
    "civil:start",
  ];

  return {
    title: BUILDER_TITLE,
    step,
    steps,
    sideChoices,
    leaderChoices,
    expertNote,
    stageRows,
    stageSummary,
    modular,
    modeOptions,
    difficulty: draft.difficulty,
    difficultyChoices,
    blind,
    randomPins,
    isPreconstructed: ready,
    preconstructedEnabled: !ready,
    summary,
    summaryArt,
    problems,
    canStart,
    startProblem: problems[0] ?? null,
    statusLine: ctx.status ?? null,
    focusOrder,
    layout: {
      step,
      setCounts: { side: ownTiles.length, other: neutralTiles.length, otherSide: otherTiles.length },
      otherSideExpanded: expanded,
      extraSets: ctx.extraSets ?? 0,
    },
  };
}

export interface BuilderResult {
  readonly draft: SetupDraft;
  /** The notice for the status line; null clears it. */
  readonly status: string | null;
  /** Navigation or Random, for the scene to carry out. */
  readonly effect?: BuilderEffect;
}

const unchanged = (draft: SetupDraft, status: string | null = null): BuilderResult => ({ draft, status });

/** Restores the current leader's ready-made stages and sets (keeps blind and everything off the builder). */
export function resetToReadyMade(draft: SetupDraft): SetupDraft {
  const offer = offerOf(draft);
  const recommended = offer.mainSchemeStages?.recommended ?? [];
  let next = setModularSetIds(draft, null);
  recommended.forEach((id, i) => {
    next = setMainSchemeStage(next, i + 1, id);
  });
  return next;
}

/** "Customize this scenario": the draft on that leader exactly as printed; the review step. */
export function openBuilderOn(draft: SetupDraft, scenarioId: string): { draft: SetupDraft; step: BuilderStep } {
  return { draft: resetToReadyMade(setCivilWarBlind(setScenario(draft, undefined, scenarioId), false)), step: 5 };
}

/** "Build your own": the first leader of the first side, as printed, starting at the side step. */
export function openBuilderBuildYourOwn(
  draft: SetupDraft,
  offer: PlayableScenarioOffer,
): { draft: SetupDraft; step: BuilderStep } {
  const first = offer.sides?.[0]?.leaders[0]?.scenarioId;
  if (!first) return { draft, step: 1 };
  return { draft: resetToReadyMade(setCivilWarBlind(setScenario(draft, undefined, first), false)), step: 1 };
}

function changeLeader(draft: SetupDraft, ctx: BuilderContext, scenarioId: string, preface: string): BuilderResult {
  if (scenarioId === draft.scenarioId) return unchanged(draft);
  const wasCustom = !isReadyMade(draft, ctx.offer ?? offerOf(draft));
  const next = resetToReadyMade(setScenario(draft, undefined, scenarioId));
  const name = leaderNameOf(offerOf(next), scenarioId);
  return {
    draft: next,
    status: wasCustom ? `${preface}Picks reset to ${name}'s ready-made scenario.` : null,
  };
}

/** Applies one action string. Unknown or refused actions return the same draft object. */
export function applyBuilderAction(draft: SetupDraft, action: string, ctx: BuilderContext): BuilderResult {
  const result = applyAction(draft, action, ctx);
  const was = draft.civilWar;
  const now = result.draft.civilWar;
  if (!was?.random || !now?.random || action.startsWith("civil:random")) return result;
  // Editing a rolled scenario's leader, stages or sets makes it the player's own build, not a random one.
  const same =
    result.draft.scenarioId === draft.scenarioId &&
    now.stageIds.join() === was.stageIds.join() &&
    (result.draft.modularSetIds ?? []).join() === (draft.modularSetIds ?? []).join();
  return same
    ? result
    : { ...result, draft: { ...result.draft, civilWar: { stageIds: now.stageIds, blind: now.blind } } };
}

function applyAction(draft: SetupDraft, action: string, ctx: BuilderContext): BuilderResult {
  const offer = offerOf(draft);
  const [prefix, kind, first, second] = action.split(":");
  if (prefix !== "civil" || !draft.civilWar || !offer.mainSchemeStages) return unchanged(draft);

  switch (kind) {
    case "step": {
      const n = Number(first);
      return n >= 1 && n <= BUILDER_STEP_COUNT
        ? { draft, status: null, effect: { kind: "step", step: n as BuilderStep } }
        : unchanged(draft);
    }
    case "other-side":
      return { draft, status: null, effect: { kind: "toggleOtherSide" } };
    case "back":
      return { draft, status: null, effect: { kind: "back" } };
    case "start":
      return { draft, status: null, effect: { kind: "start" } };
    case "side": {
      const target = offer.sides?.find((s) => s.side === first);
      if (!target || sideOfLeader(offer, draft.scenarioId) === first) return unchanged(draft);
      const leader = target.leaders[0];
      return leader ? changeLeader(draft, ctx, leader.scenarioId, `Changed to ${target.name}. `) : unchanged(draft);
    }
    case "leader": {
      const mySide = offer.sides?.find((s) => s.leaders.some((l) => l.scenarioId === draft.scenarioId));
      if (!first || !mySide?.leaders.some((l) => l.scenarioId === first)) return unchanged(draft);
      return changeLeader(draft, ctx, first, "");
    }
    case "stage": {
      const number = Number(first);
      const row = offer.mainSchemeStages.stages.find((s) => s.stageNumber === number);
      if (!row || !row.options.some((o) => o.printedCardId === second)) return unchanged(draft);
      return unchanged(setMainSchemeStage(draft, number, second!));
    }
    case "set": {
      const listed = offer.modularSets?.find((s) => s.id === first);
      if (!listed || !listed.ok) return unchanged(draft);
      const chosen = effectiveSetIds(draft, offer);
      if (chosen.includes(listed.id))
        return unchanged(
          setModularSetIds(
            draft,
            chosen.filter((x) => x !== listed.id),
          ),
        );
      if (modularAtMaxReason({ min: offer.modularSetCount.min, max: offer.modularSetCount.max }, chosen.length))
        return unchanged(draft);
      return unchanged(setModularSetIds(draft, [...chosen, listed.id]));
    }
    case "difficulty":
      // The same setter Table setup uses; only the two difficulties a Civil War leader has are taken.
      return first === "standard" || first === "expert" ? unchanged(setDifficulty(draft, first)) : unchanged(draft);
    case "mode": {
      const result = selectMode(draft, first === "competitive" ? "competitive" : "cooperative");
      return result.ok ? unchanged(result.draft) : unchanged(result.draft, result.message);
    }
    case "preconstructed":
      return isReadyMade(draft, offer) ? unchanged(draft) : unchanged(resetToReadyMade(draft));
    case "blind":
      return unchanged(setCivilWarBlind(draft, first !== "show"));
    case "lock": {
      const key = first === "side" ? "side" : first === "leader" ? "leader" : null;
      if (!key) return unchanged(draft);
      const pins = { ...ctx.pins, [key]: !ctx.pins?.[key] };
      return { draft, status: null, effect: { kind: "pins", pins } };
    }
    case "count": {
      const n = Number(first);
      return n === 3 || n === 4
        ? { draft, status: null, effect: { kind: "pins", pins: { ...ctx.pins, modularCount: n } } }
        : unchanged(draft);
    }
    case "random":
    case "random-blind": {
      const blind = kind === "random-blind";
      const mySide = sideOfLeader(offer, draft.scenarioId);
      const request: CivilWarRandomRequest = {
        seed: draft.seed,
        ...(ctx.pins?.side && mySide ? { side: mySide } : {}),
        ...(ctx.pins?.leader ? { leaderId: draft.scenarioId } : {}),
        ...(ctx.pins?.modularCount !== undefined ? { modularCount: ctx.pins.modularCount } : {}),
      };
      if (!ctx.random) return { draft, status: null, effect: { kind: "random", blind, request } };
      let picks: CivilWarRandomPicks;
      try {
        picks = ctx.random(request);
      } catch (error) {
        // The cards package states why the pins cannot go together; the builder says it and changes nothing.
        return unchanged(draft, error instanceof Error ? error.message : String(error));
      }
      let next = picks.leaderId === draft.scenarioId ? draft : setScenario(draft, undefined, picks.leaderId);
      next = setModularSetIds(next, picks.modularSetIds);
      picks.stageIds.forEach((id, i) => {
        next = setMainSchemeStage(next, i + 1, id);
      });
      next = setCivilWarBlind({ ...next, seed: draft.seed + 1 }, blind);
      if (next.civilWar) next = { ...next, civilWar: { ...next.civilWar, random: true } };
      return { draft: next, status: null, effect: { kind: "random", blind, request } };
    }
    default:
      return unchanged(draft);
  }
}

/** Start: the session config for the draft, or null while the offer states a problem. */
export function startConfigOf(
  draft: SetupDraft,
  players: readonly CorePlayer[],
  ctx: BuilderContext,
): SessionConfig | null {
  const view = builderViewOf(draft, ctx);
  return view?.canStart ? toSessionConfig(draft, players) : null;
}

/**
 * The offer's words for an action the view shows disabled, for the status line when the player taps it or moves focus
 * onto it (a keyboard or pad user reads the reason this way): a disabled set tile's reason, a disabled game mode's
 * reason, or Start's problem. Null for anything enabled.
 */
export function refusalOf(view: BuilderView, action: string): string | null {
  if (action === "civil:start") return view.canStart ? null : view.startProblem;
  if (action.startsWith("civil:set:")) {
    const tile = view.modular.sections.flatMap((s) => s.tiles).find((t) => t.action === action);
    return tile && !tile.enabled ? (tile.disabledReason ?? null) : null;
  }
  if (action.startsWith("civil:mode:")) {
    const row = view.modeOptions.find((m) => `civil:mode:${m.id}` === action);
    return row && !row.enabled ? (row.reason ?? null) : null;
  }
  return null;
}

/**
 * The status line when no notice is up: the engine's problem while Start is refused, else the one plain sentence that
 * reads the whole scenario ("Iron Man, Cut Off Support then Negative Zone Prison, 4 modular sets chosen of 3 to 4.").
 */
export function defaultStatusOf(view: BuilderView): string {
  if (view.startProblem) return view.startProblem;
  const leader = view.leaderChoices.find((l) => l.selected)?.name ?? "";
  const pickOf = (row: StageRowView): string => row.options.find((o) => o.selected)?.name ?? "";
  const [row1, row2] = view.stageRows;
  const schemes = view.blind || !row1 || !row2 ? "main scheme hidden" : `${pickOf(row1)} then ${pickOf(row2)}`;
  const range = /^(.*?) sets?\./.exec(view.modular.counterLine)?.[1] ?? "";
  const sets = view.blind
    ? `${view.modular.chosen} modular sets hidden`
    : `${view.modular.chosen} modular set${view.modular.chosen === 1 ? "" : "s"} chosen of ${range}`;
  return `${leader}, ${schemes}, ${sets}.`;
}
