import { describe, expect, it } from "vitest";
import type { CardId } from "@mc/content";
import type { InstanceId, PlayerId } from "@mc/engine";
import { encounterStripOf } from "./villain-encounter-strip.js";
import type { EncounterTracking } from "./villain-walkthrough.js";

const id = (value: string): InstanceId => value as InstanceId;
const me = "p1" as PlayerId;
const ally = "p2" as PlayerId;

const tracking: EncounterTracking = {
  dealt: [
    { instanceId: id("stampede"), playerId: me, duringReveal: false },
    { instanceId: id("hydra"), playerId: ally, duringReveal: false },
  ],
  revealed: [{ instanceId: id("stampede"), cardId: "01104" as CardId, playerId: me }],
  current: { instanceId: id("stampede"), cardId: "01104" as CardId, playerId: me },
};

const names: Record<string, string> = { stampede: "Stampede", hydra: "Hydra Mercenary", surge: "Shadow of the Past" };
const strip = (encounter: EncounterTracking, shown: (InstanceId | null)[]) =>
  encounterStripOf(
    encounter,
    shown,
    me,
    (instance) => names[instance as string] ?? "?",
    () => "Captain Marvel",
  );

describe("encounterStripOf", () => {
  it("counts the card being revealed against every card dealt (1 OF 2), the next one face down", () => {
    const result = strip(tracking, [null, null, id("stampede")]);
    expect(result.position).toEqual({ index: 1, total: 2 });
    expect(result.tiles.map((tile) => [tile.seat, tile.name, tile.status])).toEqual([
      ["YOU", "Stampede", "now"],
      ["CAPTAIN MARVEL", "Facedown", "next"],
    ]);
  });

  it("follows the screen, not the engine: a card the engine revealed but the screen has not shown stays face down", () => {
    const ahead: EncounterTracking = {
      ...tracking,
      revealed: [...tracking.revealed, { instanceId: id("hydra"), cardId: "01105" as CardId, playerId: ally }],
    };
    const result = strip(ahead, [id("stampede")]);
    expect(result.tiles[1]!.name).toBe("Facedown");
    expect(result.position).toEqual({ index: 1, total: 2 });
  });

  it("marks earlier cards done and counts a surge card dealt during the reveal", () => {
    const surged: EncounterTracking = {
      dealt: [...tracking.dealt, { instanceId: id("surge"), playerId: me, duringReveal: true }],
      revealed: [...tracking.revealed, { instanceId: id("hydra"), cardId: "01105" as CardId, playerId: ally }],
      current: null,
    };
    const result = strip(surged, [id("stampede"), id("stampede"), id("hydra")]);
    expect(result.tiles.map((tile) => tile.status)).toEqual(["done", "now", "next"]);
    expect(result.position).toEqual({ index: 2, total: 3 });
  });

  it("has no position before any reveal is shown", () => {
    expect(strip(tracking, [null]).position).toBeNull();
    expect(strip(tracking, []).tiles[0]!.status).toBe("next");
  });
});
