/**
 * Shadowland (MC65), the eleventh `CampaignDefinition`: three scenarios (Shadows in the Night, Shadow Labyrinth, Heart
 * of
 * Shadow) won in order, the Hand's Dark Protege villains checked off as they are used, and a Creeping Corruption
 * upgrade
 * on every hero.
 *
 * Source of truth: `docs/campaign-modes/markdown/mc65_shadowland.md` ("MC65 p. N", the insert's printed pages: the
 * campaign rules pp. 4 to 6, the three scenarios' Campaign Instructions pp. 9 to 10, 14 to 15 and 17, the log sheet
 * p. 20) and `docs/phase7-shadowland.md` section 4.1 and the rules brief M12. Every `CampaignInstruction` carries the
 * printed bullet it encodes, in printed order, except the composition ones (said so where they are built). The model is
 * `mojo.ts` (a linear box with a recorded support or upgrade and the facedown-card heal) and `fne.ts` (a villain drawn
 * from the log and recorded, a lost game replayed).
 *
 * ---------------------------------------------------------------------------------------------------------------
 * MODELING
 *
 * - **The villain** (pp. 5, 9). Scenarios 1 and 2 each draw a Dark Protege villain at random (their own Setup text,
 * "Choose
 *   1 random villain from that set"). The campaign makes that draw, from the six villains less `removedVillains`, with
 * the
 *   campaign's own RNG (`random`, a fresh draw for every attempt: a replayed scenario is set up again), and hands the
 * card
 *   to the scenario builder (`CampaignGameStart.villain` is the villain card id,
 * `Wave11ScenarioOptions.villainCardId`).
 *   Scenario 1's Victory checks that villain off (p. 9). Scenario 2's does not: p. 15 prints no such bullet, and the
 *   villain it sets aside is not "used" in any further sense; only scenario 1's villain is removed (reading flag 1).
 * - **Identity** (p. 9). The seat's identity is recorded by the box's first instruction (`seatIdentity`, an engine
 * value
 *   added for this box), as the printed first bullet says; "Daredevil's name or Elektra's name" is matched against the
 *   hero's printed name, so the removal does not depend on which printing of the hero a pool holds. That bullet is
 *   printed under Setup but decides which villains the draw may offer, so it runs in scenario 1's composition, before
 *   the villain is drawn.
 * - **Creeping Corruption** (pp. 9, 14, 17). Scenarios 1 and 2 compose four copies of 72A set aside and the other six
 *   Black Flower cards for the encounter deck (`SHADOWLAND_BLACK_FLOWER_REST`: the real set would add 72A to the deck
 * too);
 *   the Setup puts one 72A into play under each player and leaves the rest aside, as Heart of Shadow's own stage 1A
 * does
 *   in scenario 3 (its Dark Invitation Setup), so scenario 3's campaign bullets only count counters.
 * - **Recorded cards** (pp. 10, 15, 14, 17), as MojoMania's. Victory of scenarios 1 and 2 reads each seat's supports
 * and
 *   upgrades in play within cost 2 (the printed cost: a card printing "-", Creeping Corruption among them, and a linked
 *   card are never offered) into a working per-seat list, and each player may choose one to record. Scenario 2's Setup
 *   puts the one recorded card into play from the player's own deck, scenario 3's puts any of the two, for 1 corruption
 *   counter each (a card put into play pays no cost).
 * - **OVERPOWERING** (pp. 9, 15, 14, 17): one per-seat box for each of scenarios 1 and 2, read at Victory from the
 *   Creeping Corruption the seat controls (the trait is on its 72B face). Scenario 2 adds 1 counter for the first box,
 *   scenario 3 one for each box that is checked.
 * - **Heart of Shadow's minions** (p. 17). The four Dark Protege minions are composed set aside; the Setup deals one at
 *   random to each player as a facedown encounter card and shuffles the rest into the encounter deck.
 * - **Expert** (p. 6). Remaining hit points are recorded after a win (capped at base) and set at the next setup, before
 * the
 *   scenario's own setup damage (ruling June 2, 2026 (3) #2); the heal is dealing yourself a facedown encounter card,
 * and a
 *   defeated player must take it to rejoin (the "may rejoin or sit the scenario out" reading of MC45/MC50/MC60,
 *   `expert-helpers.ts`).
 * - **Loss** (p. 5): "they may reset the scenario and try again with no penalty": `retry: "free"`, the log goes back
 *   to the node's start, so a lost game checks off no villain and records nothing.
 *
 * READING FLAGS (none is settled by the insert or RRG 1.8; each is the most literal reading, and the first three are
 * open questions put to the owner)
 * 1. Open question: scenario 2's villain is not removed (above).
 * 2. Open question: a card's "cost of 2 or less" is its printed cost (MojoMania's reading); an X-cost card is not a
 *    "-" card and may be recorded.
 * 3. Open question: "Each player may take one copy of each card they recorded" (p. 17) lets a player take none, one or
 *    both.
 * 4. Settled (owner question 12 = B, Quin, 2026-10-22, PR #355, docs/phase7-shadowland.md §5.1): the expert hit point
 *    set runs after the scenario's own setup: see `expertSetups`.
 */
import {
  DATA_ONLY_CARDS,
  PLAYABLE_CARDS,
  SHADOWLAND_CAMPAIGN,
  SHADOWLAND_CARDS,
  cardId,
  trait,
  type CardId,
} from "@mc/content";
import {
  DEFAULT_CAMPAIGN_WINDOW,
  type CampaignChoiceSource,
  type CampaignDefinition,
  type CampaignInstruction,
  type CampaignNode,
  type CampaignOp,
  type CampaignPredicate,
  type CampaignValue,
  type CampaignWindow,
  type EffectSpec,
  type LogFieldDef,
} from "@mc/engine";
import {
  addCounters,
  campaignLogCards,
  campaignLogIsSet,
  chooseCards,
  chosen,
  dealAsEncounterCard,
  eachPlayer,
  encounterSetAside,
  forEachPlayer,
  ifThen,
  moveCards,
  perHero,
  placeThreat,
  putIntoPlay,
  query,
  selectCards,
  theMainScheme,
  thatPlayer,
  varOf,
} from "../dsl/index.js";
import { CORRUPTION, creepingCorruptionOf, placeCorruption } from "../wave11/shadowland/creeping-corruption.js";
import { SHADOWLAND_BLACK_FLOWER_REST } from "./composed-sets.js";
import { defeatedSeatRecordsZero, healWithFacedownCard, hpRecord, hpSet, rejoinOrSitOut } from "./expert-helpers.js";

// ---------------------------------------------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------------------------------------------

const [SHADOWS_IN_THE_NIGHT, SHADOW_LABYRINTH, HEART_OF_SHADOW] = SHADOWLAND_CAMPAIGN.scenarioIds.map(
  (id) => id as string,
) as [string, string, string];

/** The three nodes, in the insert's order (p. 4); a node's id is its scenario's. */
export const SHADOWLAND_NODES: readonly string[] = [SHADOWS_IN_THE_NIGHT, SHADOW_LABYRINTH, HEART_OF_SHADOW];

/** The six Dark Protege villains (the log's "Dark Protege removed from the Campaign", p. 20), by card id. */
export const SHADOWLAND_VILLAINS: Readonly<Record<string, string>> = {
  Archpriestess: "65012a",
  Daredevil: "65013a",
  Elektra: "65014a",
  Gorgon: "65015a",
  "Lady Bullseye": "65016a",
  "White Tiger": "65017a",
};
const VILLAIN_CARDS: readonly CardId[] = Object.values(SHADOWLAND_VILLAINS).map(cardId);

/** Scenario 3's four Dark Protege minions (p. 17): Archpriestess, Gorgon, Lady Bullseye, White Tiger. */
export const SHADOWLAND_MINIONS: readonly string[] = ["65020", "65021", "65022", "65023"];
const MINION_CARDS: readonly CardId[] = SHADOWLAND_MINIONS.map(cardId);

/** Creeping Corruption, its Setup face (Black Flower 72A), and how many copies the set holds. */
const CREEPING_CORRUPTION: CardId = cardId("65072a");
const CREEPING_CORRUPTION_COPIES = 4;

const OVERPOWERING_FIELDS = ["overpowering1", "overpowering2"] as const;
const OVERPOWERING = trait("OVERPOWERING");

/** Cost 2 or less (pp. 10 and 15): the highest printed cost a recorded support or upgrade can have. */
const RECORD_MAX_COST = 2;

const LABEL: Readonly<Record<string, string>> = {
  [SHADOWS_IN_THE_NIGHT]: "Scenario #1 - Shadows in the Night",
  [SHADOW_LABYRINTH]: "Scenario #2 - Shadow Labyrinth",
  [HEART_OF_SHADOW]: "Scenario #3 - Heart of Shadow",
};
const PAGE = { rules: "MC65 p. 5", expert: "MC65 p. 6", log: "MC65 p. 20" } as const;
const SETUP_PAGE: Readonly<Record<string, string>> = {
  [SHADOWS_IN_THE_NIGHT]: "MC65 p. 9",
  [SHADOW_LABYRINTH]: "MC65 p. 14",
  [HEART_OF_SHADOW]: "MC65 p. 17",
};
const VICTORY_PAGE: Readonly<Record<string, string>> = {
  [SHADOWS_IN_THE_NIGHT]: "MC65 p. 9",
  [SHADOW_LABYRINTH]: "MC65 p. 15",
  [HEART_OF_SHADOW]: "MC65 p. 17",
};

const EXPERT_CAMPAIGN = { expertCampaign: true } as const;

// ---------------------------------------------------------------------------------------------------------------
// Small builders
// ---------------------------------------------------------------------------------------------------------------

const constant = (value: number | string | boolean): CampaignValue => ({ kind: "const", value });
const field = (id: string): CampaignValue => ({ kind: "field", field: id });
const seatField = (id: string): CampaignValue => ({ kind: "field", field: id, seat: "self" });
const choiceOf = (slot: string): CampaignValue => ({ kind: "choice", slot });
const contains = (id: string, value: string): CampaignPredicate => ({ kind: "fieldContains", field: id, value });
const notP = (of: CampaignPredicate): CampaignPredicate => ({ kind: "not", of });

const between = (
  id: string,
  text: string,
  citation: string,
  ops: readonly CampaignOp[],
  over: Partial<CampaignInstruction> = {},
): CampaignInstruction => ({ id, text, citation, step: { kind: "betweenGames", ops }, ...over });

const inGame = (
  id: string,
  text: string,
  citation: string,
  effects: readonly EffectSpec[],
  window: CampaignWindow = DEFAULT_CAMPAIGN_WINDOW,
): CampaignInstruction => ({ id, text, citation, step: { kind: "inGame", window, effects } });

// ---------------------------------------------------------------------------------------------------------------
// The villain (MC65 pp. 5, 9)
// ---------------------------------------------------------------------------------------------------------------

/** The six villains the draw may still offer: every Dark Protege villain not checked off in the log (p. 5). */
const REMAINING_VILLAINS: CampaignChoiceSource = {
  kind: "excludingTitles",
  from: { kind: "cards", cardIds: VILLAIN_CARDS },
  titlesIn: field("removedVillains"),
};

/**
 * Not printed as a bullet: each of scenarios 1 and 2's own Setup is "Choose 1 random villain from that set", and p. 5
 * says a checked-off villain "is removed from the campaign and cannot be used in later scenarios", so the campaign
 * draws
 * from what is left and tells the builder which villain it drew. Recorded in `villain`, which scenario 1's Victory
 * reads.
 */
function drawVillain(node: string): CampaignInstruction {
  return between(
    `mc65.${node}.compose.villain`,
    "Choose 1 random villain from the Dark Protege set, not counting a villain checked off in the campaign log (a checked-off villain is removed from the campaign).",
    PAGE.rules,
    [
      { kind: "random", slot: "villain", from: REMAINING_VILLAINS, perAttempt: true },
      { kind: "composeVillain", villain: choiceOf("villain") },
      { kind: "setField", field: "villain", value: choiceOf("villain") },
    ],
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Scenario 1's composition: the identity and what it removes (p. 9)
// ---------------------------------------------------------------------------------------------------------------

/** The names the first bullet matches: "If Daredevil's name or Elektra's name is recorded for this campaign". */
const NAMESAKES: readonly [string, string][] = [
  ["Daredevil", SHADOWLAND_VILLAINS["Daredevil"]!],
  ["Elektra", SHADOWLAND_VILLAINS["Elektra"]!],
];

const identityComposition: readonly CampaignInstruction[] = [
  between(
    "mc65.s1.compose.identity",
    "Each player records their identity in the campaign log. Players cannot switch identities during a campaign.",
    SETUP_PAGE[SHADOWS_IN_THE_NIGHT]!,
    [
      {
        kind: "forEachSeat",
        ops: [
          { kind: "setField", field: "identity", seat: "self", value: { kind: "seatIdentity" } },
          { kind: "setField", field: "identityName", seat: "self", value: { kind: "seatIdentity", as: "name" } },
        ],
      },
    ],
  ),
  between(
    "mc65.s1.compose.namesakes",
    "If Daredevil's name or Elektra's name is recorded for this campaign, check off the villain with that name in the campaign log, then remove that villain from the campaign.",
    SETUP_PAGE[SHADOWS_IN_THE_NIGHT]!,
    NAMESAKES.map(([name, villain]): CampaignOp => ({
      kind: "if",
      // "Recorded" by any seat; checked off once, however many players name it.
      when: {
        kind: "and",
        of: [
          { kind: "fieldContains", field: "identityName", value: name, seat: "self" },
          notP(contains("removedVillains", villain)),
        ],
      },
      then: [{ kind: "appendToList", field: "removedVillains", value: constant(villain) }],
    })),
  ),
];

// ---------------------------------------------------------------------------------------------------------------
// Creeping Corruption (pp. 9, 14, 17)
// ---------------------------------------------------------------------------------------------------------------

/** Not printed: Black Flower's other cards for the encounter deck and four 72A set aside, before the game is built. */
const corruptionComposition = (node: string, citation: string): readonly CampaignInstruction[] => [
  between(
    `mc65.${node}.compose.black-flower`,
    "Gather the Black Flower set: its Creeping Corruption upgrades (72A) set aside, each other card for the encounter deck.",
    citation,
    [
      { kind: "composeEncounterSets", sets: [constant(SHADOWLAND_BLACK_FLOWER_REST)], into: "deck" },
      { kind: "setAsideCards", cards: [constant(CREEPING_CORRUPTION)], copies: constant(CREEPING_CORRUPTION_COPIES) },
    ],
  ),
];

/**
 * "Put 1 Creeping Corruption upgrade (collector 72A) from the Black Flower modular set into play under each player's
 * control, Setup keyword side faceup. Set any remaining Creeping Corruption upgrades aside." The shuffle of the other
 * cards is the composition above. "Setup keyword side faceup" is 72A, the side the card enters on.
 */
const putCreepingCorruption = (node: string): CampaignInstruction =>
  inGame(
    `mc65.${node}.setup.creeping-corruption`,
    "Put 1 Creeping Corruption upgrade (collector 72A) from the Black Flower modular set into play under each player's control, Setup keyword side faceup. Set any remaining Creeping Corruption upgrades aside. Shuffle each other card from that set into the encounter deck.",
    SETUP_PAGE[node]!,
    [
      forEachPlayer(
        eachPlayer,
        // The copies are identical, so one at random is the first; the rest stay set aside.
        selectCards(
          "corruption",
          encounterSetAside(query("upgrade", { printedId: CREEPING_CORRUPTION }), { random: 1 }),
        ),
        putIntoPlay(chosen("corruption"), thatPlayer),
      ),
    ],
  );

/** "Each player who ... [had OVERPOWERING] places 1 corruption counter on their Creeping Corruption": scenario 2's, then 3's. */
const overpoweringCounters = (node: string, text: string, boxes: readonly string[]): CampaignInstruction =>
  inGame(`mc65.${node}.setup.overpowering`, text, SETUP_PAGE[node]!, [
    forEachPlayer(
      eachPlayer,
      ...boxes.map((box) => ifThen(campaignLogIsSet(box, true, { seat: thatPlayer }), placeCorruption(1, thatPlayer))),
    ),
  ]);

// ---------------------------------------------------------------------------------------------------------------
// The recorded cards (pp. 10, 15; 14, 17)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Supports and upgrades that print a dash for their cost ("Players cannot choose cards without a cost", pp. 10 and 15)
 * and linked cards (engine reading: a linked card is never in a deck, RRG 1.8 "Linked" p. 27, so it cannot be a
 * recorded card of one). The content record emits a dash as cost 0 with `specialCost: "dash"`, which a cost ceiling
 * cannot tell from a free card, so they are listed from the pool and taken out of what is offered. Creeping Corruption
 * (72A, "-") is one.
 */
const UNRECORDABLE_IDS: readonly CardId[] = [
  ...new Map(
    [...PLAYABLE_CARDS, ...DATA_ONLY_CARDS, ...SHADOWLAND_CARDS]
      .filter(
        (card) =>
          (card.type === "support" || card.type === "upgrade") &&
          (("specialCost" in card && card.specialCost === "dash") ||
            ("keywords" in card && card.keywords.some((keyword) => keyword.name === "linked"))),
      )
      .map((card) => [card.id, card.id] as const),
  ).values(),
];

const controlledWithin = (max: number) => ({
  categories: ["support", "upgrade"] as const,
  controller: "you" as const,
  maxPrintedCost: max,
});

/**
 * Not printed: reads the finished game into the working fields the choice below offers from, because a `record`
 * instruction reads a game and a `choose` reads the log. Per seat: the supports and upgrades they control within cost
 * 2,
 * and the ones in play that may not be recorded.
 */
function recordCandidates(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Note each player's supports and upgrades in play within the cost limit, so the card to record can be chosen.",
    citation,
    step: {
      kind: "record",
      writes: [
        {
          field: "candidates",
          seat: "each",
          mode: "set",
          value: { kind: "cardsInPlay", query: controlledWithin(RECORD_MAX_COST) },
        },
        {
          field: "unrecordable",
          seat: "each",
          mode: "set",
          value: {
            kind: "cardsInPlay",
            query: {
              categories: ["support", "upgrade"],
              controller: "you",
              // An empty `anyOf` matches nothing, which is the right answer when the pool prints no such card.
              anyOf: UNRECORDABLE_IDS.map((printedId) => ({ printedId })),
            },
          },
        },
      ],
    },
  };
}

/**
 * "Each player may choose one support or upgrade they control with a cost of 2 or less and record it in the campaign
 * log. Players cannot choose cards without a cost (cards with a cost of '-')." The first goes to slot 1, the second to
 * slot 2: the list is appended to once at each of scenarios 1 and 2.
 */
function recordCard(id: string, citation: string, text: string): CampaignInstruction {
  return between(id, text, citation, [
    {
      kind: "forEachSeat",
      ops: [
        {
          kind: "choose",
          slot: "recordedCard",
          chooser: "eachSeat",
          optional: true,
          from: {
            kind: "excludingTitles",
            from: { kind: "values", of: seatField("candidates") },
            titlesIn: seatField("unrecordable"),
          },
        },
        {
          kind: "if",
          when: { kind: "choiceMade", slot: "recordedCard" },
          then: [{ kind: "appendToList", field: "recordedCards", seat: "self", value: choiceOf("recordedCard") }],
        },
      ],
    },
  ]);
}

/**
 * "Each player may take one copy of [each card] they recorded in the campaign log from their deck and put it into play
 * under their control. [Then,] for each card a player put into play this way, that player places 1 corruption counter
 * on their Creeping Corruption." A recorded card names the first copy found among the player's own cards (a deck card
 * is controlled by its owner), none included. The setup window is before the starting hands are drawn, so every copy
 * of a card the player may take is still in their deck; no query can name the deck zone alone, which is why the
 * window, not a filter, keeps it so.
 */
function takeRecordedCards(node: string, text: string, most: number): CampaignInstruction {
  return inGame(`mc65.${node}.setup.recorded-cards`, text, SETUP_PAGE[node]!, [
    forEachPlayer(
      eachPlayer,
      chooseCards(
        "taken",
        campaignLogCards("recordedCards", { seat: thatPlayer, filter: { controlledBy: thatPlayer } }),
        {
          min: 0,
          max: most,
          chooser: thatPlayer,
        },
      ),
      putIntoPlay(chosen("taken"), thatPlayer, { bind: "put" }),
      addCounters(CORRUPTION, varOf("put.count"), creepingCorruptionOf(thatPlayer)),
    ),
  ]);
}

// ---------------------------------------------------------------------------------------------------------------
// Expert campaign (p. 6)
// ---------------------------------------------------------------------------------------------------------------

const REJOIN_LABEL = "Rejoin and heal to full · +1 facedown card";

/**
 * Scenarios 2 and 3's two shaded bullets, after the rest of Setup in print. A defeated player is asked before the
 * scenario is set up whether to rejoin (`rejoinOrSitOut`). The hard set of hit points runs in the campaign
 * instructions after the scenario's own setup (`afterScenarioSetup`), so it overwrites any damage setup dealt: RRG 1.8
 * Appendix II step 13 and the insert p. 5 ("Set up each scenario as normal, then follow ..."), owner question 12 = B
 * (Quin, 2026-10-22, PR #355, docs/phase7-shadowland.md §5.1). This departs from the ruling June 2, 2026 (3) #2 that
 * the other boxes keep (set first); only Shadowland follows the RRG order. The heal is dealing a facedown encounter
 * card, which follows the set.
 */
const expertSetups = (node: string): readonly CampaignInstruction[] => {
  const citation = SETUP_PAGE[node]!;
  return [
    rejoinOrSitOut(`mc65.${node}.setup.rejoin`, PAGE.expert, REJOIN_LABEL),
    hpSet(`mc65.${node}.setup.hp-set`, citation),
    healWithFacedownCard(`mc65.${node}.setup.heal`, citation),
  ];
};

// ---------------------------------------------------------------------------------------------------------------
// The three nodes
// ---------------------------------------------------------------------------------------------------------------

const MINION_FILTER = query("minion", { anyOf: MINION_CARDS.map((printedId) => ({ printedId })) });

const nodeOne: CampaignNode = {
  id: SHADOWS_IN_THE_NIGHT,
  label: LABEL[SHADOWS_IN_THE_NIGHT]!,
  scenario: { kind: "fixed", scenarioId: SHADOWLAND_CAMPAIGN.scenarioIds[0]! },
  composition: [
    ...identityComposition,
    drawVillain(SHADOWS_IN_THE_NIGHT),
    ...corruptionComposition(SHADOWS_IN_THE_NIGHT, SETUP_PAGE[SHADOWS_IN_THE_NIGHT]!),
  ],
  setup: [
    putCreepingCorruption(SHADOWS_IN_THE_NIGHT),
    inGame(
      "mc65.s1.setup.threat",
      "Place an additional 1[per_hero] threat on the main scheme.",
      SETUP_PAGE[SHADOWS_IN_THE_NIGHT]!,
      [placeThreat(perHero(1), theMainScheme)],
    ),
  ],
  victory: [
    between(
      "mc65.s1.victory.villain",
      "In the campaign log, check off the name of the villain from the Dark Protege special encounter set used in this scenario. Remove that villain from the campaign.",
      VICTORY_PAGE[SHADOWS_IN_THE_NIGHT]!,
      [{ kind: "appendToList", field: "removedVillains", value: field("villain") }],
    ),
    overpoweringRecord("mc65.s1.victory.overpowering", VICTORY_PAGE[SHADOWS_IN_THE_NIGHT]!, "overpowering1"),
    recordCandidates("mc65.s1.victory.candidates", "MC65 p. 10"),
    recordCard(
      "mc65.s1.victory.card",
      "MC65 p. 10",
      'Each player may choose one support or upgrade they control with a cost of 2 or less and record it in the campaign log. (Each player will be able to start the next scenario with their chosen card in play at the cost of additional corruption counters on their Creeping Corruption.) Players cannot choose cards without a cost (cards with a cost of "-").',
    ),
    hpRecord("mc65.s1.victory.hp", "MC65 p. 10"),
  ],
};

/** "Each player records if their Creeping Corruption upgrade has the OVERPOWERING trait in the campaign log." */
function overpoweringRecord(id: string, citation: string, box: string): CampaignInstruction {
  return {
    id,
    text: "Each player records if their Creeping Corruption upgrade has the OVERPOWERING trait in the campaign log.",
    citation,
    step: {
      kind: "record",
      writes: [
        {
          field: box,
          seat: "each",
          mode: "set",
          value: {
            kind: "atLeast",
            of: {
              kind: "cardsInPlay",
              query: { categories: ["upgrade"], name: "Creeping Corruption", trait: OVERPOWERING, controller: "you" },
            },
            amount: 1,
          },
        },
      ],
    },
  };
}

const nodeTwo: CampaignNode = {
  id: SHADOW_LABYRINTH,
  label: LABEL[SHADOW_LABYRINTH]!,
  scenario: { kind: "fixed", scenarioId: SHADOWLAND_CAMPAIGN.scenarioIds[1]! },
  composition: [
    drawVillain(SHADOW_LABYRINTH),
    ...corruptionComposition(SHADOW_LABYRINTH, SETUP_PAGE[SHADOW_LABYRINTH]!),
  ],
  setup: [
    putCreepingCorruption(SHADOW_LABYRINTH),
    overpoweringCounters(
      SHADOW_LABYRINTH,
      "Each player checks the campaign log. Each player whose Creeping Corruption had the OVERPOWERING trait in the previous scenario places 1 corruption counter on their Creeping Corruption.",
      ["overpowering1"],
    ),
    takeRecordedCards(
      SHADOW_LABYRINTH,
      "Each player may take one copy of the card they recorded in the campaign log from their deck and put it into play under their control. Each player who does so places 1 corruption counter on their Creeping Corruption.",
      1,
    ),
    inGame(
      "mc65.s2.setup.threat",
      "Place an additional 3[per_hero] threat on the main scheme.",
      SETUP_PAGE[SHADOW_LABYRINTH]!,
      [placeThreat(perHero(3), theMainScheme)],
    ),
    ...expertSetups(SHADOW_LABYRINTH),
  ],
  victory: [
    overpoweringRecord("mc65.s2.victory.overpowering", VICTORY_PAGE[SHADOW_LABYRINTH]!, "overpowering2"),
    recordCandidates("mc65.s2.victory.candidates", VICTORY_PAGE[SHADOW_LABYRINTH]!),
    recordCard(
      "mc65.s2.victory.card",
      VICTORY_PAGE[SHADOW_LABYRINTH]!,
      'Each player may choose one support or upgrade they control with a cost of 2 or less and record it in the campaign log. Players cannot choose cards without a cost (cards with a cost of "-").',
    ),
    hpRecord("mc65.s2.victory.hp", VICTORY_PAGE[SHADOW_LABYRINTH]!),
  ],
};

const nodeThree: CampaignNode = {
  id: HEART_OF_SHADOW,
  label: LABEL[HEART_OF_SHADOW]!,
  scenario: { kind: "fixed", scenarioId: SHADOWLAND_CAMPAIGN.scenarioIds[2]! },
  composition: [
    between(
      "mc65.s3.compose.minions",
      "Find the four minions from the Dark Protege set (Archpriestess, Gorgon, Lady Bullseye, and White Tiger).",
      SETUP_PAGE[HEART_OF_SHADOW]!,
      [{ kind: "setAsideCards", cards: MINION_CARDS.map(constant) }],
    ),
  ],
  setup: [
    overpoweringCounters(
      HEART_OF_SHADOW,
      "Each player checks the campaign log and places 1 corruption counter on their Creeping Corruption upgrade for each time in a previous scenario their Creeping Corruption had the OVERPOWERING trait.",
      OVERPOWERING_FIELDS,
    ),
    takeRecordedCards(
      HEART_OF_SHADOW,
      "Each player may take one copy of each card they recorded in the campaign log from their deck and put it into play under their control. Then, for each card a player put into play this way, that player places 1 corruption counter on their Creeping Corruption.",
      2,
    ),
    inGame(
      "mc65.s3.setup.minions",
      "Find the four minions from the Dark Protege set (Archpriestess, Gorgon, Lady Bullseye, and White Tiger). Deal one minion at random to each player as a facedown encounter card, then shuffle any remaining minions into the encounter deck.",
      SETUP_PAGE[HEART_OF_SHADOW]!,
      [
        forEachPlayer(
          eachPlayer,
          selectCards("minion", encounterSetAside(MINION_FILTER, { random: 1 })),
          dealAsEncounterCard(chosen("minion"), thatPlayer),
        ),
        moveCards(encounterSetAside(MINION_FILTER), "encounterDeckShuffle"),
      ],
    ),
    ...expertSetups(HEART_OF_SHADOW),
  ],
  victory: [between("mc65.s3.victory.win", "The players win the campaign!", VICTORY_PAGE[HEART_OF_SHADOW]!, [])],
};

// ---------------------------------------------------------------------------------------------------------------
// The definition
// ---------------------------------------------------------------------------------------------------------------

const logFields: readonly LogFieldDef[] = [
  { id: "identity", label: "Identity", scope: "perSeat", type: { kind: "cardRef" }, citation: PAGE.log },
  {
    id: "identityName",
    label: "Identity's name (working)",
    scope: "perSeat",
    type: { kind: "text" },
    working: true,
    citation: "MC65 p. 9",
  },
  {
    id: "remainingHp",
    label: "Remaining hit points",
    scope: "perSeat",
    type: { kind: "number", min: 0 },
    whenModes: EXPERT_CAMPAIGN,
    citation: PAGE.expert,
  },
  {
    id: "recordedCards",
    label: "Recorded support or upgrade",
    scope: "perSeat",
    type: { kind: "cardList" },
    citation: "MC65 p. 10",
  },
  {
    id: "overpowering1",
    label: "Was your Creeping Corruption OVERPOWERING? Scenario #1 (Shadows in the Night)",
    scope: "perSeat",
    type: { kind: "flag" },
    citation: PAGE.log,
  },
  {
    id: "overpowering2",
    label: "Was your Creeping Corruption OVERPOWERING? Scenario #2 (Shadow Labyrinth)",
    scope: "perSeat",
    type: { kind: "flag" },
    citation: PAGE.log,
  },
  {
    id: "removedVillains",
    label: "Dark Protege removed from the Campaign",
    scope: "shared",
    type: { kind: "cardList" },
    citation: PAGE.log,
  },
  {
    id: "villain",
    label: "Dark Protege villain of this scenario (working)",
    scope: "shared",
    type: { kind: "cardRef" },
    working: true,
    citation: PAGE.rules,
  },
  {
    id: "candidates",
    label: "Supports and upgrades costing 2 or less (working)",
    scope: "perSeat",
    type: { kind: "cardList" },
    working: true,
    citation: "MC65 p. 10",
  },
  {
    id: "unrecordable",
    label: "Supports and upgrades that cannot be recorded (working)",
    scope: "perSeat",
    type: { kind: "cardList" },
    working: true,
    citation: "MC65 p. 10",
  },
];

export const SHADOWLAND_CAMPAIGN_DEFINITION: CampaignDefinition = {
  campaignId: SHADOWLAND_CAMPAIGN.id,
  version: "1",
  logFields,
  // MC65 p. 6: "If a player is defeated during a scenario and teammates go on to win, the defeated player does not take
  // part in that scenario's victory steps, but can rejoin for the next scenario by dealing themselves one facedown
  // encounter card during setup." A seat that sat out has its earlier hit point record cleared so it must pay to
  // rejoin.
  everyNodeVictory: [defeatedSeatRecordsZero("mc65.victory.defeated-hp", PAGE.expert)],
  elimination: {
    id: "mc65.elimination",
    text: "If a player is defeated during a scenario and teammates go on to win, the defeated player does not take part in that scenario's victory steps, but can rejoin for the next scenario by dealing themselves one facedown encounter card during setup to restore their identity to its starting hit point value.",
    citation: PAGE.expert,
    whenModes: EXPERT_CAMPAIGN,
  },
  // MC65 p. 5: "if they lost they may reset the scenario and try again with no penalty". No DEFEAT block anywhere.
  loss: { retry: "free", retryBaseline: "nodeStart", citation: "MC65 pp. 4, 5" },
  graph: { kind: "linear", nodes: [nodeOne, nodeTwo, nodeThree] },
};
