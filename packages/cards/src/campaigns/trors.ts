/**
 * The Rise of Red Skull (MC10) — the first `CampaignDefinition` (docs/campaign-mode-design.md §11 step 7).
 *
 * Source of truth: `docs/campaign-modes/markdown/mc10_the_rise_of_red_skull.md` (the primary rulebook conversion,
 * cited below as "MC10 p. N") and `docs/campaign-modes/log-sheets/mc10_the_rise_of_red_skull_campaign-log.pdf`
 * (transcribed into that same markdown's "Campaign Log Sheet Reference" section). Every `CampaignInstruction`
 * carries the citation of the printed bullet it encodes, in the order that bullet is printed on its page.
 *
 * This file is plain data — the same discipline `packages/engine/src/testing/campaign.ts`'s synthetic fixture and
 * `packages/content/src/data/trors/campaign.ts`'s `Campaign` record both already use — rather than a builder
 * layer, because a `CampaignDefinition` is small enough (five linear nodes) that plain object literals read at
 * least as clearly as calls into a bespoke builder API would, and the engine's own types catch every shape error.
 *
 * ---------------------------------------------------------------------------------------------------------------
 * WHAT THIS BOX ASKED OF THE FOUNDATION. Writing it found six gaps, all now closed in `@mc/engine` (this file is
 * content, so none of them is worked around here):
 *
 * - `CampaignChoiceSource` `campaignSet`/`perSeatSet` take a `filter`, because the `hydra_camp` set holds two
 *   unrelated four-card pools offered by different scenarios — the TECH upgrades (MC10 p. 5) and the "Basic"
 *   Condition upgrades (MC10 p. 7). Both choices below are that filter plus `excludeGranted`.
 * - `CampaignGameQuery` `cardsTuckedUnder` reads the cards under a host card, which no in-play selection can see
 *   (RRG 1.8 "Tuck"): Zola's "record the name of each ally underneath [Hydra Prison]" (MC10 p. 12).
 * - `CampaignOp` `random` takes `optional`, for "each player **may** add 1 random obligation" (MC10 p. 7, p. 10,
 *   p. 12, p. 15): the players decide whether, never which.
 * - `CampaignPredicate` `choiceMade` reads whether a seat took an optional choice or declined it, and a `flag`
 *   written from nothing is now *unchecked* rather than checked — the polarity every "may" below depends on.
 * - `deck.ts` exempts a campaign grant from two refusals it applied unconditionally: a `specificTo.kind ===
 *   "scenario"` card (MC10 p. 10's rescued Captive allies, added to decks by instruction) and an `obligation`
 *   (MC10 p. 17, "they have player-card backs because they are meant to be added to player decks"). Both stay
 *   illegal as ordinary deckbuilding choices.
 *
 * ---------------------------------------------------------------------------------------------------------------
 * TWO READINGS WORTH KNOWING ABOUT.
 *
 * 1. **The obligation draw reads one shared set, not four numbered ones.** MC10 p. 17 prints four numbered Expert
 *    Campaign Sets and says "they must take that card from the set that matches their player number", which is
 *    `CampaignChoiceSource.perSeatSet`. `@mc/content`'s `TRORS_CAMPAIGN` has no `perSeatSetIds`: the ingested data
 *    is one `expcamp` set holding 4 copies of each obligation rather than four per-seat sets (see that record's own
 *    note). Drawing from the one set is the same draw — the four sets are identical — but it is a `campaignSet`
 *    source until the data is split, and it is the one place this file is not literally what p. 17 says.
 * 2. **Each seat's own "Basic" upgrade is identified by the card, not by the seat.** `setGrantFace` flips a card's
 *    face wherever it was granted; `excludeGranted` on the p. 7 choice means at most one seat can hold each of the
 *    four upgrades, so "that player's upgrade" and "that card" name the same grant.
 */

import { encounterSetId, scenarioId, trait, TRORS_CAMPAIGN as TRORS_CAMPAIGN_RECORD } from "@mc/content";
import {
  DEFAULT_CAMPAIGN_WINDOW,
  type CampaignDefinition,
  type CampaignInstruction,
  type CampaignOp,
} from "@mc/engine";
import {
  campaignLogCards,
  campaignLogIsSet,
  campaignLogValue,
  damageOn,
  dealEncounterCard,
  eachPlayer,
  forEachPlayer,
  heal,
  identityOf,
  ifThen,
  moveCards,
  placeThreat,
  setRemainingHitPoints,
  thatPlayer,
  theMainScheme,
} from "../dsl/index.js";

/** MC10 p. 5's Experimental Weapons deck: "EXPERIMENTAL. WEAPON." (04089–04092). */
const EXPERIMENTAL = trait("EXPERIMENTAL");
/** MC10 p. 10's Taskmaster-set allies: "CAPTIVE. HERO FOR HIRE." (04097–04100). */
const CAPTIVE = trait("CAPTIVE");
/** MC10 p. 5's four campaign upgrades: "TECH." (04155–04158). */
const TECH = trait("TECH");
/** MC10 p. 7's four campaign upgrades: "CONDITION." (04159a–04162a), each with an "Improved" side. */
const CONDITION = trait("CONDITION");

/** The two campaign-specific sets `TRORS_CAMPAIGN.campaignSetIds` names: the upgrades, and the obligations. */
const HYDRA_CAMPAIGN_SET = encounterSetId("hydra_camp");
const EXPERT_CAMPAIGN_SET = encounterSetId("expcamp");

/** MC10 p. 12's Zola-set side scheme the allies are imprisoned beneath. */
const HYDRA_PRISON = { categories: ["sideScheme"], name: "Hydra Prison" } as const;

/**
 * MC10 p. 12: "replace their 'Basic' Condition upgrade with its 'Improved' side." Each upgrade's other face has
 * its own printed name, which is what a `CampaignGrant.face` records, so the pairing is card data this file names
 * once (the coverage test checks every pair against `@mc/content`'s `flipSide.name`).
 */
const IMPROVED_SIDES: readonly (readonly [string, string])[] = [
  ["04159a", "Improved Thwart Upgrade"],
  ["04160a", "Improved Attack Upgrade"],
  ["04161a", "Improved Defense Upgrade"],
  ["04162a", "Improved Recovery Upgrade"],
];

/**
 * The replacement itself, one branch per upgrade: which face a grant is on is a printed *name*, and the four
 * upgrades have four different ones, so the branch that knows which card this seat recorded is the branch that
 * knows what to call its other side. `fieldContains` reads the seat's own "Basic Upgrade" column.
 */
const improveOps = (): readonly CampaignOp[] =>
  IMPROVED_SIDES.map(([id, face]) => ({
    kind: "if",
    when: { kind: "fieldContains", field: "basicUpgrade", value: id, seat: "self" },
    then: [{ kind: "setGrantFace", card: { kind: "const", value: id }, face }],
  }));

/**
 * "Expert Campaign Only: Each player may add 1 random obligation from their expert campaign set to their deck to
 * heal their identity to its full hit point value." Printed identically on MC10 p. 7, p. 10, p. 12 and p. 15.
 *
 * Two instructions for one printed sentence, because its halves are on opposite sides of the game boundary: the
 * draw and the deck addition happen between games (no `GameState` exists), while "heal their identity to its full
 * hit point value" is an effect inside the game that is about to be set up. `healedByObligation` is the per-seat
 * bridge between them, cleared first so that last scenario's acceptance cannot heal this one. The heal is printed
 * — and therefore resolved — *after* the previous bullet has set that seat's hit points to its recorded remaining
 * value (MC10 p. 17's persistent damage), so it overwrites it, which is exactly what "to its full hit point
 * value" buys.
 */
function obligationSetup(prefix: string, citation: string): readonly CampaignInstruction[] {
  return [
    {
      id: `${prefix}.obligation`,
      text: "Expert Campaign Only: Each player may add 1 random obligation from their expert campaign set to their deck to heal their identity to its full hit point value.",
      citation,
      whenModes: { expertCampaign: true },
      step: {
        kind: "betweenGames",
        ops: [
          {
            kind: "forEachSeat",
            ops: [
              { kind: "clearField", field: "healedByObligation", seat: "self" },
              // No `excludeGranted`: MC10 p. 17's four sets are identical, so two players may hold the same
              // obligation title — and the printed draw is from each seat's own copy of the set (see the header).
              {
                kind: "random",
                slot: "obligation",
                optional: true,
                from: { kind: "campaignSet", encounterSetId: EXPERT_CAMPAIGN_SET },
              },
              {
                kind: "if",
                when: { kind: "choiceMade", slot: "obligation" },
                then: [
                  {
                    kind: "grantCard",
                    seat: "self",
                    card: { kind: "choice", slot: "obligation" },
                    permanence: "campaign",
                  },
                  {
                    kind: "appendToList",
                    field: "obligations",
                    seat: "self",
                    value: { kind: "choice", slot: "obligation" },
                  },
                  {
                    kind: "setField",
                    field: "healedByObligation",
                    seat: "self",
                    value: { kind: "const", value: true },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      id: `${prefix}.obligation-heal`,
      text: "(The heal half of the same sentence: each player who added an obligation begins this scenario at their full hit point value.)",
      citation,
      whenModes: { expertCampaign: true },
      step: {
        kind: "inGame",
        window: DEFAULT_CAMPAIGN_WINDOW,
        effects: [
          forEachPlayer(
            eachPlayer,
            ifThen(
              campaignLogIsSet("healedByObligation", true, { seat: thatPlayer }),
              // "To its full hit point value" is all of its damage healed (RRG 1.8 "Hit Points", p. 22).
              heal(damageOn(identityOf(thatPlayer)), identityOf(thatPlayer)),
            ),
          ),
        ],
      },
    },
  ];
}

/**
 * Printed identically on scenarios 2–5's SETUP list (MC10 p. 7, p. 10, p. 12, p. 15) — not on scenario 1's, which
 * has nothing recorded yet to search for or shuffle in. Kept as one factory rather than `everyNodeSetup` (design
 * §4's "instructions appended to *every* node's setup") because scenario 1 does not print this block: the four
 * boxes MC50/MC45 use `everyNodeSetup` for genuinely print it on every scenario's page, and this box does not.
 *
 * All four printed bullets, in printed order; the fourth is `obligationSetup`'s pair (see its own comment for why
 * one sentence is two instructions). Scenario 5 prints the same four plus two of its own, so it lists them itself.
 */
function repeatedSetup(prefix: string, citation: string): readonly CampaignInstruction[] {
  return [
    {
      id: `${prefix}.setup-keyword`,
      text: "Each player searches their deck for all cards with the setup keyword and puts them into play.",
      citation,
      // Already RRG 1.8 Appendix II step 11 (`packages/engine/src/setup-steps.ts`'s `putSetupCardsIntoPlay`), which
      // sweeps every player's deck for Setup-keyword cards on *every* game, campaign or not — including a card a
      // campaign granted earlier (grants are ordinary deck lines by the time this runs). MC10 restates the rule
      // here for the TECH upgrades a campaign has added; no additional effect is needed, so this step is a no-op
      // kept only to keep the printed setup list complete and citable.
      step: { kind: "inGame", window: DEFAULT_CAMPAIGN_WINDOW, effects: [] },
    },
    {
      id: `${prefix}.experimental`,
      text: "Shuffle each EXPERIMENTAL attachment recorded in the campaign log into the encounter deck.",
      citation,
      step: {
        kind: "inGame",
        window: DEFAULT_CAMPAIGN_WINDOW,
        effects: [moveCards(campaignLogCards("experimental"), "encounterDeckShuffle")],
      },
    },
    {
      id: `${prefix}.hp-set`,
      text: "Expert Campaign Only: Set each player's hit points to their remaining hit point value recorded in the campaign log for the previous scenario.",
      citation,
      whenModes: { expertCampaign: true },
      step: {
        kind: "inGame",
        window: DEFAULT_CAMPAIGN_WINDOW,
        effects: [
          forEachPlayer(
            eachPlayer,
            setRemainingHitPoints(campaignLogValue("remainingHp", { seat: thatPlayer }), identityOf(thatPlayer)),
          ),
        ],
      },
    },
    ...obligationSetup(prefix, citation),
  ];
}

/**
 * Printed identically after every scenario's victory bullets (MC10 p. 5, p. 7, p. 10, p. 12): "Record each
 * identity's remaining hit points in the campaign log, as well as any cards added to their deck." Only the
 * hit-points half needs its own write — "as well as any cards added to their deck" is already satisfied by
 * whichever earlier victory instruction of *this same scenario* recorded that card (MC10 p. 3's general rule,
 * "When a card is added to a player's deck this way, write that card's title in the matching field of the campaign
 * log"), so there is nothing left for this bullet to write beyond the hit-point value itself.
 */
function hpRecordVictory(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Expert Campaign Only: Record each identity's remaining hit points in the campaign log, as well as any cards added to their deck.",
    citation,
    whenModes: { expertCampaign: true },
    step: {
      kind: "record",
      writes: [{ field: "remainingHp", seat: "each", mode: "set", value: { kind: "remainingHitPointsCappedAtBase" } }],
    },
  };
}

export const TRORS_CAMPAIGN_DEFINITION: CampaignDefinition = {
  campaignId: TRORS_CAMPAIGN_RECORD.id,
  version: "1",
  logFields: [
    {
      id: "remainingHp",
      label: "Remaining hit points",
      scope: "perSeat",
      type: { kind: "number", min: 0 },
      whenModes: { expertCampaign: true },
      citation: "MC10 p. 17",
    },
    {
      id: "experimental",
      label: "Experimental Weapons added to encounter deck",
      scope: "shared",
      type: { kind: "cardList" },
      citation: "MC10 p. 5",
    },
    {
      id: "delayCounters",
      label: "Number of delay counters on main scheme",
      scope: "shared",
      type: { kind: "number", min: 0 },
      citation: "MC10 p. 7",
    },
    {
      id: "engagedWithEnemy",
      label: "Players engaged with minions",
      scope: "perSeat",
      type: { kind: "flag" },
      citation: "MC10 p. 12",
    },
    {
      id: "rescuedAllies",
      label: "Rescued Allies",
      scope: "perSeat",
      type: { kind: "cardList" },
      citation: "MC10 p. 10",
    },
    // The printed log sheet's own columns (MC10 p. 20): "Tech Upgrade", "Basic Upgrade", "Obligations".
    { id: "techUpgrade", label: "Tech Upgrade", scope: "perSeat", type: { kind: "cardRef" }, citation: "MC10 p. 5" },
    {
      id: "basicUpgrade",
      label: "Basic Upgrade",
      scope: "perSeat",
      // `withFace`, because MC10 p. 12 replaces the recorded card "with its 'Improved' side" rather than with
      // another card: the column ends up naming a card *and* a face.
      type: { kind: "cardRef", withFace: true },
      citation: "MC10 p. 7",
    },
    {
      id: "obligations",
      label: "Obligations",
      scope: "perSeat",
      type: { kind: "cardList" },
      whenModes: { expertCampaign: true },
      citation: "MC10 p. 17",
    },
    // Four fields the printed sheet has no column for, because on paper the players simply remember these facts
    // between the game ending and the instruction that reads them. Each is written and read within one scenario.
    {
      id: "healedByObligation",
      label: "Healed by an obligation this scenario",
      scope: "perSeat",
      type: { kind: "flag" },
      whenModes: { expertCampaign: true },
      citation: "MC10 p. 17",
    },
    {
      id: "hydraPrison",
      label: "Hydra Prison still in play",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC10 p. 12",
    },
    { id: "heroForm", label: "In hero form", scope: "perSeat", type: { kind: "flag" }, citation: "MC10 p. 12" },
    {
      id: "imprisonedAllies",
      label: "Allies left in Hydra Prison",
      scope: "shared",
      type: { kind: "cardList" },
      citation: "MC10 p. 12",
    },
  ],
  // MC10 p. 3: "If the players lost, they may reset the scenario and try again with no penalty" — for every
  // scenario except one Expert Campaign Only exception on Red Skull (MC10 p. 15). `retry: "byInstruction"` with
  // every node's `defeat` left absent reproduces "no penalty" exactly (the log is always restored to
  // `logBefore` on a loss regardless of `retry`'s value — `packages/engine/src/campaign/runner.ts`'s
  // `applyCampaignResult`; `retry` only gates whether `node.defeat` instructions run at all), while giving Red
  // Skull's own `defeat` block — gated `expertCampaign: true` — somewhere to live. `retry: "free"` cannot express
  // that exception at all, since it skips every node's `defeat` unconditionally.
  loss: { retry: "byInstruction", retryBaseline: "nodeStart" },
  // MC10 p. 17 "Elimination and Victory": "If a player is defeated during a scenario that their teammates go on to
  // win, the defeated player does not participate in any of the victory steps for that scenario. However, they can
  // rejoin their teammates for the next scenario by adding an obligation to their deck during setup to restore
  // their identity to full hit points." Maintainer decision 2026-09-23 (no FFG ruling exists to settle it): unlike
  // MC16 p. 5's free rejoin, "by adding an obligation" reads as the price of rejoining, not an optional extra, so
  // `rejoinGrant` is unconditional here — see its own doc comment on `EliminationPolicy` in `@mc/engine`.
  // `rejoinAtPrintedHitPoints` writes `remainingHp`, the same field `mc10.*.setup.hp`'s "Set each player's hit
  // points to their remaining hit point value" already reads every scenario, so "full hit points" for a rejoining
  // seat is simply that field holding the seat's printed HP instead of a lower recorded value — no separate heal
  // path is needed. The obligation itself is drawn from `EXPERT_CAMPAIGN_SET` with no `filter` (the set holds only
  // obligations) and appended to `obligations`, the same field `obligationSetup`'s own volunteered draw writes, per
  // this file's header note 1: the ingested data is one shared `expcamp` set rather than four numbered per-seat
  // ones, so this reads that one set exactly as every other obligation draw in this file already does.
  elimination: {
    id: "mc10.elimination.rejoin",
    text: "Expert Campaign Only: If a player is defeated during a scenario that their teammates go on to win, the defeated player does not participate in any of the victory steps for that scenario. However, they can rejoin their teammates for the next scenario by adding an obligation to their deck during setup to restore their identity to full hit points.",
    citation: "MC10 p. 17; maintainer decision 2026-09-23 (obligation required, not optional; no FFG ruling)",
    whenModes: { expertCampaign: true },
    rejoinAtPrintedHitPoints: { field: "remainingHp" },
    rejoinGrant: {
      from: { kind: "campaignSet", encounterSetId: EXPERT_CAMPAIGN_SET },
      appendToField: "obligations",
    },
  },
  graph: {
    kind: "linear",
    nodes: [
      {
        id: "crossbones",
        label: "Scenario #1 - Crossbones",
        scenario: { kind: "fixed", scenarioId: scenarioId("crossbones") },
        setup: [
          {
            id: "mc10.s1.setup.identity",
            text: "Each player records their identity in the campaign log found on the back cover of this rulebook. Players cannot switch identities during a campaign.",
            citation: "MC10 p. 5",
            // Already true the moment the log exists: `CampaignSeat.identityCardId` is set once by
            // `createCampaignLog` from the seat the player chose before the campaign began, and `deck.ts`'s
            // `campaign_identity_locked` check enforces "cannot switch" for the rest of the campaign. Nothing here
            // needs to write a log field (see the file header) — this step is kept only so the printed setup list
            // is complete and citable.
            step: { kind: "betweenGames", ops: [] },
          },
        ],
        victory: [
          {
            id: "mc10.s1.victory.tech",
            text: "Each player chooses one of the TECH upgrades from the Hydra Campaign set and adds it to their deck.",
            citation: "MC10 p. 5",
            step: {
              kind: "betweenGames",
              // One seat at a time — choose, then add — because the four TECH upgrades are four physical cards:
              // `excludeGranted` reads the grants, so the card a seat takes has to be in its deck before the next
              // seat is asked. MC10 p. 3's "write that card's title in the matching field of the campaign log" is
              // the `setField`, which is the printed sheet's "Tech Upgrade" column.
              ops: [
                {
                  kind: "forEachSeat",
                  ops: [
                    {
                      kind: "choose",
                      slot: "tech",
                      chooser: "eachSeat",
                      from: {
                        kind: "campaignSet",
                        encounterSetId: HYDRA_CAMPAIGN_SET,
                        excludeGranted: true,
                        filter: { traits: [TECH] },
                      },
                    },
                    { kind: "grantCard", seat: "self", card: { kind: "choice", slot: "tech" }, permanence: "campaign" },
                    { kind: "setField", field: "techUpgrade", seat: "self", value: { kind: "choice", slot: "tech" } },
                  ],
                },
              ],
            },
          },
          {
            id: "mc10.s1.victory.experimental",
            text: "Record the name of each EXPERIMENTAL attachment that entered the game in the campaign log.",
            citation: "MC10 p. 5",
            step: {
              kind: "record",
              writes: [
                {
                  field: "experimental",
                  mode: "append",
                  value: { kind: "cardsThatEnteredPlay", query: { trait: EXPERIMENTAL } },
                },
              ],
            },
          },
          hpRecordVictory("mc10.s1.victory.hp", "MC10 p. 5"),
        ],
      },
      {
        id: "absorbing-man",
        label: "Scenario #2 - Absorbing Man",
        scenario: { kind: "fixed", scenarioId: scenarioId("absorbing-man") },
        setup: repeatedSetup("mc10.s2.setup", "MC10 p. 7"),
        victory: [
          {
            id: "mc10.s2.victory.delay",
            text: "Record the number of delay counters on the main scheme in the campaign log.",
            citation: "MC10 p. 7",
            step: {
              kind: "record",
              writes: [
                {
                  field: "delayCounters",
                  mode: "set",
                  value: { kind: "countersOn", query: { categories: ["mainScheme"] }, counter: "delay" },
                },
              ],
            },
          },
          {
            id: "mc10.s2.victory.basic",
            text: "Each player may choose one of the \u201CBasic\u201D Condition upgrades in the Campaign set, attach it to their identity, and add it to their deck in the campaign log.",
            citation: "MC10 p. 7",
            step: {
              kind: "betweenGames",
              // "May", so the choice is `optional` and everything that follows is gated on `choiceMade`: a seat
              // that declines records nothing, and Zola's victory (MC10 p. 12) then has nothing to improve.
              // "Attach it to their identity" needs no op — the card is printed `Permanent. Setup.`, so the
              // setup-keyword sweep (RRG 1.8 Appendix II step 11) puts it into play in every later scenario.
              ops: [
                {
                  kind: "forEachSeat",
                  ops: [
                    {
                      kind: "choose",
                      slot: "basic",
                      chooser: "eachSeat",
                      optional: true,
                      from: {
                        kind: "campaignSet",
                        encounterSetId: HYDRA_CAMPAIGN_SET,
                        excludeGranted: true,
                        filter: { traits: [CONDITION] },
                      },
                    },
                    {
                      kind: "if",
                      when: { kind: "choiceMade", slot: "basic" },
                      then: [
                        {
                          kind: "grantCard",
                          seat: "self",
                          card: { kind: "choice", slot: "basic" },
                          permanence: "campaign",
                        },
                        {
                          kind: "setField",
                          field: "basicUpgrade",
                          seat: "self",
                          value: { kind: "choice", slot: "basic" },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          hpRecordVictory("mc10.s2.victory.hp", "MC10 p. 7"),
        ],
      },
      {
        id: "taskmaster",
        label: "Scenario #3 - Taskmaster",
        scenario: { kind: "fixed", scenarioId: scenarioId("taskmaster") },
        setup: repeatedSetup("mc10.s3.setup", "MC10 p. 10"),
        victory: [
          {
            id: "mc10.s3.victory.rescued-record",
            text: "Each player who rescued one or more allies from the Taskmaster encounter set adds those allies to their deck and records their names in the campaign log.",
            citation: "MC10 p. 10",
            step: {
              kind: "record",
              writes: [
                {
                  field: "rescuedAllies",
                  seat: "each",
                  mode: "append",
                  value: { kind: "cardsThatEnteredPlay", query: { trait: CAPTIVE, controller: "you" } },
                },
              ],
            },
          },
          {
            id: "mc10.s3.victory.rescued-grant",
            text: "(The deck-addition half of the same sentence: each rescued ally recorded above is added to that player's deck for the rest of the campaign.)",
            citation: "MC10 p. 10",
            step: {
              kind: "betweenGames",
              ops: [
                {
                  kind: "grantCard",
                  seat: "self",
                  card: { kind: "field", field: "rescuedAllies", seat: "self" },
                  permanence: "campaign",
                },
              ],
            },
          },
          hpRecordVictory("mc10.s3.victory.hp", "MC10 p. 10"),
        ],
      },
      {
        id: "zola",
        label: "Scenario #4 - Zola",
        scenario: { kind: "fixed", scenarioId: scenarioId("zola") },
        setup: repeatedSetup("mc10.s4.setup", "MC10 p. 12"),
        victory: [
          {
            id: "mc10.s4.victory.engaged",
            text: "Each player engaged with an enemy records they are engaged with an enemy in the campaign log.",
            citation: "MC10 p. 12",
            step: {
              kind: "record",
              writes: [{ field: "engagedWithEnemy", seat: "each", mode: "set", value: { kind: "isEngagedWithEnemy" } }],
            },
          },
          {
            id: "mc10.s4.victory.prison",
            text: "If the Hydra Prison side scheme is still in play, record the name of each ally underneath it in the campaign log.",
            citation: "MC10 p. 12",
            step: {
              kind: "record",
              // The printed "if … is still in play" needs no separate condition: a host that is no longer in play
              // has nothing underneath it, so both writes fall out of the one query. The allies are *tucked*, so
              // no in-play selection can see them (RRG 1.8 "Tuck") — hence `cardsTuckedUnder`. The flag is what
              // the next two bullets read, because by then there is no game left to ask.
              writes: [
                {
                  field: "hydraPrison",
                  mode: "set",
                  value: { kind: "atLeast", of: { kind: "cardsInPlay", query: HYDRA_PRISON }, amount: 1 },
                },
                {
                  field: "imprisonedAllies",
                  mode: "append",
                  value: { kind: "cardsTuckedUnder", under: HYDRA_PRISON, query: { categories: ["ally"] } },
                },
              ],
            },
          },
          {
            id: "mc10.s4.victory.prison-remove",
            text: "Those allies cannot be included in any deck for the remainder of the campaign.",
            citation: "MC10 p. 12",
            // RRG 1.8 p. 29's removal, which this scenario's own RULES CLARIFICATION spells out: "cross it out of
            // the campaign log. That card is no longer part of the campaign and cannot be included in any deck for
            // the remainder of the campaign." It survives a retry, and `deck.ts` refuses the card from then on.
            step: {
              kind: "betweenGames",
              ops: [{ kind: "removeFromCampaign", cards: [{ kind: "field", field: "imprisonedAllies" }] }],
            },
          },
          {
            id: "mc10.s4.victory.hero-form",
            text: "(The reading half of the next bullet: each player records whether they were in hero form when the game ended.)",
            citation: "MC10 p. 12",
            // "Each player **in hero form**" is a fact about the finished game, so it is recorded like MC10's own
            // "each player engaged with an enemy records …" above. A player defeated during the scenario has no
            // identity in play, which is also MC10 p. 17's "the defeated player does not participate in any of the
            // victory steps".
            step: {
              kind: "record",
              writes: [
                {
                  field: "heroForm",
                  seat: "each",
                  mode: "set",
                  value: {
                    kind: "atLeast",
                    of: { kind: "cardsInPlay", query: { categories: ["hero"], controller: "you" } },
                    amount: 1,
                  },
                },
              ],
            },
          },
          {
            id: "mc10.s4.victory.improved",
            text: "If the Hydra Prison side scheme is not in play, each player in hero form may replace their \u201CBasic\u201D Condition upgrade with its \u201CImproved\u201D side.",
            citation: "MC10 p. 12",
            when: { kind: "not", of: { kind: "fieldIsSet", field: "hydraPrison" } },
            step: {
              kind: "betweenGames",
              ops: [
                {
                  kind: "forEachSeat",
                  ops: [
                    {
                      kind: "if",
                      // Three conditions, all printed: the prison is gone (the instruction's own `when`), this
                      // seat is in hero form, and this seat has a "Basic" upgrade at all — a seat that declined
                      // MC10 p. 7's optional choice left that field unset, which is what `fieldIsSet` reads.
                      when: {
                        kind: "and",
                        of: [
                          { kind: "fieldIsSet", field: "heroForm", seat: "self" },
                          { kind: "fieldIsSet", field: "basicUpgrade", seat: "self" },
                        ],
                      },
                      then: [
                        // "May": the seat is offered its own upgrade — the only CONDITION card in its deck — and
                        // may decline. Nothing below runs unless it took the offer.
                        {
                          kind: "choose",
                          slot: "improve",
                          chooser: "eachSeat",
                          optional: true,
                          from: { kind: "ownDeck", filter: { traits: [CONDITION] } },
                        },
                        {
                          kind: "if",
                          when: { kind: "choiceMade", slot: "improve" },
                          then: improveOps(),
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          hpRecordVictory("mc10.s4.victory.hp", "MC10 p. 12"),
        ],
      },
      {
        id: "red-skull",
        label: "Scenario #5 - Red Skull",
        scenario: { kind: "fixed", scenarioId: scenarioId("red-skull") },
        setup: [
          {
            id: "mc10.s5.setup.setup-keyword",
            text: "Each player searches their deck for all cards with the setup keyword and puts them into play.",
            citation: "MC10 p. 15",
            step: { kind: "inGame", window: DEFAULT_CAMPAIGN_WINDOW, effects: [] },
          },
          {
            id: "mc10.s5.setup.experimental",
            text: "Shuffle each EXPERIMENTAL attachment recorded in the campaign log into the encounter deck.",
            citation: "MC10 p. 15",
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [moveCards(campaignLogCards("experimental"), "encounterDeckShuffle")],
            },
          },
          {
            id: "mc10.s5.setup.delay-threat-standard",
            text: "Place X threat counters on the main scheme, where X is the number of delay counters recorded in the campaign log.",
            citation: "MC10 p. 15",
            whenModes: { expertCampaign: false },
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [placeThreat(campaignLogValue("delayCounters"), theMainScheme)],
            },
          },
          {
            id: "mc10.s5.setup.delay-threat-expert",
            // "(Place X[per_hero] instead if you are playing an expert campaign.)" MC10's own "[per_hero]" notation
            // is "once per player"; there is no ValueSpec that multiplies two dynamic values together (`scaled`'s
            // `times` is a compile-time constant), so this is spelled as placing the same delay-counter threat once
            // per player instead — which totals to exactly delayCounters × playerCount, the same number, without
            // needing a new engine primitive.
            text: "Place X[per_hero] threat counters on the main scheme instead, where X is the number of delay counters recorded in the campaign log, if you are playing an expert campaign.",
            citation: "MC10 p. 15",
            whenModes: { expertCampaign: true },
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [forEachPlayer(eachPlayer, placeThreat(campaignLogValue("delayCounters"), theMainScheme))],
            },
          },
          {
            id: "mc10.s5.setup.hp",
            text: "Expert Campaign Only: Set each player's hit points to their remaining hit point value recorded in the campaign log for the previous scenario.",
            citation: "MC10 p. 15",
            whenModes: { expertCampaign: true },
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [
                forEachPlayer(
                  eachPlayer,
                  setRemainingHitPoints(campaignLogValue("remainingHp", { seat: thatPlayer }), identityOf(thatPlayer)),
                ),
              ],
            },
          },
          ...obligationSetup("mc10.s5.setup", "MC10 p. 15"),
          {
            id: "mc10.s5.setup.engaged-deal-card",
            text: "Expert Campaign Only: Each player who was recorded as being engaged with an enemy deals themselves an encounter card.",
            citation: "MC10 p. 15",
            whenModes: { expertCampaign: true },
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [
                forEachPlayer(
                  eachPlayer,
                  ifThen(
                    campaignLogIsSet("engagedWithEnemy", true, { seat: thatPlayer }),
                    dealEncounterCard(thatPlayer),
                  ),
                ),
              ],
            },
          },
        ],
        victory: [
          {
            id: "mc10.s5.victory.win",
            text: "Hydra is defeated and the players win the campaign! Turn the page to read the conclusion.",
            citation: "MC10 p. 15",
            // Purely narrative: `packages/engine/src/campaign/runner.ts`'s `advanceAfterWin` already marks a won
            // node completed and ends the campaign "won" once every node is completed, with no op needed — Red
            // Skull is the last node in this linear graph, so winning it always triggers that automatically.
            step: { kind: "betweenGames", ops: [] },
          },
        ],
        // Printed under Red Skull's own "SETUP:" list (MC10 p. 15), not a "DEFEAT:" heading — but its content is a
        // consequence of *losing this game*, which is structurally what `defeat` is for (design §4.1); `setup`
        // instructions never see an outcome to read. Kept here rather than under `setup` so the shape matches what
        // the sentence actually says, with the citation preserving where it was printed.
        defeat: [
          {
            id: "mc10.s5.defeat.lose-campaign",
            text: "Expert Campaign Only: If the players lose this game, Red Skull conquers the world and the players lose the campaign.",
            citation: "MC10 p. 15",
            whenModes: { expertCampaign: true },
            step: { kind: "betweenGames", ops: [{ kind: "endCampaign", result: "lost" }] },
          },
        ],
      },
    ],
  },
};
