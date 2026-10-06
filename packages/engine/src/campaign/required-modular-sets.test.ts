/**
 * `CampaignNode.requiredModularSetIds`: a modular set the campaign requires in a scenario. MC40 p. 14: "The Black Tom
 * Cassidy set can be removed from this scenario and/or added to other scenarios when using the scenario customization
 * rules, but it is required when playing Juggernaut in campaign mode."
 *
 * The field reaches a caller three ways, each pinned here: `startGameFromLog` names the sets
 * (`CampaignGameStart.requiredModularSetIds`), `campaignModularSetIds` folds them into the modular choice, and the
 * frozen `CampaignGameInput` makes `createGame` refuse a game built without one.
 */
import { describe, expect, it } from "vitest";
import { campaignId, cardId, encounterSetId, scenarioId, type PlayModes } from "@mc/content";
import { DEFAULT_DEPS } from "../abilities.js";
import type { CampaignDefinition } from "../campaign.js";
import { createGame } from "../setup.js";
import { stubTreachery } from "../testing/fixtures.js";
import { DEFAULT_CARDS, HERO, MAIN_SCHEME, VILLAIN, seatIdentities } from "../testing/scenario.js";
import {
  campaignModularSetIds,
  createCampaignLog,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignSeatSetup,
} from "./runner.js";

const CAMPAIGN_ID = campaignId("required-modular-sets-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const REQUIRED = encounterSetId("required_set");
const OTHER = encounterSetId("other_set");
const REQUIRED_CARD = stubTreachery({ id: "required-card", encounterSetIds: [REQUIRED] });
const OTHER_CARD = stubTreachery({ id: "other-card", encounterSetIds: [OTHER] });

const SEATS: readonly CampaignSeatSetup[] = [1, 2].map((seatNumber) => ({
  seatNumber,
  identityCardId: cardId(`hero-${seatNumber}`),
  deck: { identityCardId: cardId(`hero-${seatNumber}`), aspects: [], cards: [] },
}));

function definitionWith(requiredModularSetIds?: readonly string[]): CampaignDefinition {
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
          scenario: { kind: "fixed", scenarioId: scenarioId("required-modular-sets-scenario") },
          ...(requiredModularSetIds ? { requiredModularSetIds } : {}),
          setup: [],
          victory: [],
        },
      ],
    },
  };
}

function startOf(definition: CampaignDefinition) {
  const log = createCampaignLog(definition, { id: "run", seats: SEATS, modes: MODES, poolVersion: "test", seed: 1 });
  const composed = resolveBetweenGames(definition, log, { pool: [] }, MODES);
  if (composed.kind !== "done") throw new Error("unexpected pending choice");
  return startGameFromLog(definition, composed.value);
}

function create(definition: CampaignDefinition, zones: { encounterDeck?: string[]; setAside?: string[] }) {
  const identities = seatIdentities(HERO, 2);
  return createGame(
    {
      seed: 1,
      cards: [...DEFAULT_CARDS, ...identities, REQUIRED_CARD, OTHER_CARD],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: (zones.encounterDeck ?? []).map((id) => cardId(id)),
      setAside: (zones.setAside ?? []).map((id) => cardId(id)),
      players: identities.map((identity) => ({ identityCardId: identity.id, deck: [] })),
      campaign: startOf(definition).input,
    },
    DEFAULT_DEPS,
  );
}

describe("startGameFromLog names a node's required modular sets (MC40 p. 14)", () => {
  it("a node with the field: the start and the frozen game input both carry the sets", () => {
    const start = startOf(definitionWith([REQUIRED]));
    expect(start.requiredModularSetIds).toEqual([REQUIRED]);
    expect(start.input.requiredModularSetIds).toEqual([REQUIRED]);
    expect(start.node.requiredModularSetIds).toEqual([REQUIRED]);
    // Not extra cards to add: the composed sets are untouched, so a builder's own copy of the set is the only one.
    expect(start.encounterSets).toEqual({ deck: [], setAside: [] });
  });

  it("a node without it (or with an empty list): the start has an empty list and the game input is unchanged", () => {
    for (const definition of [definitionWith(), definitionWith([])]) {
      const start = startOf(definition);
      expect(start.requiredModularSetIds).toEqual([]);
      expect("requiredModularSetIds" in start.input).toBe(false);
    }
  });

  it("a set the definition lists twice is named once", () => {
    const start = startOf(definitionWith([REQUIRED, OTHER, REQUIRED]));
    expect(start.requiredModularSetIds).toEqual([REQUIRED, OTHER]);
    expect(start.input.requiredModularSetIds).toEqual([REQUIRED, OTHER]);
  });
});

describe("campaignModularSetIds: required sets are added to the caller's modular choice", () => {
  const required = { requiredModularSetIds: [REQUIRED] as readonly string[] };
  const none = { requiredModularSetIds: [] as readonly string[] };

  it("nothing required: the caller's choice comes back as given, undefined included", () => {
    expect(campaignModularSetIds(none, [OTHER])).toBeUndefined();
    expect(campaignModularSetIds(none, [OTHER], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("nothing picked: the required sets, then the scenario's recommendation", () => {
    expect(campaignModularSetIds(required, [OTHER])).toEqual([REQUIRED, OTHER]);
    expect(campaignModularSetIds(required, [])).toEqual([REQUIRED]);
  });

  it("the recommendation is the required set (Juggernaut and Black Tom Cassidy): one set, not two", () => {
    expect(campaignModularSetIds(required, [REQUIRED])).toEqual([REQUIRED]);
  });

  it("another set picked: the required set is added, not replaced, and the recommendation is not used", () => {
    expect(campaignModularSetIds(required, [REQUIRED], [OTHER])).toEqual([REQUIRED, OTHER]);
    expect(campaignModularSetIds(required, ["recommended"], [OTHER])).toEqual([REQUIRED, OTHER]);
  });

  it("the required set picked as well, or a set picked twice: each is in the result once", () => {
    expect(campaignModularSetIds(required, [], [OTHER, REQUIRED])).toEqual([REQUIRED, OTHER]);
    expect(campaignModularSetIds(required, [], [REQUIRED])).toEqual([REQUIRED]);
    expect(campaignModularSetIds(required, [], [OTHER, OTHER])).toEqual([REQUIRED, OTHER]);
  });

  it("an empty pick is a pick: only the required sets", () => {
    expect(campaignModularSetIds(required, [OTHER], [])).toEqual([REQUIRED]);
  });

  it("reads a real start", () => {
    expect(campaignModularSetIds(startOf(definitionWith([REQUIRED])), [], [OTHER])).toEqual([REQUIRED, OTHER]);
  });
});

describe("createGame refuses a campaign game built without a required modular set", () => {
  it("no card of the set anywhere: invalid setup, naming the set and the node", () => {
    const created = create(definitionWith([REQUIRED]), { encounterDeck: ["other-card"] });
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.error.code).toBe("invalid_setup");
    expect(created.error.message).toContain("required_set");
    expect(created.error.message).toContain("only");
  });

  it("the set in the encounter deck, or set aside: the game is created", () => {
    expect(create(definitionWith([REQUIRED]), { encounterDeck: ["required-card", "other-card"] }).ok).toBe(true);
    expect(create(definitionWith([REQUIRED]), { setAside: ["required-card"] }).ok).toBe(true);
  });

  it("two required sets: each must be there", () => {
    const definition = definitionWith([REQUIRED, OTHER]);
    expect(create(definition, { encounterDeck: ["required-card"] }).ok).toBe(false);
    expect(create(definition, { encounterDeck: ["required-card", "other-card"] }).ok).toBe(true);
  });

  it("no required set: nothing is checked", () => {
    expect(create(definitionWith(), { encounterDeck: [] }).ok).toBe(true);
  });
});
