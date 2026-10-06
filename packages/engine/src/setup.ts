import { modeOnlyFlipped } from "./query.js";
import type {
  AnyCard,
  CardId,
  CoreAspect,
  DeckCardEntry,
  DeckContents,
  HeroIdentityCard,
  ScenarioSeparateDeck,
  VillainSideLetter,
} from "@mc/content";
import { DEFAULT_DEPS, type EngineDeps, type RuleSpec } from "./abilities.js";
import { NO_CAMPAIGN_WRITES, type CampaignGameInput } from "./campaign.js";
import { isPermanentCard, unbuildableSeparateDeck, validateDeck, type DeckContext } from "./deck.js";
import { createCtx, emit, setStep, type Ctx } from "./ctx.js";
import { engineError, type EngineError, type IllegalDeck } from "./errors.js";
import { runFlow } from "./flow.js";
import type { OutsideFacts } from "./outside-facts.js";
import { encounterDeckId, instanceId, playerId, type EncounterDeckId, type InstanceId, type PlayerId } from "./ids.js";
import { createRng, nextInt } from "./rng.js";
import {
  FIRST_CAMPAIGN_STEP,
  FIRST_STANDALONE_STEP,
  resolveScenarioSetup,
  stepAfterScenarioSetupAbilities,
} from "./setup-steps.js";
import { cardsMatch } from "./unique.js";
import { separatedSideCards } from "./separated-identity.js";
import {
  NO_STATUSES,
  type CardHome,
  type CardInstance,
  type EncounterDeckState,
  type GameState,
  type PlayerState,
  type ScenarioDeckState,
  type ScenarioSetupInstruction,
  type SeparateDeckState,
  type VillainState,
  type SetAsideModularSet,
  type StackedDecks,
  type TableRules,
} from "./state.js";
import type { GameEvent } from "./events.js";

export interface PlayerSetup {
  readonly identityCardId: CardId;
  readonly deck: readonly CardId[];
  /**
   * The deck's chosen aspect(s), as the player declared them. Always read: an encounter set included because a player
   * chose an aspect (`GameSetupConfig.autoIncludedSets`) tests this declaration, never the cards in the deck (RRG 1.8
   * FAQ, Crisis of Infinite Deadpools, p. 64), so a seat that supplies none has chosen none. Under
   * `GameSetupConfig.requireLegalDecks` an absent choice is also an illegal deck.
   */
  readonly aspects?: readonly CoreAspect[];
  /**
   * Mulligans this seat may take after its first one, in RRG 1.8 Appendix II step 15 (docs/phase7-wave5.md §3.26): each
   * is another full mulligan (discard any number, draw back up). Absent or 0: the one mulligan every player has. Set by
   * a campaign's setup (MC27 p. 22 reputation node 5, with the RRG 1.8 p. 67 erratum).
   */
  readonly extraMulligans?: number;
  /**
   * Facts from outside the game that are known before it starts (docs/phase7-wave7.md §3.83), such as whether this
   * seat's player won their previous game (§4.1 Q48). The client supplies them; the engine stores them in
   * `PlayerState.outsideFacts` and never looks anything up itself, so the game replays from its log. An absent fact
   * is false.
   */
  readonly outsideFacts?: OutsideFacts;
}

/** A seat's expanded deck list collapsed into decklist lines, in first-appearance order. */
const deckContentsOf = (setup: PlayerSetup): DeckContents => {
  const quantities = new Map<CardId, number>();
  for (const id of setup.deck) quantities.set(id, (quantities.get(id) ?? 0) + 1);
  const cards: DeckCardEntry[] = [...quantities].map(([cardId, quantity]) => ({ cardId, quantity }));
  return { identityCardId: setup.identityCardId, aspects: setup.aspects ?? [], cards };
};

/**
 * The deck rules a campaign game's seat is judged by (docs/campaign-mode-design.md §8): its locked identity, the
 * copies the campaign granted it (legal, and exempt from deck size — MC10 p. 3), and the campaign's removals
 * (RRG 1.8 p. 29). Without this a campaign game refuses the very cards its own campaign added, from the second
 * scenario on.
 *
 * `CampaignGameInput` carries no `@mc/content` `Campaign` record — the engine never names a box — so the
 * campaign's own sets are read off what it granted: every granted copy was put there by the campaign's definition,
 * and a campaign-specific card names its set (`specificTo.encounterSetId`). A campaign card nobody was granted
 * therefore still fails, as "not granted" when its set is one the campaign has granted from, and as "from a
 * different product" otherwise — refused either way, which is the rule; only the wording is the narrower one.
 */
function campaignDeckContextOf(
  campaign: CampaignGameInput,
  seatIndex: number,
  pool: Readonly<Record<string, AnyCard>>,
): DeckContext {
  const seat = campaign.seats[seatIndex];
  const granted = seat?.grantedCardIds ?? [];
  const campaignSetIds = new Set<string>();
  for (const id of granted) {
    const card = pool[id];
    const specificTo = card && "specificTo" in card ? card.specificTo : undefined;
    if (specificTo?.kind === "campaign") campaignSetIds.add(specificTo.encounterSetId);
  }
  return {
    campaign: {
      campaignId: campaign.campaignId,
      campaignSetIds: [...campaignSetIds],
      identityCardId: seat?.identityCardId ?? "",
      grantedCardIds: granted,
      removedFromCampaign: campaign.removedFromCampaign,
    },
  };
}

/**
 * One villain of a scenario with several villains in play at once (`Scenario.multipleVillains`; The Wrecking Crew
 * insert, "Prepare Villains and Dials" and "Prepare Encounter Decks").
 */
export interface VillainSetup {
  readonly villainCardId: CardId;
  /** Absent: the card's `startingSide`, else "A". */
  readonly side?: VillainSideLetter;
  /** Its first stage (version A: 0, version B: 1). Default 0. */
  readonly startStageIndex?: number;
  /** Its last stage (the extreme challenge starts on A with B last). Defaults to the side's last stage. */
  readonly lastStageIndex?: number;
  /**
   * The printed version this villain plays at, as shorthand for the two stage indexes (The Wrecking Crew insert,
   * "Adjustable Difficulty"): `"A"` is the version-A stage alone (standard), `"B"` the version-B stage alone
   * (expert), and `"extreme"` starts on A with B under it — "When the version A of a villain is defeated, its
   * version B enters play, and the game is won only after all version-B villains are defeated", which is an ordinary
   * stage advance (docs/phase7-wave1.md §4.6). Each villain chooses its own, so a mixed table is legal. Setting it
   * alongside `startStageIndex` / `lastStageIndex` is refused rather than silently resolved.
   */
  readonly version?: "A" | "B" | "extreme";
  /** This villain's own encounter deck: "Each villain … has its own encounter deck of 15 cards". */
  readonly encounterDeck: readonly CardId[];
  /** Its signature side scheme, created set aside (`encounterSetAside`) and linked to this villain. */
  readonly signatureSideSchemeCardId?: CardId;
}

/**
 * Cards to put on top of decks right after setup's seeded shuffle (`GameSetupConfig.stack`), top card first.
 *
 * - `players` is keyed by **seat index**, the index into `GameSetupConfig.players` (0 is the first seat, `p1`), the
 *   same indexing as `firstPlayerIndex`. JSON turns the keys into strings ("0"), which reads back the same.
 * - `encounter` stacks the first encounter deck (the first villain's, or the shared one), which after setup's step 10
 *   also holds the identities' obligations.
 *
 * Each listed code takes one copy of that card out of the deck: the topmost copy after the shuffle, so every other card
 * keeps its shuffled relative order. Listing a code twice takes two copies. A code the deck doesn't hold (or holds
 * fewer times than listed) is `invalid_setup`.
 *
 * Setup cards (RRG 1.8 Appendix II step 11) and a scenario deck built at setup still leave the encounter deck
 * afterward, as they would from any position, so stacking one of those gains nothing.
 */
export interface SetupStack {
  readonly players?: Readonly<Record<number, readonly CardId[]>>;
  readonly encounter?: readonly CardId[];
}

export interface GameSetupConfig {
  readonly seed: number;
  /** Every card the game can reference; stored in state so a save replays standalone. */
  readonly cards: readonly AnyCard[];
  /** The villain; with `villains`, the first of them. */
  readonly villainCardId: CardId;
  /** Absent: the card's `startingSide`, else "A". */
  readonly villainSide?: VillainSideLetter;
  /** Standard play starts at stage I, expert at stage II (RRG "Modes of Play"). */
  readonly villainStartStageIndex?: number;
  /** The last villain stage used (standard: stage II, expert: stage III). Defaults to the side's last stage. */
  readonly villainLastStageIndex?: number;
  /**
   * Several villains in play at once, in printed order, each with its own encounter deck and optional signature
   * side scheme. When set, `villainCardId` must name the first of them, `encounterDeck` must be empty and the
   * single-villain side/stage fields must be absent: each villain carries its own. The first villain starts with
   * the active counter; a setup ability moves it (`setActiveVillain`).
   */
  readonly villains?: readonly VillainSetup[];
  /**
   * With `villains`: every villain shares the one encounter deck `encounterDeck` builds, instead of each having its own
   * (Tower Defense, `MultipleVillains.encounterDecks: "shared"`; MC21 p. 10, "Encounter Deck: Tower Defense, Armies of
   * Titan, and Standard sets"). Each villain's own `encounterDeck` must then be empty. docs/phase7-wave4.md §3.2.
   */
  readonly sharedEncounterDeck?: boolean;
  /**
   * Every villain starts set aside (out of play, in `encounterSetAside`), and the main scheme's Setup brings the first
   * ones in (`addVillain`). Until then no villain is in play and "the villain" is nobody
   * (`GameState.villainsEnteringAtSetup`).
   *
   * - With `villains` (`MultipleVillains.atSetup: "setAside"`): The Sinister Six, Sinister Synchronization 1A (`sm`
   *   27100a), "Choose X villains at random … Put those villains into play". docs/phase7-wave5.md §3.1.
   * - Without (`Scenario.startingVillain: "bySetup"`): a single-villain game whose villain the main scheme's Setup
   *   chooses, among `villainCardId` and `setAsideVillainCardIds`, all of them set aside (On the Run, Gotta Get Away
   *   1A: "Put 1 random MARAUDER villain into play. Remove the minion with the same title as the villain, along with
   *   each other villain, from the game."). `villainCardId` stays listed in `GameState.villains`, out of play, and
   *   holds the active counter and the encounter deck until one enters; the others are plain set-aside cards, as
   *   `setAsideVillainCardIds` always are. A villain enters on its card's starting side and first stage (`addVillain`),
   *   so `villainSide` and the stage indexes must say the same, and not with `randomStartingVillain`, which draws
   *   before any setup text resolves. docs/phase7-wave7.md §3.42.
   */
  readonly villainsStartSetAside?: true;
  /** `ScenarioRules.activeCounter` (The Sinister Six's activation order; docs/phase7-wave5.md §3.1). */
  readonly activeCounter?: "nextInActivationOrder";
  /**
   * RRG Appendix II: each identity's obligation (`HeroIdentityCard.obligationCardId`) is shuffled into the
   * encounter deck and its nemesis set (`nemesisEncounterSetId`, `quantityInSet` copies of each card) is set
   * aside. Cards missing from `cards` are skipped unless `requireIdentitySets` is set. Default true.
   */
  readonly includeIdentitySets?: boolean;
  readonly requireIdentitySets?: boolean;
  /**
   * Refuse any seat whose deck is not legal under the RRG deckbuilding rules (`validateDeck`),
   * with `illegal_deck`. Off by default so engine tests can seat small synthetic decks. Real
   * content (`coreScenario`) turns it on. There is no "play it anyway" opt-out for real games.
   */
  readonly requireLegalDecks?: boolean;
  readonly mainSchemeCardId: CardId;
  /** The encounter deck of a single-villain scenario. Empty when `villains` gives each villain its own. */
  readonly encounterDeck: readonly CardId[];
  readonly players: readonly PlayerSetup[];
  readonly firstPlayerIndex?: number;
  /**
   * Villain cards of the scenario set aside out of play at setup, for card abilities to add (`addVillain`; The Once and
   * Future Kang insert, "Setup": "Kang (II) and Kang (III) will enter play through the card effects on main schemes 3A
   * and 4A"). Created in `encounterSetAside`, homed to the first encounter deck. Expert substitution
   * (`Scenario.expertVillains`) is the scenario builder's: pass the expert cards here (`villainsForDifficulty`).
   */
  readonly setAsideVillainCardIds?: readonly CardId[];
  /**
   * `Scenario.startingVillain: "random"` (Loki, MC21 p. 24: "choose one Loki villain card at random, reveal it and put
   * it into play. Set the remaining four versions of Loki aside"): the villain that starts is chosen with the game's
   * seeded RNG among `villainCardId` and `setAsideVillainCardIds`, and the rest are set aside. docs/phase7-wave4.md §3.7.
   */
  readonly randomStartingVillain?: true;
  /**
   * The number `Scenario.victoryCondition` gives for the modes being played (the scenario builder picks it): "If the
   * number of Lokis in the victory display is equal to the victory condition, the players win the game" (All Hail King
   * Loki 1B). Read by `ValueSpec victoryCondition`. docs/phase7-wave4.md §3.7.
   */
  readonly victoryCondition?: number;
  /**
   * Rules the scenario itself imposes, printed in its rulebook rather than on any card: "When a player reveals a Spell
   * environment, they place that card in front of them in their play area" (Ebony Maw, MC21 p. 6) is
   * `[{ kind: "entersRevealersPlayArea", cards: { trait: SPELL } }]`. In force for the whole game, read by `activeRules`
   * like a constant on a card in play, with no card as "self" and nobody as "you". docs/phase7-wave4.md §3.40.
   */
  readonly scenarioRuleSpecs?: readonly RuleSpec[];
  /**
   * Setup instructions the scenario's rulebook prints rather than a card, which the scenario builder includes when
   * the players chose them: MC21 p. 11's "Modular Difficulty" for Tower Defense ("they may place damage on Avengers
   * Tower during setup"; docs/phase7-wave4.md §4 Q4). Each resolves once, in order, as scenario text resolved by the
   * first player, after Appendix II step 12's Setup and When Revealed abilities and before step 14's draw. Absent or
   * empty: the game is exactly the game it was before this field existed.
   */
  readonly scenarioSetupInstructions?: readonly ScenarioSetupInstruction[];
  /**
   * The mode being played, standard (default) or expert (RRG 1.8 "Modes of Play", p. 29). Villain stages and the
   * expert set are the scenario builder's; the engine reads this only for "Standard Mode Only" / "Expert Mode Only"
   * faces (`modeOnly`): RRG 1.8 "Double-Sided Card" (p. 17), such a card "is put into play with the 'Expert Mode Only'
   * side faceup if the players are playing expert mode". docs/phase7-wave4.md §3.18.
   */
  readonly difficulty?: "standard" | "expert";
  /** The table's own options (`TableRules`, `state.ts`): each defaults to off; stored in the state when on. */
  readonly tableRules?: TableRules;
  /**
   * Modular encounter sets set aside at setup instead of shuffled in (`Scenario.setAsideModularSetCount`; Making
   * Connections 1A, The Hood: "Choose 7 modular encounter sets and set them aside (you may choose randomly)"). Each is
   * its set id and its cards, one entry per copy; they are created in `encounterSetAside` and recorded in
   * `GameState.setAsideModularSets` for `EffectSpec shuffleInSetAsideModularSet`. Which sets, and that none is a
   * Standard/Expert classification set (RRG 1.8 "Standard Set", p. 40), is the scenario builder's choice.
   * docs/phase7-wave4.md §3.18.
   */
  readonly setAsideModularSets?: readonly { readonly encounterSetId: string; readonly cardIds: readonly CardId[] }[];
  /** `Scenario.victory`. Absent: `"finalVillainStage"` (RRG 1.8 "Villain Defeat", p. 47). */
  readonly victory?: "finalVillainStage" | "cardAbility";
  /** Whether card abilities may create separate game areas (`Scenario.separateGameAreas` is present). Default false. */
  readonly separateGameAreas?: boolean;
  /**
   * `Scenario.separateDecks` (docs/phase7-wave2.md §3.3). Each starts empty; the main scheme's 1A `Setup:` builds it
   * (`buildScenarioDeck`), moving the matching cards out of the encounter deck built at Appendix II step 10.
   */
  readonly scenarioDecks?: readonly (ScenarioSeparateDeck & {
    /**
     * Built during scenario setup with no card text asking (an encounter set's own deck, `EncounterSet.separateDecks`:
     * the Infinity Stone deck, MC21 p. 16). docs/phase7-wave4.md §3.6.
     */
    readonly buildAtSetup?: true;
  })[];
  /**
   * Scenario cards that start set aside, out of play (RRG 1.8 "Set Aside", p. 39): Taskmaster's Captive allies, The
   * Sleeper, Kang's Dominion. Created in `encounterSetAside`, never in the encounter deck. A player card among them has
   * no owner until a player takes it (RRG 1.8 "Ownership and Control", p. 31).
   */
  readonly setAside?: readonly CardId[];
  /**
   * Encounter sets no one picks, each in the game exactly when its `when` holds (docs/phase7-wave7.md §3.74, §4 Q44).
   * Deadpool insert, "Using the 'Pool Aspect": "When setting up a game in which at least one player is using the 'Pool
   * aspect, shuffle 1 copy of the Crisis of Infinite Deadpools (#37) treachery card into the encounter deck. Set the
   * rest of the Dreadpool modular encounter set aside." The scenario builder lists every such set of its card pool,
   * whatever the seats chose, and the engine decides: when the condition holds, `shuffledIn` joins the first encounter
   * deck before it is shuffled (RRG 1.8 Appendix II step 10, p. 51) and the rest are created in `encounterSetAside`,
   * found there by their set (`TargetQuery.inEncounterSet`); the set is included once however many seats satisfy it.
   * They are not a `setAsideModularSets` entry, so no random "set-aside modular set" pick or count sees them. When
   * the condition fails, none of the set's cards exist in the game. Logged as `encounterSetAutoIncluded`. Absent or
   * empty: the game is exactly the game it was before this field existed.
   */
  readonly autoIncludedSets?: readonly AutoIncludedSetSetup[];
  /**
   * This game is one scenario of a campaign (RRG 1.8 "Modes of Play", p. 29), as the campaign runner composed it:
   * the log values it may read, the setup instructions to resolve at each window, and what the campaign has already
   * removed (design §7.1). Frozen into `GameState.campaign` and therefore into the replay baseline, so the game
   * replays without the campaign log — which is the whole reason the boundary is a value rather than a lookup.
   *
   * `seats` must line up with `players`, seat by seat: seat *numbers* are the campaign log's own (MC10 p. 17's
   * "player number"), so they are not assumed to be 1, 2, 3, 4 in table order.
   *
   * Absent for a standalone game, which is then byte for byte the game it was before campaign mode existed.
   */
  readonly campaign?: CampaignGameInput;
  /**
   * A predictable opening for tutorials and scripted scenarios: named cards moved to the top of decks after the seeded
   * shuffle and before the draw and the mulligan (`SetupStack`). **Not a rules feature** — RRG 1.8 Appendix II step 6
   * (p. 51) always shuffles — but an alternative setup config, and part of the replay baseline, so a stacked game
   * replays exactly from `{ seed, stack, commands }`. Test-only state edits after `createGame` cannot give that.
   * Stacking consumes no randomness. Absent (or listing nothing): the game is exactly the game it was before this
   * field existed.
   */
  readonly stack?: SetupStack;
}

/**
 * The villain deck and set-aside villains a scenario uses at a difficulty (docs/phase7-wave2.md §3.4). The Once and
 * Future Kang insert, "Adjustable Difficulty": "To play the scenario in expert mode, replace all six villains in the
 * Kang encounter set with the six villains from the Expert Kang set". Without `expertVillains`, both difficulties use
 * the scenario's own villains (stage ranges choose the rest).
 */
export function villainsForDifficulty(
  scenario: {
    readonly villainCardId: CardId;
    readonly setAsideVillainCardIds?: readonly CardId[];
    readonly expertVillains?: { readonly villainCardId: CardId; readonly setAsideVillainCardIds: readonly CardId[] };
  },
  difficulty: "standard" | "expert",
): { readonly villainCardId: CardId; readonly setAsideVillainCardIds: readonly CardId[] } {
  if (difficulty === "expert" && scenario.expertVillains) return scenario.expertVillains;
  return { villainCardId: scenario.villainCardId, setAsideVillainCardIds: scenario.setAsideVillainCardIds ?? [] };
}

/**
 * An encounter set that is in the game only when a setup condition holds (`EncounterSet.autoIncluded`, expanded by
 * `@mc/content`'s `autoIncludedSetsOf`; docs/phase7-wave7.md §3.74).
 */
export interface AutoIncludedSetSetup {
  readonly encounterSetId: string;
  /** `aspectChosen`: at least one seat declared `aspect` among its chosen aspects. */
  readonly when: { readonly kind: "aspectChosen"; readonly aspect: CoreAspect };
  /** The cards shuffled into the encounter deck, one entry per copy; each must be among `cardIds`. */
  readonly shuffledIn: readonly CardId[];
  /** The whole set, one entry per copy. What `shuffledIn` leaves starts set aside. */
  readonly cardIds: readonly CardId[];
}

/** An `AutoIncludedSetSetup` whose condition holds for this table, with the seats that made it hold. */
interface IncludedSet {
  readonly setup: AutoIncludedSetSetup;
  readonly playerIds: readonly PlayerId[];
  readonly remainder: readonly CardId[];
}

/** The seats that declared `aspect` among their chosen aspects (a seat's own, and in a campaign game its campaign entry's). */
function playersChoosingAspect(config: GameSetupConfig, aspect: CoreAspect): PlayerId[] {
  return config.players.flatMap((seat, seatIndex) => {
    const aspects = [...(seat.aspects ?? []), ...(config.campaign?.seats[seatIndex]?.aspects ?? [])];
    return aspects.includes(aspect) ? [playerId(`p${seatIndex + 1}`)] : [];
  });
}

/**
 * The `config.autoIncludedSets` whose condition holds for this table, for a screen that shows what the deal will add
 * (Table setup's "The game you'll get"). The same test `createGame` applies, minus its list validation.
 */
export function autoIncludedSetsInGame(config: GameSetupConfig): readonly AutoIncludedSetSetup[] {
  return (config.autoIncludedSets ?? []).filter((setup) => playersChoosingAspect(config, setup.when.aspect).length > 0);
}

/**
 * Which of `config.autoIncludedSets` are in this game, or a reason the list is malformed. "Chose" is the declared
 * choice (RRG 1.8 FAQ, Crisis of Infinite Deadpools, p. 64: "only included if at least one player in the game chooses
 * the 'Pool aspect as (one of) their chosen aspect(s)", not when an ability merely lets a deck hold such cards): a
 * seat's `PlayerSetup.aspects`, and in a campaign game its `CampaignSeatInput.aspects` as well. Every entry is
 * checked whether or not its condition holds, so a bad entry never passes by going unused.
 */
function includedSetsOf(config: GameSetupConfig, pool: Readonly<Record<string, AnyCard>>): IncludedSet[] | string {
  const included: IncludedSet[] = [];
  const seen = new Set<string>();
  for (const setup of config.autoIncludedSets ?? []) {
    const setId = setup.encounterSetId;
    if (seen.has(setId)) return `auto-included set ${setId} is listed twice`;
    seen.add(setId);
    for (const cardId of setup.cardIds) {
      const card = pool[cardId];
      if (!card || !("encounterSetIds" in card) || !(card.encounterSetIds as readonly string[]).includes(setId))
        return `${cardId} is not a card of the auto-included set ${setId}`;
      if (card.type === "evidence" || card.type === "villain" || card.type === "main_scheme")
        return `${cardId} cannot be part of the auto-included set ${setId}`;
    }
    if (setup.shuffledIn.length === 0) return `auto-included set ${setId} shuffles no card in`;
    const remainder = [...setup.cardIds];
    for (const cardId of setup.shuffledIn) {
      const at = remainder.indexOf(cardId);
      if (at < 0)
        return `auto-included set ${setId} shuffles in ${cardId}, which the set does not hold (that many times)`;
      remainder.splice(at, 1);
    }
    const playerIds = playersChoosingAspect(config, setup.when.aspect);
    if (playerIds.length > 0) included.push({ setup, playerIds, remainder });
  }
  return included;
}

export type SetupResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: EngineError };

const PLAYER_HOME: CardHome = { kind: "player" };
const ACTIVE_DECK_HOME: CardHome = { kind: "activeEncounterDeck" };

const blankInstance = (id: InstanceId, cardId: CardId, ownerId: PlayerId | null, home: CardHome): CardInstance => ({
  instanceId: id,
  cardId,
  ownerId,
  controllerId: ownerId,
  home,
  faceup: false,
  exhausted: false,
  damage: 0,
  threat: 0,
  statuses: NO_STATUSES,
  counters: {},
  attachedTo: null,
  attachments: [],
  boostCards: [],
  tucked: [],
  facedownAs: null,
  engagedWith: null,
  flipped: false,
});

/**
 * How the engine names a colliding hero to a client: "Captain Marvel (Carol Danvers)".
 *
 * `uniqueLabel` from `./unique.js` would print the same string for an identity; this wrapper
 * only pins the type so the setup message always names the person behind the mask.
 */
const identityLabel = (card: HeroIdentityCard): string => `${card.name} (${card.alterEgo.faceName})`;

const invalid = (message: string): SetupResult => ({ ok: false, error: engineError("invalid_setup", message) });

/**
 * The stage range each printed version plays at (The Wrecking Crew insert, "Adjustable Difficulty"; §1.2's standard
 * `[1, 1]` and expert `[2, 2]` as indexes, and the extreme challenge's A-then-B).
 */
const VERSION_STAGES: Record<"A" | "B" | "extreme", readonly [number, number]> = {
  A: [0, 0],
  B: [1, 1],
  extreme: [0, 1],
};

/** A villain as setup will create it, checked against the pool. */
interface PlannedVillain {
  readonly card: AnyCard & { readonly type: "villain" };
  readonly side: VillainSideLetter;
  readonly startStageIndex: number;
  readonly lastStageIndex: number;
  readonly encounterDeck: readonly CardId[];
  readonly signatureSideSchemeCardId: CardId | null;
}

/** The villains to create, one-villain configs included, or the reason the config is malformed. */
function planVillains(
  config: GameSetupConfig,
  pool: Readonly<Record<string, AnyCard>>,
): readonly PlannedVillain[] | string {
  let setups: readonly VillainSetup[];
  if (config.villains) {
    const [first] = config.villains;
    if (!first) return "villains must list at least one villain";
    if (first.villainCardId !== config.villainCardId) return "villainCardId must name the first of villains";
    if (config.sharedEncounterDeck) {
      if (config.villains.some((villain) => villain.encounterDeck.length > 0))
        return "with a shared encounter deck, each villain's own encounterDeck must be empty";
    } else if (config.encounterDeck.length > 0)
      return "with villains, each villain has its own encounterDeck; encounterDeck must be empty";
    if (
      config.villainSide !== undefined ||
      config.villainStartStageIndex !== undefined ||
      config.villainLastStageIndex !== undefined
    ) {
      return "with villains, side and stages are set per villain";
    }
    const ids = config.villains.map((v) => v.villainCardId);
    if (new Set(ids).size !== ids.length) return "villains lists the same villain twice";
    // The shared deck is built once, as the first villain's (docs/phase7-wave4.md §3.2).
    setups = config.sharedEncounterDeck
      ? config.villains.map((villain, index) =>
          index === 0 ? { ...villain, encounterDeck: config.encounterDeck } : villain,
        )
      : config.villains;
  } else {
    setups = [
      {
        villainCardId: config.villainCardId,
        encounterDeck: config.encounterDeck,
        ...(config.villainSide !== undefined ? { side: config.villainSide } : {}),
        ...(config.villainStartStageIndex !== undefined ? { startStageIndex: config.villainStartStageIndex } : {}),
        ...(config.villainLastStageIndex !== undefined ? { lastStageIndex: config.villainLastStageIndex } : {}),
      },
    ];
  }
  const planned: PlannedVillain[] = [];
  for (const setup of setups) {
    const card = pool[setup.villainCardId];
    if (!card || card.type !== "villain") return `${setup.villainCardId} is not a villain card`;
    const side = setup.side ?? card.startingSide ?? "A";
    const villainSide = card.sides.find((s) => s.side === side);
    if (!villainSide) return `villain has no side ${side}`;
    if (setup.version !== undefined && (setup.startStageIndex !== undefined || setup.lastStageIndex !== undefined)) {
      return `${setup.villainCardId} sets both a version and explicit stage indexes`;
    }
    const range = setup.version ? VERSION_STAGES[setup.version] : null;
    const startStageIndex = range ? range[0] : (setup.startStageIndex ?? 0);
    if (!villainSide.stages[startStageIndex]) return `villain has no stage index ${startStageIndex}`;
    const lastStageIndex = range ? range[1] : (setup.lastStageIndex ?? villainSide.stages.length - 1);
    if (!villainSide.stages[lastStageIndex] || lastStageIndex < startStageIndex)
      return `villain has no last stage index ${lastStageIndex}`;
    const scheme = setup.signatureSideSchemeCardId;
    if (scheme !== undefined && pool[scheme]?.type !== "side_scheme") return `${scheme} is not a side scheme card`;
    planned.push({
      card,
      side,
      startStageIndex,
      lastStageIndex,
      encounterDeck: setup.encounterDeck,
      signatureSideSchemeCardId: scheme ?? null,
    });
  }
  return planned;
}

/**
 * `GameSetupConfig.stack` checked against the decks setup just built and re-keyed by player id, or the reason it
 * can't be applied. Null when nothing is stacked, so an unstacked game's state has no `setupStack` at all.
 */
function stackedDecksOf(
  config: GameSetupConfig,
  players: readonly PlayerState[],
  encounterDeck: readonly InstanceId[],
  instances: Readonly<Record<string, CardInstance>>,
): StackedDecks | null | string {
  const stack = config.stack;
  if (!stack) return null;
  /** The first code listed more often than `deck` holds it, if any. */
  const shortfall = (deck: readonly InstanceId[], codes: readonly CardId[]): CardId | null => {
    const held = new Map<string, number>();
    for (const id of deck) {
      const cardId = instances[id]?.cardId;
      if (cardId !== undefined) held.set(cardId, (held.get(cardId) ?? 0) + 1);
    }
    for (const code of codes) {
      const left = held.get(code) ?? 0;
      if (left === 0) return code;
      held.set(code, left - 1);
    }
    return null;
  };
  const byPlayer: Record<string, readonly CardId[]> = {};
  for (const [key, codes] of Object.entries(stack.players ?? {})) {
    const seatIndex = Number(key);
    const player = Number.isInteger(seatIndex) ? players[seatIndex] : undefined;
    if (!player) return `stack names seat ${key}, but there is no player at that seat index`;
    const missing = shortfall(player.deck, codes);
    if (missing !== null)
      return `stack puts ${missing} on top of ${player.playerId}'s deck more times than the deck holds it`;
    if (codes.length > 0) byPlayer[player.playerId] = codes;
  }
  const encounter = stack.encounter ?? [];
  const missing = shortfall(encounterDeck, encounter);
  if (missing !== null) return `stack puts ${missing} on top of the encounter deck more times than the deck holds it`;
  const hasPlayers = Object.keys(byPlayer).length > 0;
  if (!hasPlayers && encounter.length === 0) return null;
  return { ...(hasPlayers ? { players: byPlayer } : {}), ...(encounter.length > 0 ? { encounter } : {}) };
}

/**
 * Which seats' decks setup would refuse (`requireLegalDecks`), seat by seat: the same verdict `createGame` judges, so a
 * screen can show a campaign deck's problem before the game is opened rather than after.
 */
export function illegalDecksOf(
  config: Pick<GameSetupConfig, "players" | "campaign" | "cards">,
  pool: Readonly<Record<string, AnyCard>> = Object.fromEntries(config.cards.map((card) => [card.id, card])),
): readonly IllegalDeck[] {
  return config.players.flatMap((setup, seatIndex) => {
    const context = config.campaign ? campaignDeckContextOf(config.campaign, seatIndex, pool) : undefined;
    const verdict = validateDeck(deckContentsOf(setup), pool, context);
    return verdict.ok ? [] : [{ seatIndex, playerId: playerId(`p${seatIndex + 1}`), problems: verdict.problems }];
  });
}

/**
 * The pool's linked cards under the title each names (`KeywordInstance linked { cardTitle }`; RRG 1.8 "Linked (Card
 * Title)", p. 27), in pool order. A linked keyword with no title names nothing, so its card is never set aside.
 */
function linkedCardsByTitle(cards: readonly AnyCard[]): ReadonlyMap<string, readonly AnyCard[]> {
  const byTitle = new Map<string, AnyCard[]>();
  for (const card of cards) {
    if (!("keywords" in card)) continue;
    for (const keyword of card.keywords) {
      if (keyword.name !== "linked" || keyword.cardTitle === undefined) continue;
      byTitle.set(keyword.cardTitle, [...(byTitle.get(keyword.cardTitle) ?? []), card]);
    }
  }
  return byTitle;
}

/** RRG Appendix II: Setup, minus obligations/nemesis sets/setup abilities (they need slice 2). */
export function createGame(requested: GameSetupConfig, deps: EngineDeps = DEFAULT_DEPS): SetupResult {
  // A random starting villain (Loki; docs/phase7-wave4.md §3.7) is drawn first, from the game's own seeded RNG.
  let rng = createRng(requested.seed);
  let config = requested;
  if (requested.randomStartingVillain) {
    const candidates = [requested.villainCardId, ...(requested.setAsideVillainCardIds ?? [])];
    const [pick, next] = nextInt(rng, candidates.length);
    rng = next;
    const chosen = candidates[pick] as CardId;
    config = {
      ...requested,
      villainCardId: chosen,
      setAsideVillainCardIds: candidates.filter((id) => id !== chosen),
    };
  }
  if (config.players.length < 1 || config.players.length > 4) {
    return invalid("a game has 1–4 players");
  }
  const pool: Record<string, AnyCard> = {};
  for (const card of config.cards) pool[card.id] = card;

  const plannedVillains = planVillains(config, pool);
  if (typeof plannedVillains === "string") return invalid(plannedVillains);
  const mainSchemeCard = pool[config.mainSchemeCardId];
  if (!mainSchemeCard || mainSchemeCard.type !== "main_scheme") {
    return invalid(`${config.mainSchemeCardId} is not a main scheme card`);
  }

  // Deck legality is judged per seat, before any seat is built, and every illegal seat is
  // reported at once. Table-level conflicts (matching identities) come after, as
  // `duplicate_unique_card`.
  if (config.requireLegalDecks) {
    const illegalDecks = illegalDecksOf(config, pool);
    if (illegalDecks.length > 0) {
      const message = illegalDecks
        .map((seat) => `${seat.playerId}'s deck is not legal: ${seat.problems.map((p) => p.message).join(" ")}`)
        .join(" ");
      return { ok: false, error: { ...engineError("illegal_deck", message), illegalDecks } };
    }
  }

  const includedSets = includedSetsOf(config, pool);
  if (typeof includedSets === "string") return invalid(includedSets);

  let seq = 1;
  const nextId = (): InstanceId => instanceId(`i${seq++}`);
  const instances: Record<string, CardInstance> = {};

  // One encounter deck per villain, "e1", "e2", … in villain order; a single villain has one deck (RRG 1.8
  // "Encounter Deck", p. 17), as before.
  const shared = config.villains !== undefined && config.sharedEncounterDeck === true;
  const deckIds: EncounterDeckId[] = shared
    ? [encounterDeckId("e1")]
    : plannedVillains.map((_, index) => encounterDeckId(`e${index + 1}`));
  /** The encounter deck villain `index` draws from: its own, or the one they share (docs/phase7-wave4.md §3.2). */
  const deckOf = (index: number): EncounterDeckId => deckIds[shared ? 0 : index] as EncounterDeckId;
  const villainInstanceIds: InstanceId[] = [];
  for (const [index, planned] of plannedVillains.entries()) {
    const id = nextId();
    instances[id] = {
      ...blankInstance(id, planned.card.id, null, { kind: "encounterDeck", deckId: deckOf(index) }),
      faceup: true,
    };
    villainInstanceIds.push(id);
  }
  const mainSchemeInstanceId = nextId();
  instances[mainSchemeInstanceId] = {
    ...blankInstance(mainSchemeInstanceId, mainSchemeCard.id, null, ACTIVE_DECK_HOME),
    faceup: true,
  };

  const players: PlayerState[] = [];
  const obligationIds: InstanceId[] = [];
  /**
   * Every identity already seated, in seat order. RRG 1.8 "Unique Icon": "When choosing
   * identities during setup, players cannot choose identities that match." Matching is a
   * pairwise relation and not transitive (see `cardsMatch`), so this is a list scanned
   * pairwise rather than a keyed map.
   */
  const seatedIdentities: { readonly playerId: PlayerId; readonly card: HeroIdentityCard }[] = [];
  /** Each player's permanent cards, set aside before setup step 1, for the `cardsSetAside` log entry. */
  const permanentSetAside: { readonly playerId: PlayerId; readonly instanceIds: readonly InstanceId[] }[] = [];
  for (const [seatIndex, setup] of config.players.entries()) {
    const id = playerId(`p${seatIndex + 1}`);
    const identityCard = pool[setup.identityCardId];
    if (!identityCard || identityCard.type !== "hero_identity") {
      return invalid(`${setup.identityCardId} is not an identity card`);
    }
    // The SP//dr insert's "Separated Identity Card" (docs/phase7-wave5.md §3.24): the other physical card's two
    // non-identity sides join the game's card pool as cards of their own type (`separatedSideCard`).
    const separatedSides = separatedSideCards(identityCard);
    for (const side of separatedSides) pool[side.id] = side;
    // The Ironheart insert's "Progressing Identity Cards" (docs/phase7-wave5.md §1.4, §3.23): "the weakest of the cards
    // is put into play under the player's control, with the other two cards set aside". A seat names the first version.
    const progressing = identityCard.progressingIdentity;
    if (progressing !== undefined && progressing.versions[0] !== identityCard.id) {
      return invalid(
        `${identityLabel(identityCard)} is a later version of a progressing identity: a seat names its first version`,
      );
    }
    const laterVersions = progressing?.versions.slice(1) ?? [];
    const missingVersion = laterVersions.find((version) => pool[version]?.type !== "hero_identity");
    if (missingVersion) return invalid(`progressing identity version ${missingVersion} is not in the card pool`);
    // Only the separate decks `unbuildableSeparateDeck` knows are built: player cards with their own discard pile
    // (Invocation) or with none, never refilled (Weather, docs/phase7-wave6.md §3.46). Hercules's Labor deck (encounter
    // cards) is data only (docs/phase7-wave2.md §15); building it as one of those would silently play a different game.
    const unbuilt = unbuildableSeparateDeck(identityCard);
    if (unbuilt) {
      return invalid(
        `${identityLabel(identityCard)}'s ${unbuilt.name} deck is a kind of separate deck this engine cannot build yet`,
      );
    }
    // RRG 1.8 "Unique Icon" — identities chosen at setup cannot match (see `cardsMatch`).
    const taken = seatedIdentities.find((seated) => cardsMatch(seated.card, identityCard));
    if (taken) {
      return {
        ok: false,
        error: engineError(
          "duplicate_unique_card",
          `${identityLabel(identityCard)} is already in play as ${taken.playerId}: the players as a group may have only one copy of each unique card in play, so ${id} cannot play the same hero`,
        ),
      };
    }
    const extraMulligans = setup.extraMulligans ?? 0;
    if (!Number.isInteger(extraMulligans) || extraMulligans < 0) {
      return invalid(`${id}'s extraMulligans must be a whole number of 0 or more, not ${extraMulligans}`);
    }
    // The input may come from a save file or another device: only a real boolean is a fact.
    const wonPreviousGame = setup.outsideFacts?.wonPreviousGame;
    if (wonPreviousGame !== undefined && typeof wonPreviousGame !== "boolean") {
      return invalid(`${id}'s outsideFacts.wonPreviousGame must be true or false, not ${String(wonPreviousGame)}`);
    }
    seatedIdentities.push({ playerId: id, card: identityCard });
    const identityInstanceId = nextId();
    instances[identityInstanceId] = {
      ...blankInstance(identityInstanceId, identityCard.id, id, PLAYER_HOME),
      faceup: true,
    };

    const deck: InstanceId[] = [];
    // RRG 1.8 "Permanent" (p. 32): "Permanent cards are set aside before step 1 of setup and are put into play later
    // by abilities on other cards" (docs/phase7-wave6.md §3.74, Q15 = B). They go to the owner's set-aside area,
    // faceup, and are never shuffled, drawn or mulliganed; a Setup ability takes them from there.
    const permanent: InstanceId[] = [];
    for (const cardId of setup.deck) {
      const card = pool[cardId];
      if (!card) return invalid(`unknown card ${cardId} in ${id}'s deck`);
      if (card.type === "evidence") return invalid(`${cardId} is an evidence card, which is never in a deck`);
      const cardInstanceId = nextId();
      if (isPermanentCard(card)) {
        instances[cardInstanceId] = { ...blankInstance(cardInstanceId, card.id, id, PLAYER_HOME), faceup: true };
        permanent.push(cardInstanceId);
        continue;
      }
      instances[cardInstanceId] = blankInstance(cardInstanceId, card.id, id, PLAYER_HOME);
      deck.push(cardInstanceId);
    }
    if (permanent.length > 0) permanentSetAside.push({ playerId: id, instanceIds: permanent });
    // Decks the identity brings besides its player deck (docs/phase7-wave1.md §3.5; RRG 1.8 "Deck", p. 15: "Certain
    // identities or scenarios may add other decks to the game"). Owned by this player; shuffled with the player deck.
    const separateDecks: Record<string, SeparateDeckState> = {};
    for (const definition of identityCard.separateDecks ?? []) {
      const ids: InstanceId[] = [];
      for (const entry of definition.cards) {
        const card = pool[entry.cardId];
        if (!card) return invalid(`unknown card ${entry.cardId} in ${identityCard.id}'s ${definition.name} deck`);
        for (let copy = 0; copy < entry.quantity; copy++) {
          const separateInstanceId = nextId();
          instances[separateInstanceId] = blankInstance(separateInstanceId, card.id, id, {
            kind: "separateDeck",
            name: definition.name,
          });
          ids.push(separateInstanceId);
        }
      }
      separateDecks[definition.name] = { deck: ids, discard: [] };
    }
    const setAside: InstanceId[] = [...permanent];
    // A progressing identity's later versions wait in the player's set-aside area for `swapIdentity` (§3.23).
    for (const version of laterVersions) {
      const versionInstanceId = nextId();
      instances[versionInstanceId] = { ...blankInstance(versionInstanceId, version, id, PLAYER_HOME), faceup: true };
      setAside.push(versionInstanceId);
    }
    // A separated identity's other card waits set aside, support side up, for setup step 16 (§3.24).
    let separatedCardInstanceId: InstanceId | undefined;
    const [separatedSupportSide] = separatedSides;
    if (separatedSupportSide) {
      separatedCardInstanceId = nextId();
      instances[separatedCardInstanceId] = {
        ...blankInstance(separatedCardInstanceId, separatedSupportSide.id, id, PLAYER_HOME),
        faceup: true,
      };
      setAside.push(separatedCardInstanceId);
    }
    if (config.includeIdentitySets !== false) {
      // Obligations and nemesis cards have no encounter deck of their own: a discard sends them to the active
      // villain's (ruling, Jan 17, 2026 (5)).
      const obligation = pool[identityCard.obligationCardId];
      if (obligation) {
        // RRG 1.8 "Obligation" (p. 30): "Each identity is associated with one or more obligation cards. If an identity
        // is being played, all of that identity's associated obligation cards are shuffled into the encounter deck
        // during setup." Scarlet Witch's set holds two copies of Slipping Sanity (FAQ "Slipping Sanity (#23)", p. 61).
        for (let copy = 0; copy < Math.max(1, obligation.quantityInSet); copy++) {
          const obligationInstanceId = nextId();
          instances[obligationInstanceId] = blankInstance(obligationInstanceId, obligation.id, null, ACTIVE_DECK_HOME);
          obligationIds.push(obligationInstanceId);
        }
      } else if (config.requireIdentitySets) {
        return invalid(`obligation ${identityCard.obligationCardId} is not in the card pool`);
      }
      const nemesis = config.cards.filter(
        (card) => "encounterSetIds" in card && card.encounterSetIds.includes(identityCard.nemesisEncounterSetId),
      );
      if (nemesis.length === 0 && config.requireIdentitySets) {
        return invalid(`nemesis set ${identityCard.nemesisEncounterSetId} has no cards in the pool`);
      }
      for (const card of nemesis) {
        for (let copy = 0; copy < card.quantityInSet; copy++) {
          const nemesisInstanceId = nextId();
          instances[nemesisInstanceId] = blankInstance(nemesisInstanceId, card.id, null, ACTIVE_DECK_HOME);
          setAside.push(nemesisInstanceId);
        }
      }
    }
    players.push({
      playerId: id,
      seatIndex,
      // RRG Appendix II step 1: each player begins in alter-ego form.
      identity: {
        instanceId: identityInstanceId,
        cardId: identityCard.id,
        form: "alterEgo",
        heroFormIndex: null,
        changedFormThisRound: false,
        ...(separatedCardInstanceId ? { separatedCardInstanceId } : {}),
      },
      hand: [],
      deck,
      discard: [],
      playArea: [],
      dealtEncounter: [],
      resolving: [],
      setAside,
      separateDecks,
      eliminated: false,
      ...(extraMulligans > 0 ? { extraMulligans } : {}),
      ...(wonPreviousGame === true ? { outsideFacts: { wonPreviousGame } } : {}),
    });
  }

  const encounterDecks: Record<string, EncounterDeckState> = {};
  /** The included `autoIncludedSets`, with the instances made for each, for the `encounterSetAutoIncluded` entries. */
  const autoIncluded: {
    readonly included: IncludedSet;
    readonly deckId: EncounterDeckId;
    readonly shuffledIn: readonly InstanceId[];
    readonly setAside: InstanceId[];
  }[] = [];
  for (const [index, planned] of plannedVillains.entries()) {
    if (shared && index > 0) continue;
    const deckId = deckOf(index);
    const deck: InstanceId[] = [];
    for (const cardId of planned.encounterDeck) {
      const card = pool[cardId];
      if (!card) return invalid(`unknown encounter card ${cardId}`);
      // The Agents of S.H.I.E.L.D. rulebook (p. 6): "Evidence cards are not added to any deck" (docs/phase7-wave2.md §6.4).
      if (card.type === "evidence")
        return invalid(`${cardId} is an evidence card, which is never in the encounter deck`);
      const cardInstanceId = nextId();
      instances[cardInstanceId] = blankInstance(cardInstanceId, card.id, null, { kind: "encounterDeck", deckId });
      deck.push(cardInstanceId);
    }
    // docs/phase7-wave7.md §3.74: an included set's `shuffledIn` cards join the first encounter deck, the one the
    // first player's game area draws from, before setup shuffles it.
    if (index === 0) {
      for (const included of includedSets) {
        const ids = included.setup.shuffledIn.map((cardId) => {
          const cardInstanceId = nextId();
          instances[cardInstanceId] = blankInstance(cardInstanceId, cardId, null, { kind: "encounterDeck", deckId });
          return cardInstanceId;
        });
        deck.push(...ids);
        autoIncluded.push({ included, deckId, shuffledIn: ids, setAside: [] });
      }
    }
    // RRG Appendix II step 10: obligations are shuffled into the encounter deck — the first (active) villain's.
    if (index === 0) deck.push(...obligationIds);
    encounterDecks[deckId] = { deck, discard: [] };
  }

  // Signature side schemes are set aside, linked to their villain, until an ability puts them into play.
  const encounterSetAside: InstanceId[] = [];
  // A campaign's `setAsideCards` (cards brought in from outside the game, MC27 p. 13) join them, ownerless like the rest.
  for (const cardId of [...(config.setAside ?? []), ...(config.campaign?.setAsideCards ?? [])]) {
    const card = pool[cardId];
    if (!card) return invalid(`unknown set-aside card ${cardId}`);
    if (card.type === "evidence" || card.type === "villain")
      return invalid(`${cardId} cannot be set aside as a scenario card`);
    const id = nextId();
    const playerCard = "deckLimit" in card;
    instances[id] = blankInstance(
      id,
      card.id,
      null,
      playerCard ? PLAYER_HOME : { kind: "encounterDeck", deckId: deckIds[0] as EncounterDeckId },
    );
    encounterSetAside.push(id);
  }
  // The rest of each included set waits in the set-aside area, homed to the deck its `shuffledIn` cards joined.
  for (const entry of autoIncluded) {
    for (const cardId of entry.included.remainder) {
      const id = nextId();
      instances[id] = blankInstance(id, cardId, null, { kind: "encounterDeck", deckId: entry.deckId });
      encounterSetAside.push(id);
      entry.setAside.push(id);
    }
  }
  const scenarioDecks: Record<string, ScenarioDeckState> = {};
  for (const deck of config.scenarioDecks ?? []) {
    if (scenarioDecks[deck.name]) return invalid(`scenario deck ${deck.name} is listed twice`);
    // A deck with no discard pile has nothing to reshuffle (docs/phase7-wave6.md §3.66).
    if (deck.discardPile === "none" && deck.whenEmpty === "reshuffleDiscardWithoutPenalty")
      return invalid(`scenario deck ${deck.name} has no discard pile to reshuffle`);
    for (const cardId of deck.contents.cardIds ?? [])
      if (!pool[cardId]) return invalid(`scenario deck ${deck.name} names unknown card ${cardId}`);
    scenarioDecks[deck.name] = {
      deck: [],
      discard: [],
      discardPile: deck.discardPile,
      whenEmpty: deck.whenEmpty,
      contents: deck.contents,
      ...(deck.buildAtSetup ? { buildAtSetup: true as const } : {}),
      ...(deck.closedToPlayerCards ? { closedToPlayerCards: true as const } : {}),
    };
  }
  const setAsideModularSets: SetAsideModularSet[] = [];
  for (const set of config.setAsideModularSets ?? []) {
    if (setAsideModularSets.some((entry) => entry.encounterSetId === set.encounterSetId))
      return invalid(`modular set ${set.encounterSetId} is set aside twice`);
    const instanceIds: InstanceId[] = [];
    for (const cardId of set.cardIds) {
      const card = pool[cardId];
      if (
        !card ||
        !("encounterSetIds" in card) ||
        !(card.encounterSetIds as readonly string[]).includes(set.encounterSetId)
      )
        return invalid(`${cardId} is not a card of the set-aside modular set ${set.encounterSetId}`);
      const id = nextId();
      instances[id] = blankInstance(id, card.id, null, {
        kind: "encounterDeck",
        deckId: deckIds[0] as EncounterDeckId,
      });
      encounterSetAside.push(id);
      instanceIds.push(id);
    }
    setAsideModularSets.push({ encounterSetId: set.encounterSetId, instanceIds });
  }
  for (const cardId of config.setAsideVillainCardIds ?? []) {
    const card = pool[cardId];
    if (!card || card.type !== "villain") return invalid(`${cardId} is not a villain card`);
    if (plannedVillains.some((planned) => planned.card.id === cardId))
      return invalid(`${cardId} is both in the villain deck and set aside`);
    const id = nextId();
    instances[id] = blankInstance(id, card.id, null, { kind: "encounterDeck", deckId: deckIds[0] as EncounterDeckId });
    encounterSetAside.push(id);
  }
  const villains: VillainState[] = plannedVillains.map((planned, index) => {
    let signatureSideSchemeId: InstanceId | null = null;
    if (planned.signatureSideSchemeCardId) {
      signatureSideSchemeId = nextId();
      instances[signatureSideSchemeId] = blankInstance(signatureSideSchemeId, planned.signatureSideSchemeCardId, null, {
        kind: "encounterDeck",
        deckId: deckOf(index),
      });
      encounterSetAside.push(signatureSideSchemeId);
    }
    return {
      instanceId: villainInstanceIds[index] as InstanceId,
      cardId: planned.card.id,
      side: planned.side,
      stageIndex: planned.startStageIndex,
      lastStageIndex: planned.lastStageIndex,
      // A villain that starts set aside is out of play until `addVillain` brings it in (docs/phase7-wave5.md §3.1).
      defeated: config.villainsStartSetAside === true,
      encounterDeckId: deckOf(index),
      signatureSideSchemeId,
    };
  });

  const firstIndex = config.firstPlayerIndex ?? 0;
  const firstPlayer = players[firstIndex];
  if (!firstPlayer) {
    return invalid(`no player at seat ${firstIndex}`);
  }
  const [firstVillain] = villains;
  if (!firstVillain) return invalid("a game has at least one villain");
  if (config.villainsStartSetAside) {
    if (config.randomStartingVillain)
      return invalid("villainsStartSetAside leaves the choice to the Setup text; not with randomStartingVillain");
    // A single-villain game (docs/phase7-wave7.md §3.42): its villain enters by `addVillain`, on its card's starting
    // side and first stage, running to its last. A config that asks for anything else would be silently ignored.
    const [planned] = plannedVillains;
    if (!config.villains && planned) {
      const entrySide = planned.card.startingSide ?? "A";
      const entryStages = planned.card.sides.find((s) => s.side === entrySide)?.stages ?? planned.card.sides[0].stages;
      if (
        planned.side !== entrySide ||
        planned.startStageIndex !== 0 ||
        planned.lastStageIndex !== entryStages.length - 1
      )
        return invalid("a villain that starts set aside enters on its starting side, from its first stage to its last");
    }
    for (const villain of villains) {
      instances[villain.instanceId] = { ...instances[villain.instanceId]!, faceup: false };
      encounterSetAside.push(villain.instanceId);
    }
  }

  // RRG 1.8 "Linked (Card Title)" (p. 27; docs/phase7-wave7.md §3.75): linked cards "are set aside at the start of the
  // game if any deck includes the card that brings the linked cards into play", as many as their product holds, and
  // "if multiple decks contain the same card named on one or more linked cards, set aside the appropriate number of
  // cards for each deck that contains the named card": one set per deck, however many copies that deck runs. They
  // come from the caller's card pool (a pool without them sets nothing aside) and wait in the shared set-aside area
  // with no owner: "When a player takes control of a card with the linked keyword, that player becomes the owner of
  // that card" (`enterPlayOnReveal`). Appendix II (p. 51) names no step for them; they are created here, last, before
  // any deck is shuffled, so no other instance's id depends on whether the pool holds them.
  const linkedSetAside: {
    readonly forPlayer: PlayerId;
    readonly cardIds: readonly CardId[];
    readonly instanceIds: readonly InstanceId[];
  }[] = [];
  const linkedCards = linkedCardsByTitle(config.cards);
  if (linkedCards.size > 0) {
    for (const [seatIndex, setup] of config.players.entries()) {
      const titles = new Set(setup.deck.map((cardId) => pool[cardId]?.name));
      const cardIds: CardId[] = [];
      const instanceIds: InstanceId[] = [];
      for (const [title, cards] of linkedCards) {
        if (!titles.has(title)) continue;
        for (const card of cards) {
          for (let copy = 0; copy < Math.max(1, card.quantityInSet); copy++) {
            const id = nextId();
            instances[id] = {
              ...blankInstance(
                id,
                card.id,
                null,
                "deckLimit" in card ? PLAYER_HOME : { kind: "encounterDeck", deckId: deckIds[0] as EncounterDeckId },
              ),
              faceup: true,
            };
            encounterSetAside.push(id);
            cardIds.push(card.id);
            instanceIds.push(id);
          }
        }
      }
      const player = players[seatIndex];
      if (player && instanceIds.length > 0) linkedSetAside.push({ forPlayer: player.playerId, cardIds, instanceIds });
    }
  }

  const setupStack = stackedDecksOf(config, players, encounterDecks[deckIds[0] as string]?.deck ?? [], instances);
  if (typeof setupStack === "string") return invalid(setupStack);

  // Seat-by-seat alignment is what makes a per-seat campaign-log read addressable (`campaignSeatNumber`), so a
  // mismatch is refused here rather than read as "this player has no campaign column" at some later window.
  if (config.campaign && config.campaign.seats.length !== config.players.length) {
    return invalid(
      `the campaign composed ${config.campaign.seats.length} seats for a table of ${config.players.length}`,
    );
  }

  // A campaign's required modular set (`CampaignNode.requiredModularSetIds`; MC40 p. 14: "required when playing
  // Juggernaut in campaign mode") must be in the game: a builder that left it out is refused here rather than the
  // campaign's setup instructions finding none of its cards and quietly doing nothing.
  for (const setId of config.campaign?.requiredModularSetIds ?? []) {
    const present = Object.values(instances).some((instance) => {
      const card = pool[instance.cardId];
      return (
        card !== undefined &&
        (("encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId)) ||
          ("specificTo" in card && card.specificTo?.encounterSetId === setId))
      );
    });
    if (!present) {
      return invalid(
        `the campaign requires the ${setId} modular set in ${config.campaign?.nodeId}, and no card of it is in the game`,
      );
    }
  }

  // RRG 1.8 "Double-Sided Card" (p. 17): a "Standard Mode Only" / "Expert Mode Only" card shows the face of the mode
  // being played, wherever it starts (docs/phase7-wave4.md §3.18). Every instance exists by now.
  if (config.difficulty === "expert") {
    for (const [id, instance] of Object.entries(instances)) {
      const card = pool[instance.cardId];
      if (card && modeOnlyFlipped(card, "expert")) instances[id] = { ...instance, flipped: true };
    }
  }
  const state: GameState = {
    round: 1,
    // A campaign game starts before Appendix II begins, so MC60 p. 9's pre-setup instructions can resolve first.
    step: config.campaign ? FIRST_CAMPAIGN_STEP : FIRST_STANDALONE_STEP,
    firstPlayerId: firstPlayer.playerId,
    startingPlayerCount: players.length,
    players,
    villains,
    activeVillainId: firstVillain.instanceId,
    mainScheme: {
      instanceId: mainSchemeInstanceId,
      cardId: mainSchemeCard.id,
      stageIndex: 0,
      completed: false,
      accelerationTokens: 0,
    },
    gameAreas: [],
    nextGameAreaSeq: 1,
    spentMainSchemeStages: [],
    revealedMainSchemes: [],
    scenarioRules: {
      victory: config.victory ?? "finalVillainStage",
      ...(config.activeCounter ? { activeCounter: config.activeCounter } : {}),
      ...(config.victoryCondition !== undefined ? { victoryCondition: config.victoryCondition } : {}),
      ...(config.difficulty === "expert" ? { difficulty: "expert" as const } : {}),
      ...(config.scenarioRuleSpecs && config.scenarioRuleSpecs.length > 0 ? { rules: config.scenarioRuleSpecs } : {}),
      ...(config.scenarioSetupInstructions && config.scenarioSetupInstructions.length > 0
        ? { setupInstructions: config.scenarioSetupInstructions }
        : {}),
      separateGameAreas: config.separateGameAreas ?? false,
    },
    ...(config.tableRules?.sameNameHeroAllyConflict ? { tableRules: { sameNameHeroAllyConflict: true } } : {}),
    encounterDecks,
    encounterDeckOrder: deckIds,
    encounterSetAside,
    ...(config.setAsideModularSets ? { setAsideModularSets } : {}),
    scenarioDecks,
    villainArea: [],
    victoryDisplay: [],
    removedFromGame: [],
    instances,
    cardPool: pool,
    stack: [],
    abilityUses: {},
    lastingEffects: [],
    stateChecks: {},
    playedThisRound: {},
    playedThisPhase: {},
    playedByPlayerThisRound: {},
    attackedThisTurn: {},
    // Both absent outside a campaign, so a standalone game's serialized state is unchanged (see `GameState`).
    ...(config.campaign ? { campaign: config.campaign, campaignWrites: NO_CAMPAIGN_WRITES } : {}),
    ...(setupStack ? { setupStack } : {}),
    // No villain is in play until setup text puts one in; open until Appendix II step 12c (docs/phase7-wave7.md §3.42).
    ...(config.villainsStartSetAside ? { villainsEnteringAtSetup: [] } : {}),
    pendingChoice: null,
    outcome: null,
    rng,
    nextInstanceSeq: seq,
    nextChoiceSeq: 1,
    nextFrameSeq: 1,
    nextLastingSeq: 1,
  };

  const ctx: Ctx = createCtx(state, deps);
  emit(ctx, {
    type: "gameCreated",
    playerIds: players.map((p) => p.playerId),
    firstPlayerId: firstPlayer.playerId,
    seed: config.seed,
  });
  for (const entry of permanentSetAside) emit(ctx, { type: "cardsSetAside", ...entry, reason: "permanent" });
  for (const entry of linkedSetAside) emit(ctx, { type: "linkedCardsSetAside", ...entry });
  for (const entry of autoIncluded) {
    const { setup, playerIds } = entry.included;
    emit(ctx, {
      type: "encounterSetAutoIncluded",
      setId: setup.encounterSetId,
      because: { kind: "aspectChosen", aspect: setup.when.aspect, playerIds },
      deckId: entry.deckId,
      shuffledIn: entry.shuffledIn,
      setAside: entry.setAside,
    });
  }

  // RRG 1.8 Appendix II steps 6-12 (p. 51). A campaign game runs this as a flow step instead (`setup-steps.ts`),
  // after MC60 p. 9's `beforeScenarioSetup` instructions have resolved; a standalone game runs it here, in the same
  // place and the same order it always has, so its state and its event stream are unchanged.
  if (!config.campaign) {
    resolveScenarioSetup(ctx);
    // A scenario's rulebook-printed setup instructions run as their own step, after step 12 has resolved.
    setStep(ctx, stepAfterScenarioSetupAbilities(ctx.state, FIRST_STANDALONE_STEP));
  }
  // Identity "Setup:" abilities are RRG 1.8 Appendix II step 16 (p. 51), after the draw and the mulligan: they run
  // from the `playerSetupAbilities` flow step (`flow.ts`), not here.
  // Steps 14 (draw) and 15 (mulligan) run as flow steps, so they happen after
  // the setup cards and setup abilities above have fully resolved.
  runFlow(ctx);

  return { ok: true, state: ctx.state, events: ctx.events };
}
