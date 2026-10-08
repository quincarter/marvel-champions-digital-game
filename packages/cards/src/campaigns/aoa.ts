/**
 * Age of Apocalypse (MC45): the eighth `CampaignDefinition`, and the first whose scenarios share one block of setup
 * (`everyNodeSetup`) around a mission drawn at random.
 *
 * Source of truth: `docs/campaign-modes/markdown/mc45_age_of_apocalypse.md` (cited as "MC45 p. N": the campaign rules
 * are p. 4, the mission area pp. 5-6, the five scenarios' Campaign Instructions pp. 8, 12, 14, 16 and 20, the expert
 * rules p. 20, the log sheet p. 24) and `docs/phase7-wave8.md` §2.11 to §2.16, §3.43 to §3.46 and the §4.1 decisions
 * Q20 to Q25. Every instruction carries the printed sentence it encodes; one the rulebook does not print as a bullet
 * (a record, a set-aside step) says so in its text.
 *
 * ---------------------------------------------------------------------------------------------------------------
 * MODELING
 *
 * - **The block** (MC45 pp. 8, 12, 14, 16, 20). Every scenario prints the same five Setup bullets, so they are
 *   `everyNodeSetup`, cited to their first printing (p. 8). Scenario 5 changes the second bullet ("Reveal the Protect
 *   the Professor [MISSION] side scheme"): the draw is gated on scenario 4 not being resolved and the fixed mission on
 *   its being resolved, so each attempt's trace shows one of the two as skipped.
 * - **The log's strike lists.** `missions` (the four rows of p. 24) and `overseers` (the five minions) are strike
 *   lists over printed names. `currentMission` and `currentOverseer` hold this attempt's draw; they are working
 *   fields (the sheet does not print them). A draw is `random` with `perAttempt` (§4.1 Q22 = B): a lost scenario that
 *   is retried draws both again, from everything still unstruck. Only a Victory list strikes.
 * - **Cards for the game.** Nothing of the five campaign sets is in a scenario's own sets except the four cards of
 *   Age of Apocalypse, which are composed into the encounter deck. Everything else is set aside by id for the game
 *   that needs it (`setAsideCards`, ownerless): the drawn mission's a face, the drawn Overseer, Mission Team, and the
 *   mission row's own cards. One in-game instruction then creates the mission area and puts the three into play
 *   (`missionSetup`); it names them as "the set-aside [MISSION] side scheme", "the set-aside [OVERSEER] minion" and
 *   Mission Team, of which a game has one each.
 * - **The four rows** (p. 24). Each has a Setup cell, resolved in the game the mission is drawn for, and after a win
 *   its Defeated or Not Defeated cell, which also writes the row's result field. "Was defeated" reads the game's
 *   defeat events by the mission's name (`cardsDefeated`): the card has flipped and left play by then. A mission that
 *   is neither defeated nor failed when the game is won was not defeated.
 * - **Carried rows.** Three cells last "for the rest of the campaign", so they are setup instructions of every later
 *   scenario, gated on the result field: Desperate Measures is offered to each player (a `thisGame` grant, so the
 *   card is in the shuffled deck and gone again after the game), Panicked Refugees is shuffled into each deck, North
 *   American Sea Wall into the encounter deck. Each resolves before the ally search.
 * - **Rewards** (an upgrade, a support, a campaign ally) are `campaign` grants with `deckSize: "counted"` (§4.1 Q25
 *   and its follow-up: the reward is one of the deck's cards for both limits). "They may include" makes the pick
 *   optional. The aspect picks leave out a title the deck already holds, so a grant never takes a title past its copy
 *   limit; the campaign allies are one card each, so a pick takes it for the table (`excludeGranted`).
 * - **Rules of the game.** The Mission Rules card has no record: its bullets are scenario rules of every node
 *   (`CampaignNode.scenarioRuleSpecs`), and scenario 5 adds "Professor X cannot enter play during this game".
 * - **Scenario 3** (p. 14; §4.1 Q21 = A): the Prelate on the reverse of the drawn Overseer is removed from the game
 *   before the scenario's own setup reveals one.
 * - **Scenario 5** (p. 20): Protect the Professor defeated wins the campaign. Won with it not defeated, the campaign
 *   is lost (`endCampaign`). If the mission fails, its own text loses the game and the scenario is retried.
 * - **Expert campaign** (p. 20): hit points recorded after scenarios 1 to 4 and set in 2 to 5; the heal costs 3 threat
 *   on the mission and is forced for a seat with no record; the ally search is narrowed to the hero's traits. This box
 *   prints no "lose the campaign" for a lost game, so there is no `defeat` block.
 *
 * ---------------------------------------------------------------------------------------------------------------
 * NOT AUTHORED: nothing.
 */

import { AOA_CAMPAIGN, cardId, encounterSetId, trait, type CardId, type CoreAspect } from "@mc/content";
import {
  DEFAULT_CAMPAIGN_WINDOW,
  type CampaignDefinition,
  type CampaignInstruction,
  type CampaignNode,
  type CampaignOp,
  type CampaignPredicate,
  type CampaignValue,
  type EffectSpec,
  type TargetCategory,
} from "@mc/engine";
import {
  chosen,
  eachPlayer,
  encounterSetAside,
  forEachPlayer,
  moveCards,
  moveCardsInto,
  query,
  selectCards,
  thatPlayer,
} from "../dsl/index.js";
import {
  allySearch,
  MISSION,
  MISSION_RULES,
  missionSetup,
  PROFESSOR_X_CANNOT_ENTER_PLAY,
  removeOverseersPrelate,
  theMission,
} from "../wave8/aoa/campaign/mission-rules.js";
import { healForThreat, hpRecord, hpSet } from "./expert-helpers.js";

// ---------------------------------------------------------------------------------------------------------------
// Sets, cards and constants
// ---------------------------------------------------------------------------------------------------------------

/** MC45 p. 4, cards 164-165: the set every scenario shuffles into its encounter deck. Campaign only (§4.1 Q23). */
const AGE_OF_APOCALYPSE_SET = encounterSetId("age_of_apocalypse");
/** Mission Team and the rewards (171-176), the set the campaign allies are chosen from. */
const BASIC_CAMPAIGN_SET = encounterSetId("aoa_basic_campaign");

const OVERSEER = trait("OVERSEER");

const MISSION_TEAM: CardId = cardId("45171a");
/** Destiny, Blink, Morph and X-Man: "each campaign ally" (MC45 p. 24). */
const CAMPAIGN_ALLIES: readonly CardId[] = ["45172", "45173", "45174", "45175"].map((id) => cardId(id));
/** Four copies in the box. */
const DESPERATE_MEASURES: CardId = cardId("45176");
const DESPERATE_MEASURES_COPIES = 4;
const NORTH_AMERICAN_SEA_WALL: CardId = cardId("45177");
/** Four copies in the box, one for each player. */
const PANICKED_REFUGEES: CardId = cardId("45178");

/** "From any aspect" (MC45 p. 24): an aspect card, and basic is not an aspect (§4.1 Q24 = A). */
const ANY_ASPECT: readonly CoreAspect[] = ["aggression", "justice", "leadership", "protection", "pool"];

/** The two values of a row's result field. */
export const AOA_DEFEATED = "defeated";
export const AOA_NOT_DEFEATED = "notDefeated";

/** One row of the log sheet's mission table (MC45 p. 24), with its three printed cells. */
interface MissionRow {
  readonly id: "liberate" | "evacuate" | "sabotage" | "find";
  /** The printed title, which is the strike list's option and the name the defeat is read by. */
  readonly name: string;
  /** The mission's a face. */
  readonly cardId: CardId;
  readonly resultField: string;
  readonly setup: string;
  readonly defeated: string;
  readonly notDefeated: string;
}

const LIBERATE: MissionRow = {
  id: "liberate",
  name: "Liberate the Seattle Core",
  cardId: cardId("45166a"),
  resultField: "resultLiberate",
  setup: "Set each copy of Desperate Measures upgrade aside.",
  defeated:
    "For the rest of the campaign, each player may shuffle 1 copy of Desperate Measures into their deck at the start of each game. That card does not count against your minimum deck size.",
  notDefeated: "Remove each copy of Desperate Measures from the campaign.",
};
const EVACUATE: MissionRow = {
  id: "evacuate",
  name: "Evacuate Survivors",
  cardId: cardId("45167a"),
  resultField: "resultEvacuate",
  setup: "Each player shuffles a copy of Panicked Refugees into their deck.",
  defeated:
    "Remove each copy of Panicked Refugees from the campaign. Each player chooses an upgrade from any aspect. They may include 1 copy of that card in their deck for the rest of the campaign. That card does not count against your minimum deck size.",
  notDefeated:
    "For the rest of the campaign, each player must shuffle a copy of Panicked Refugees into their deck at the start of each game.",
};
const SABOTAGE: MissionRow = {
  id: "sabotage",
  name: "Sabotage the Sea Wall",
  cardId: cardId("45168a"),
  resultField: "resultSabotage",
  setup: "Shuffle the North American Sea Wall side scheme into the encounter deck.",
  defeated:
    "Remove the North American Sea Wall side scheme from the campaign. Each player chooses a support from any aspect. They may include 1 copy of that card in their deck for the rest of the campaign. That card does not count against your minimum deck size.",
  notDefeated:
    "For the rest of the campaign, shuffle the North American Sea Wall into the encounter deck during setup.",
};
const FIND: MissionRow = {
  id: "find",
  name: "Find Lost Mutants",
  cardId: cardId("45169a"),
  resultField: "resultFind",
  setup: "Set each campaign ally aside.",
  defeated:
    "Each player chooses a campaign ally. They may include that ally in their deck for the rest of the campaign. That card does not count against your minimum deck size.",
  notDefeated: "Remove each campaign ally from the campaign.",
};

/** The four missions of the log, in the sheet's order. */
export const AOA_MISSIONS: readonly MissionRow[] = [LIBERATE, EVACUATE, SABOTAGE, FIND];
/** Scenario 5's mission: not a row of the log and never drawn. */
export const AOA_PROTECT_THE_PROFESSOR = { name: "Protect the Professor", cardId: cardId("45170a") } as const;

/** The five Overseers (179A-183A), in card order. The option is the printed name. */
export const AOA_OVERSEERS: readonly { readonly name: string; readonly cardId: CardId }[] = [
  { name: "Mister Sinister", cardId: cardId("45179a") },
  { name: "The Shadow King", cardId: cardId("45180a") },
  { name: "Abyss", cardId: cardId("45181a") },
  { name: "Sugar Man", cardId: cardId("45182a") },
  { name: "Mikhail Rasputin", cardId: cardId("45183a") },
];

/** The node after which the mission is no longer drawn: scenario 5 plays Protect the Professor (MC45 p. 20). */
const LAST_DRAWN_NODE = "dark-beast";

const BLOCK_PAGE = "MC45 p. 8";
const AREA_PAGE = "MC45 p. 5";
const LOG_PAGE = "MC45 p. 24";

const field = (id: string): CampaignValue => ({ kind: "field", field: id });
const constant = (value: number | string | boolean): CampaignValue => ({ kind: "const", value });
const choiceOf = (slot: string): CampaignValue => ({ kind: "choice", slot });

const missionIs = (name: string): CampaignPredicate => ({
  kind: "fieldContains",
  field: "currentMission",
  value: name,
});
const resultIs = (row: MissionRow, result: string): CampaignPredicate => ({
  kind: "fieldContains",
  field: row.resultField,
  value: result,
});
const MISSION_DEFEATED: CampaignPredicate = { kind: "fieldIsSet", field: "missionDefeated" };
const FOUR_SCENARIOS_WON: CampaignPredicate = { kind: "nodeResolved", nodeId: LAST_DRAWN_NODE };

const setAside = (card: CardId, copies?: CampaignValue): CampaignOp => ({
  kind: "setAsideCards",
  cards: [constant(card)],
  ...(copies ? { copies } : {}),
});

/** The one set-aside card of this printed id that the game holds for each seat, or the only one. */
const setAsideCard = (card: CardId) => encounterSetAside({ printedId: card });

// ---------------------------------------------------------------------------------------------------------------
// The block: Setup of every scenario (MC45 pp. 8, 12, 14, 16, 20)
// ---------------------------------------------------------------------------------------------------------------

/** "Shuffle the Age of Apocalypse modular set into the encounter deck." */
const AGE_OF_APOCALYPSE: CampaignInstruction = {
  id: "mc45.setup.age-of-apocalypse",
  text: "Shuffle the Age of Apocalypse modular set into the encounter deck.",
  citation: BLOCK_PAGE,
  step: {
    kind: "betweenGames",
    ops: [{ kind: "composeEncounterSets", sets: [constant(AGE_OF_APOCALYPSE_SET)], into: "deck" }],
  },
};

/**
 * "Randomly select one of the available [MISSION] side schemes …" (scenarios 1 to 4). Available is unstruck (MC45
 * p. 5). Drawn again on every attempt (§4.1 Q22 = B). The drawn mission's a face is set aside for the game.
 */
const MISSION_DRAW: CampaignInstruction = {
  id: "mc45.setup.mission",
  text: "Randomly select one of the available [MISSION] side schemes and follow the Setup directions for it in the campaign log.",
  citation: BLOCK_PAGE,
  when: { kind: "not", of: FOUR_SCENARIOS_WON },
  step: {
    kind: "betweenGames",
    ops: [
      {
        kind: "random",
        slot: "mission",
        from: { kind: "fieldOptions", field: "missions", unstruckOnly: true },
        perAttempt: true,
      },
      { kind: "setField", field: "currentMission", value: choiceOf("mission") },
      ...AOA_MISSIONS.map((row): CampaignOp => ({
        kind: "if",
        when: missionIs(row.name),
        then: [setAside(row.cardId)],
      })),
    ],
  },
};

/** Scenario 5's second bullet, in place of the draw (MC45 p. 20). */
const PROTECT_THE_PROFESSOR: CampaignInstruction = {
  id: "mc45.setup.protect-the-professor",
  text: "Reveal the Protect the Professor [MISSION] side scheme and put it into play.",
  citation: "MC45 p. 20",
  when: FOUR_SCENARIOS_WON,
  step: {
    kind: "betweenGames",
    ops: [
      { kind: "setField", field: "currentMission", value: constant(AOA_PROTECT_THE_PROFESSOR.name) },
      setAside(AOA_PROTECT_THE_PROFESSOR.cardId),
    ],
  },
};

/**
 * "Randomly select one of the available [OVERSEER] minions and add it to the mission area. Put the double-sided
 * Mission Rules card into play next to it." Drawn again on every attempt, as the mission is. The Mission Rules card
 * has no record: its rules are the node's `scenarioRuleSpecs`.
 */
const OVERSEER_DRAW: CampaignInstruction = {
  id: "mc45.setup.overseer",
  text: "Randomly select one of the available [OVERSEER] minions and add it to the mission area. Put the double-sided Mission Rules card into play next to it.",
  citation: BLOCK_PAGE,
  step: {
    kind: "betweenGames",
    ops: [
      {
        kind: "random",
        slot: "overseer",
        from: { kind: "fieldOptions", field: "overseers", unstruckOnly: true },
        perAttempt: true,
      },
      { kind: "setField", field: "currentOverseer", value: choiceOf("overseer") },
      ...AOA_OVERSEERS.map((overseer): CampaignOp => ({
        kind: "if",
        when: { kind: "fieldContains", field: "currentOverseer", value: overseer.name },
        then: [setAside(overseer.cardId)],
      })),
    ],
  },
};

/** "The first player takes control of the Mission Team (171A) support card, [MISSION] side faceup.": the card itself. */
const MISSION_TEAM_SET_ASIDE: CampaignInstruction = {
  id: "mc45.setup.mission-team",
  text: "The first player takes control of the Mission Team (171A) support card, [MISSION] side faceup.",
  citation: BLOCK_PAGE,
  step: { kind: "betweenGames", ops: [setAside(MISSION_TEAM)] },
};

const SET_ASIDE_MISSION = "mission";
const SET_ASIDE_OVERSEER = "overseer";
const SET_ASIDE_MISSION_TEAM = "missionTeam";
/** Binds this game's mission, Overseer and Mission Team: the campaign set one of each aside. */
const selectMissionCards = (): readonly EffectSpec[] => [
  selectCards(SET_ASIDE_MISSION, encounterSetAside(query("sideScheme", { trait: MISSION }))),
  selectCards(SET_ASIDE_OVERSEER, encounterSetAside(query("minion", { trait: OVERSEER }))),
  selectCards(SET_ASIDE_MISSION_TEAM, setAsideCard(MISSION_TEAM)),
];

/**
 * The game's half of the three bullets above (MC45 p. 5; §2.12 steps 3 to 5): the mission area is created, the mission
 * enters play there with 5 threat for each player, the Overseer is put into play there engaged with nobody, and
 * Mission Team is put into play under the first player's control. Not printed as its own bullet.
 */
const MISSION_AREA: CampaignInstruction = {
  id: "mc45.setup.mission-area",
  text: "Put the selected [MISSION] side scheme and the selected [OVERSEER] minion into play in the mission area, and Mission Team into play under the first player's control.",
  citation: AREA_PAGE,
  step: {
    kind: "inGame",
    window: DEFAULT_CAMPAIGN_WINDOW,
    effects: [
      ...selectMissionCards(),
      ...missionSetup(chosen(SET_ASIDE_MISSION), chosen(SET_ASIDE_OVERSEER), chosen(SET_ASIDE_MISSION_TEAM)),
    ],
  },
};

/** "Each player shuffles a copy of Panicked Refugees into their deck": an encounter card in a player's deck (§3.42). */
const shufflePanickedRefugees = (): readonly EffectSpec[] => [
  forEachPlayer(
    eachPlayer,
    moveCardsInto(encounterSetAside({ printedId: PANICKED_REFUGEES }, { random: 1 }), "deckShuffle", thatPlayer),
  ),
];
const shuffleSeaWall = (): readonly EffectSpec[] => [
  moveCards(setAsideCard(NORTH_AMERICAN_SEA_WALL), "encounterDeckShuffle"),
];

/** Not printed as a bullet: the cards an in-game instruction of the same gate is about to move, set aside by id. */
const cardsFor = (
  id: string,
  text: string,
  when: CampaignPredicate,
  ops: readonly CampaignOp[],
): CampaignInstruction => ({
  id,
  text,
  citation: LOG_PAGE,
  when,
  step: { kind: "betweenGames", ops },
});
const inGame = (
  id: string,
  text: string,
  when: CampaignPredicate,
  effects: readonly EffectSpec[],
): CampaignInstruction => ({
  id,
  text,
  citation: LOG_PAGE,
  when,
  step: { kind: "inGame", window: DEFAULT_CAMPAIGN_WINDOW, effects },
});

const PANICKED_REFUGEES_FOR_EACH = setAside(PANICKED_REFUGEES, { kind: "seatCount" });

/** The four rows' Setup cells (MC45 p. 24), each resolved in the game its mission was drawn for. */
const SETUP_CELLS: readonly CampaignInstruction[] = [
  cardsFor("mc45.setup.liberate", LIBERATE.setup, missionIs(LIBERATE.name), [
    setAside(DESPERATE_MEASURES, constant(DESPERATE_MEASURES_COPIES)),
  ]),
  cardsFor(
    "mc45.setup.evacuate.cards",
    "Set a copy of Panicked Refugees aside for each player, to be shuffled in by the next instruction.",
    missionIs(EVACUATE.name),
    [PANICKED_REFUGEES_FOR_EACH],
  ),
  inGame("mc45.setup.evacuate", EVACUATE.setup, missionIs(EVACUATE.name), shufflePanickedRefugees()),
  cardsFor(
    "mc45.setup.sabotage.cards",
    "Set the North American Sea Wall side scheme aside, to be shuffled in by the next instruction.",
    missionIs(SABOTAGE.name),
    [setAside(NORTH_AMERICAN_SEA_WALL)],
  ),
  inGame("mc45.setup.sabotage", SABOTAGE.setup, missionIs(SABOTAGE.name), shuffleSeaWall()),
  cardsFor(
    "mc45.setup.find",
    FIND.setup,
    missionIs(FIND.name),
    CAMPAIGN_ALLIES.map((ally) => setAside(ally)),
  ),
];

/**
 * The three cells that last "for the rest of the campaign" (MC45 p. 24), as setup of every later scenario: "at the
 * start of each game" is before the ally search and the starting hands (§2.14).
 *
 * Desperate Measures is offered to each player between games and granted for this game only, so the copy is in the
 * deck when it is shuffled and is not in the seat's deck list afterward; a retry offers it again. It is counted
 * toward deck size like any card of the deck (§4.1 Q25 and its follow-up).
 */
const CARRIED_ROWS: readonly CampaignInstruction[] = [
  cardsFor("mc45.setup.carried.desperate-measures", LIBERATE.defeated, resultIs(LIBERATE, AOA_DEFEATED), [
    {
      kind: "forEachSeat",
      ops: [
        {
          kind: "choose",
          slot: "desperateMeasures",
          chooser: "eachSeat",
          optional: true,
          from: { kind: "cards", cardIds: [DESPERATE_MEASURES] },
        },
        {
          kind: "if",
          when: { kind: "choiceMade", slot: "desperateMeasures" },
          then: [
            {
              kind: "grantCard",
              seat: "self",
              card: choiceOf("desperateMeasures"),
              permanence: "thisGame",
              deckSize: "counted",
            },
          ],
        },
      ],
    },
  ]),
  cardsFor(
    "mc45.setup.carried.panicked-refugees.cards",
    "Set a copy of Panicked Refugees aside for each player, to be shuffled in by the next instruction.",
    resultIs(EVACUATE, AOA_NOT_DEFEATED),
    [PANICKED_REFUGEES_FOR_EACH],
  ),
  inGame(
    "mc45.setup.carried.panicked-refugees",
    EVACUATE.notDefeated,
    resultIs(EVACUATE, AOA_NOT_DEFEATED),
    shufflePanickedRefugees(),
  ),
  cardsFor(
    "mc45.setup.carried.sea-wall.cards",
    "Set the North American Sea Wall side scheme aside, to be shuffled in by the next instruction.",
    resultIs(SABOTAGE, AOA_NOT_DEFEATED),
    [setAside(NORTH_AMERICAN_SEA_WALL)],
  ),
  inGame("mc45.setup.carried.sea-wall", SABOTAGE.notDefeated, resultIs(SABOTAGE, AOA_NOT_DEFEATED), shuffleSeaWall()),
];

const ALLY_SEARCH_TEXT =
  "Each player searches their deck for an ally and adds it to their hand. (This card counts towards your hand size.)";

/** The fifth bullet (§3.44), and its expert reading (MC45 p. 20; §2.16): one of the two resolves. */
const ALLY_SEARCH: readonly CampaignInstruction[] = [
  {
    id: "mc45.setup.ally-search",
    text: ALLY_SEARCH_TEXT,
    citation: BLOCK_PAGE,
    whenModes: { expertCampaign: false },
    step: { kind: "inGame", window: DEFAULT_CAMPAIGN_WINDOW, effects: allySearch() },
  },
  {
    id: "mc45.setup.ally-search.expert",
    text: `${ALLY_SEARCH_TEXT} When playing expert campaign, the ally you choose during Setup must share a trait with your hero.`,
    citation: "MC45 p. 20",
    whenModes: { expertCampaign: true },
    step: { kind: "inGame", window: DEFAULT_CAMPAIGN_WINDOW, effects: allySearch({ sharesTraitWithHero: true }) },
  },
];

const EVERY_NODE_SETUP: readonly CampaignInstruction[] = [
  AGE_OF_APOCALYPSE,
  MISSION_DRAW,
  PROTECT_THE_PROFESSOR,
  ...SETUP_CELLS,
  OVERSEER_DRAW,
  MISSION_TEAM_SET_ASIDE,
  MISSION_AREA,
  ...CARRIED_ROWS,
  ...ALLY_SEARCH,
];

// ---------------------------------------------------------------------------------------------------------------
// Per-scenario setup
// ---------------------------------------------------------------------------------------------------------------

/** MC45 pp. 12, 14, 16, 20: the two Expert Campaign Only bullets that end the Setup of scenarios 2 to 5. */
const expertSetup = (n: number, page: string): readonly CampaignInstruction[] => [
  hpSet(`mc45.s${n}.setup.hp-set`, page),
  healForThreat(`mc45.s${n}.setup.heal`, page, 3, theMission, "[MISSION] side scheme"),
];

/**
 * Scenario 3 only (MC45 p. 14; §3.46, §4.1 Q21 = A), before the scenario's own setup reveals a Prelate: the Prelate on
 * the reverse of this game's Overseer is not available. A struck Overseer's Prelate is untouched (ruling April 30,
 * 2026, Ruling 4 (2)): only the Overseer drawn for this game is named.
 */
const PRELATE_OF_THE_OVERSEER: CampaignInstruction = {
  id: "mc45.s3.setup.prelate",
  text: "The [PRELATE] minions (179-183) are found on the reverse sides of the [OVERSEER] minions: remove the Prelate on the reverse of this game's Overseer from the game.",
  citation: "MC45 p. 14",
  step: {
    kind: "inGame",
    window: "beforeScenarioSetup",
    effects: [
      selectCards(SET_ASIDE_OVERSEER, encounterSetAside(query("minion", { trait: OVERSEER }))),
      ...removeOverseersPrelate(chosen(SET_ASIDE_OVERSEER)),
    ],
  },
};

// ---------------------------------------------------------------------------------------------------------------
// Victory (MC45 pp. 8, 12, 14, 16; the cells of p. 24)
// ---------------------------------------------------------------------------------------------------------------

/** "Each player chooses …. They may include … in their deck for the rest of the campaign." One pick for each seat. */
const reward = (from: Extract<CampaignOp, { kind: "choose" }>["from"]): CampaignOp => ({
  kind: "forEachSeat",
  ops: [
    { kind: "choose", slot: "reward", chooser: "eachSeat", optional: true, from },
    {
      kind: "if",
      when: { kind: "choiceMade", slot: "reward" },
      then: [
        { kind: "grantCard", seat: "self", card: choiceOf("reward"), permanence: "campaign", deckSize: "counted" },
      ],
    },
  ],
});
const aspectReward = (category: TargetCategory): CampaignOp =>
  reward({ kind: "collection", filter: { categories: [category], aspects: ANY_ASPECT, notInOwnDeck: true } });

/** What each row's two cells do after a win, beyond writing the result. */
const CELLS: Readonly<
  Record<MissionRow["id"], { readonly defeated: readonly CampaignOp[]; readonly notDefeated: readonly CampaignOp[] }>
> = {
  liberate: {
    defeated: [],
    notDefeated: [{ kind: "removeFromCampaign", cards: [constant(DESPERATE_MEASURES)] }],
  },
  evacuate: {
    defeated: [{ kind: "removeFromCampaign", cards: [constant(PANICKED_REFUGEES)] }, aspectReward("upgrade")],
    notDefeated: [],
  },
  sabotage: {
    defeated: [{ kind: "removeFromCampaign", cards: [constant(NORTH_AMERICAN_SEA_WALL)] }, aspectReward("support")],
    notDefeated: [],
  },
  find: {
    defeated: [
      reward({
        kind: "campaignSet",
        encounterSetId: BASIC_CAMPAIGN_SET,
        excludeGranted: true,
        filter: { categories: ["ally"] },
      }),
    ],
    notDefeated: [{ kind: "removeFromCampaign", cards: CAMPAIGN_ALLIES.map((ally) => constant(ally)) }],
  },
};

/** Whether the mission of this name was defeated during the game: the defeat event, by the name it then had. */
const missionDefeatedRecord = (
  id: string,
  citation: string,
  name: string,
  when?: CampaignPredicate,
): CampaignInstruction => ({
  id,
  text: `Record whether the ${name} [MISSION] side scheme was defeated, for the instructions that follow.`,
  citation,
  ...(when ? { when } : {}),
  step: {
    kind: "record",
    writes: [
      {
        field: "missionDefeated",
        mode: "set",
        value: { kind: "atLeast", of: { kind: "cardsDefeated", name }, amount: 1 },
      },
    ],
  },
});

/** The Victory list of scenarios 1 to 4, in printed order after the records it reads. */
function victory(n: number, page: string): readonly CampaignInstruction[] {
  const prefix = `mc45.s${n}.victory`;
  return [
    {
      id: `${prefix}.overseer-record`,
      text: "Record whether the [OVERSEER] minion was defeated, for the instructions that follow.",
      citation: page,
      step: {
        kind: "record",
        writes: [
          {
            field: "overseerDefeated",
            mode: "set",
            value: {
              kind: "atLeast",
              of: { kind: "cardsInVictoryDisplay", query: { categories: ["minion"], trait: OVERSEER } },
              amount: 1,
            },
          },
        ],
      },
    },
    ...AOA_MISSIONS.map((row) =>
      missionDefeatedRecord(`${prefix}.${row.id}.record`, page, row.name, missionIs(row.name)),
    ),
    {
      id: `${prefix}.strike-mission`,
      text: "Strike the [MISSION] side scheme from the campaign log.",
      citation: page,
      step: { kind: "betweenGames", ops: [{ kind: "strike", field: "missions", option: field("currentMission") }] },
    },
    // "If the [MISSION] side scheme was defeated, follow the 'Defeated' instructions for that side scheme in the
    // campaign log", and "was not defeated … 'Not Defeated'": each row's two cells, of which one resolves.
    ...AOA_MISSIONS.flatMap((row): CampaignInstruction[] => [
      {
        id: `${prefix}.${row.id}.defeated`,
        text: row.defeated,
        citation: LOG_PAGE,
        when: { kind: "and", of: [missionIs(row.name), MISSION_DEFEATED] },
        step: {
          kind: "betweenGames",
          ops: [{ kind: "setField", field: row.resultField, value: constant(AOA_DEFEATED) }, ...CELLS[row.id].defeated],
        },
      },
      {
        id: `${prefix}.${row.id}.not-defeated`,
        text: row.notDefeated,
        citation: LOG_PAGE,
        when: { kind: "and", of: [missionIs(row.name), { kind: "not", of: MISSION_DEFEATED }] },
        step: {
          kind: "betweenGames",
          ops: [
            { kind: "setField", field: row.resultField, value: constant(AOA_NOT_DEFEATED) },
            ...CELLS[row.id].notDefeated,
          ],
        },
      },
    ]),
    {
      id: `${prefix}.strike-overseer`,
      text: "If the [OVERSEER] minion was defeated, strike its name from the campaign log.",
      citation: page,
      when: { kind: "fieldIsSet", field: "overseerDefeated" },
      step: { kind: "betweenGames", ops: [{ kind: "strike", field: "overseers", option: field("currentOverseer") }] },
    },
    hpRecord(`${prefix}.hp`, page),
  ];
}

const node = (
  n: number,
  id: string,
  label: string,
  page: string,
  extra: { readonly setup?: readonly CampaignInstruction[]; readonly victory?: readonly CampaignInstruction[] } = {},
): CampaignNode => {
  const scenarioId = AOA_CAMPAIGN.scenarioIds[n - 1];
  if (scenarioId === undefined) throw new Error(`Age of Apocalypse has no scenario ${n}`);
  return {
    id,
    label,
    scenario: { kind: "fixed", scenarioId },
    // The Mission Rules card (MC45 p. 5): in force in every game of the campaign.
    scenarioRuleSpecs: [...MISSION_RULES, ...(n === 5 ? [PROFESSOR_X_CANNOT_ENTER_PLAY] : [])],
    setup: [...(extra.setup ?? []), ...(n >= 2 ? expertSetup(n, page) : [])],
    victory: extra.victory ?? victory(n, page),
  };
};

// ---------------------------------------------------------------------------------------------------------------
// The definition
// ---------------------------------------------------------------------------------------------------------------

const resultField = (row: MissionRow) => ({
  id: row.resultField,
  label: row.name,
  scope: "shared" as const,
  type: { kind: "choice" as const, options: [AOA_DEFEATED, AOA_NOT_DEFEATED] },
  citation: LOG_PAGE,
});

export const AOA_CAMPAIGN_DEFINITION: CampaignDefinition = {
  campaignId: AOA_CAMPAIGN.id,
  version: "1",
  logFields: [
    {
      id: "remainingHp",
      label: "Remaining hit points (expert)",
      scope: "perSeat",
      type: { kind: "number", min: 0 },
      whenModes: { expertCampaign: true },
      citation: LOG_PAGE,
    },
    {
      id: "missions",
      label: "Mission Side Schemes",
      scope: "shared",
      type: { kind: "strikeList", options: AOA_MISSIONS.map((row) => row.name) },
      citation: LOG_PAGE,
    },
    {
      id: "overseers",
      label: "Overseer Minions",
      scope: "shared",
      type: { kind: "strikeList", options: AOA_OVERSEERS.map((overseer) => overseer.name) },
      citation: LOG_PAGE,
    },
    {
      id: "currentMission",
      label: "This scenario's mission",
      scope: "shared",
      type: {
        kind: "choice",
        options: [...AOA_MISSIONS.map((row) => row.name), AOA_PROTECT_THE_PROFESSOR.name],
      },
      working: true,
      citation: AREA_PAGE,
    },
    {
      id: "currentOverseer",
      label: "This scenario's Overseer",
      scope: "shared",
      type: { kind: "choice", options: AOA_OVERSEERS.map((overseer) => overseer.name) },
      working: true,
      citation: AREA_PAGE,
    },
    ...AOA_MISSIONS.map(resultField),
    {
      id: "missionDefeated",
      label: "Mission defeated this scenario",
      scope: "shared",
      type: { kind: "flag" },
      working: true,
      citation: BLOCK_PAGE,
    },
    {
      id: "overseerDefeated",
      label: "Overseer defeated this scenario",
      scope: "shared",
      type: { kind: "flag" },
      working: true,
      citation: BLOCK_PAGE,
    },
  ],
  // MC45 p. 20 "Elimination and Victory": a player defeated in a scenario their teammates win takes no part in its
  // Victory steps (no pick in a Defeated cell, no hit points recorded). They rejoin by paying the heal (`healForThreat`),
  // so there is no `rejoinAtPrintedHitPoints`.
  elimination: {
    id: "mc45.elimination",
    text: "In an expert campaign, if a player is defeated during a scenario that their teammates go on to win, the defeated player does not participate in the Victory steps of that scenario.",
    citation: "MC45 p. 20",
    whenModes: { expertCampaign: true },
  },
  // MC45 p. 4: "If the players lost, they may reset the scenario and try again with no penalty." No box of this
  // campaign prints a DEFEAT instruction, in either mode.
  loss: { retry: "free", retryBaseline: "nodeStart", citation: "MC45 p. 4" },
  everyNodeSetup: EVERY_NODE_SETUP,
  graph: {
    kind: "linear",
    nodes: [
      node(1, "unus", "Scenario #1 - Unus", "MC45 p. 8", {
        setup: [
          {
            id: "mc45.s1.setup.identity",
            text: "Each player records their identity in the campaign log found on the back cover of this rulebook. Players cannot switch identities during a campaign.",
            citation: "MC45 p. 8",
            // The seat's identity is recorded when the campaign log is created (`CampaignSeat.identityCardId`).
            step: { kind: "betweenGames", ops: [] },
          },
        ],
      }),
      node(2, "four-horsemen", "Scenario #2 - Four Horsemen", "MC45 p. 12"),
      node(3, "apocalypse", "Scenario #3 - Apocalypse", "MC45 p. 14", { setup: [PRELATE_OF_THE_OVERSEER] }),
      node(4, LAST_DRAWN_NODE, "Scenario #4 - Dark Beast", "MC45 p. 16"),
      node(5, "en-sabah-nur", "Scenario #5 - En Sabah Nur", "MC45 p. 20", {
        setup: [
          {
            id: "mc45.s5.setup.professor-x",
            text: "Professor X cannot enter play during this game.",
            citation: "MC45 p. 20",
            // A rule of the game, not something to resolve: this node's `scenarioRuleSpecs` (§3.43).
            step: { kind: "betweenGames", ops: [] },
          },
        ],
        victory: [
          missionDefeatedRecord("mc45.s5.victory.record", "MC45 p. 20", AOA_PROTECT_THE_PROFESSOR.name),
          {
            id: "mc45.s5.victory.saved",
            text: "If the Protect the Professor [MISSION] side scheme was defeated, the players saved Professor X and win the campaign!",
            citation: "MC45 p. 20",
            when: MISSION_DEFEATED,
            // The last node won ends the campaign as won (the runner), unless the next instruction says otherwise.
            step: { kind: "betweenGames", ops: [] },
          },
          {
            id: "mc45.s5.victory.failed",
            text: "If the Protect the Professor [MISSION] side scheme was not defeated, the players failed to save Professor X and lose the campaign.",
            citation: "MC45 p. 20",
            when: { kind: "not", of: MISSION_DEFEATED },
            step: { kind: "betweenGames", ops: [{ kind: "endCampaign", result: "lost" }] },
          },
        ],
      }),
    ],
  },
};
