import { describe, expect, it } from "vitest";
import {
  clampSeatCount,
  clearRoomTable,
  enterRoomSetup,
  isPlaceholderSeat,
  keepRoomDraft,
  placeholderSeats,
  roomBaseConfig,
  roomDraft,
  roomSeatCount,
  roomSetupActive,
  seatSpecsOf,
} from "./room-table-setup.js";
import type { SetupDraft } from "./setup-draft.js";

describe("room table setup", () => {
  it("is on from entering until the draft is kept", () => {
    clearRoomTable();
    expect(roomSetupActive()).toBe(false);
    enterRoomSetup(3);
    expect(roomSetupActive()).toBe(true);
    expect(roomSeatCount()).toBe(3);
    const draft = { seats: ["d1"] } as unknown as SetupDraft;
    keepRoomDraft(draft);
    expect(roomSetupActive()).toBe(false);
    expect(roomDraft()).toBe(draft);
    clearRoomTable();
    expect(roomDraft()).toBeNull();
  });
  it("keeps the seat count between one and four", () => {
    expect([0, 1, 2.6, 4, 9].map(clampSeatCount)).toEqual([1, 1, 3, 4, 4]);
    expect(seatSpecsOf(3)).toEqual([{ id: "s1" }, { id: "s2" }, { id: "s3" }]);
    expect(seatSpecsOf(7)).toHaveLength(4);
  });
  it("stands a placeholder in for each seat's deck", () => {
    expect(placeholderSeats(2)).toEqual(["room-seat-1", "room-seat-2"]);
    expect(isPlaceholderSeat("room-seat-1")).toBe(true);
    expect(isPlaceholderSeat("deck-7")).toBe(false);
  });
  it("builds the game's settings without players", () => {
    const draft = {
      scenarioId: "rhino",
      difficulty: "expert",
      modularSetIds: null,
      seats: [],
      firstPlayerIndex: null,
      seed: 5,
      setAsideModularSetIds: null,
      extraModularSetIds: [],
    } as unknown as SetupDraft;
    const base = roomBaseConfig(draft, 3, undefined, undefined);
    expect(base).not.toHaveProperty("players");
    expect(base).toMatchObject({ scenarioId: "rhino", difficulty: "expert", seed: 5 });
  });
});
