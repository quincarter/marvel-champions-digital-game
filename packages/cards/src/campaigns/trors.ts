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
 * VOCABULARY GAPS (found writing this file; not hacked around — each is a `// TODO(gap N)` at its instruction,
 * with the exact printed text, and is owned by `game-rules-architect`):
 *
 * Gap 1 — `CampaignChoiceSource` (`kind: "campaignSet"`) has no card-data filter (trait/category). MC10's
 *   `hydra_camp` encounter set holds two unrelated four-card pools — the TECH upgrades (04155–04158) and the
 *   "Basic" Condition upgrades (04159a–04162a) — offered as *separate* choices in different scenarios. `campaignSet`
 *   can only offer the whole set undifferentiated; `kind: "cards"` can name a literal id list but has no
 *   `excludeGranted`, so two players could take the same single-copy physical card. Blocks: Crossbones victory
 *   "choose one of the TECH upgrades" (MC10 p. 5) and Absorbing Man victory "choose one of the 'Basic' Condition
 *   upgrades" (MC10 p. 7).
 * Gap 2 — `CampaignGameQuery` has no member reading cards tucked under a host card (`InstanceRecord.tucked`;
 *   `cardsInPlay` deliberately excludes them, per `packages/engine/src/select.ts`'s own comment, "tucked cards are
 *   out of play"). Blocks: Zola victory "record the name of each ally underneath [Hydra Prison]" and its paired
 *   `removeFromCampaign` (MC10 p. 12).
 * Gap 3 — `CampaignOp` has no way to make a `random` draw *optional*: `random` always draws, and `choose` with
 *   `optional: true` preserves the "may" but sacrifices the randomness (the player would pick, not draw randomly).
 *   Blocks: "Expert Campaign Only: Each player may add 1 random obligation from their expert campaign set to their
 *   deck to heal their identity to its full hit point value.", printed identically on MC10 p. 7, p. 10, p. 12 and
 *   p. 15 (Absorbing Man, Taskmaster, Zola and Red Skull setup).
 * Gap 4 — no later `CampaignPredicate`/op in the same instruction list can read whether an earlier `choose` with
 *   `optional: true` was accepted or declined by a given seat: `logValueFor`'s `flag` case treats an *empty*
 *   `CampaignValue` as `true` (`packages/engine/src/campaign/ops.ts`, "first === undefined ? true : ..."), which is
 *   the wrong polarity for "did this seat decline", and no other primitive reads a `choose` slot's presence.
 *   Blocks: Zola victory "each player in hero form may replace their 'Basic' Condition upgrade with its 'Improved'
 *   side" (MC10 p. 12).
 *
 * Because gaps 1–4 each block one specific bullet (not a whole scenario), the *rest* of each scenario's setup and
 * victory instructions are implemented; the coverage test below and the smoke test in `trors.test.ts` exercise them.
 *
 * Two more bugs surfaced in `packages/engine/src/deck.ts` while checking whether the granted cards above would
 * actually be legal in a later scenario's deck — flagged in the PR report, not fixed here (`@mc/cards` only):
 * `specificTo.kind === "scenario"` cards are refused unconditionally (no grant exemption), which would block a
 * rescued Taskmaster Captive ally (MC10 p. 10) even though `grantCard` records it correctly; and `obligation` is
 * not in `PLAYER_DECK_TYPES`, which would refuse the MC10 p. 17 expert-campaign obligations MC10 explicitly says
 * "are meant to be added to player decks ... they are still encounter cards" — moot until gap 3 is resolved, but
 * it will need fixing at the same time.
 *
 * ---------------------------------------------------------------------------------------------------------------
 * LOG FIELDS NOT YET DECLARED. The printed log sheet (MC10 p. 20 / the log sheet PDF) also has "Player #N's
 * Identity", "Tech Upgrade", "Basic Upgrade" and "Obligations" columns. "Identity" is deliberately never a
 * `LogFieldDef`: it is already `CampaignSeat.identityCardId`, set once by `createCampaignLog` and enforced by
 * `CampaignDeckContext.identityCardId` in `deck.ts` (MC10 p. 3, "Players cannot switch identities during a
 * campaign") — a second, generic `fields` copy would be redundant state with no reader. "Tech Upgrade" and "Basic
 * Upgrade" would be written *only* by the two gap-1 instructions above; "Obligations" would be written *only* by
 * the gap-3 instructions. The design's coverage test (§9.3) rejects a field with no reader or writer (`KNOWN_UNUSED`
 * is reserved for `{ kind: "text" }` fields), so declaring any of the three now would be a field this file can
 * never legitimately touch. They are added the moment their blocking gap is resolved.
 */

import { scenarioId, trait, TRORS_CAMPAIGN as TRORS_CAMPAIGN_RECORD } from "@mc/content";
import { DEFAULT_CAMPAIGN_WINDOW, type CampaignDefinition, type CampaignInstruction } from "@mc/engine";
import {
  campaignLogCards,
  campaignLogIsSet,
  campaignLogValue,
  dealEncounterCard,
  eachPlayer,
  forEachPlayer,
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

/**
 * Printed identically on scenarios 2–5's SETUP list (MC10 p. 7, p. 10, p. 12, p. 15) — not on scenario 1's, which
 * has nothing recorded yet to search for or shuffle in. Kept as one factory rather than `everyNodeSetup` (design
 * §4's "instructions appended to *every* node's setup") because scenario 1 does not print this block: the four
 * boxes MC50/MC45 use `everyNodeSetup` for genuinely print it on every scenario's page, and this box does not.
 *
 * Three of the four printed bullets are here; the fourth ("Each player may add 1 random obligation …") is gap 3
 * above and is not represented at all — see the file header. Where it goes is noted as a comment in each caller.
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
    // TODO(gap 3 — CampaignOp.random has no `optional`, see file header): "Expert Campaign Only: Each player may
    // add 1 random obligation from their expert campaign set to their deck to heal their identity to its full hit
    // point value." (this scenario's own citation above.)
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
  ],
  // MC10 p. 3: "If the players lost, they may reset the scenario and try again with no penalty" — for every
  // scenario except one Expert Campaign Only exception on Red Skull (MC10 p. 15). `retry: "byInstruction"` with
  // every node's `defeat` left absent reproduces "no penalty" exactly (the log is always restored to
  // `logBefore` on a loss regardless of `retry`'s value — `packages/engine/src/campaign/runner.ts`'s
  // `applyCampaignResult`; `retry` only gates whether `node.defeat` instructions run at all), while giving Red
  // Skull's own `defeat` block — gated `expertCampaign: true` — somewhere to live. `retry: "free"` cannot express
  // that exception at all, since it skips every node's `defeat` unconditionally.
  loss: { retry: "byInstruction", retryBaseline: "nodeStart" },
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
          // TODO(gap 1 — CampaignChoiceSource.campaignSet has no trait filter, see file header): "Each player
          // chooses one of the TECH upgrades from the Hydra Campaign set and adds it to their deck." (MC10 p. 5.)
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
          // TODO(gap 1 — CampaignChoiceSource.campaignSet has no trait filter, see file header): "Each player may
          // choose one of the 'Basic' Condition upgrades in the Campaign set, attach it to their identity, and add
          // it to their deck in the campaign log." (MC10 p. 7.)
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
          // TODO(gap 2 — no CampaignGameQuery reads tucked cards, see file header): "If the Hydra Prison side
          // scheme is still in play, record the name of each ally underneath it in the campaign log. Those allies
          // cannot be included in any deck for the remainder of the campaign." (MC10 p. 12.)
          // TODO(gap 4 — no predicate reads whether an optional `choose` was declined, see file header): "If the
          // Hydra Prison side scheme is not in play, each player in hero form may replace their 'Basic' Condition
          // upgrade with its 'Improved' side." (MC10 p. 12.) The two bullets are one printed if/else; both wait on
          // their gaps together rather than implementing only the (individually expressible) "not in play" half.
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
          // TODO(gap 3 — CampaignOp.random has no `optional`, see file header): "Expert Campaign Only: Each player
          // may add 1 random obligation from their expert campaign set to their deck to heal their identity to its
          // full hit point value." (MC10 p. 15.)
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
