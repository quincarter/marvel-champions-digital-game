import { describe, expect, it } from "vitest";
import type { RoomChatLine } from "../live/room-state.js";
import { chatChanged, chatMark } from "./room-chat-unread.js";

const line = (n: number, mine = false): RoomChatLine => ({ from: "p", text: `line ${n}`, at: 1000 + n, mine });
const lines = (from: number, count: number): RoomChatLine[] => Array.from({ length: count }, (_, i) => line(from + i));

describe("chatChanged", () => {
  it("draws the first time", () => {
    expect(chatChanged(null, [])).toBe(true);
  });

  it("is false for the same lines, even in a new array", () => {
    const chat = lines(0, 5);
    expect(chatChanged(chatMark(chat), [...chat])).toBe(false);
  });

  it("sees a line added below the cap", () => {
    expect(chatChanged(chatMark(lines(0, 5)), lines(0, 6))).toBe(true);
  });

  it("sees a new line once the room holds 200 and the length no longer moves", () => {
    const full = lines(0, 200);
    const next = [...full, line(200)].slice(-200);
    expect(next).toHaveLength(full.length);
    expect(chatChanged(chatMark(full), next)).toBe(true);
  });

  it("sees my own line at the cap", () => {
    const full = lines(0, 200);
    const next = [...full, line(200, true)].slice(-200);
    expect(chatChanged(chatMark(full), next)).toBe(true);
  });
});
