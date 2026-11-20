import { describe, expect, it } from "vitest";
import {
  clearRoomTable,
  enterRoomSetup,
  keepRoomDraft,
  roomDraft,
  roomSetupActive,
  seatLabelOf,
  seatSpecsOf,
} from "./room-table-setup.js";
import type { SetupDraft } from "./setup-draft.js";

describe("room table setup", () => {
  it("is on from entering until the draft is kept", () => {
    clearRoomTable();
    expect(roomSetupActive()).toBe(false);
    enterRoomSetup();
    expect(roomSetupActive()).toBe(true);
    const draft = { seats: ["d1"] } as unknown as SetupDraft;
    keepRoomDraft(draft);
    expect(roomSetupActive()).toBe(false);
    expect(roomDraft()).toBe(draft);
    clearRoomTable();
    expect(roomDraft()).toBeNull();
  });
  it("makes one seat per hero, labelled with hero and deck", () => {
    expect(seatSpecsOf(["Spider-Man - Justice", "Ms. Marvel"])).toEqual([
      { id: "s1", label: "Spider-Man - Justice" },
      { id: "s2", label: "Ms. Marvel" },
    ]);
    expect(seatLabelOf("Iron Man", "Aggression")).toBe("Iron Man - Aggression");
    expect(seatLabelOf("Iron Man", null)).toBe("Iron Man");
  });
});
