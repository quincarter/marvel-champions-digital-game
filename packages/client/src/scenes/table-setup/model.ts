/**
 * What Set up the table shows, worked out from the draft once per draw (the engine's own preview, the setup options, the
 * modular picker): the composers (`wide.ts`, `compact.ts`) only lay this out and never decide anything.
 */
import type { Deck, Scenario } from "@mc/content";
import {
  buildScenarioWithLoadedPacks,
  POOL_ENCOUNTER_SETS,
  POOL_VERSION,
  currentCardsById,
  currentDeps,
  currentEncounterSets,
  currentPool,
  currentScenarios,
} from "../../content/pool.js";
import { appSession } from "../../session.js";
import { tableRulesOf } from "../../settings.js";
import { installedSetupHouseRules } from "../../packs/game-packs.js";
import { progressionScope } from "../../progression/progression-scope.js";
import { houseModularAllowed } from "../../view/house-modular-sets.js";
import type { DeckOption } from "../../view/deck-list-model.js";
import { seatableDeckOptionsOf } from "../../view/seatable-decks.js";
import { corePlayerForSeat } from "../../view/deck-seat.js";
import { roomSetupActive } from "../../view/room-table-setup.js";
import { blindRevealOf } from "../../view/civil-war-blind.js";
import { civilWarTableSummaryOf, type CivilWarTableSummary } from "../../view/civil-war-table-summary.js";
import {
  houseSetCount,
  modularDealBlockOf,
  modularSetOptionsFor,
  pickedSetCount,
  requiredEncounterSetsFor,
  type ModularSetOption,
  type RequiredEncounterSet,
} from "../../view/modular-sets.js";
import { modularHeaderRightLabel } from "../../view/modular-summary.js";
import { offersRandomModularSets } from "../../view/modular-random.js";
import { scenarioDetailOf } from "../../view/scenario-detail.js";
import {
  hasSetAsideModularChoice,
  hoodModularSetOptionsFor,
  type HoodModularSetOption,
} from "../../view/hood-modular-sets.js";
import { hasTowerDefenseSetupDamageOption, toSessionConfig, type SetupDraft } from "../../view/setup-draft.js";
import { scenarioOfDraft, setupOptionRowsOf, splitOptionRows, type SetupOptionRow } from "../../view/setup-options.js";
import {
  blindWhatsInThereRows,
  compositionRowsOf,
  difficultyCardsFor,
  gameSummaryRowsOf,
  nemesisStandbyOf,
  tableSetupPreviewOf,
  whatsInThereRowsOf,
  type CompositionRow,
  type DifficultyCard,
  type GameSummaryRow,
  type NemesisStandby,
  type TableSetupPreview,
} from "../../view/table-setup-preview.js";
import { t } from "../../i18n/translate.js";
import type { SeatCell } from "./seating/seating.types.js";

/** Every encounter set's printed name, for the Standard and Expert chips. */
const POOL_SET_NAMES: ReadonlyMap<string, string> = new Map(
  POOL_ENCOUNTER_SETS.map((set) => [set.id as string, set.name]),
);

export interface TableModel {
  readonly draft: SetupDraft;
  readonly scenario: Scenario;
  readonly villainName: string;
  readonly players: readonly ReturnType<typeof corePlayerForSeat>[];
  readonly deckOptions: readonly DeckOption[];
  readonly cw: CivilWarTableSummary | null;
  readonly requiredSets: readonly RequiredEncounterSet[];
  readonly modularOptions: readonly ModularSetOption[];
  /** Why "Deal it out" waits (the modular picks, a builder refusal), or null when it can deal. */
  readonly dealBlocked: string | null;
  readonly allOptionRows: readonly SetupOptionRow[];
  readonly setChoices: readonly SetupOptionRow[];
  readonly optionRows: readonly SetupOptionRow[];
  readonly towerDefense: boolean;
  readonly hoodOptions: readonly HoodModularSetOption[];
  readonly compositionRows: readonly CompositionRow[];
  readonly whatsInThereRows: readonly CompositionRow[];
  readonly nemesis: NemesisStandby | null;
  readonly summaryRows: readonly GameSummaryRow[];
  readonly encounterDeckSize: number;
  readonly preview: TableSetupPreview | null;
  readonly difficultyCards: readonly DifficultyCard[];
  readonly modularRight: string;
  readonly pickedCount: number;
  readonly randomSets: boolean;
  readonly seats: readonly SeatCell[];
}

export const scenarioOf = (draft: SetupDraft): Scenario =>
  scenarioOfDraft(
    draft,
    currentScenarios().find((s) => (s.id as string) === draft.scenarioId)!,
  );

export const deckOptionsOf = (saved: readonly Deck[]): readonly DeckOption[] =>
  seatableDeckOptionsOf(saved, currentPool(), POOL_VERSION, currentDeps());

function seatCellsOf(draft: SetupDraft, options: readonly DeckOption[]): readonly SeatCell[] {
  return draft.seats.map((deckId, index) => {
    const option = options.find((o) => (o.deck.id as string) === deckId);
    const first = draft.firstPlayerIndex === index || (draft.firstPlayerIndex === null && index === 0);
    return {
      index,
      name: option?.identityName ?? "?",
      meta: first ? t("tableSetup.firstPlayer") : t("tableSetup.seatN", { n: index + 1 }),
      chipLabel: index === 0 ? t("tableSetup.you") : t("tableSetup.seatShort", { n: index + 1 }),
      identityCardId: option?.deck.identityCardId as string | undefined,
      selected: first,
    };
  });
}

export function tableModelOf(draft: SetupDraft, saved: readonly Deck[]): TableModel {
  const settings = appSession().settings;
  const scenario = scenarioOf(draft);
  const deckOptions = deckOptionsOf(saved);
  // Room mode (#880): the heroes are not known yet, so the preview is dealt with stand-in precon heroes, one per seat.
  const players = roomSetupActive()
    ? deckOptions
        .filter((o) => o.seatable && o.deck.source.kind === "precon")
        .slice(0, draft.seats.length)
        .map((option) => corePlayerForSeat(option))
    : draft.seats
        .map((deckId) => deckOptions.find((o) => (o.deck.id as string) === deckId))
        .filter((o): o is DeckOption => o !== undefined)
        .map((option) => corePlayerForSeat(option, draft.deckSwaps));
  const cards = currentCardsById();
  // A Civil War build: the read-only summary stands in for the picker.
  const cw = civilWarTableSummaryOf(draft, {
    cards,
    scenarios: currentScenarios(),
    encounterSets: POOL_ENCOUNTER_SETS,
  });
  const requiredSets = cw ? [] : requiredEncounterSetsFor(scenario, cards);
  const modularOptions = cw
    ? []
    : modularSetOptionsFor(draft, scenario, cards, {
        scope: progressionScope(),
        allowMore: settings.allowExtraModularSets,
      });
  let dealBlocked = cw ? null : modularDealBlockOf(draft, scenario);
  const allOptionRows = setupOptionRowsOf(
    draft,
    POOL_SET_NAMES,
    undefined,
    installedSetupHouseRules(),
    progressionScope(),
  );
  const { setChoices, cards: optionRows } = splitOptionRows(allOptionRows);
  const hoodOptions = hasSetAsideModularChoice(scenario) ? hoodModularSetOptionsFor(draft, scenario, cards) : [];

  let compositionRows: readonly CompositionRow[] = [];
  let whatsInThereRows: readonly CompositionRow[] = [];
  let nemesis: NemesisStandby | null = null;
  let summaryRows: readonly GameSummaryRow[] = [];
  let encounterDeckSize = 0;
  let preview: TableSetupPreview | null = null;
  let startStage: number | undefined;
  if (players.length > 0 && dealBlocked === null) {
    const options = toSessionConfig(
      draft,
      players,
      currentScenarios().find((s) => s.id === scenario.id),
      tableRulesOf(settings),
    );
    // A builder refusal (a stale save, a house set the scenario cannot take) is shown on the screen, which keeps Deal off.
    let config: ReturnType<typeof buildScenarioWithLoadedPacks> | null = null;
    try {
      config = buildScenarioWithLoadedPacks(draft.scenarioId, options);
    } catch (error) {
      dealBlocked = error instanceof Error ? error.message : String(error);
    }
    if (config) {
      startStage = config.villainStartStageIndex;
      preview = tableSetupPreviewOf(
        config,
        scenario,
        draft.difficulty,
        cards,
        currentEncounterSets(),
        undefined,
        blindRevealOf(options, null),
        options.modes?.skirmish?.villainVersion,
      );
      compositionRows = compositionRowsOf(preview.encounterDeck);
      whatsInThereRows = whatsInThereRowsOf(preview.encounterDeck);
      if (options.blind) whatsInThereRows = blindWhatsInThereRows(whatsInThereRows);
      // Which nemesis sets come in depends on the heroes, which a room's players choose later.
      nemesis = roomSetupActive() ? null : nemesisStandbyOf(preview.encounterDeck);
      summaryRows = gameSummaryRowsOf(preview, tableRulesOf(settings));
      encounterDeckSize = preview.encounterDeckSize;
    }
  }
  return {
    draft,
    scenario,
    villainName: scenarioDetailOf(scenario, cards, currentEncounterSets()).displayName,
    players,
    deckOptions,
    cw,
    requiredSets,
    modularOptions,
    dealBlocked,
    allOptionRows,
    setChoices,
    optionRows,
    towerDefense: hasTowerDefenseSetupDamageOption(scenario),
    hoodOptions,
    compositionRows,
    whatsInThereRows,
    nemesis,
    summaryRows,
    encounterDeckSize,
    preview,
    // The cards say where the game begins: Apocalypse's easier start moves the standard card's stage to I.
    difficultyCards: difficultyCardsFor(
      scenario,
      draft.difficulty === "standard" && draft.easierStart ? startStage : undefined,
    ),
    modularRight: cw
      ? cw.build
      : modularHeaderRightLabel(
          scenario,
          requiredSets.length,
          draft.seats.length,
          pickedSetCount(modularOptions),
          settings.allowExtraModularSets && houseModularAllowed(scenario) ? houseSetCount(modularOptions) : null,
        ),
    pickedCount: cw ? cw.setCount : pickedSetCount(modularOptions) + houseSetCount(modularOptions),
    randomSets: !cw && offersRandomModularSets(scenario, draft.seats.length),
    seats: seatCellsOf(draft, deckOptions),
  };
}
