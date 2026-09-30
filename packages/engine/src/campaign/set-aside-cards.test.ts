/**
 * `CampaignOp` `setAsideCards` and the ownership a card brought in from outside the game takes when it enters play.
 *
 * MC27 p. 13/15 ("Put the Venom (190) ally card into play under the first player's control") and p. 22 ("Each player
 * may search their collection for a Helicarrier support … and put it into play under their control") name player
 * cards that no composed set holds and no deck lists. The op sets them aside at setup (`CampaignGameInput.
 * setAsideCards`, created ownerless in `encounterSetAside`); an `inGame` `putIntoPlay` then brings each in, and the
 * player it enters play under becomes its owner (RRG 1.8 "Ownership and Control", p. 31), so it leaves play to that
 * player's discard pile rather than the encounter discard pile.
 */
import { describe, expect, it } from "vitest";
import { campaignId, cardId, scenarioId, type PlayModes } from "@mc/content";
import { DEFAULT_DEPS } from "../abilities.js";
import type { CampaignDefinition, CampaignInstruction } from "../campaign.js";
import { discardZoneFor } from "../query.js";
import { cardsInPlay } from "../select.js";
import { createGame } from "../setup.js";
import type { GameState } from "../state.js";
import { runCommands } from "../testing/drive.js";
import { stubAlly } from "../testing/fixtures.js";
import { DEFAULT_CARDS, HERO, MAIN_SCHEME, VILLAIN, seatIdentities } from "../testing/scenario.js";
import {
  createCampaignLog,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignDeps,
  type CampaignSeatSetup,
} from "./runner.js";

const CAMPAIGN_ID = campaignId("set-aside-cards-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const OUTSIDER = stubAlly({ id: "outsider-ally", cost: 3, atk: 1, thw: 1, hp: 3 });
const DEPS: CampaignDeps = { pool: [OUTSIDER] };

const SEATS: readonly CampaignSeatSetup[] = [1, 2].map((seatNumber) => ({
  seatNumber,
  identityCardId: cardId(`hero-${seatNumber}`),
  deck: { identityCardId: cardId(`hero-${seatNumber}`), aspects: [], cards: [] },
}));

function definitionWith(setup: readonly CampaignInstruction[]): CampaignDefinition {
  return {
    campaignId: CAMPAIGN_ID,
    version: "1",
    logFields: [],
    loss: { retry: "free", retryBaseline: "nodeStart" },
    graph: {
      kind: "linear",
      nodes: [
        {
          id: "only",
          label: "Only",
          scenario: { kind: "fixed", scenarioId: scenarioId("set-aside-cards-scenario") },
          setup,
          victory: [],
        },
      ],
    },
  };
}

const setAside = (copies?: "seatCount"): CampaignInstruction => ({
  id: "only.setup.set-aside",
  text: "test",
  citation: "test",
  step: {
    kind: "betweenGames",
    ops: [
      {
        kind: "setAsideCards",
        cards: [{ kind: "const", value: OUTSIDER.id }],
        ...(copies ? { copies: { kind: "seatCount" } } : {}),
      },
    ],
  },
});

/** "Put the [card] into play under the first player's control." */
const putIntoPlayUnderFirstPlayer: CampaignInstruction = {
  id: "only.setup.into-play",
  text: "test",
  citation: "test",
  step: {
    kind: "inGame",
    window: "afterScenarioSetup",
    effects: [
      { kind: "selectCards", slot: "outsider", cards: { kind: "encounterSetAside", filter: { name: OUTSIDER.name } } },
      { kind: "putIntoPlay", card: { kind: "slot", slot: "outsider" }, controller: { kind: "firstPlayer" } },
    ],
  },
};

function compose(definition: CampaignDefinition) {
  const log = createCampaignLog(definition, { id: "run", seats: SEATS, modes: MODES, poolVersion: "test", seed: 1 });
  const composed = resolveBetweenGames(definition, log, DEPS, MODES);
  if (composed.kind !== "done") throw new Error("unexpected pending choice");
  return startGameFromLog(definition, composed.value);
}

function playSetup(definition: CampaignDefinition) {
  const identities = seatIdentities(HERO, 2);
  const created = createGame(
    {
      seed: 1,
      cards: [...DEFAULT_CARDS, ...identities, OUTSIDER],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: [],
      players: identities.map((identity) => ({ identityCardId: identity.id, deck: [] })),
      campaign: compose(definition).input,
    },
    DEFAULT_DEPS,
  );
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const driven = runCommands(created.state, DEFAULT_DEPS);
  return { created: created.state, state: driven.state, events: [...created.events, ...driven.events] };
}

const outsiders = (state: GameState) =>
  Object.values(state.instances).filter((instance) => instance.cardId === OUTSIDER.id);

describe("CampaignOp setAsideCards (MC27 p. 13/15/22)", () => {
  it("names one instance per card by default, and one per seat with copies: seatCount", () => {
    expect(compose(definitionWith([setAside()])).input.setAsideCards).toEqual([OUTSIDER.id]);
    expect(compose(definitionWith([setAside("seatCount")])).input.setAsideCards).toEqual([OUTSIDER.id, OUTSIDER.id]);
  });

  it("leaves the game input without the field when no op names a card", () => {
    expect(compose(definitionWith([])).input).not.toHaveProperty("setAsideCards");
  });

  it("refuses a card that is not in the card pool", () => {
    const definition = definitionWith([
      {
        ...setAside(),
        step: { kind: "betweenGames", ops: [{ kind: "setAsideCards", cards: [{ kind: "const", value: "nope" }] }] },
      },
    ]);
    const log = createCampaignLog(definition, { id: "run", seats: SEATS, modes: MODES, poolVersion: "test", seed: 1 });
    expect(() => resolveBetweenGames(definition, log, DEPS, MODES)).toThrow(/nope, not in the card pool/);
  });

  it("creates the cards set aside, ownerless, in no deck, at setup", () => {
    const { created } = playSetup(definitionWith([setAside("seatCount")]));
    const copies = outsiders(created);
    expect(copies).toHaveLength(2);
    for (const copy of copies) {
      expect(created.encounterSetAside).toContain(copy.instanceId);
      expect(copy).toMatchObject({ ownerId: null, controllerId: null });
      for (const player of created.players) {
        expect([...player.deck, ...player.hand, ...player.discard]).not.toContain(copy.instanceId);
      }
    }
  });
});

describe('putIntoPlay of an ownerless player card makes its controller its owner (RRG 1.8 "Ownership and Control", p. 31)', () => {
  it("enters play under the first player, who then owns it; leaving play sends it to their discard pile", () => {
    // Set aside and never put into play, nobody owns it: a discard would go to the encounter discard pile.
    const { state: asideOnly } = playSetup(definitionWith([setAside()]));
    const [aside] = outsiders(asideOnly);
    if (!aside) throw new Error("nothing set aside");
    expect(discardZoneFor(asideOnly, aside.instanceId).kind).toBe("encounterDiscard");

    const { state, events } = playSetup(definitionWith([setAside(), putIntoPlayUnderFirstPlayer]));

    const [copy] = outsiders(state);
    if (!copy) throw new Error("the card vanished");
    expect(cardsInPlay(state)).toContain(copy.instanceId);
    expect(state.encounterSetAside).not.toContain(copy.instanceId);
    expect(copy).toMatchObject({ controllerId: state.firstPlayerId, ownerId: state.firstPlayerId });
    expect(copy.home).toEqual({ kind: "player" });
    expect(state.players.find((player) => player.playerId === state.firstPlayerId)?.playArea).toContain(
      copy.instanceId,
    );
    expect(events).toContainEqual({
      type: "ownershipChanged",
      instanceId: copy.instanceId,
      playerId: state.firstPlayerId,
    });
    expect(discardZoneFor(state, copy.instanceId)).toEqual({ kind: "discard", playerId: state.firstPlayerId });
  });
});
