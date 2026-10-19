/**
 * Fear No Evil (MC60), the tenth `CampaignDefinition` and the only one with a `choice` graph (docs/phase7-wave11-
 * scenarios.md section S5). Source: `docs/campaign-modes/markdown/mc60_fear_no_evil.md` ("MC60 p. N"), the campaign
 * setup on p. 9 (steps 1 to 14), each scenario's CAMPAIGN INSTRUCTIONS (pp. 13 to 23) and the log sheet on p. 28.
 *
 * **The shape.** Five interchangeable scenarios (a main scheme, its environment, an underling villain chosen for it)
 * and the Kingpin finale. Before every game the runner's `beforeChoice` block draws and progresses two unresolved
 * scenarios (steps 1 to 3); the players then choose one (step 4: `available` is always true, the finale is reached only
 * through `finale.when`); the node's `composition` fixes the villain (step 5), deck surgery (step 8) and the cards the
 * campaign sets aside for step 12 and 13 (the environments, the Typhoid Mary ally, and what two environments' Setups
 * draw on); `everyNodeSetup` carries steps 10 to 13 and the node's own `setup` the scenario's SETUP bullet (step 14).
 *
 * **Node ids are the scenario ids** (`art-museum-heist`, ..., `kingpin`); the villain is recorded per node as the
 * villain encounter set id (`hammerhead`, `typhoid_mary`, ...), which is what the caller hands to `wave11Scenario` as
 * `villainSetId` (`CampaignGameStart.villain`).
 *
 * **Reading flags for the rules expert** (each is marked where it is built):
 * 1. Settled (rules expert, 2026-10-19; spec E30): DEFEAT says "Go to 'Campaign Setup' on page 9" and p. 8 says a
 *    lost scenario "may be able to be attempted again", so a lost game keeps the log (`retryBaseline: "keepLog"`): the
 *    marks already drawn stay, the DEFEAT block goes on top, `beforeChoice` draws two new environments and the players
 *    choose again (perhaps another scenario; one that Failed is not offered). The playthrough answer is asked once.
 * 2. Settled with 1: the villain recorded at composition survives a lost game, so the next game at that scenario
 *    takes it by step 5a ("If there is already a villain listed"). Removed allies and supports are still recorded
 *    only by a VICTORY block (Q201 = A), so a lost game records none.
 * 3. Settled (owner, Q210 = B, 2026-10-19): step 5b is repeated before every game. "First time through?" is asked once
 *    and only says whether 5b applies at all; then at each scenario's setup with no recorded villain (5a wins when
 *    there is one, also after a loss) the group is offered the next unrecorded villain on p. 8's list (with the Purple
 *    Man / Typhoid Mary group choice when that is the next pair) or a random unrecorded villain (5c).
 * 4. Settled (rules expert, 2026-10-19; spec E31): step 12 places every environment first, then resolves their Setups
 *    together (`resolveSetups`), the first player ordering them when two or more have one (RRG 1.8 "Simultaneous
 *    Resolution", p. 40); with one, no prompt.
 * 5. "Under any player's control" (step 13) is decided by the first player (`choosePlayer`).
 */

import { FNE_CAMPAIGN, cardId, trait, type CardId } from "@mc/content";
import {
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
  campaignLogAtLeast,
  campaignLogValue,
  choosePlayer,
  chosen,
  chosenPlayer,
  chooseOneBy,
  countOf,
  dealEncounterCard,
  eachPlayer,
  each,
  encounterSetAside,
  findCard,
  firstPlayer,
  forEachPlayer,
  giveBoostCard,
  giveTough,
  heal,
  identityOf,
  ifElse,
  ifThen,
  inEncounterSet,
  inMode,
  option,
  perHero,
  placeThreat,
  product,
  putIntoPlay,
  query,
  removeCountersFrom,
  resolveSetups,
  selectCards,
  statOf,
  thatPlayer,
  valueAtLeast,
} from "../dsl/index.js";
import { defeatedSeatRecordsZero, hpSet, rejoinOrSitOut } from "./expert-helpers.js";

// ---------------------------------------------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------------------------------------------

const [ART_MUSEUM_HEIST, THE_GETAWAY, PROTECTION_RACKET, THE_RAFT_BREAKOUT, STOP_THE_PRESSES, KINGPIN] =
  FNE_CAMPAIGN.scenarioIds.map((id) => id as string) as [string, string, string, string, string, string];

/** The five interchangeable scenarios in log order (MC60 p. 28); Kingpin is the finale. */
export const FNE_UNDERLING_NODES: readonly string[] = [
  ART_MUSEUM_HEIST,
  THE_GETAWAY,
  PROTECTION_RACKET,
  THE_RAFT_BREAKOUT,
  STOP_THE_PRESSES,
];
export const FNE_FINALE_NODE: string = KINGPIN;

/** The log sheet's "List of Villains", in its printed order; each is its villain encounter set's id (`villainSetId`). */
export const FNE_VILLAINS: readonly string[] = ["bullseye", "electro", "hammerhead", "purple_man", "typhoid_mary"];

/** MC60 p. 8 "Underling villain play order", the first-playthrough order (item 4 is a choice of two). */
const RECOMMENDED_ORDER: readonly string[] = ["hammerhead", "bullseye", "electro"];

/** Each scenario's campaign environment, its Completed face (the Failed face is its `flipSide`). */
export const FNE_ENVIRONMENTS: Readonly<Record<string, string>> = {
  [ART_MUSEUM_HEIST]: "60205a",
  [THE_GETAWAY]: "60206a",
  [PROTECTION_RACKET]: "60207a",
  [THE_RAFT_BREAKOUT]: "60208a",
  [STOP_THE_PRESSES]: "60209a",
};
/** The encounter set of the campaign cards (the environments 60205 to 60209 and the Typhoid Mary ally). */
const FNE_CAMPAIGN_SET = "fne_campaign";
const TYPHOID_MARY_ALLY: CardId = cardId("60210a");
/** The Raft Breakout encounter set's six minions (60144 to 60149): set aside when its Failed environment is in play. */
const RAFT_MINIONS: readonly CardId[] = ["60144", "60145", "60146", "60147", "60148", "60149"].map(cardId);
/** The Daily Bugle supports (60153 to 60156): set aside when the Completed Stop the Presses! environment is in play. */
const BUGLE_SUPPORTS: readonly CardId[] = ["60153", "60154", "60155", "60156"].map(cardId);

export const FNE_FIRST_PLAYTHROUGH = "First playthrough";
export const FNE_LATER_PLAYTHROUGH = "Not the first playthrough";
/** Step 5b's per-scenario offer on a first playthrough (owner answer Q210 = B, 2026-10-19). */
export const FNE_VILLAIN_LISTED = "The next villain on the recommended list";
export const FNE_VILLAIN_RANDOM = "A random unrecorded villain";

const LOG_PAGE = "MC60 p. 28";
const SETUP_PAGE = "MC60 p. 9";

/** Each scenario's page for its CAMPAIGN INSTRUCTIONS (the map on p. 10). */
const PAGE: Readonly<Record<string, string>> = {
  [PROTECTION_RACKET]: "MC60 p. 13",
  [THE_RAFT_BREAKOUT]: "MC60 p. 15",
  [ART_MUSEUM_HEIST]: "MC60 p. 17",
  [THE_GETAWAY]: "MC60 p. 19",
  [STOP_THE_PRESSES]: "MC60 p. 21",
  [KINGPIN]: "MC60 p. 23",
};
const LABEL: Readonly<Record<string, string>> = {
  [ART_MUSEUM_HEIST]: "Art Museum Heist",
  [THE_GETAWAY]: "The Getaway",
  [PROTECTION_RACKET]: "Protection Racket",
  [THE_RAFT_BREAKOUT]: "The Raft Breakout",
  [STOP_THE_PRESSES]: "Stop the Presses!",
  [KINGPIN]: "Kingpin",
};

export const villainField = (node: string): string => `villain.${node}`;
export const completedField = (node: string): string => `completed.${node}`;

// ---------------------------------------------------------------------------------------------------------------
// Small builders
// ---------------------------------------------------------------------------------------------------------------

const constant = (value: number | string | boolean): CampaignValue => ({ kind: "const", value });
const fieldOf = (field: string): CampaignValue => ({ kind: "field", field });
const choiceOf = (slot: string): CampaignValue => ({ kind: "choice", slot });
const isSet = (field: string): CampaignPredicate => ({ kind: "fieldIsSet", field });
const notP = (of: CampaignPredicate): CampaignPredicate => ({ kind: "not", of });
const allOf = (...of: CampaignPredicate[]): CampaignPredicate => ({ kind: "and", of });
const resolved = (nodeId: string, as?: "completed" | "failed"): CampaignPredicate => ({
  kind: "nodeResolved",
  nodeId,
  ...(as ? { as } : {}),
});

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
  window: CampaignWindow,
  effects: readonly EffectSpec[],
  over: Partial<CampaignInstruction> = {},
): CampaignInstruction => ({ id, text, citation, step: { kind: "inGame", window, effects }, ...over });

const EXPERT_CAMPAIGN = { expertCampaign: true } as const;

// ---------------------------------------------------------------------------------------------------------------
// Log fields (MC60 p. 28; section S5.1)
// ---------------------------------------------------------------------------------------------------------------

const logFields: readonly LogFieldDef[] = [
  {
    id: "remainingHp",
    label: "Remaining hit points",
    scope: "perSeat",
    type: { kind: "number", min: 0 },
    whenModes: EXPERT_CAMPAIGN,
    citation: SETUP_PAGE,
  },
  ...FNE_UNDERLING_NODES.map((node): LogFieldDef => ({
    id: villainField(node),
    label: `Villain: ${LABEL[node]}`,
    scope: "shared",
    type: { kind: "choice", options: FNE_VILLAINS },
    citation: LOG_PAGE,
  })),
  ...FNE_UNDERLING_NODES.map((node): LogFieldDef => ({
    id: completedField(node),
    label: `Completed: ${LABEL[node]}`,
    scope: "shared",
    type: { kind: "flag" },
    citation: LOG_PAGE,
  })),
  {
    id: "unrecordedVillains",
    label: "List of Villains",
    scope: "shared",
    type: { kind: "strikeList", options: FNE_VILLAINS },
    citation: LOG_PAGE,
  },
  {
    id: "removedTitles",
    label: "Allies and Persona Supports Removed from the Campaign",
    scope: "shared",
    type: { kind: "cardList" },
    citation: LOG_PAGE,
  },
  { id: "trustEstablished", label: "Trust Established?", scope: "shared", type: { kind: "flag" }, citation: LOG_PAGE },
  { id: "maryDefeated", label: "Mary Defeated?", scope: "shared", type: { kind: "flag" }, citation: LOG_PAGE },
  {
    id: "playthrough",
    label: "First time through the campaign?",
    scope: "shared",
    type: { kind: "choice", options: [FNE_FIRST_PLAYTHROUGH, FNE_LATER_PLAYTHROUGH] },
    working: true,
    citation: SETUP_PAGE,
  },
  // Persists in the log, but is re-asked (and overwritten) before every read of it.
  {
    id: "villainMethod",
    label: "How this scenario's villain is chosen (first playthrough)",
    scope: "shared",
    type: { kind: "choice", options: [FNE_VILLAIN_LISTED, FNE_VILLAIN_RANDOM] },
    working: true,
    citation: SETUP_PAGE,
  },
  {
    id: "checks",
    label: "Check marks beside the chosen scenario",
    scope: "shared",
    type: { kind: "number", min: 0 },
    working: true,
    citation: SETUP_PAGE,
  },
  {
    id: "trustThisGame",
    label: "Disturbed Psyche had at least 2 threat this game",
    scope: "shared",
    type: { kind: "flag" },
    working: true,
    citation: PAGE[PROTECTION_RACKET]!,
  },
  {
    id: "maryThisGame",
    label: "The Typhoid Mary ally is in the victory display",
    scope: "shared",
    type: { kind: "flag" },
    working: true,
    citation: PAGE[PROTECTION_RACKET]!,
  },
];

// ---------------------------------------------------------------------------------------------------------------
// beforeChoice: campaign setup steps 1 to 3 (MC60 p. 9)
// ---------------------------------------------------------------------------------------------------------------

/** Every scenario still to be played except the finale: steps 1 and 2's "remaining campaign environments". */
const REMAINING: CampaignChoiceSource = {
  kind: "excludingTitles",
  from: { kind: "nodes", filter: "unresolved" },
  titlesIn: constant(FNE_FINALE_NODE),
};

const beforeChoice: readonly CampaignInstruction[] = [
  between(
    "mc60.choice.playthrough",
    "Is this the players' first time through the campaign?",
    "MC60 p. 9",
    [
      { kind: "choose", slot: "playthrough", chooser: "group", from: { kind: "fieldOptions", field: "playthrough" } },
      { kind: "setField", field: "playthrough", value: choiceOf("playthrough") },
    ],
    { when: notP(isSet("playthrough")) },
  ),
  between(
    "mc60.choice.draw",
    "Shuffle the remaining campaign environments and draw two at random. If there is only one remaining, draw it.",
    "MC60 p. 9 step 2",
    [
      { kind: "random", slot: "drawA", from: REMAINING },
      {
        kind: "random",
        slot: "drawB",
        from: { kind: "excludingTitles", from: REMAINING, titlesIn: choiceOf("drawA") },
      },
    ],
  ),
  between(
    "mc60.choice.progress",
    "In the Campaign Log, progress each scenario matching a drawn environment by marking the first unmarked box to the right of that scenario. If there was only one environment drawn, mark two boxes instead. If a scenario has three Xs to its right, it has Failed.",
    "MC60 p. 9 step 3",
    [
      { kind: "progressNode", node: choiceOf("drawA") },
      { kind: "progressNode", node: choiceOf("drawB") },
      {
        kind: "if",
        when: notP({ kind: "choiceMade", slot: "drawB" }),
        then: [{ kind: "progressNode", node: choiceOf("drawA") }],
      },
    ],
  ),
];

// ---------------------------------------------------------------------------------------------------------------
// Composition: campaign setup steps 5, 6, 8 and what steps 12 and 13 draw on (MC60 p. 9)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Step 5: "Determine the villain ... and record the name of the chosen villain next to the scenario":
 * (a) the villain already listed for the scenario; else (b) on the players' first time through, the group may take the first of
 * Hammerhead, Bullseye and Electro still unrecorded, then a group choice of Purple Man or Typhoid Mary (the only two left); else
 * (c) one of the unrecorded villains at random. Recording also strikes it from the log's "List of Villains".
 * Reading flag 3: on a first playthrough the group is asked, each time, between 5b's list and 5c's random draw.
 */
function villainComposition(node: string): CampaignInstruction {
  const field = villainField(node);
  const recommended = RECOMMENDED_ORDER.reduceRight<readonly CampaignOp[]>(
    (otherwise, villain) => [
      {
        kind: "if",
        when: { kind: "notStruck", field: "unrecordedVillains", option: villain },
        then: [{ kind: "setField", field, value: constant(villain) }],
        else: otherwise,
      },
    ],
    [
      {
        // "Purple Man or Typhoid Mary": by now the three above are struck, so the unstruck options are exactly the two.
        kind: "choose",
        slot: "villain",
        chooser: "group",
        // Asked once: a lost game keeps the record (`retryBaseline: "keepLog"`), and 5a then takes it.
        from: { kind: "fieldOptions", field: "unrecordedVillains", unstruckOnly: true },
      },
      { kind: "setField", field, value: choiceOf("villain") },
    ],
  );
  const randomVillain: readonly CampaignOp[] = [
    {
      kind: "random",
      slot: "villain",
      from: { kind: "fieldOptions", field: "unrecordedVillains", unstruckOnly: true },
    },
    { kind: "setField", field, value: choiceOf("villain") },
  ];
  return between(
    `mc60.${node}.compose.villain`,
    "Determine the villain and record the name of the chosen villain next to the scenario in the campaign log. Gather your chosen villain and its encounter set.",
    "MC60 p. 9 steps 5 and 6",
    [
      {
        kind: "if",
        when: notP(isSet(field)),
        then: [
          {
            kind: "if",
            when: { kind: "fieldContains", field: "playthrough", value: FNE_FIRST_PLAYTHROUGH },
            then: [
              // Asked at every setup that has no recorded villain; the field only carries the answer to the `if`.
              {
                kind: "choose",
                slot: "villainMethod",
                chooser: "group",
                from: { kind: "fieldOptions", field: "villainMethod" },
              },
              { kind: "setField", field: "villainMethod", value: choiceOf("villainMethod") },
              {
                kind: "if",
                when: { kind: "fieldContains", field: "villainMethod", value: FNE_VILLAIN_LISTED },
                then: recommended,
                else: randomVillain,
              },
            ],
            else: randomVillain,
          },
          { kind: "strike", field: "unrecordedVillains", option: fieldOf(field) },
        ],
      },
      { kind: "composeVillain", villain: fieldOf(field) },
    ],
  );
}

/** Step 12's cards, step 13's ally and what the environments' Setups draw on, set aside for the game (MC60 p. 9). */
function campaignSetAsides(node: string): readonly CampaignInstruction[] {
  const prefix = `mc60.${node}.compose`;
  return [
    // Step 8, before the set-asides below so a removed Daily Bugle support is not offered (S4.1 Q203).
    between(
      `${prefix}.surgery`,
      "Each player searches their deck for each card whose title is recorded in the 'Allies/Supports Removed from the Campaign' section of the campaign log and removes those cards from the game.",
      "MC60 p. 9 step 8",
      [{ kind: "removeFromCampaign", cards: [fieldOf("removedTitles")], byTitle: true }],
    ),
    ...FNE_UNDERLING_NODES.map((scenario) =>
      between(
        `${prefix}.environment.${scenario}`,
        `Gather the ${LABEL[scenario]} campaign environment (a Completed or Failed scenario's).`,
        "MC60 p. 9 steps 1 and 12",
        [{ kind: "setAsideCards", cards: [constant(FNE_ENVIRONMENTS[scenario]!)] }],
        { when: resolved(scenario) },
      ),
    ),
    between(
      `${prefix}.typhoid-mary`,
      "If 'Trust Established?' is checked in the campaign log and 'Mary Defeated?' is not, gather the Typhoid Mary campaign ally.",
      "MC60 p. 9 step 13",
      [{ kind: "setAsideCards", cards: [constant(TYPHOID_MARY_ALLY)] }],
      { when: allOf(isSet("trustEstablished"), notP(isSet("maryDefeated"))) },
    ),
    between(
      `${prefix}.raft-minions`,
      "(Not printed: The Raft Breakout's Failed environment shuffles the six minions of its encounter set into the encounter deck, so a game that does not play that scenario holds them set aside.)",
      "MC60 p. 9 step 12",
      [{ kind: "setAsideCards", cards: RAFT_MINIONS.map(constant) }],
      { when: resolved(THE_RAFT_BREAKOUT, "failed") },
    ),
    between(
      `${prefix}.daily-bugle`,
      "(Not printed: Stop the Presses!'s Completed environment lets each player choose a Daily Bugle support, so a game that does not play that scenario holds those not removed from the campaign set aside.)",
      "MC60 p. 9 step 12",
      [{ kind: "setAsideCards", cards: BUGLE_SUPPORTS.map(constant) }],
      { when: resolved(STOP_THE_PRESSES, "completed") },
    ),
  ];
}

function composition(node: string): readonly CampaignInstruction[] {
  const checks =
    node === KINGPIN
      ? []
      : [
          between(
            `mc60.${node}.compose.checks`,
            "(Not printed: copies the check marks beside this scenario into a working number the SETUP bullet reads.)",
            "MC60 p. 9 step 3",
            [{ kind: "setField", field: "checks", value: { kind: "nodeProgress", node } }],
          ),
        ];
  return [...(node === KINGPIN ? [] : [villainComposition(node)]), ...campaignSetAsides(node), ...checks];
}

// ---------------------------------------------------------------------------------------------------------------
// everyNodeSetup: campaign setup steps 10 to 13 (MC60 p. 9)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Steps 10 and 11 (and the rejoin they price) read "the previous scenario": the first game of the campaign has none,
 * and no record to read (with none, every seat would be set to 0). Gated on any seat holding a record, which every game
 * of an expert campaign writes, won or lost (as aos.ts gives its expert setups to scenarios 2 to 5 only).
 */
const AFTER_A_GAME: CampaignPredicate = { kind: "fieldIsSet", field: "remainingHp", seat: "self" };

const afterMulligans = (instruction: CampaignInstruction): CampaignInstruction =>
  instruction.step.kind === "inGame"
    ? { ...instruction, step: { ...instruction.step, window: "afterMulligans" } }
    : instruction;

/** "Expert Campaign Only: Set each player's hit points to their remaining hit point value ... previous scenario." */
const hpSetStep: CampaignInstruction = { ...afterMulligans(hpSet("mc60.setup.hp", SETUP_PAGE)), when: AFTER_A_GAME };

const HEAL_LABEL = "Heal REC · +1 facedown card";
const REJOIN_LABEL = "Rejoin and heal REC · +1 facedown card";

/**
 * "Expert Campaign Only: Each player may deal themself one facedown encounter card to heal damage from their identity
 * equal to its REC." A seat recorded at 0 that is still here chose to rejoin (`rejoinOrSitOut`) and pays without being
 * asked again, as the other boxes' heals do (docs/phase7-wave11-scenarios.md S4.0).
 */
const healStep: CampaignInstruction = (() => {
  const identity = identityOf(thatPlayer);
  const pay = [dealEncounterCard(thatPlayer), heal(statOf(identity, "rec"), identity)];
  return inGame(
    "mc60.setup.heal",
    "Expert Campaign Only: Each player may deal themself one facedown encounter card to heal damage from their identity equal to its REC.",
    SETUP_PAGE,
    "afterMulligans",
    [
      forEachPlayer(
        eachPlayer,
        ifThen(
          campaignLogAtLeast("remainingHp", 1, { seat: thatPlayer }),
          chooseOneBy(thatPlayer, option(HEAL_LABEL, ...pay), option("Decline", [])),
          pay,
        ),
      ),
    ],
    // "May" (MC60 p. 9 step 11): a seat with hit points left may decline.
    { whenModes: EXPERT_CAMPAIGN, when: AFTER_A_GAME },
  );
})();

/**
 * Step 12: one instruction placing each environment on each face, in log order, gated on the scenario's outcome; then
 * one resolving the Setups of every environment placed, which the first player orders when two or more have one (RRG
 * 1.8 "Simultaneous Resolution", p. 40; spec E31). Only a resolved scenario's environment is set aside (`composition`),
 * so the campaign environments in play here are exactly the ones placed.
 */
const environmentSteps: readonly CampaignInstruction[] = [
  ...FNE_UNDERLING_NODES.flatMap((scenario) =>
    (["completed", "failed"] as const).map((as) =>
      inGame(
        `mc60.setup.environment.${scenario}.${as}`,
        `Place the environment for each ${as === "completed" ? "Completed" : "Failed"} scenario into play ${as === "completed" ? "Completed" : "Failed"} side faceup.`,
        "MC60 p. 9 step 12",
        "afterMulligans",
        [
          selectCards(
            "environment",
            encounterSetAside(query("environment", { printedId: cardId(FNE_ENVIRONMENTS[scenario]!) })),
          ),
          // A flip or a campaign placement is not a reveal (January 26, 2026 R4 (2); April 30, 2026 R3 (3)): no When
          // Revealed.
          putIntoPlay(chosen("environment"), firstPlayer, { otherFace: as === "failed" }),
        ],
        { when: resolved(scenario, as) },
      ),
    ),
  ),
  inGame(
    "mc60.setup.environment.setups",
    'Resolve the "Setup" abilities on each of these cards.',
    "MC60 p. 9 step 12",
    "afterMulligans",
    [resolveSetups(each(query("environment", inEncounterSet(FNE_CAMPAIGN_SET))), firstPlayer)],
    { when: { kind: "or", of: FNE_UNDERLING_NODES.map((scenario) => resolved(scenario)) } },
  ),
];

/** Step 13: the ally goes into play under the player the first player names, only while Trust holds and Mary lives. */
const maryStep: CampaignInstruction = inGame(
  "mc60.setup.typhoid-mary",
  "If 'Trust Established?' is checked in the campaign log and 'Mary Defeated?' is not, put the Typhoid Mary campaign ally into play under any player's control.",
  "MC60 p. 9 step 13",
  "afterMulligans",
  [
    selectCards("mary", encounterSetAside({ printedId: TYPHOID_MARY_ALLY })),
    choosePlayer("maryController", firstPlayer),
    putIntoPlay(chosen("mary"), chosenPlayer("maryController")),
  ],
  { when: allOf(isSet("trustEstablished"), notP(isSet("maryDefeated"))) },
);

const everyNodeSetup: readonly CampaignInstruction[] = [
  { ...rejoinOrSitOut("mc60.setup.rejoin", "MC60 p. 9", REJOIN_LABEL), when: AFTER_A_GAME },
  hpSetStep,
  healStep,
  ...environmentSteps,
  maryStep,
];

// ---------------------------------------------------------------------------------------------------------------
// Each scenario's SETUP bullet (step 14), at the window after step 13
// ---------------------------------------------------------------------------------------------------------------

/** The per-hero threat of a SETUP bullet, "1[per_hero] (2[per_hero] in expert mode)". */
const perHeroByMode = ifElse(inMode("expert"), perHero(2), perHero(1));
const checks = campaignLogValue("checks");
const BUGLE = query("support", inEncounterSet("stop_the_presses"));
const PRISONER = query("minion", { trait: trait("PRISONER") });
const COMPLETED_ENVIRONMENTS = countOf(query("environment", { trait: trait("COMPLETED") }));

const setupOf = (node: string): CampaignInstruction => {
  const page = PAGE[node]!;
  const id = `mc60.${node}.setup`;
  const at = (text: string, effects: readonly EffectSpec[]): CampaignInstruction =>
    inGame(id, text, page, "afterMulligans", effects);
  switch (node) {
    case ART_MUSEUM_HEIST:
      return at(
        "Place 1[per_hero] threat (2[per_hero] threat instead in expert mode) on the main scheme for each check mark in the campaign log beside 'Art Museum Heist'.",
        [placeThreat(product(checks, perHeroByMode), { kind: "mainScheme" })],
      );
    case THE_GETAWAY:
      return at(
        "If there is at least one check mark beside 'The Getaway' in the campaign log, find Jackknifed Tanker Truck and reveal it. If there are two check marks, place an additional 1[per_hero] threat (2[per_hero] threat instead in Expert mode) on Jackknifed Tanker Truck.",
        [
          ifThen(campaignLogAtLeast("checks", 1), [
            findCard(query("sideScheme", { name: "Jackknifed Tanker Truck" }), "reveal", { bind: "truck" }),
            ifThen(campaignLogAtLeast("checks", 2), placeThreat(perHeroByMode, chosen("truck"))),
          ]),
        ],
      );
    case PROTECTION_RACKET:
      return at(
        "Place 1 threat (2 threat in expert mode) on each main scheme for each check mark in the campaign log beside 'Protection Racket.'",
        [placeThreat(product(checks, ifElse(inMode("expert"), 2, 1)), each(query("mainScheme")))],
      );
    case THE_RAFT_BREAKOUT:
      return at(
        "If there is at least one check mark beside 'The Raft Breakout' in the campaign log, give each Prisoner minion in play a tough status card. If there are two check marks, give each of those minions a facedown boost card as well.",
        [
          ifThen(campaignLogAtLeast("checks", 1), [
            giveTough(each(PRISONER)),
            ifThen(campaignLogAtLeast("checks", 2), giveBoostCard(each(PRISONER))),
          ]),
        ],
      );
    case STOP_THE_PRESSES:
      return at(
        "Remove 1 stamina counter from each Daily Bugle Support for each check mark in the campaign log beside 'Stop the Presses!'",
        [removeCountersFrom(each(BUGLE), "stamina", checks)],
      );
    default:
      return at(
        "If the number of Completed environments in play is at least: 3, give each minion in play a tough status card. 4, find and reveal the James Wesley attachment.",
        [
          ifThen(valueAtLeast(COMPLETED_ENVIRONMENTS, 3), giveTough(each(query("minion")))),
          ifThen(
            valueAtLeast(COMPLETED_ENVIRONMENTS, 4),
            findCard(query("attachment", { name: "James Wesley" }), "reveal"),
          ),
        ],
      );
  }
};

// ---------------------------------------------------------------------------------------------------------------
// VICTORY and DEFEAT (MC60 pp. 13 to 23)
// ---------------------------------------------------------------------------------------------------------------

function victoryOf(node: string): readonly CampaignInstruction[] {
  const page = PAGE[node]!;
  const id = `mc60.${node}.victory`;
  return [
    {
      id: `${id}.trust-record`,
      text: "(Reading half of the next bullet: whether Disturbed Psyche is in play with at least 2 threat.)",
      citation: page,
      step: {
        kind: "record",
        writes: [
          {
            field: "trustThisGame",
            mode: "set",
            // Disturbed Psyche 60112 (MC60 p. 13): the word "in play" is the query's own (`threatOn` reads cards in play).
            value: { kind: "atLeast", of: { kind: "threatOn", query: { name: "Disturbed Psyche" } }, amount: 2 },
          },
          {
            field: "maryThisGame",
            mode: "set",
            value: {
              kind: "atLeast",
              of: { kind: "cardsInVictoryDisplay", query: { printedId: TYPHOID_MARY_ALLY } },
              amount: 1,
            },
          },
        ],
      },
    },
    between(
      `${id}.trust`,
      "If Disturbed Psyche is in play and has at least 2 threat on it, check the 'Trust Established?' box in the campaign log.",
      page,
      [{ kind: "setField", field: "trustEstablished", value: constant(true) }],
      { when: isSet("trustThisGame") },
    ),
    between(
      `${id}.mary`,
      "If the Typhoid Mary/Bloody Mary ally is in the victory display, check the 'Mary Defeated?' box in the campaign log.",
      page,
      [{ kind: "setField", field: "maryDefeated", value: constant(true) }],
      { when: isSet("maryThisGame") },
    ),
    {
      id: `${id}.removed`,
      // Q201 = A and Q203 = B (docs/phase7-wave11-scenarios.md S4.1): recorded after a won game only, and including the
      // Daily Bugle supports Stop the Presses!'s own Setup removed from the game.
      text: "Record the title of each unique ally and support that was removed from the game in the campaign log.",
      citation: page,
      step: {
        kind: "record",
        writes: [
          {
            field: "removedTitles",
            mode: "append",
            distinct: true,
            value: { kind: "cardsRemovedFromGame", query: query(["ally", "support"], { unique: true }) },
          },
        ],
      },
    },
    between(`${id}.completed`, `Check the 'Completed' box in the campaign log for ${LABEL[node]}.`, page, [
      { kind: "markNode", node: constant(node), as: "completed" },
      { kind: "setField", field: completedField(node), value: constant(true) },
    ]),
  ];
}

/** "Expert Campaign Only: Progress '<scenario>' in the campaign log." Then, in either mode, back to Campaign Setup. */
const defeatOf = (node: string): readonly CampaignInstruction[] => [
  between(
    `mc60.${node}.defeat.progress`,
    `Expert Campaign Only: Progress '${LABEL[node]}' in the campaign log.`,
    PAGE[node]!,
    [{ kind: "progressNode", node: constant(node) }],
    { whenModes: EXPERT_CAMPAIGN },
  ),
];

/**
 * Kingpin's expert DEFEAT (MC60 p. 23): with an environment on its Completed side, the players choose one and flip it
 * to its Failed side and replay the scenario; otherwise they lose the campaign. The flipped scenario's "Completed" box
 * is cleared with it (the sheet's left column mirrors `position.resolved`).
 */
const kingpinDefeat: readonly CampaignInstruction[] = [
  between(
    "mc60.kingpin.defeat.flip",
    "Expert Campaign Only: If there is at least one environment on its Completed side, choose and flip one to its Failed side and replay the scenario. Otherwise, the players lose the campaign.",
    PAGE[KINGPIN]!,
    [
      {
        kind: "if",
        when: { kind: "or", of: FNE_UNDERLING_NODES.map((node) => resolved(node, "completed")) },
        then: [
          { kind: "choose", slot: "flip", chooser: "group", from: { kind: "nodes", filter: "completed" } },
          { kind: "markNode", node: choiceOf("flip"), as: "failed" },
          ...FNE_UNDERLING_NODES.map((node): CampaignOp => ({
            kind: "if",
            when: notP(resolved(node, "completed")),
            then: [{ kind: "clearField", field: completedField(node) }],
          })),
        ],
        else: [{ kind: "endCampaign", result: "lost" }],
      },
    ],
    { whenModes: EXPERT_CAMPAIGN },
  ),
];

// ---------------------------------------------------------------------------------------------------------------
// The definition
// ---------------------------------------------------------------------------------------------------------------

const nodeOf = (scenario: string): CampaignNode => ({
  id: scenario,
  label: LABEL[scenario]!,
  scenario: { kind: "fixed", scenarioId: FNE_CAMPAIGN.scenarioIds.find((id) => (id as string) === scenario)! },
  composition: composition(scenario),
  setup: [setupOf(scenario)],
  victory:
    scenario === KINGPIN
      ? [
          between("mc60.kingpin.victory.win", "The players take down Kingpin and win the campaign!", PAGE[KINGPIN]!, [
            { kind: "endCampaign", result: "won" },
          ]),
        ]
      : victoryOf(scenario),
  defeat: scenario === KINGPIN ? kingpinDefeat : defeatOf(scenario),
});

export const FNE_CAMPAIGN_DEFINITION: CampaignDefinition = {
  campaignId: FNE_CAMPAIGN.id,
  version: "1",
  logFields,
  // MC60 p. 9, "Expert Campaign Only: Record ... remaining hit points ... after each game": a win and a loss.
  everyNodeVictory: [
    defeatedSeatRecordsZero("mc60.victory.defeated-hp", "MC60 p. 9"),
    {
      id: "mc60.victory.hp",
      text: "Expert Campaign Only: Record each identity's remaining hit points in the campaign log.",
      citation: SETUP_PAGE,
      whenModes: EXPERT_CAMPAIGN,
      step: {
        kind: "record",
        writes: [
          { field: "remainingHp", seat: "each", mode: "set", value: { kind: "remainingHitPointsCappedAtBase" } },
        ],
      },
    },
  ],
  everyNodeSetup,
  elimination: {
    id: "mc60.elimination",
    text: "Expert Campaign Only: If a player is defeated during a scenario that their teammates go on to win, the defeated player does not participate in the Victory steps of that scenario.",
    citation: SETUP_PAGE,
    whenModes: EXPERT_CAMPAIGN,
  },
  loss: {
    retry: "byInstruction",
    // MC60 p. 8 and every DEFEAT's "Go to 'Campaign Setup'": the log is kept and the scenario chosen again (E30).
    retryBaseline: "keepLog",
    citation: "MC60 pp. 8, 9, 13, 23",
    everyNodeDefeat: [
      {
        id: "mc60.defeat.hp",
        text: "Expert Campaign Only: Record each identity's remaining hit points in the campaign log.",
        citation: SETUP_PAGE,
        whenModes: EXPERT_CAMPAIGN,
        step: {
          kind: "record",
          writes: [
            { field: "remainingHp", seat: "each", mode: "set", value: { kind: "remainingHitPointsCappedAtBase" } },
          ],
        },
      },
    ],
  },
  graph: {
    kind: "choice",
    nodes: [...FNE_UNDERLING_NODES, KINGPIN].map(nodeOf),
    beforeChoice,
    // Always true: every unresolved scenario but the finale is offered (the runner leaves the finale out itself).
    available: { kind: "and", of: [] },
    finale: { nodeId: KINGPIN, when: { kind: "and", of: FNE_UNDERLING_NODES.map((node) => resolved(node)) } },
    progressToFail: 3,
  },
};
