/**
 * Issue #873: a grant's face (`setGrantFace`) reaches the next game as `CampaignSeatInput.grantFaces`, so the copy
 * enters play already on that face (MC10 p. 12, a permanent "replace … with its 'Improved' side"). A face marked
 * `atSetup` is reached by a campaign Setup flip each game instead (MC27 p. 22, "**Setup:** Each player flips their …
 * upgrade to its Enhanced side", resolved at RRG v1.8 p. 51 setup step 13): the log keeps the face, and the copy
 * enters play on its front, or that Setup flip would turn it back.
 *
 * A standalone synthetic definition, as `grant-deck-size.test.ts` does, so nothing here perturbs `runner.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { campaignId, cardId, scenarioId, type PlayModes } from "@mc/content";
import type { CampaignDefinition, CampaignGameResult, CampaignInstruction, CampaignLog } from "../campaign.js";
import {
  applyCampaignResult,
  createCampaignLog,
  resolveBetweenGames,
  type CampaignDeps,
  type CampaignSeatSetup,
} from "./runner.js";

const CAMPAIGN_ID = campaignId("grant-face-at-setup-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const DEPS: CampaignDeps = { pool: [] };
const SCENARIO = scenarioId("grant-face-at-setup-test-scenario");
const SEATS: readonly CampaignSeatSetup[] = [1, 2].map((seatNumber) => ({
  seatNumber,
  identityCardId: cardId(`hero-${seatNumber}`),
  deck: { identityCardId: cardId(`hero-${seatNumber}`), aspects: [], cards: [] },
}));

const between = (id: string, ops: CampaignInstruction["step"] & { kind: "betweenGames" }): CampaignInstruction => ({
  id,
  text: "test",
  citation: "test",
  step: ops,
});
const grant = (card: string): CampaignInstruction =>
  between(`grant.${card}`, {
    kind: "betweenGames",
    ops: [{ kind: "grantCard", seat: "each", card: { kind: "const", value: card }, permanence: "campaign" }],
  });
const face = (card: string, name: string, atSetup: boolean): CampaignInstruction =>
  between(`face.${card}.${atSetup}`, {
    kind: "betweenGames",
    ops: [
      {
        kind: "forEachSeat",
        ops: [
          {
            kind: "setGrantFace",
            card: { kind: "const", value: card },
            face: name,
            ...(atSetup ? { atSetup: true as const } : {}),
          },
        ],
      },
    ],
  });

/** Node one grants both cards; its victory turns one permanently and one by Setup flip; node three re-turns one. */
const DEFINITION: CampaignDefinition = {
  campaignId: CAMPAIGN_ID,
  version: "1",
  logFields: [],
  loss: { retry: "free", retryBaseline: "nodeStart" },
  graph: {
    kind: "linear",
    nodes: [
      {
        id: "first",
        label: "First",
        scenario: { kind: "fixed", scenarioId: SCENARIO },
        setup: [grant("swapped"), grant("flipped")],
        victory: [face("swapped", "Swapped Side", false), face("flipped", "Flipped Side", true)],
      },
      {
        id: "second",
        label: "Second",
        scenario: { kind: "fixed", scenarioId: SCENARIO },
        setup: [],
        victory: [face("flipped", "Flipped Side", false)],
      },
      { id: "third", label: "Third", scenario: { kind: "fixed", scenarioId: SCENARIO }, setup: [], victory: [] },
    ],
  },
};

function next(log: CampaignLog): CampaignLog {
  const outcome = resolveBetweenGames(DEFINITION, log, DEPS, MODES, []);
  if (outcome.kind !== "done") throw new Error("unexpected choice");
  return outcome.value;
}
function won(log: CampaignLog): CampaignLog {
  const result: CampaignGameResult = {
    nodeId: log.attempt?.nodeId ?? "",
    outcome: "won",
    records: [],
    removedFromCampaign: [],
    logWrites: [],
    expiringGrants: [],
  };
  const applied = applyCampaignResult(DEFINITION, log, result, { at: 1_700_000_000_000 }, DEPS);
  if (applied.kind !== "done") throw new Error("unexpected choice after the game");
  return applied.value;
}
const newLog = (): CampaignLog =>
  createCampaignLog(DEFINITION, { id: "run", seats: SEATS, modes: MODES, poolVersion: "test", seed: 5 });

describe("setGrantFace atSetup", () => {
  it("before any face is set, the grants carry neither field and the game's input has no grantFaces", () => {
    const first = next(newLog());
    for (const seat of first.seats) {
      expect(seat.grants).toEqual([
        { cardId: "swapped", permanence: "campaign", grantedAtNodeId: "first" },
        { cardId: "flipped", permanence: "campaign", grantedAtNodeId: "first" },
      ]);
    }
    for (const seat of first.attempt!.input.seats) expect(seat).not.toHaveProperty("grantFaces");
  });

  it("both faces are in the log; only the unmarked one reaches the game, so the marked copy enters on its front", () => {
    const second = next(won(next(newLog())));
    expect(second.attempt?.nodeId).toBe("second");
    for (const seat of second.seats) {
      expect(seat.grants).toEqual([
        { cardId: "swapped", permanence: "campaign", face: "Swapped Side", grantedAtNodeId: "first" },
        {
          cardId: "flipped",
          permanence: "campaign",
          face: "Flipped Side",
          faceAtSetup: true,
          grantedAtNodeId: "first",
        },
      ]);
    }
    for (const seat of second.attempt!.input.seats) {
      expect(seat.grantFaces).toEqual([{ cardId: "swapped", face: "Swapped Side" }]);
    }
  });

  it("a later unmarked setGrantFace clears the marker, and the face then reaches the game", () => {
    const third = next(won(next(won(next(newLog())))));
    expect(third.attempt?.nodeId).toBe("third");
    for (const seat of third.seats) {
      const flipped = seat.grants.find((entry) => entry.cardId === "flipped");
      expect(flipped).toEqual({
        cardId: "flipped",
        permanence: "campaign",
        face: "Flipped Side",
        grantedAtNodeId: "first",
      });
    }
    for (const seat of third.attempt!.input.seats) {
      expect(seat.grantFaces).toEqual([
        { cardId: "swapped", face: "Swapped Side" },
        { cardId: "flipped", face: "Flipped Side" },
      ]);
    }
  });
});
