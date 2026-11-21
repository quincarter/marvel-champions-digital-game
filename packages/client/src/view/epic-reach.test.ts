import { describe, expect, it } from "vitest";
import type { RemoteTarget } from "../live/room-state.js";
import { reachRows, remotePowerCommand } from "./epic-reach.js";

const target = (by: "attack" | "thwart"): RemoteTarget =>
  ({
    table: "t2",
    tableName: "South Table",
    card: { instanceId: "i9", cardId: "55041", by, remainingHitPoints: 12, threat: 5 },
  }) as unknown as RemoteTarget;

const legal = {
  actions: {
    kind: "turn",
    illegal: [],
    legal: [
      {
        action: { kind: "basicAttack", instanceId: "h1" },
        example: { type: "basicAttack", payment: [{ fromHand: "c1" }] },
      },
      { action: { kind: "basicThwart", instanceId: "h1" }, example: { type: "basicThwart" } },
      { action: { kind: "basicAttack", instanceId: "a1" }, example: { type: "basicAttack" } },
      { action: { kind: "endTurn" }, example: { type: "endTurn" } },
    ],
  },
} as never;

const names = (id: string): string => ({ h1: "Spider-Man", a1: "Ally" })[id] ?? id;

describe("what my pod can reach", () => {
  it("lists the characters the engine offers a basic attack for, not the client's guess", () => {
    const [row] = reachRows([target("attack")], legal, () => "The Mangog", names);
    expect(row).toMatchObject({ name: "The Mangog", tableName: "South Table", power: "attack", left: 12 });
    expect(row?.characters.map((c) => c.name)).toEqual(["Spider-Man", "Ally"]);
  });

  it("uses the thwart list and the card's threat for a scheme", () => {
    const [row] = reachRows([target("thwart")], legal, () => "Door", names);
    expect(row?.left).toBe(5);
    expect(row?.characters.map((c) => c.name)).toEqual(["Spider-Man"]);
  });

  it("has nobody when it is not a turn", () => {
    const [row] = reachRows([target("attack")], { actions: { kind: "gameOver" } } as never, () => "x", names);
    expect(row?.characters).toEqual([]);
  });

  it("sends a remotePower carrying the engine's own payment", () => {
    const t = target("attack");
    const [row] = reachRows([t], legal, () => "x", names);
    expect(remotePowerCommand("p1", row!, t, row!.characters[0]!)).toEqual({
      type: "remotePower",
      playerId: "p1",
      characterInstanceId: "h1",
      power: "attack",
      toGroupId: "t2",
      targetInstanceId: "i9",
      payment: [{ fromHand: "c1" }],
    });
  });
});
