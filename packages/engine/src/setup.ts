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
import { unbuildableSeparateDeck, validateDeck, type DeckContext } from "./deck.js";
import { createCtx, emit, setStep, type Ctx } from "./ctx.js";
import { engineError, type EngineError } from "./errors.js";
import { runFlow } from "./flow.js";
import { encounterDeckId, instanceId, playerId, type EncounterDeckId, type InstanceId, type PlayerId } from "./ids.js";
import { createRng, nextInt } from "./rng.js";
import {
  FIRST_CAMPAIGN_STEP,
  FIRST_STANDALONE_STEP,
  resolveScenarioSetup,
  stepAfterScenarioSetupAbilities,
} from "./setup-steps.js";
import { cardsMatch } from "./unique.js";
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
} from "./state.js";
import type { GameEvent } from "./events.js";

export interface PlayerSetup {
  readonly identityCardId: CardId;
  readonly deck: readonly CardId[];
  /** The deck's chosen aspect(s). Only read when `GameSetupConfig.requireLegalDecks` is set, where an absent choice is an illegal deck. */
  readonly aspects?: readonly CoreAspect[];
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
   * With `villains`: every villain starts set aside (out of play, in `encounterSetAside`), and the main scheme's Setup
   * brings the first ones in (`addVillain`). `MultipleVillains.atSetup: "setAside"`; The Sinister Six, Sinister
   * Synchronization 1A (`sm` 27100a): "Choose X villains at random … Put those villains into play". Until then no
   * villain is in play and "the villain" is nobody. docs/phase7-wave5.md §3.1.
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
    const illegalDecks = config.players.flatMap((setup, seatIndex) => {
      const context = config.campaign ? campaignDeckContextOf(config.campaign, seatIndex, pool) : undefined;
      const verdict = validateDeck(deckContentsOf(setup), pool, context);
      return verdict.ok ? [] : [{ seatIndex, playerId: playerId(`p${seatIndex + 1}`), problems: verdict.problems }];
    });
    if (illegalDecks.length > 0) {
      const message = illegalDecks
        .map((seat) => `${seat.playerId}'s deck is not legal: ${seat.problems.map((p) => p.message).join(" ")}`)
        .join(" ");
      return { ok: false, error: { ...engineError("illegal_deck", message), illegalDecks } };
    }
  }

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
  for (const [seatIndex, setup] of config.players.entries()) {
    const id = playerId(`p${seatIndex + 1}`);
    const identityCard = pool[setup.identityCardId];
    if (!identityCard || identityCard.type !== "hero_identity") {
      return invalid(`${setup.identityCardId} is not an identity card`);
    }
    // The SP//dr insert's "Separated Identity Card" (two identity cards sharing one dial) is not modeled; seating it as an
    // ordinary identity would silently play a different game (docs/phase7-wave2.md §6.10).
    if (identityCard.separatedIdentity !== undefined) {
      return invalid(
        `${identityLabel(identityCard)} is a separated identity (two identity cards), which this engine cannot seat yet`,
      );
    }
    // The Ironheart insert's "Progressing Identity Cards" (several identity cards swapped during the game) is not modeled
    // yet (docs/phase7-wave5.md §1.4, §3.23); seating one version as a plain identity would play a different game.
    if (identityCard.progressingIdentity !== undefined) {
      return invalid(
        `${identityLabel(identityCard)} is a progressing identity (several identity cards), which this engine cannot seat yet`,
      );
    }
    // Only Doctor Strange's kind of separate deck is built (a player-card deck with its own discard pile). Hercules's
    // Labor deck (encounter cards) and Gift deck (no discard pile) are data only (docs/phase7-wave2.md §15); building
    // either as if it were the Invocation deck would silently play a different game.
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
    seatedIdentities.push({ playerId: id, card: identityCard });
    const identityInstanceId = nextId();
    instances[identityInstanceId] = {
      ...blankInstance(identityInstanceId, identityCard.id, id, PLAYER_HOME),
      faceup: true,
    };

    const deck: InstanceId[] = [];
    for (const cardId of setup.deck) {
      const card = pool[cardId];
      if (!card) return invalid(`unknown card ${cardId} in ${id}'s deck`);
      if (card.type === "evidence") return invalid(`${cardId} is an evidence card, which is never in a deck`);
      const cardInstanceId = nextId();
      instances[cardInstanceId] = blankInstance(cardInstanceId, card.id, id, PLAYER_HOME);
      deck.push(cardInstanceId);
    }
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
    const setAside: InstanceId[] = [];
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
    });
  }

  const encounterDecks: Record<string, EncounterDeckState> = {};
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
    // RRG Appendix II step 10: obligations are shuffled into the encounter deck — the first (active) villain's.
    if (index === 0) deck.push(...obligationIds);
    encounterDecks[deckId] = { deck, discard: [] };
  }

  // Signature side schemes are set aside, linked to their villain, until an ability puts them into play.
  const encounterSetAside: InstanceId[] = [];
  for (const cardId of config.setAside ?? []) {
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
  const scenarioDecks: Record<string, ScenarioDeckState> = {};
  for (const deck of config.scenarioDecks ?? []) {
    if (scenarioDecks[deck.name]) return invalid(`scenario deck ${deck.name} is listed twice`);
    scenarioDecks[deck.name] = {
      deck: [],
      discard: [],
      discardPile: deck.discardPile,
      whenEmpty: deck.whenEmpty,
      contents: deck.contents,
      ...(deck.buildAtSetup ? { buildAtSetup: true as const } : {}),
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
    if (!config.villains) return invalid("villainsStartSetAside needs villains");
    for (const villain of villains) {
      instances[villain.instanceId] = { ...instances[villain.instanceId]!, faceup: false };
      encounterSetAside.push(villain.instanceId);
    }
  }

  // Seat-by-seat alignment is what makes a per-seat campaign-log read addressable (`campaignSeatNumber`), so a
  // mismatch is refused here rather than read as "this player has no campaign column" at some later window.
  if (config.campaign && config.campaign.seats.length !== config.players.length) {
    return invalid(
      `the campaign composed ${config.campaign.seats.length} seats for a table of ${config.players.length}`,
    );
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
