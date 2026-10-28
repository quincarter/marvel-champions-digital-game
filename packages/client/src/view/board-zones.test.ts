import { describe, expect, it } from "vitest";
import type { InstanceId } from "@mc/engine";
import type { BoardModel } from "./board-model.js";
import type { FocusTarget } from "./focus.js";
import {
  rowScrollOf,
  scrollTargetOf,
  tabOfStop,
  tableCardsOf,
  zoneJump,
  zoneOfTarget,
  type ZoneMembers,
  type ZoneStop,
} from "./board-zones.js";

const id = (value: string): InstanceId => value as InstanceId;
const card = (value: string): FocusTarget => ({ kind: "card", instanceId: id(value) });
const basic = (action: "attack" | "endTurn"): FocusTarget => ({ kind: "basic", action });

const members: ZoneMembers = {
  hand: new Set([id("h1"), id("h2")]),
  playArea: new Set([id("me"), id("ally")]),
  villain: new Set([id("rhino"), id("scheme")]),
  threat: new Set([id("scheme")]),
};

// The idle route puts the hand first, then cards in play with an ability, then the bar.
const full: readonly FocusTarget[] = [
  card("h1"),
  card("h2"),
  card("ally"),
  card("rhino"),
  basic("attack"),
  { kind: "undo" },
  basic("endTurn"),
];

describe("zoneOfTarget", () => {
  it("names the zone of a card by the cards each zone holds", () => {
    expect(zoneOfTarget(card("h2"), members)).toBe("hand");
    expect(zoneOfTarget(card("ally"), members)).toBe("playArea");
    expect(zoneOfTarget(card("scheme"), members)).toBe("villain");
    expect(zoneOfTarget(card("teammate"), members)).toBeNull();
  });

  it("reads the discard pile on the hand row as the hand's", () => {
    expect(zoneOfTarget({ kind: "discard" }, members)).toBe("hand");
  });

  it("puts the bar's controls and a decision's controls with the action bar", () => {
    for (const target of [basic("attack"), { kind: "undo" }, { kind: "cancel" }, { kind: "confirm" }] as const) {
      expect(zoneOfTarget(target, members)).toBe("actionBar");
    }
    expect(zoneOfTarget({ kind: "teamUp", pairKey: "a|b" }, members)).toBeNull();
  });
});

describe("zoneJump", () => {
  it("steps hand, play area, villain, action bar and wraps", () => {
    let focus: FocusTarget | null = card("h1");
    const seen: string[] = [];
    for (let hop = 0; hop < 5; hop += 1) {
      const stop: ZoneStop = zoneJump(full, members, focus, 1)!;
      seen.push(stop.zone);
      focus = stop.target;
    }
    expect(seen).toEqual(["playArea", "villain", "actionBar", "hand", "playArea"]);
  });

  it("lands on the first stop of a zone, from anywhere inside the one before", () => {
    expect(zoneJump(full, members, card("h2"), 1)!.target).toEqual(card("ally"));
    expect(zoneJump(full, members, { kind: "undo" }, 1)!.target).toEqual(card("h1"));
  });

  it("steps backward and wraps the other way", () => {
    expect(zoneJump(full, members, card("h1"), -1)!.zone).toBe("actionBar");
    expect(zoneJump(full, members, card("rhino"), -1)!.zone).toBe("playArea");
  });

  it("starts from the first zone going forward and the last going back when nothing is focused", () => {
    expect(zoneJump(full, members, null, 1)!.zone).toBe("hand");
    expect(zoneJump(full, members, null, -1)!.zone).toBe("actionBar");
    expect(zoneJump(full, members, card("teammate"), 1)!.zone).toBe("hand");
  });

  it("skips a zone with no stop on the route", () => {
    const noHand = full.filter((target) => zoneOfTarget(target, members) !== "hand");
    expect(zoneJump(noHand, members, { kind: "undo" }, 1)!.zone).toBe("playArea");
    const barOnly: readonly FocusTarget[] = [basic("attack")];
    expect(zoneJump(barOnly, members, basic("attack"), 1)!.zone).toBe("actionBar");
  });

  it("is null when the route has no zoned stop", () => {
    expect(zoneJump([], members, null, 1)).toBeNull();
    expect(zoneJump([{ kind: "teamUp", pairKey: "x" }], members, null, 1)).toBeNull();
  });
});

describe("tabOfStop", () => {
  it("sends the play area to Me, schemes to Threat, other villain cards to Enemies, the rest nowhere", () => {
    expect(tabOfStop({ zone: "playArea", target: card("ally") }, members)).toBe("me");
    expect(tabOfStop({ zone: "villain", target: card("scheme") }, members)).toBe("threat");
    expect(tabOfStop({ zone: "villain", target: card("rhino") }, members)).toBe("enemies");
    expect(tabOfStop({ zone: "hand", target: card("h1") }, members)).toBeNull();
    expect(tabOfStop({ zone: "actionBar", target: basic("attack") }, members)).toBeNull();
  });
});

const both = { hand: true, playArea: true };

describe("scrollTargetOf", () => {
  it("falls back to the table when the focused row has nothing to scroll", () => {
    expect(scrollTargetOf(false, card("h1"), members, { hand: false, playArea: true })).toBe("table");
    expect(scrollTargetOf(false, card("ally"), members, { hand: true, playArea: false })).toBe("table");
  });

  it("scrolls the log once it is focused, then the row focus is in, else the table", () => {
    expect(scrollTargetOf(true, card("h1"), members, both)).toBe("log");
    expect(scrollTargetOf(false, card("h1"), members, both)).toBe("hand");
    expect(scrollTargetOf(false, card("ally"), members, both)).toBe("playArea");
    expect(scrollTargetOf(false, card("rhino"), members, both)).toBe("table");
    expect(scrollTargetOf(false, basic("attack"), members, both)).toBe("table");
    expect(scrollTargetOf(false, null, members, both)).toBe("table");
  });

  it("scrolls a full play area row on a sideways push the focused region cannot take", () => {
    expect(scrollTargetOf(false, card("rhino"), members, both, true)).toBe("playArea");
    expect(scrollTargetOf(false, basic("attack"), members, both, true)).toBe("playArea");
    expect(scrollTargetOf(false, null, members, both, true)).toBe("playArea");
    expect(scrollTargetOf(false, card("h1"), members, { hand: false, playArea: true }, true)).toBe("playArea");
    // The hand row and the log keep the stick while they hold focus, and a row that fits leaves it to the table.
    expect(scrollTargetOf(false, card("h1"), members, both, true)).toBe("hand");
    expect(scrollTargetOf(true, card("rhino"), members, both, true)).toBe("log");
    expect(scrollTargetOf(false, card("rhino"), members, { hand: true, playArea: false }, true)).toBe("table");
  });
});

describe("rowScrollOf", () => {
  it("takes the stick's dominant axis", () => {
    expect(rowScrollOf(5, 2)).toBe(5);
    expect(rowScrollOf(-1, 4)).toBe(4);
    expect(rowScrollOf(0, 0)).toBe(0);
  });
});

describe("tableCardsOf", () => {
  const chip = (value: string) => ({ instanceId: id(value) });
  const host = (value: string, attached: readonly string[] = []) => ({
    instanceId: id(value),
    attachments: attached.map(chip),
  });
  const model = {
    me: host("me", ["armor"]),
    myPlayArea: [host("ally", ["webs"])],
    villains: [{ panel: host("rhino", ["tough"]) }],
    minions: [host("goon", ["gun"])],
    environments: [host("env")],
    mainScheme: host("main", ["focused"]),
    extraMainSchemes: [],
    sideSchemes: [host("side")],
    scenarioPlayAreas: [
      { neutral: true, cards: [{ instanceId: id("pod"), panel: host("pod") }] },
      { neutral: false, cards: [{ instanceId: id("area"), panel: host("area") }] },
    ],
    team: [{ identityInstanceId: id("mate") }],
  } as unknown as BoardModel;

  it("lists every card on the table, each host followed by what is attached to it", () => {
    const table = tableCardsOf(model);
    expect(table.playArea).toEqual([id("me"), id("armor"), id("ally"), id("webs")]);
    expect(table.villain).toEqual(
      ["rhino", "tough", "goon", "gun", "env", "main", "focused", "side", "pod", "area"].map(id),
    );
    expect(table.threat).toEqual(["main", "focused", "side", "pod"].map(id));
    expect(table.team).toEqual([id("mate")]);
  });
});
