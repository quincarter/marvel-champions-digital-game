/**
 * Table setup's "the game you'll get" (docs/phase4-screen-gaps.md §3 W2, D05):
 * villain total HP, starting threat, encounter deck size and obligation
 * count, for the seats actually chosen — unlike Scenario select's detail
 * panel (`view/scenario-detail.ts`), which shows the same numbers unscaled
 * because it runs before a player count exists.
 *
 * **Never a re-derivation of a rule.** Starting threat and villain HP are
 * `@mc/engine`'s own `scale(value, playerCount)` applied to the printed
 * `ScalingValue`s — the same function `maxHitPoints`/`mainSchemeValue` use at
 * runtime, just called ahead of a game existing. Encounter deck size and
 * obligation count are read straight off `view/encounter-preview.ts`'s
 * `EncounterDeckPreview` (S3, already landed) rather than counted again here.
 *
 * **`config` is a `GameSetupConfig`** the caller already built with
 * `buildScenario`/`coreScenario` for the draft's current scenario, difficulty,
 * modular sets and seated players — the same object `EngineSessionCore.start`
 * would hand to `createGame`, and the same one `encounterDeckPreviewOf` reads
 * (`view/encounter-preview.ts`'s own doc comment on why this is safe: pure,
 * side-effect-free data assembly, not a `GameState`).
 *
 * **Villain total HP is a display rollup, not a rule.** "How much HP does
 * this whole fight have" sums every stage's HP across the difficulty's own
 * stage range (RRG 1.8 Appendix II; `Scenario.villainStages`) — nothing about
 * damage, defeat order or overkill is decided here, only printed numbers
 * added together, the same descriptive-not-rules-query line `view/deck-stats.ts`
 * (S1) already draws for a deck's cost curve. "Extreme" (Breakout's own
 * challenge: every villain's version A in play with its B underneath, RRG
 * insert "Adjustable Difficulty") has no single `Scenario.villainStages` range
 * of its own, so it's the union of `standard` and `expert`'s ranges — version
 * A's stage plus version B's, exactly the two stages that challenge plays
 * through.
 */
import type { AnyCard, CardId, EncounterSet, Scenario } from "@mc/content";
import { scale, type GameSetupConfig } from "@mc/engine";
import { encounterDeckPreviewOf, type EncounterDeckPreview } from "./encounter-preview.js";
import type { SetupDifficulty } from "./setup-draft.js";

export interface TableSetupPreview {
  readonly playerCount: number;
  readonly villainTotalHp: number;
  readonly startingThreat: number;
  readonly encounterDeckSize: number;
  readonly obligationsCount: number;
  readonly encounterDeck: EncounterDeckPreview;
}

/** The villain stage-number range this difficulty covers — `Scenario.villainStages[difficulty]`, or the union of standard and expert for Breakout's own "extreme". */
export function stageRangeFor(scenario: Scenario, difficulty: SetupDifficulty): readonly [number, number] {
  if (difficulty !== "extreme") return scenario.villainStages[difficulty];
  const [standardLo, standardHi] = scenario.villainStages.standard;
  const [expertLo, expertHi] = scenario.villainStages.expert;
  return [Math.min(standardLo, expertLo), Math.max(standardHi, expertHi)];
}

function villainTotalHp(scenario: Scenario, difficulty: SetupDifficulty, cardsById: ReadonlyMap<string, AnyCard>, playerCount: number): number {
  const [lo, hi] = stageRangeFor(scenario, difficulty);
  const villainCardIds: readonly CardId[] = scenario.multipleVillains ? scenario.multipleVillains.villains.map((v) => v.villainCardId) : [scenario.villainCardId];
  let total = 0;
  for (const villainCardId of villainCardIds) {
    const card = cardsById.get(villainCardId as string);
    if (!card || card.type !== "villain") continue;
    const side = card.sides.find((s) => s.side === (card.startingSide ?? "A")) ?? card.sides[0];
    if (!side) continue;
    for (const stage of side.stages) {
      if (stage.stageNumber >= lo && stage.stageNumber <= hi) total += scale(stage.hp, playerCount);
    }
  }
  return total;
}

/**
 * "The encounter deck you're building" (S3) as text lines, one per villain
 * deck plus a breakdown by set and by card type — the same "count the lines
 * before laying out" rule `view/scenario-detail.ts`'s `scenarioDetailLines`
 * uses, so `view/table-setup-layout.ts` can flex its own panel to fit.
 */
export function encounterDeckPreviewLines(encounterDeck: EncounterDeckPreview): readonly string[] {
  const lines: string[] = [];
  for (const deck of encounterDeck.decks) {
    lines.push(`${deck.villainName}'s deck: ${deck.totalCards} cards`);
    for (const set of deck.bySet) lines.push(`  ${set.setName}: ${set.cardCount}`);
  }
  if (encounterDeck.obligationsShuffledIn.length > 0) {
    lines.push(`Obligations shuffled in: ${encounterDeck.obligationsShuffledIn.map((o) => `${o.heroName}'s ${o.obligationName}`).join(", ")}`);
  }
  if (encounterDeck.nemesisSetsHeldBack.length > 0) {
    lines.push(`Nemesis sets held back: ${encounterDeck.nemesisSetsHeldBack.map((n) => n.setName).join(", ")}`);
  }
  return lines;
}

/** "The game you'll get" as text lines — the headline numbers a table setup screen shows before "Deal it out". */
export function gamePreviewLines(preview: TableSetupPreview): readonly string[] {
  return [
    `${preview.playerCount} player${preview.playerCount === 1 ? "" : "s"}`,
    `Villain total HP: ${preview.villainTotalHp}`,
    `Starting threat: ${preview.startingThreat}`,
    `Encounter deck size: ${preview.encounterDeckSize}`,
    `Obligations: ${preview.obligationsCount}`,
  ];
}

export function tableSetupPreviewOf(
  config: GameSetupConfig,
  scenario: Scenario,
  difficulty: SetupDifficulty,
  cardsById: ReadonlyMap<string, AnyCard>,
  encounterSets: readonly EncounterSet[],
): TableSetupPreview {
  const playerCount = config.players.length;
  const mainScheme = cardsById.get(scenario.mainSchemeCardId as string);
  if (!mainScheme || mainScheme.type !== "main_scheme") throw new Error(`scenario ${scenario.id} main scheme ${scenario.mainSchemeCardId} not found`);
  const encounterDeck = encounterDeckPreviewOf(config, [...cardsById.values()], encounterSets);
  return {
    playerCount,
    villainTotalHp: villainTotalHp(scenario, difficulty, cardsById, playerCount),
    startingThreat: scale(mainScheme.stages[0]!.startingThreat, playerCount),
    encounterDeckSize: encounterDeck.decks.reduce((sum, deck) => sum + deck.totalCards, 0),
    obligationsCount: encounterDeck.obligationsShuffledIn.length,
    encounterDeck,
  };
}
