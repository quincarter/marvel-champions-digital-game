/**
 * A synthetic two-node campaign, and a log part-way through it, for engine tests.
 *
 * Deliberately **not** any real box: it names no published campaign, scenario or card, and its citations use the
 * placeholder code `MC00` so nothing here can be mistaken for a printed rule. Its job is to exercise the shapes the
 * first real box (a linear, free-retry, no-currency campaign) does *not* reach, because those are the shapes that
 * would force an engine change if the foundation got them wrong:
 *
 * - a `kind: "choice"` graph with `beforeChoice` and a `finale` (the non-linear box's structure),
 * - a `composed` node whose villain is chosen between games,
 * - `inGame` instructions at windows other than the default `afterScenarioSetup`,
 * - a numeric **per-seat** field gated on expert campaign mode (persistent damage),
 * - a `strikeList` field and the `strike` op / `notStruck` predicate over it,
 * - a `hidden` field written by a seeded `random` op,
 * - an `instructionList` field resolving against `conditionalInstructions`,
 * - a node `defeat` block, and an `Expert Campaign Only` instruction.
 *
 * Everything is plain data; `campaign.test.ts` round-trips both values through `JSON.parse(JSON.stringify(...))`.
 */

import { campaignId, cardId, encounterSetId, scenarioId } from "@mc/content";
import { createRng } from "../rng.js";
import type { CampaignDefinition, CampaignLog, CampaignLogSnapshot, CampaignSeat } from "../campaign.js";

const CITE = "MC00 p. 1";

/** Obviously synthetic ids: a `syn-` prefix no published set uses. */
const RELIC_A = cardId("syn-relic-a");
const RELIC_B = cardId("syn-relic-b");
const WARD = cardId("syn-ward");
const SYNTHETIC_SET = encounterSetId("syn-campaign-set");

export const SYNTHETIC_CAMPAIGN_ID = campaignId("syn-campaign");

export const SYNTHETIC_CAMPAIGN: CampaignDefinition = {
  campaignId: SYNTHETIC_CAMPAIGN_ID,
  version: "1",
  logFields: [
    {
      id: "stamina",
      label: "Remaining hit points",
      scope: "perSeat",
      type: { kind: "number", min: 0 },
      whenModes: { expertCampaign: true },
      citation: CITE,
    },
    { id: "keepsakes", label: "Keepsakes", scope: "perSeat", type: { kind: "cardList" }, citation: CITE },
    {
      id: "errands",
      label: "Errands",
      scope: "shared",
      type: { kind: "strikeList", options: ["north", "south", "east"] },
      citation: CITE,
    },
    {
      id: "warden",
      label: "Chosen warden",
      scope: "shared",
      type: { kind: "choice", options: ["warden-one", "warden-two"] },
      citation: CITE,
    },
    { id: "favors", label: "Favors owed", scope: "shared", type: { kind: "instructionList" }, citation: CITE },
    {
      id: "saboteur",
      label: "Saboteur",
      scope: "shared",
      type: { kind: "choice", options: ["warden-one", "warden-two"] },
      hidden: true,
      citation: CITE,
    },
  ],
  conditionalInstructions: {
    "syn.favor.ward": {
      id: "syn.favor.ward",
      text: "Setup: Place 1 threat on the main scheme.",
      citation: CITE,
      step: {
        kind: "inGame",
        window: "afterScenarioSetup",
        effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }],
      },
    },
  },
  everyNodeSetup: [
    {
      id: "syn.every.ward",
      text: "Shuffle each ward recorded in the campaign log into the encounter deck.",
      citation: CITE,
      when: { kind: "fieldContains", field: "keepsakes", value: WARD, seat: "self" },
      step: {
        kind: "inGame",
        window: "afterScenarioSetup",
        effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }],
      },
    },
  ],
  loss: { retry: "byInstruction", retryBaseline: "nodeStart" },
  graph: {
    kind: "choice",
    available: {
      kind: "and",
      of: [
        { kind: "not", of: { kind: "nodeResolved", nodeId: "alpha", as: "completed" } },
        { kind: "not", of: { kind: "nodeResolved", nodeId: "alpha", as: "failed" } },
      ],
    },
    finale: { nodeId: "omega", when: { kind: "nodeResolved", nodeId: "alpha" } },
    beforeChoice: [
      {
        id: "syn.before.saboteur",
        text: "Draw one warden at random and set it aside face down without looking at it.",
        citation: CITE,
        when: { kind: "not", of: { kind: "fieldIsSet", field: "saboteur" } },
        step: {
          kind: "betweenGames",
          ops: [
            { kind: "random", slot: "saboteur", from: { kind: "fieldOptions", field: "warden" } },
            { kind: "setField", field: "saboteur", value: { kind: "choice", slot: "saboteur" } },
          ],
        },
      },
      {
        id: "syn.before.progress",
        text: "Progress each unresolved trial that was not chosen.",
        citation: CITE,
        step: {
          kind: "betweenGames",
          ops: [
            { kind: "random", slot: "drifting", from: { kind: "nodes", filter: "unresolved" } },
            { kind: "progressNode", node: { kind: "choice", slot: "drifting" } },
          ],
        },
      },
    ],
    nodes: [
      {
        id: "alpha",
        label: "Trial #1 - the Crossing",
        scenario: { kind: "fixed", scenarioId: scenarioId("syn-scenario-one") },
        setup: [
          {
            id: "syn.alpha.setup.threat",
            text: "Place 1 threat on the main scheme for each errand struck from the campaign log.",
            citation: CITE,
            step: {
              kind: "inGame",
              window: "afterScenarioSetup",
              effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }],
            },
          },
          {
            // A non-default window, and the printed `Expert Campaign Only` prefix, on the same instruction.
            id: "syn.alpha.setup.stamina",
            text: "Expert Campaign Only: After resolving mulligans, set each player's hit points to the value recorded in the campaign log.",
            citation: CITE,
            whenModes: { expertCampaign: true },
            step: {
              kind: "inGame",
              window: "afterMulligans",
              effects: [
                {
                  kind: "heal",
                  target: { kind: "identityOf", player: { kind: "each" } },
                  amount: { kind: "const", value: 1 },
                },
              ],
            },
          },
        ],
        victory: [
          {
            id: "syn.alpha.victory.keepsakes",
            text: "Record the name of each ally that entered play in the campaign log.",
            citation: CITE,
            step: {
              kind: "record",
              writes: [
                {
                  field: "keepsakes",
                  seat: "each",
                  mode: "append",
                  value: { kind: "cardsThatEnteredPlay", query: { categories: ["ally"] } },
                },
              ],
            },
          },
          {
            id: "syn.alpha.victory.errand",
            text: "Each player chooses one relic and adds it to their deck, then strike the errand they completed.",
            citation: CITE,
            step: {
              kind: "betweenGames",
              ops: [
                {
                  kind: "choose",
                  slot: "relic",
                  chooser: "eachSeat",
                  from: { kind: "campaignSet", encounterSetId: SYNTHETIC_SET, excludeGranted: true },
                },
                {
                  kind: "grantCard",
                  seat: "self",
                  card: { kind: "choice", slot: "relic" },
                  permanence: "campaign",
                },
                { kind: "strike", field: "errands", option: { kind: "const", value: "north" } },
                { kind: "markNode", node: { kind: "const", value: "alpha" }, as: "completed" },
              ],
            },
          },
          {
            id: "syn.alpha.victory.stamina",
            text: "Expert Campaign Only: Record each identity's remaining hit points in the campaign log.",
            citation: CITE,
            whenModes: { expertCampaign: true },
            step: {
              kind: "record",
              writes: [
                { field: "stamina", seat: "each", mode: "set", value: { kind: "remainingHitPointsCappedAtBase" } },
              ],
            },
          },
        ],
        defeat: [
          {
            id: "syn.alpha.defeat.progress",
            text: "Progress the Crossing in the campaign log and forget every favor owed to you.",
            citation: CITE,
            step: {
              kind: "betweenGames",
              ops: [
                { kind: "progressNode", node: { kind: "const", value: "alpha" } },
                { kind: "clearField", field: "favors" },
              ],
            },
          },
        ],
      },
      {
        id: "omega",
        label: "Trial #2 - the Reckoning",
        scenario: { kind: "composed" },
        composition: [
          {
            id: "syn.omega.compose.warden",
            text: "Choose a warden at random, record its name in the campaign log, and gather its encounter sets.",
            citation: CITE,
            when: { kind: "not", of: { kind: "fieldIsSet", field: "warden" } },
            step: {
              kind: "betweenGames",
              ops: [
                { kind: "random", slot: "warden", from: { kind: "fieldOptions", field: "warden", unstruckOnly: true } },
                { kind: "setField", field: "warden", value: { kind: "choice", slot: "warden" } },
                { kind: "composeVillain", villain: { kind: "choice", slot: "warden" } },
                { kind: "composeEncounterSets", sets: [{ kind: "const", value: SYNTHETIC_SET }] },
              ],
            },
          },
        ],
        setup: [
          {
            id: "syn.omega.setup.deck-surgery",
            text: "Each player removes every card recorded as removed from the campaign from their deck.",
            citation: CITE,
            step: {
              kind: "inGame",
              window: "beforePlayerSetup",
              effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }],
            },
          },
        ],
        victory: [
          {
            id: "syn.omega.victory.end",
            text: "The saboteur is unmasked and the players win the campaign!",
            citation: CITE,
            when: { kind: "notStruck", field: "errands", option: "east" },
            step: {
              kind: "betweenGames",
              ops: [
                {
                  kind: "forEachSeat",
                  ops: [
                    {
                      kind: "choose",
                      slot: "parting-gift",
                      chooser: "eachSeat",
                      optional: true,
                      from: {
                        kind: "collection",
                        filter: { categories: ["upgrade"], aspects: ["leadership"], maxPrintedCost: 3 },
                      },
                    },
                    {
                      kind: "grantCard",
                      seat: "self",
                      card: { kind: "choice", slot: "parting-gift" },
                      permanence: "thisGame",
                    },
                  ],
                },
                { kind: "markNode", node: { kind: "const", value: "omega" }, as: "completed" },
                { kind: "endCampaign", result: "won" },
              ],
            },
          },
        ],
        defeat: [
          {
            id: "syn.omega.defeat.lose",
            text: "Expert Campaign Only: The players lose the campaign.",
            citation: CITE,
            whenModes: { expertCampaign: true },
            step: { kind: "betweenGames", ops: [{ kind: "endCampaign", result: "lost" }] },
          },
        ],
      },
    ],
  },
};

const seats: readonly CampaignSeat[] = [
  {
    seatNumber: 1,
    identityCardId: cardId("syn-hero-one"),
    deck: {
      identityCardId: cardId("syn-hero-one"),
      aspects: ["leadership"],
      cards: [
        { cardId: cardId("syn-player-card"), quantity: 3 },
        { cardId: RELIC_A, quantity: 1 },
      ],
    },
    grants: [{ cardId: RELIC_A, permanence: "campaign", face: "improved", grantedAtNodeId: "alpha" }],
    fields: {
      stamina: { kind: "number", value: 7 },
      keepsakes: { kind: "cardList", cardIds: [WARD] },
    },
  },
  {
    seatNumber: 2,
    identityCardId: cardId("syn-hero-two"),
    deck: {
      identityCardId: cardId("syn-hero-two"),
      aspects: ["protection"],
      cards: [{ cardId: cardId("syn-player-card"), quantity: 2 }],
    },
    grants: [],
    fields: {
      stamina: { kind: "number", value: 11 },
      keepsakes: { kind: "cardList", cardIds: [] },
    },
  },
];

const positionBefore = { nextNodeId: "alpha", resolved: {}, progress: { omega: 1 } };

const snapshotBefore: CampaignLogSnapshot = {
  definitionVersion: "1",
  shared: {
    errands: { kind: "strikeList", struck: [] },
    warden: { kind: "choice", option: "warden-one" },
    favors: { kind: "instructionList", ids: [] },
  },
  hidden: { saboteur: { kind: "choice", option: "warden-two" } },
  seats: seats.map((seat) => ({
    ...seat,
    grants: [],
    fields: { ...seat.fields, keepsakes: { kind: "cardList", cardIds: [] } },
  })),
  removedFromCampaign: [],
  position: positionBefore,
  rng: createRng(4242),
};

/** A log one won game in: the first node resolved, a grant taken, an errand struck, a card removed for good. */
export const SYNTHETIC_CAMPAIGN_LOG: CampaignLog = {
  schema: 1,
  id: "syn-log-1",
  campaignId: SYNTHETIC_CAMPAIGN_ID,
  definitionVersion: "1",
  poolVersion: "syn-pool-1",
  modes: { campaign: { campaignId: SYNTHETIC_CAMPAIGN_ID, expertCampaign: true } },
  seats,
  shared: {
    errands: { kind: "strikeList", struck: ["north"] },
    warden: { kind: "choice", option: "warden-one" },
    favors: { kind: "instructionList", ids: ["syn.favor.ward"] },
  },
  hidden: { saboteur: { kind: "choice", option: "warden-two" } },
  removedFromCampaign: [RELIC_B],
  position: { nextNodeId: "omega", resolved: { alpha: "completed" }, progress: { omega: 1 } },
  seed: 4242,
  rng: { value: 4242, draws: 2 },
  history: [
    {
      nodeId: "alpha",
      modes: { expert: true, campaign: { campaignId: SYNTHETIC_CAMPAIGN_ID, expertCampaign: true } },
      outcome: "won",
      gameId: "syn-game-1",
      logBefore: snapshotBefore,
      at: 1_700_000_000_000,
      steps: [
        {
          instructionId: "syn.alpha.victory.keepsakes",
          text: "Record the name of each ally that entered play in the campaign log.",
          citation: CITE,
          kind: "record",
          writes: [
            { field: "keepsakes", seatNumber: 1, mode: "append", value: { kind: "cardList", cardIds: [WARD] } },
            { field: "keepsakes", seatNumber: 2, mode: "append", value: { kind: "cardList", cardIds: [] } },
          ],
          choices: [],
          removedFromCampaign: [],
          grants: [],
        },
        {
          instructionId: "syn.alpha.victory.errand",
          text: "Each player chooses one relic and adds it to their deck, then strike the errand they completed.",
          citation: CITE,
          kind: "betweenGames",
          writes: [{ field: "errands", seatNumber: null, mode: "strike", value: { kind: "choice", option: "north" } }],
          choices: [{ slot: "relic", seatNumber: 1, picked: [RELIC_A] }],
          removedFromCampaign: [RELIC_B],
          grants: [{ cardId: RELIC_A, permanence: "campaign", face: "improved", grantedAtNodeId: "alpha" }],
        },
        {
          instructionId: "syn.omega.defeat.lose",
          text: "Expert Campaign Only: The players lose the campaign.",
          citation: CITE,
          kind: "betweenGames",
          skipped: "condition",
          writes: [],
          choices: [],
          removedFromCampaign: [],
          grants: [],
        },
      ],
    },
  ],
  status: "active",
};
