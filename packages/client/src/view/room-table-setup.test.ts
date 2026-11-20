import { describe, expect, it } from "vitest";
import {
  clearRoomTable,
  enterRoomSetup,
  keepRoomDraft,
  roomDraft,
  roomSetupActive,
  parseSeatLabel,
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
    expect(
      seatSpecsOf([
        { label: "Spider-Man - Justice", cardId: "01001a" },
        { label: "Ms. Marvel", cardId: null },
      ]),
    ).toEqual([
      { id: "s1", label: "Spider-Man - Justice|01001a" },
      { id: "s2", label: "Ms. Marvel" },
    ]);
    expect(parseSeatLabel("Spider-Man - Justice|01001a")).toEqual({ text: "Spider-Man - Justice", cardId: "01001a" });
    expect(parseSeatLabel("Ms. Marvel")).toEqual({ text: "Ms. Marvel", cardId: null });
    expect(seatSpecsOf([{ label: "x".repeat(200), cardId: "01001a" }])[0]!.label).toHaveLength(80);
    expect(seatLabelOf("Iron Man", "Aggression")).toBe("Iron Man - Aggression");
    expect(seatLabelOf("Iron Man", null)).toBe("Iron Man");
    expect(seatLabelOf("Spider-Man (Peter Parker)", "Spider-Man (Justice) — Core Set starter deck")).toBe(
      "Spider-Man (Justice) — Core Set starter deck",
    );
  });
});
