/**
 * Playing a Civil War scenario blind (docs/phase7-wave10-client.md 2.6; MC56 p. 5 suggests not looking at the stage 2
 * main scheme and the modular sets you drew). A presentation of known state: the engine hides nothing, the save and the
 * log still hold the picks (section 8), and this module only decides which names the screens print.
 *
 * What counts as having turned up is read from the live `GameState`, never stored:
 * - **stage 2** has turned up once the central main scheme is past its first stage (`stageOrder` position, else the
 *   stage index);
 * - **a modular set** has turned up once any card of it has left the encounter deck and the set-aside pile (revealed,
 *   in play, discarded). A card found some other way also counts, so this errs towards revealing a set early, never
 *   towards hiding one that is on the table.
 * Counts are never masked.
 */
import type { AnyCard, EncounterSet } from "@mc/content";
import type { GameEvent, GameState } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import type { InspectModel } from "./inspect-model.js";

export const HIDDEN_STAGE_NAME = "Stage 2 (hidden)";
export const HIDDEN_STAGE_TEXT = "Hidden until the main scheme advances to it.";
export const HIDDEN_SET_NAME = "Hidden modular set";

/** What is still hidden in a game started blind. */
export interface BlindReveal {
  /** True once the main scheme has advanced past stage 1. */
  readonly stage2Reached: boolean;
  /** Printed id of the chosen stage 2, when the config names it. */
  readonly stage2Id: string | null;
  /** The game's modular sets (config order) and which of them have turned up. */
  readonly modularSetIds: readonly string[];
  readonly revealedSetIds: ReadonlySet<string>;
}

type BlindConfig = Pick<SessionConfig, "blind" | "modularSetIds" | "mainSchemeStageIds">;

export function stage2ReachedIn(game: GameState): boolean {
  const scheme = game.mainScheme;
  const position = scheme.stageOrder ? scheme.stageOrder.indexOf(scheme.stageIndex) : scheme.stageIndex;
  return position >= 1;
}

/** The sets of `setIds` with a card out of the encounter deck and off the set-aside pile. */
export function revealedSetsIn(game: GameState, setIds: readonly string[]): ReadonlySet<string> {
  const wanted = new Set(setIds);
  const waiting = new Set<string>(game.encounterSetAside);
  for (const deck of Object.values(game.encounterDecks)) for (const id of deck.deck) waiting.add(id);
  const revealed = new Set<string>();
  for (const instance of Object.values(game.instances)) {
    if (waiting.has(instance.instanceId)) continue;
    const card = game.cardPool[instance.cardId as string] as AnyCard | undefined;
    if (!card || !("encounterSetIds" in card)) continue;
    for (const id of card.encounterSetIds as readonly string[]) if (wanted.has(id)) revealed.add(id);
  }
  return revealed;
}

/** Null when the game was not started blind (nothing to mask). `game` null means nothing has turned up yet. */
export function blindRevealOf(config: BlindConfig | null | undefined, game: GameState | null): BlindReveal | null {
  if (!config?.blind) return null;
  const modularSetIds = config.modularSetIds ?? [];
  return {
    stage2Reached: game ? stage2ReachedIn(game) : false,
    stage2Id: config.mainSchemeStageIds?.[1] ?? null,
    modularSetIds,
    revealedSetIds: game ? revealedSetsIn(game, modularSetIds) : new Set(),
  };
}

/** The name a modular set prints under: its own once it has turned up, else the hidden word. */
export function maskedSetName(setId: string, name: string, reveal: BlindReveal | null): string {
  return reveal && reveal.modularSetIds.includes(setId) && !reveal.revealedSetIds.has(setId) ? HIDDEN_SET_NAME : name;
}

/**
 * The scenario sheet's lines for a blind game (Pause): the stage pair and the modular sets, hidden pieces as words and a
 * count. `names` supplies the printed names of the picks.
 */
export function blindSheetLines(
  reveal: BlindReveal,
  names: { readonly stage: (printedCardId: string) => string; readonly set: (setId: string) => string },
  stage1Id: string | null,
): readonly string[] {
  const stage2 = reveal.stage2Reached && reveal.stage2Id ? names.stage(reveal.stage2Id) : "hidden";
  const shown = reveal.modularSetIds.filter((id) => reveal.revealedSetIds.has(id)).map((id) => names.set(id));
  const hidden = reveal.modularSetIds.length - shown.length;
  const sets = [...shown, ...(hidden > 0 ? [`${hidden} hidden`] : [])].join(", ");
  return [...(stage1Id ? [`Stage 1: ${names.stage(stage1Id)}`] : []), `Stage 2: ${stage2}`, `Modular sets: ${sets}`];
}

/** Set breakdown rows of the encounter-deck preview with the unrevealed modular sets' names hidden (counts kept). */
export function maskSetRows<T extends { readonly setId: string; readonly setName: string }>(
  rows: readonly T[],
  reveal: BlindReveal | null,
): readonly T[] {
  if (!reveal) return rows;
  return rows.map((row) => ({ ...row, setName: maskedSetName(row.setId, row.setName, reveal) }));
}

/** The Inspect sheet of a main scheme stage the game has not reached: no name, text, keywords or art of its own. */
export function maskedStageInspect(model: InspectModel): InspectModel {
  return {
    ...model,
    name: HIDDEN_STAGE_NAME,
    rulesText: HIDDEN_STAGE_TEXT,
    printedText: null,
    flavor: null,
    keywords: [],
    keywordChips: [],
    keywordDefinitions: [],
    traits: [],
    stats: [],
    abilities: [],
    timing: [],
    art: null,
    howItWorks: null,
    footerLeft: "",
    footerRight: "",
  };
}

/** Names of encounter sets by id, for the sheet. */
export const setNamesOf = (sets: readonly EncounterSet[]): ((id: string) => string) => {
  const byId = new Map(sets.map((set) => [set.id as string, set.name]));
  return (id) => byId.get(id) ?? id;
};

/**
 * Events as the log may show them in a blind game: the "stages chosen" announcement names stage 2, so it is dropped
 * until the main scheme has advanced past stage 1. Applied to every batch folded into the log (a resumed game's whole
 * history included), so no log surface can print it.
 */
export function eventsForBlindLog(events: readonly GameEvent[], reveal: BlindReveal | null): readonly GameEvent[] {
  if (!reveal || reveal.stage2Reached) return events;
  return events.filter((event) => event.type !== "mainSchemeStagesChosen");
}
