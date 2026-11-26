import { describe, expect, it } from "vitest";
import { layoutChatList } from "./room-chat-layout.js";

/** A stand-in for the DOM measure: 8 px a character, 16 px a line, breaking anywhere (overflow-wrap: anywhere). */
const measureAt = (width: number) => (text: string) => Math.max(1, Math.ceil((text.length * 8) / width)) * 16;

describe("layoutChatList", () => {
  it("never extends the list past the space it was given, at 375 wide with a long unbroken message", () => {
    const textWidth = 375 - 24 - 32;
    const url = `https://example.com/${"a".repeat(900)}`;
    const layout = layoutChatList(
      [
        { text: "hi", name: "Ana" },
        { text: url, mine: true },
      ],
      120,
      measureAt(textWidth),
    );
    expect(layout.viewHeight).toBe(120);
    expect(layout.contentHeight).toBeGreaterThan(layout.viewHeight);
    // The overflow scrolls inside the region: the newest line ends at the content's bottom.
    const last = layout.lines[layout.lines.length - 1]!;
    expect(last.y + last.height).toBe(layout.contentHeight);
    expect(layout.lines[0]!.y).toBe(0);
  });

  it("keeps every line (oldest first) and names a line that isn't mine", () => {
    const layout = layoutChatList(
      [
        { text: "a", name: "Ana" },
        { text: "b", mine: true },
      ],
      200,
      () => 16,
    );
    expect(layout.lines.map((line) => line.text)).toEqual(["Ana: a", "b"]);
    expect(layout.contentHeight).toBe(200);
  });

  it("gives a negative space no height", () => {
    expect(layoutChatList([], -30, () => 16).viewHeight).toBe(0);
  });
});
