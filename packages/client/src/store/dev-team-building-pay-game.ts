/**
 * A real Maria Hill game, from the replay attached to issue #569, stopped at the payment Team-Building Exercise opens
 * for a card from hand with Organizational Support in that hand: the sheet the report was about. `&fixture=team-building-pay`
 * opens it (`boot-dev-jump.ts`), for tests and screenshots.
 */
import type { Command, PlayerId } from "@mc/engine";
import type { SessionStore } from "./session-store.js";
import type { SessionConfig } from "../engine/host.js";

const REPLAY = {
  config: {
    scenarioId: "hela",
    difficulty: "standard",
    modes: { campaign: { campaignId: "mts" } },
    players: [
      {
        identityCardId: "50001a",
        deck: [
          "50002",
          "50003",
          "50003",
          "50004",
          "50004",
          "50005",
          "50005",
          "50005",
          "50006",
          "50007",
          "50007",
          "50008",
          "50009",
          "50010",
          "50011",
          "50012",
          "50013",
          "50014",
          "50014",
          "50014",
          "50017",
          "50018",
          "50020",
          "50021",
          "50023",
          "50024",
          "50025",
          "50026",
          "50027",
          "01092",
          "27044",
          "27044",
          "27044",
          "27055",
          "04016",
          "27054",
          "27046",
          "12024",
          "01083",
          "50016",
          "50016",
          "50028",
          "21183",
        ],
        aspects: ["leadership"],
      },
    ],
    seed: 1718510655,
    campaign: {
      campaignId: "mts",
      nodeId: "hela",
      definitionVersion: "1",
      modes: { campaign: { campaignId: "mts" } },
      log: {
        shared: {
          secureLandingPadInPlay: { kind: "flag", value: false },
          cosmoInPool: { kind: "flag", value: true },
          securityBreachInPool: { kind: "flag", value: false },
          saveShawarmaPlaceInPlay: { kind: "flag", value: false },
          shawarmaInPool: { kind: "flag", value: true },
          blackSwanDefeated: { kind: "flag", value: true },
          avengersTowerDamaged: { kind: "flag", value: true },
          defensiveProtocolsDefeated: { kind: "flag", value: true },
          infinityStones1BCompleted: { kind: "flag", value: false },
        },
        perSeat: [{ seatNumber: 1, fields: {} }],
      },
      instructions: [
        {
          instructionId: "mc21.s4.setup.norn-stones",
          text: 'Put the "Find the Norn Stones" side scheme into play.',
          citation: "MC21 p. 21",
          window: "afterScenarioSetup",
          effects: [
            {
              kind: "selectCards",
              slot: "scheme",
              cards: { kind: "encounterSetAside", filter: { name: "Find the Norn Stones" } },
            },
            { kind: "putIntoPlay", card: { kind: "slot", slot: "scheme" }, controller: { kind: "firstPlayer" } },
          ],
        },
        {
          instructionId: "mc21.s4.setup.summoned-back",
          text: 'Shuffle the "Summoned Back" treachery into the encounter deck.',
          citation: "MC21 p. 21",
          window: "afterScenarioSetup",
          effects: [
            {
              kind: "moveCards",
              cards: { kind: "encounterSetAside", filter: { name: "Summoned Back" } },
              to: "encounterDeckShuffle",
            },
          ],
        },
      ],
      removedFromCampaign: [],
      seats: [
        {
          seatNumber: 1,
          identityCardId: "50001a",
          deck: [
            "50002",
            "50003",
            "50003",
            "50004",
            "50004",
            "50005",
            "50005",
            "50005",
            "50006",
            "50007",
            "50007",
            "50008",
            "50009",
            "50010",
            "50011",
            "50012",
            "50013",
            "50014",
            "50014",
            "50014",
            "50017",
            "50018",
            "50020",
            "50021",
            "50023",
            "50024",
            "50025",
            "50026",
            "50027",
            "01092",
            "27044",
            "27044",
            "27044",
            "27055",
            "04016",
            "27054",
            "27046",
            "12024",
            "01083",
            "50016",
            "50016",
            "50028",
            "21183",
          ],
          aspects: ["leadership"],
          grantedCardIds: ["21183"],
        },
      ],
      seed: 1718510655,
    },
    campaignEncounterSets: { deck: [], setAside: ["mts_campaign"] },
    tableRules: { sameNameHeroAllyConflict: true },
    outsideFacts: [{ wonPreviousGame: true }],
  },
  commands: [
    { playerId: "p1", command: { type: "resolveChoice", playerId: "p1", choiceId: "c1", selectedOptionIds: [] } },
    {
      playerId: "p1",
      command: {
        type: "useAbility",
        playerId: "p1",
        cardInstanceId: "i3",
        abilityId: "50001b.maria-hill-action",
        payment: [],
      },
    },
    { playerId: "p1", command: { type: "resolveChoice", playerId: "p1", choiceId: "c2", selectedOptionIds: ["i16"] } },
    {
      playerId: "p1",
      command: {
        type: "playCard",
        playerId: "p1",
        cardInstanceId: "i16",
        payment: [
          { fromHand: "i13" },
          { fromHand: "i9" },
          { fromHand: "i42" },
          { fromHand: "i19" },
          { fromHand: "i20" },
        ],
        attachToInstanceId: null,
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c3",
        selectedOptionIds: ["i13:50007.special-funding-response"],
      },
    },
    { playerId: "p1", command: { type: "endTurn", playerId: "p1" } },
    { playerId: "p1", command: { type: "resolveChoice", playerId: "p1", choiceId: "c4", selectedOptionIds: [] } },
    {
      playerId: "p1",
      command: {
        type: "playCard",
        playerId: "p1",
        cardInstanceId: "i41",
        payment: [{ fromHand: "i30" }],
        attachToInstanceId: null,
      },
    },
    { playerId: "p1", command: { type: "changeForm", playerId: "p1" } },
    {
      playerId: "p1",
      command: {
        type: "useAbility",
        playerId: "p1",
        cardInstanceId: "i41",
        abilityId: "12024.team-building-exercise-action",
        payment: [],
      },
    },
    { playerId: "p1", command: { type: "resolveChoice", playerId: "p1", choiceId: "c5", selectedOptionIds: ["i40"] } },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c6",
        selectedOptionIds: ["hand:i38", "hand:i5", "hand:i39"],
      },
    },
    {
      playerId: "p1",
      command: { type: "basicAttack", playerId: "p1", attackerInstanceId: "i3", targetInstanceId: "i56" },
    },
    {
      playerId: "p1",
      command: {
        type: "useAbility",
        playerId: "p1",
        cardInstanceId: "i16",
        abilityId: "50009.the-iliad-action",
        payment: [],
      },
    },
    { playerId: "p1", command: { type: "resolveChoice", playerId: "p1", choiceId: "c7", selectedOptionIds: ["0"] } },
    { playerId: "p1", command: { type: "resolveChoice", playerId: "p1", choiceId: "c8", selectedOptionIds: ["i56"] } },
    {
      playerId: "p1",
      command: { type: "basicThwart", playerId: "p1", thwarterInstanceId: "i40", schemeInstanceId: "i53" },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c9",
        selectedOptionIds: ["i40:27046.agent-13-response"],
      },
    },
    { playerId: "p1", command: { type: "resolveChoice", playerId: "p1", choiceId: "c10", selectedOptionIds: ["i16"] } },
    {
      playerId: "p1",
      command: {
        type: "useAbility",
        playerId: "p1",
        cardInstanceId: "i16",
        abilityId: "50009.the-iliad-action",
        payment: [],
      },
    },
    { playerId: "p1", command: { type: "resolveChoice", playerId: "p1", choiceId: "c11", selectedOptionIds: ["0"] } },
    { playerId: "p1", command: { type: "resolveChoice", playerId: "p1", choiceId: "c12", selectedOptionIds: ["i28"] } },
    { playerId: "p1", command: { type: "endTurn", playerId: "p1" } },
    {
      playerId: "p1",
      command: { type: "resolveChoice", playerId: "p1", choiceId: "c13", selectedOptionIds: ["decline"] },
    },
    {
      playerId: "p1",
      command: { type: "basicThwart", playerId: "p1", thwarterInstanceId: "i3", schemeInstanceId: "i2" },
    },
    {
      playerId: "p1",
      command: {
        type: "useAbility",
        playerId: "p1",
        cardInstanceId: "i16",
        abilityId: "50009.the-iliad-action",
        payment: [],
      },
    },
    { playerId: "p1", command: { type: "resolveChoice", playerId: "p1", choiceId: "c14", selectedOptionIds: ["0"] } },
    { playerId: "p1", command: { type: "resolveChoice", playerId: "p1", choiceId: "c15", selectedOptionIds: ["i1"] } },
    {
      playerId: "p1",
      command: {
        type: "playCard",
        playerId: "p1",
        cardInstanceId: "i35",
        payment: [{ fromHand: "i17" }],
        attachToInstanceId: null,
      },
    },
    {
      playerId: "p1",
      command: {
        type: "useAbility",
        playerId: "p1",
        cardInstanceId: "i3",
        abilityId: "50001a.reassignment",
        payment: [],
      },
    },
    { playerId: "p1", command: { type: "resolveChoice", playerId: "p1", choiceId: "c16", selectedOptionIds: ["i35"] } },
    { playerId: "p1", command: { type: "resolveChoice", playerId: "p1", choiceId: "c17", selectedOptionIds: ["i16"] } },
    { playerId: "p1", command: { type: "changeForm", playerId: "p1" } },
    {
      playerId: "p1",
      command: {
        type: "useAbility",
        playerId: "p1",
        cardInstanceId: "i79",
        abilityId: "21158.frozen-action",
        payment: [{ fromHand: "i44" }, { fromHand: "i27" }],
      },
    },
    {
      playerId: "p1",
      command: { type: "basicThwart", playerId: "p1", thwarterInstanceId: "i40", schemeInstanceId: "i2" },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c18",
        selectedOptionIds: ["i40:27046.agent-13-response"],
      },
    },
    { playerId: "p1", command: { type: "resolveChoice", playerId: "p1", choiceId: "c19", selectedOptionIds: ["i16"] } },
    { playerId: "p1", command: { type: "endTurn", playerId: "p1" } },
    { playerId: "p1", command: { type: "resolveChoice", playerId: "p1", choiceId: "c20", selectedOptionIds: [] } },
    { playerId: "p1", command: { type: "changeForm", playerId: "p1" } },
    {
      playerId: "p1",
      command: {
        type: "useAbility",
        playerId: "p1",
        cardInstanceId: "i41",
        abilityId: "12024.team-building-exercise-action",
        payment: [],
      },
    },
    { playerId: "p1", command: { type: "resolveChoice", playerId: "p1", choiceId: "c21", selectedOptionIds: ["i4"] } },
  ],
} as unknown as {
  readonly config: SessionConfig;
  readonly commands: readonly { readonly playerId: PlayerId; readonly command: Command }[];
};

/** Starts the game and plays the report's moves up to the payment. */
export async function startTeamBuildingPayGame(store: SessionStore): Promise<void> {
  await store.start(REPLAY.config);
  for (const { command } of REPLAY.commands) {
    if (command.type === "resolveChoice") await store.resolveChoice(command.selectedOptionIds);
    else await store.dispatch(command);
  }
}
