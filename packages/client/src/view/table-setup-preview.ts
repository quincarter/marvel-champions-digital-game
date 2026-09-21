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
 *
 * **Extended for the owner's D05 correction (2026-09-18):** the desktop
 * screenshot the owner sent draws three specific panels ("COMPOSITION",
 * "WHAT'S IN THERE", "NEMESIS SETS HELD BACK" — `compositionRowsOf`/
 * `whatsInThereRowsOf`/`nemesisStandbyOf`) plus a label/value sidebar ("THE
 * GAME YOU'LL GET" — `gameSummaryRowsOf`/`TableSetupPreview`'s own new
 * fields) and a difficulty card row with a real, derived one-line description
 * per difficulty (`difficultyCardsFor`) rather than the plain text dump this
 * module used to produce. Every new number here is still read off
 * `EncounterDeckPreview`/`@mc/engine`'s `scale` exactly as before — nothing
 * added here restates a rule or invents a count `@mc/content` doesn't carry.
 */
import type { AnyCard, CardId, CardType, EncounterSet, Scenario } from "@mc/content";
import { scale, type GameSetupConfig } from "@mc/engine";
import { encounterDeckPreviewOf, type EncounterDeckPreview } from "./encounter-preview.js";
import { difficultyOptionsFor, type SetupDifficulty } from "./setup-draft.js";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;
const roman = (n: number): string => ROMAN[n] ?? String(n);

/** "A" / "A and B" / "A, B and C" — the joined-possessive shape the nemesis-standby sentence needs ("Yon-Rogg, Titania and Killmonger's nemesis cards…"). */
function joinWithAnd(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export interface TableSetupPreview {
  readonly playerCount: number;
  readonly villainName: string;
  /** How many villains are in play at once — 1 for every scenario but The Wrecking Crew's Breakout. */
  readonly villainCount: number;
  /** This difficulty's own starting stage, as a roman numeral (`stageRangeFor(scenario, difficulty)[0]`). */
  readonly villainStageLabel: string;
  readonly villainTotalHp: number;
  readonly mainSchemeThreat: number;
  readonly mainSchemeAcceleration: number;
  readonly startingThreat: number;
  /** The printed per-player rate itself (`MainSchemeStage.startingThreat.perPlayer`), not the scaled total — "12 (3 / player)" needs both. */
  readonly startingThreatPerPlayer: number;
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

function villainTotalHp(
  scenario: Scenario,
  difficulty: SetupDifficulty,
  cardsById: ReadonlyMap<string, AnyCard>,
  playerCount: number,
): number {
  const [lo, hi] = stageRangeFor(scenario, difficulty);
  const villainCardIds: readonly CardId[] = scenario.multipleVillains
    ? scenario.multipleVillains.villains.map((v) => v.villainCardId)
    : [scenario.villainCardId];
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

export interface CompositionRow {
  readonly label: string;
  readonly count: number;
  /** The one row this section draws in Hero Red text, never a fill (the screen's single red fill is "Deal it out") — the obligations row, since it's the one line in "what's shuffled in" that isn't a set the table chose. */
  readonly red: boolean;
}

/**
 * "COMPOSITION" (the owner's D05 correction): every encounter set entering
 * the deck — the villain's own required set(s), the modular set(s) chosen,
 * Standard/Expert — each with its real card count, summed across every
 * villain for a multi-villain scenario (Breakout) since the panel shows one
 * deck's worth of composition, not four side by side. The obligations row is
 * appended last and marked `red`, exactly as D05 draws it.
 */
export function compositionRowsOf(encounterDeck: EncounterDeckPreview): readonly CompositionRow[] {
  const bySet = new Map<string, { name: string; count: number }>();
  for (const deck of encounterDeck.decks) {
    for (const set of deck.bySet) {
      const existing = bySet.get(set.setId);
      bySet.set(set.setId, { name: set.setName, count: (existing?.count ?? 0) + set.cardCount });
    }
  }
  const rows: CompositionRow[] = [...bySet.values()]
    .sort((a, b) => b.count - a.count)
    .map((set) => ({ label: set.name, count: set.count, red: false }));
  if (encounterDeck.obligationsShuffledIn.length > 0) {
    rows.push({ label: "Obligations (shuffled in)", count: encounterDeck.obligationsShuffledIn.length, red: true });
  }
  return rows;
}

/** The five card-type rows "WHAT'S IN THERE" always shows, in this order — a type not represented in the deck still gets its own zero row (a real, derived zero, not an omission). */
const WHATS_IN_THERE_TYPES: readonly { readonly type: CardType; readonly label: string }[] = [
  { type: "minion", label: "Minions" },
  { type: "side_scheme", label: "Side schemes" },
  { type: "treachery", label: "Treacheries" },
  { type: "attachment", label: "Attachments" },
];

/**
 * "WHAT'S IN THERE": Minions / Side schemes / Treacheries / Attachments (each
 * a `CardType` bucket, summed across every villain deck) plus "Surge cards"
 * (the `surge` keyword, cross-cutting with the four types above — a card
 * counts in both its type row and the surge row).
 */
export function whatsInThereRowsOf(encounterDeck: EncounterDeckPreview): readonly CompositionRow[] {
  const byType = new Map<CardType, number>();
  let surgeCount = 0;
  for (const deck of encounterDeck.decks) {
    for (const bucket of deck.byType) byType.set(bucket.type, (byType.get(bucket.type) ?? 0) + bucket.count);
    surgeCount += deck.surgeCount;
  }
  const rows: CompositionRow[] = WHATS_IN_THERE_TYPES.map(({ type, label }) => ({
    label,
    count: byType.get(type) ?? 0,
    red: false,
  }));
  rows.push({ label: "Surge cards", count: surgeCount, red: false });
  return rows;
}

export interface NemesisStandby {
  readonly sentence: string;
  readonly totalCards: number;
}

/** "NEMESIS SETS HELD BACK": the sentence names the actual heroes whose nemesis sets are waiting off to the side, and the foot line totals every card across them. Null when the scenario uses no identity sets at all (The Wrecking Crew) — the panel itself is the caller's to omit or grey out in that case, not this module's. */
export function nemesisStandbyOf(encounterDeck: EncounterDeckPreview): NemesisStandby | null {
  if (encounterDeck.nemesisSetsHeldBack.length === 0) return null;
  const names = encounterDeck.nemesisSetsHeldBack.map((n) => n.heroName);
  const totalCards = encounterDeck.nemesisSetsHeldBack.reduce((sum, n) => sum + n.cardCount, 0);
  return {
    sentence: `${joinWithAnd(names)}'s nemesis cards stay out of the deck until an obligation pulls them in.`,
    totalCards,
  };
}

export interface GameSummaryRow {
  readonly label: string;
  readonly value: string;
}

/** "THE GAME YOU'LL GET" (the owner's D05 correction): label-over-value rows, every value read off `TableSetupPreview`'s own real, scaled numbers. */
export function gameSummaryRowsOf(preview: TableSetupPreview): readonly GameSummaryRow[] {
  return [
    {
      label: "Villain",
      value:
        preview.villainCount > 1
          ? `${preview.villainCount} villains · ${preview.villainTotalHp} HP total`
          : `${preview.villainName} ${preview.villainStageLabel} · ${preview.villainTotalHp} HP total`,
    },
    { label: "Main scheme", value: `${preview.mainSchemeThreat} threat · accel ${preview.mainSchemeAcceleration}` },
    { label: "Starting threat", value: `${preview.startingThreat} (${preview.startingThreatPerPlayer} / player)` },
    { label: "Encounter deck", value: `${preview.encounterDeckSize} cards` },
    { label: "Obligations", value: `${preview.obligationsCount} shuffled in` },
    { label: "Heroes", value: `${preview.playerCount}` },
  ];
}

export interface DifficultyCard {
  readonly id: SetupDifficulty;
  readonly name: string;
  readonly description: string;
}

/**
 * DIFFICULTY's own cards (the owner's D05 correction): a Bangers name and a
 * one-line description — derived from `stageRangeFor`'s own starting stage
 * for this scenario, never invented flavor text. Heroic is out of scope (§4
 * — `difficultyOptionsFor` never offers it), so this never returns more than
 * "Standard"/"Expert"/Breakout's own "Extreme".
 */
export function difficultyCardsFor(scenario: Scenario): readonly DifficultyCard[] {
  return difficultyOptionsFor(scenario).map((difficulty) => {
    const [lo] = stageRangeFor(scenario, difficulty);
    const name = difficulty === "standard" ? "Standard" : difficulty === "expert" ? "Expert" : "Extreme";
    const description =
      difficulty === "standard"
        ? `Standard encounter set only. Starts at stage ${roman(lo)}.`
        : difficulty === "expert"
          ? `Expert set added. Starts at stage ${roman(lo)}.`
          : `Every villain's A and B version in play. Starts at stage ${roman(lo)}.`;
    return { id: difficulty, name, description };
  });
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
  if (!mainScheme || mainScheme.type !== "main_scheme")
    throw new Error(`scenario ${scenario.id} main scheme ${scenario.mainSchemeCardId} not found`);
  const encounterDeck = encounterDeckPreviewOf(config, [...cardsById.values()], encounterSets);
  const firstStage = mainScheme.stages[0]!;
  const villainCard = cardsById.get(scenario.villainCardId as string);
  const villainSide =
    villainCard?.type === "villain"
      ? (villainCard.sides.find((s) => s.side === (villainCard.startingSide ?? "A")) ?? villainCard.sides[0])
      : undefined;
  return {
    playerCount,
    villainName: villainSide?.name ?? villainCard?.name ?? scenario.name,
    villainCount: scenario.multipleVillains ? scenario.multipleVillains.villains.length : 1,
    villainStageLabel: roman(stageRangeFor(scenario, difficulty)[0]),
    villainTotalHp: villainTotalHp(scenario, difficulty, cardsById, playerCount),
    mainSchemeThreat: scale(firstStage.targetThreat, playerCount),
    mainSchemeAcceleration: scale(firstStage.acceleration, playerCount),
    startingThreat: scale(firstStage.startingThreat, playerCount),
    startingThreatPerPlayer: firstStage.startingThreat.perPlayer,
    encounterDeckSize: encounterDeck.decks.reduce((sum, deck) => sum + deck.totalCards, 0),
    obligationsCount: encounterDeck.obligationsShuffledIn.length,
    encounterDeck,
  };
}
