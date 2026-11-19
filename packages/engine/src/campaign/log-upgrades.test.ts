/**
 * `CampaignDefinition.logUpgrades` (issue #873): bookkeeping a definition runs on a log before every game it composes,
 * so a log saved by an older build reads the way the current definition writes it. Here a grant whose face an older
 * build recorded as permanent becomes a Setup face (`faceAtSetup`), and the Setup entry that flips it is added to an
 * `instructionList` field, as MC27 p. 22's node 13 now writes both.
 *
 * A standalone synthetic definition, as `grant-face-at-setup.test.ts` does, so nothing here perturbs `runner.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { campaignId, cardId, scenarioId, type CardId, type PlayModes } from "@mc/content";
import type { CampaignDefinition, CampaignInstruction, CampaignLog, CampaignOp } from "../campaign.js";
import { SYNTHETIC_CAMPAIGN_POOL } from "../testing/campaign.js";
import { createCampaignLog, resolveBetweenGames, type CampaignDeps, type CampaignSeatSetup } from "./runner.js";

const CAMPAIGN_ID = campaignId("log-upgrades-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
/** A pool only so `setAsideCards` names a real card: its refusal, not the pool lookup, is under test. */
const DEPS: CampaignDeps = { pool: SYNTHETIC_CAMPAIGN_POOL };
const SCENARIO = scenarioId("log-upgrades-test-scenario");
const GADGET = cardId("gadget");
const SETUP_FLIP = "late.setupFlip";
const SEATS: readonly CampaignSeatSetup[] = [1, 2].map((seatNumber) => ({
  seatNumber,
  identityCardId: cardId(`hero-${seatNumber}`),
  deck: { identityCardId: cardId(`hero-${seatNumber}`), aspects: [], cards: [] },
}));

const upgrade = (id: string, ops: readonly CampaignOp[]): CampaignInstruction => ({
  id,
  text: "test",
  citation: "test",
  when: { kind: "valueAtLeast", value: { kind: "field", field: "level" }, amount: { kind: "const", value: 1 } },
  step: { kind: "betweenGames", ops },
});

/** Once `level` is 1, the gadget's face is a Setup face and `setups` names the Setup flip, each written once. */
const UPGRADE = upgrade("upgrade.setupFlip", [
  { kind: "setGrantFace", card: { kind: "const", value: GADGET }, face: "Other Side", atSetup: true },
  {
    kind: "if",
    when: { kind: "not", of: { kind: "fieldContains", field: "setups", value: SETUP_FLIP } },
    then: [{ kind: "appendToList", field: "setups", value: { kind: "const", value: SETUP_FLIP } }],
  },
]);

const definitionWith = (logUpgrades?: readonly CampaignInstruction[]): CampaignDefinition => ({
  campaignId: CAMPAIGN_ID,
  version: "1",
  logFields: [
    { id: "level", label: "Level", scope: "shared", type: { kind: "number" }, citation: "test" },
    { id: "setups", label: "Setups", scope: "shared", type: { kind: "instructionList" }, citation: "test" },
  ],
  loss: { retry: "free", retryBaseline: "nodeStart" },
  conditionalInstructions: {
    [SETUP_FLIP]: {
      id: SETUP_FLIP,
      text: "Setup: flip the gadget.",
      citation: "test",
      step: { kind: "inGame", window: "afterScenarioSetup", effects: [] },
    },
  },
  ...(logUpgrades ? { logUpgrades } : {}),
  graph: {
    kind: "linear",
    nodes: [{ id: "only", label: "Only", scenario: { kind: "fixed", scenarioId: SCENARIO }, setup: [], victory: [] }],
  },
});
const DEFINITION = definitionWith([UPGRADE]);

function next(log: CampaignLog, definition: CampaignDefinition = DEFINITION): CampaignLog {
  const outcome = resolveBetweenGames(definition, log, DEPS, MODES, []);
  if (outcome.kind !== "done") throw new Error("unexpected choice");
  return outcome.value;
}
const withoutAttempt = ({ attempt: _attempt, ...rest }: CampaignLog): CampaignLog => rest;

/** Each seat holds the gadget on `face` (as given), at `level`, with `setups` as given. */
function logWith(
  level: number,
  grantFields: { readonly face?: string; readonly faceAtSetup?: true },
  setups: readonly string[],
): CampaignLog {
  const log = createCampaignLog(DEFINITION, { id: "run", seats: SEATS, modes: MODES, poolVersion: "test", seed: 9 });
  return {
    ...log,
    shared: {
      ...log.shared,
      level: { kind: "number", value: level },
      setups: { kind: "instructionList", ids: setups },
    },
    seats: log.seats.map((seat) => ({
      ...seat,
      deck: { ...seat.deck, cards: [{ cardId: GADGET as CardId, quantity: 1 }] },
      grants: [{ cardId: GADGET as CardId, permanence: "campaign", grantedAtNodeId: "only", ...grantFields }],
    })),
  };
}

const ids = (log: CampaignLog): readonly string[] => {
  const value = log.shared.setups;
  return value?.kind === "instructionList" ? value.ids : [];
};

describe("CampaignDefinition.logUpgrades", () => {
  it("brings an older log to the current shape before the game is composed, and keeps it in the returned log", () => {
    const composed = next(logWith(1, { face: "Other Side" }, []));
    for (const seat of composed.seats) {
      expect(seat.grants).toEqual([
        { cardId: GADGET, permanence: "campaign", grantedAtNodeId: "only", face: "Other Side", faceAtSetup: true },
      ]);
    }
    expect(ids(composed)).toEqual([SETUP_FLIP]);
    // The game sees the upgraded log: no grantFaces (the copy enters on its front) and the Setup flip queued.
    for (const seat of composed.attempt!.input.seats) expect(seat).not.toHaveProperty("grantFaces");
    expect(composed.attempt!.input.instructions.map((entry) => entry.instructionId)).toEqual([SETUP_FLIP]);
    // Bookkeeping, not a printed step: the attempt's trace does not name the upgrade.
    expect(composed.attempt!.steps.map((step) => step.instructionId)).not.toContain(UPGRADE.id);
    // A `nodeStart` retry restores to the upgraded log.
    expect(composed.attempt!.logBefore.seats).toEqual(composed.seats);
    expect(composed.attempt!.logBefore.shared).toEqual(composed.shared);
  });

  it("leaves a log already in the current shape as it is: the same game as a definition without upgrades", () => {
    const current = logWith(1, { face: "Other Side", faceAtSetup: true }, [SETUP_FLIP]);
    expect(next(current)).toEqual(next(current, definitionWith()));
    expect(next(current).seats).toEqual(current.seats);
    expect(next(current).shared).toEqual(current.shared);
  });

  it("is idempotent: composing from the upgraded log changes nothing more", () => {
    const once = next(logWith(1, { face: "Other Side" }, []));
    const twice = next(withoutAttempt(once));
    expect(twice.seats).toEqual(once.seats);
    expect(twice.shared).toEqual(once.shared);
    expect(ids(twice)).toEqual([SETUP_FLIP]);
  });

  it("skips a log its condition does not hold for, as it skips a definition that declares none", () => {
    const early = logWith(0, { face: "Other Side" }, []);
    expect(next(early)).toEqual(next(early, definitionWith()));
    for (const seat of next(early).attempt!.input.seats) {
      expect(seat.grantFaces).toEqual([{ cardId: GADGET, face: "Other Side" }]);
    }
  });

  it("refuses an upgrade that is not a betweenGames step, asks for a choice, or draws from the campaign RNG", () => {
    const old = logWith(1, { face: "Other Side" }, []);
    const inGame: CampaignInstruction = {
      ...UPGRADE,
      id: "upgrade.inGame",
      step: { kind: "inGame", window: "afterScenarioSetup", effects: [] },
    };
    const source = { kind: "cards" as const, cardIds: [cardId("a"), cardId("b")] };
    const choose = upgrade("upgrade.choose", [{ kind: "choose", slot: "pick", chooser: "group", from: source }]);
    const random = upgrade("upgrade.random", [{ kind: "random", slot: "pick", from: source }]);
    expect(() => next(old, definitionWith([inGame]))).toThrow(/must be betweenGames steps/);
    expect(() => next(old, definitionWith([choose]))).toThrow(/must not ask for a choice/);
    expect(() => next(old, definitionWith([random]))).toThrow(/must not draw from the campaign RNG/);
  });

  it.each<[string, CampaignOp, RegExp]>([
    [
      "sets cards aside",
      { kind: "setAsideCards", cards: [{ kind: "const", value: "syn-relic-a" }] },
      /set cards aside/,
    ],
    [
      "composes a villain",
      { kind: "composeVillain", villain: { kind: "const", value: "villain" } },
      /compose a villain/,
    ],
    [
      "composes encounter sets",
      { kind: "composeEncounterSets", sets: [{ kind: "const", value: "some-set" }] },
      /compose encounter sets/,
    ],
    ["marks a node", { kind: "markNode", node: { kind: "const", value: "only" }, as: "failed" }, /position or status/],
    ["progresses a node", { kind: "progressNode", node: { kind: "const", value: "only" } }, /position or status/],
    ["ends the campaign", { kind: "endCampaign", result: "lost" }, /position or status/],
  ])("refuses an upgrade that %s, rather than dropping or applying it quietly", (_what, op, message) => {
    const old = logWith(1, { face: "Other Side" }, []);
    expect(() => next(old, definitionWith([upgrade("upgrade.refused", [op])]))).toThrow(message);
  });
});
