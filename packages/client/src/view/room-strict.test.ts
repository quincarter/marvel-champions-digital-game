import { afterEach, describe, expect, test } from "vitest";
import { roomCheatsOf, roomStrictOf, roomUndoOffOf, strictReason, undoOffReason } from "./room-strict.js";
import { setSeatContextSource, setSeatGameUp } from "./seat-context.js";

describe("roomStrictOf", () => {
  test("only a strict room's game is strict", () => {
    expect(roomStrictOf({ roomPlayMode: "strict" })).toBe(true);
    expect(roomStrictOf({ roomPlayMode: "host" })).toBe(false);
    expect(roomStrictOf({})).toBe(false);
    expect(roomStrictOf(null)).toBe(false);
  });

  test("the reason is one line", () => {
    expect(strictReason()).toBe("Strict rules: the host turned this off");
  });
});

describe("the room's Undo setting", () => {
  test("Off, like Strict, takes Undo away; Host only and Ask do not; no room changes nothing", () => {
    expect(roomUndoOffOf({ roomPlayMode: "strict" })).toBe(true);
    expect(roomUndoOffOf({ roomPlayMode: "host", roomUndo: "off" })).toBe(true);
    expect(roomUndoOffOf({ roomPlayMode: "host", roomUndo: "host" })).toBe(false);
    expect(roomUndoOffOf({ roomPlayMode: "host", roomUndo: "ask" })).toBe(false);
    expect(roomUndoOffOf({})).toBe(false);
    expect(roomUndoOffOf(null)).toBe(false);
  });

  test("the reason names Strict rules or the host's setting", () => {
    expect(undoOffReason({ roomPlayMode: "strict" })).toBe("Strict rules: the host turned this off");
    expect(undoOffReason({ roomPlayMode: "host" })).toBe("The host turned Undo off");
  });
});

describe("roomCheatsOf", () => {
  const mine = { allowManualAdjust: true, undoPastTurn: "allow" as const };
  test("a game outside a room takes this device's settings as they are", () => {
    expect(roomCheatsOf(mine, {})).toEqual({ manualAdjust: true, undoPastTurn: "allow" });
    expect(roomCheatsOf(mine, null)).toEqual({ manualAdjust: true, undoPastTurn: "allow" });
  });

  test("cheats off in the room turns the host's cheats off", () => {
    const config = { room: "r", roomPlayMode: "host" as const, roomUndo: "ask" as const };
    expect(roomCheatsOf(mine, config)).toEqual({ manualAdjust: false, undoPastTurn: "off" });
  });

  test("cheats on: Manual adjust needs Host control, Undo past a turn needs Undo not Off", () => {
    const on = { room: "r", roomCheats: true };
    expect(roomCheatsOf(mine, { ...on, roomPlayMode: "host", roomUndo: "host" })).toEqual({
      manualAdjust: true,
      undoPastTurn: "allow",
    });
    expect(roomCheatsOf(mine, { ...on, roomPlayMode: "host", roomUndo: "off" })).toEqual({
      manualAdjust: true,
      undoPastTurn: "off",
    });
    expect(roomCheatsOf(mine, { ...on, roomPlayMode: "strict", roomUndo: "off" })).toEqual({
      manualAdjust: false,
      undoPastTurn: "off",
    });
    expect(roomCheatsOf({ ...mine, allowManualAdjust: false }, { ...on, roomPlayMode: "host" }).manualAdjust).toBe(
      false,
    );
  });
});

describe("roomCheatsOf on a game that names only its play mode", () => {
  test("is still a room's game: cheats off turns the settings off", () => {
    const mine = { allowManualAdjust: true, undoPastTurn: "allow" as const };
    expect(roomCheatsOf(mine, { roomPlayMode: "strict" })).toEqual({ manualAdjust: false, undoPastTurn: "off" });
  });
});

describe("a seated guest's cheats (#904)", () => {
  afterEach(() => {
    setSeatContextSource(null);
    setSeatGameUp(false);
  });

  test("never apply to a room game, whatever this device's Settings say", () => {
    setSeatContextSource(() => ({ role: "guest" }) as never);
    setSeatGameUp(true);
    expect(roomCheatsOf({ allowManualAdjust: true, undoPastTurn: "allow" }, null)).toEqual({
      manualAdjust: false,
      undoPastTurn: "off",
    });
  });
});
