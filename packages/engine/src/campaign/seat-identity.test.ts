/**
 * `CampaignValue` `seatIdentity` (MC65 p. 9: "Each player records their identity in the campaign log"): the scoped seat's
 * identity card, or its printed name, written to a field.
 */
import { describe, expect, it } from "vitest";
import { campaignId, cardId, scenarioId, type AnyCard, type PlayModes } from "@mc/content";
import type { CampaignDefinition, CampaignLog, CampaignOp } from "../campaign.js";
import { createCampaignLog, resolveBetweenGames, type CampaignDeps } from "./runner.js";

const ID = campaignId("seat-identity-test");
const MODES: PlayModes = { campaign: { campaignId: ID } };
const hero = (id: string, name: string) => ({ id: cardId(id), type: "hero_identity", name }) as unknown as AnyCard;
const POOL = [hero("h1", "Daredevil"), hero("h2", "Elektra")];

const definitionWith = (ops: readonly CampaignOp[]): CampaignDefinition => ({
  campaignId: ID,
  version: "1",
  logFields: [
    { id: "identity", label: "i", scope: "perSeat", type: { kind: "cardRef" }, citation: "t" },
    { id: "name", label: "n", scope: "perSeat", type: { kind: "text" }, citation: "t" },
    { id: "first", label: "f", scope: "shared", type: { kind: "text" }, citation: "t" },
  ],
  loss: { retry: "free", retryBaseline: "nodeStart" },
  graph: {
    kind: "linear",
    nodes: [
      {
        id: "n1",
        label: "n1",
        scenario: { kind: "fixed", scenarioId: scenarioId("s1") },
        composition: [{ id: "t.id", text: "t", citation: "t", step: { kind: "betweenGames", ops } }],
        setup: [],
        victory: [],
      },
    ],
  },
});

const seat = (seatNumber: number, identity: string) => ({
  seatNumber,
  identityCardId: cardId(identity),
  deck: { identityCardId: cardId(identity), aspects: [], cards: [] },
});

function compose(
  ops: readonly CampaignOp[],
  identities: readonly string[],
  pool: readonly AnyCard[] = POOL,
): CampaignLog {
  const definition = definitionWith(ops);
  const log = createCampaignLog(definition, {
    id: "run",
    seats: identities.map((identity, index) => seat(index + 1, identity)),
    modes: MODES,
    poolVersion: "t",
    seed: 1,
  });
  const deps: CampaignDeps = { pool };
  const outcome = resolveBetweenGames(definition, log, deps, MODES, []);
  if (outcome.kind !== "done") throw new Error("the composition asked a question");
  return outcome.value;
}

const perSeat: CampaignOp = {
  kind: "forEachSeat",
  ops: [
    { kind: "setField", field: "identity", seat: "self", value: { kind: "seatIdentity" } },
    { kind: "setField", field: "name", seat: "self", value: { kind: "seatIdentity", as: "name" } },
  ],
};

describe("seatIdentity (MC65 p. 9)", () => {
  it("inside forEachSeat is each seat's own identity, as a card and as its printed name", () => {
    const log = compose([perSeat], ["h1", "h2"]);
    expect(log.seats.map((s) => s.fields["identity"])).toEqual([
      { kind: "cardRef", cardId: "h1" },
      { kind: "cardRef", cardId: "h2" },
    ]);
    expect(log.seats.map((s) => s.fields["name"])).toEqual([
      { kind: "text", value: "Daredevil" },
      { kind: "text", value: "Elektra" },
    ]);
  });

  it("outside a seat scope reads the first seat's", () => {
    const log = compose(
      [{ kind: "setField", field: "first", value: { kind: "seatIdentity", as: "name" } }],
      ["h2", "h1"],
    );
    expect(log.shared["first"]).toEqual({ kind: "text", value: "Elektra" });
  });

  it("an identity missing from the pool has no name, though its id is still recorded", () => {
    const log = compose([perSeat], ["h1", "gone"]);
    expect(log.seats[1]!.fields["identity"]).toEqual({ kind: "cardRef", cardId: "gone" });
    expect(log.seats[1]!.fields["name"]).toEqual({ kind: "text", value: "" });
    expect(log.seats[0]!.fields["name"]).toEqual({ kind: "text", value: "Daredevil" });
  });
});
