import { describe, expect, test } from "vitest";
import { cardId, type Campaign } from "@mc/content";
import type { CampaignChoiceAnswer, CampaignPendingChoice } from "@mc/engine";
import {
  ROLE_CALL_START,
  backFromRole,
  confirmedRole,
  isRoleChoice,
  roleCallOf,
  roleConfirmOf,
  roleRelationOf,
  seatHeaderOf,
  selectRole,
} from "./campaign-role-call-model.js";

const roles = [
  { id: "brawler", name: "Brawler", encounterSetId: "brawler", aspects: ["aggression", "protection"] },
  { id: "commander", name: "Commander", encounterSetId: "commander", aspects: ["aggression", "leadership"] },
  { id: "defender", name: "Defender", encounterSetId: "defender", aspects: ["justice", "protection"] },
  { id: "peacekeeper", name: "Peacekeeper", encounterSetId: "peacekeeper", aspects: ["justice", "leadership"] },
] as unknown as NonNullable<Campaign["roles"]>;

const seats = [
  { seatNumber: 1, identityCardId: cardId("colossus"), deck: { aspects: ["protection"] } },
  { seatNumber: 2, identityCardId: cardId("shadowcat"), deck: { aspects: ["aggression", "justice"] } },
];
const nameOf = (id: string): string => (id === "colossus" ? "Colossus" : "Shadowcat");

const pendingFor = (seatNumber: number, options: string[]): CampaignPendingChoice => ({
  instructionId: "mc32.s1.setup.roles",
  slot: "role",
  seatNumber,
  text: "Each player chooses one of the campaign roles.",
  citation: "MC32 p. 7",
  chooser: "eachSeat",
  options,
  count: 1,
  optional: false,
});

const seat1Took = (role: string): CampaignChoiceAnswer => ({
  instructionId: "mc32.s1.setup.roles",
  slot: "role",
  seatNumber: 1,
  picked: [role],
});

describe("seatHeaderOf", () => {
  test("names the seat and its hero", () => {
    expect(seatHeaderOf(pendingFor(1, []), seats, nameOf)).toMatchObject({
      seatNumber: 1,
      heroName: "Colossus",
      title: "SEAT 1 · COLOSSUS",
    });
    expect(seatHeaderOf(pendingFor(2, []), seats, nameOf)?.title).toBe("SEAT 2 · SHADOWCAT");
  });
  test("shows the deck's aspects: one, two, or none", () => {
    expect(seatHeaderOf(pendingFor(1, []), seats, nameOf)?.deckAspects.map((a) => a.aspect)).toEqual(["protection"]);
    expect(seatHeaderOf(pendingFor(2, []), seats, nameOf)?.deckAspects.map((a) => a.aspect)).toEqual([
      "aggression",
      "justice",
    ]);
    const bare = [{ seatNumber: 1, identityCardId: cardId("colossus"), deck: { aspects: [] } }];
    expect(seatHeaderOf(pendingFor(1, []), bare, nameOf)?.deckAspects).toEqual([]);
  });
  test("a team-wide choice or an unknown seat has no header", () => {
    expect(seatHeaderOf({ seatNumber: null }, seats, nameOf)).toBeNull();
    expect(seatHeaderOf({ seatNumber: 4 }, seats, nameOf)).toBeNull();
  });
});

describe("roleRelationOf", () => {
  test("neither aspect in the deck", () => {
    expect(roleRelationOf(["justice", "leadership"], ["protection"])).toBe("Adds Justice and Leadership");
    expect(roleRelationOf(["justice", "leadership"], [])).toBe("Adds Justice and Leadership");
  });
  test("one aspect already in the deck", () => {
    expect(roleRelationOf(["aggression", "protection"], ["protection"])).toBe(
      "Builds on your Protection deck and adds Aggression",
    );
  });
  test("both aspects already in the deck", () => {
    expect(roleRelationOf(["aggression", "justice"], ["aggression", "justice"])).toBe(
      "Builds on your Aggression + Justice deck",
    );
  });
  test("tiles carry the line for the choosing seat's deck", () => {
    const ids = roles.map((role) => role.id);
    const one = roleCallOf(pendingFor(1, ids), roles, [], seats, nameOf);
    expect(one.tiles.map((tile) => tile.relation)).toEqual([
      "Builds on your Protection deck and adds Aggression",
      "Adds Aggression and Leadership",
      "Builds on your Protection deck and adds Justice",
      "Adds Justice and Leadership",
    ]);
    const two = roleCallOf(pendingFor(2, ids), roles, [], seats, nameOf);
    expect(two.tiles[1]!.relation).toBe("Builds on your Aggression deck and adds Leadership");
  });
});

describe("isRoleChoice", () => {
  test("a pick of one role id is a role choice; role-building's card list is not", () => {
    expect(isRoleChoice(pendingFor(1, ["brawler", "defender"]), roles)).toBe(true);
    expect(isRoleChoice(pendingFor(1, ["some-card-id"]), roles)).toBe(false);
    expect(isRoleChoice({ ...pendingFor(1, ["brawler"]), count: 2 }, roles)).toBe(false);
    expect(isRoleChoice(pendingFor(1, ["brawler"]), undefined)).toBe(false);
  });
});

describe("roleCallOf", () => {
  test("seat 1: four tiles with name, aspects and a summary, none taken", () => {
    const view = roleCallOf(
      pendingFor(
        1,
        roles.map((role) => role.id),
      ),
      roles,
      [],
      seats,
      nameOf,
    );
    expect(view.tiles.map((tile) => tile.name)).toEqual(["Brawler", "Commander", "Defender", "Peacekeeper"]);
    const brawler = view.tiles[0]!;
    expect(brawler.aspects.map((aspect) => aspect.aspect)).toEqual(["aggression", "protection"]);
    expect(brawler.aspectsLabel).toBe("Aggression + Protection");
    expect(brawler.summary.length).toBeGreaterThan(10);
    expect(view.tiles.every((tile) => tile.available && tile.takenBySeat === null)).toBe(true);
  });

  test("seat 2: the role seat 1 took is shown as taken, with who took it, and can't be picked", () => {
    const view = roleCallOf(
      pendingFor(2, ["commander", "defender", "peacekeeper"]),
      roles,
      [seat1Took("brawler")],
      seats,
      nameOf,
    );
    expect(view.tiles).toHaveLength(4);
    const brawler = view.tiles[0]!;
    expect(brawler).toMatchObject({ takenBySeat: 1, takenByName: "Colossus", available: false });
    expect(view.tiles.slice(1).every((tile) => tile.available)).toBe(true);
    expect(selectRole(ROLE_CALL_START, view, "brawler")).toBe(ROLE_CALL_START);
  });
});

describe("the confirm flow", () => {
  const view = roleCallOf(
    pendingFor(
      1,
      roles.map((role) => role.id),
    ),
    roles,
    [],
    seats,
    nameOf,
  );

  test("choosing a role selects it but records nothing; Back clears it", () => {
    const state = selectRole(ROLE_CALL_START, view, "brawler");
    expect(state.selected).toBe("brawler");
    expect(backFromRole()).toEqual(ROLE_CALL_START);
    expect(confirmedRole(ROLE_CALL_START, view)).toBeNull();
  });

  test("only Confirm yields the answer", () => {
    expect(confirmedRole(selectRole(ROLE_CALL_START, view, "defender"), view)).toBe("defender");
  });

  test("the confirm words name the hero and the role", () => {
    expect(roleConfirmOf(view.tiles[0]!, "Colossus").title).toBe("Colossus will be the Brawler");
  });
});
