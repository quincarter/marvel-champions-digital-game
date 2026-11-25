import { describe, expect, it } from "vitest";
import { lobbyLayout } from "./room-lobby-layout.js";

const sizes: readonly [string, number, number][] = [
  ["se", 375, 667],
  ["pixel", 412, 924],
  ["tablet-portrait", 768, 1024],
  ["tablet", 1024, 768],
  ["desktop", 1440, 900],
  ["desktop-tall", 1440, 980],
  ["ultrawide", 2560, 1080],
];

describe("lobbyLayout", () => {
  it("picks tabs, stack and wide by width", () => {
    expect(lobbyLayout(375, 667, 56, "seats", 16).mode).toBe("tabs");
    expect(lobbyLayout(768, 1024, 56, "seats", 24).mode).toBe("stack");
    expect(lobbyLayout(1024, 768, 56, "seats", 24).mode).toBe("wide");
  });
  it.each(sizes)("keeps every panel on screen at %s", (_name, width, height) => {
    for (const active of ["seats", "settings", "chat"] as const) {
      const layout = lobbyLayout(width, height, 56, active, width < 500 ? 16 : 24);
      expect(Object.keys(layout.panels).length).toBeGreaterThan(0);
      for (const rect of Object.values(layout.panels)) {
        expect(rect.height).toBeGreaterThan(80);
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(layout.footer.y);
      }
    }
  });
  it("keeps a landscape tablet as it was: settings above chat on the right", () => {
    const layout = lobbyLayout(1024, 768, 56, "seats", 24);
    expect(layout.mode).toBe("wide");
    expect(layout.chatPill).toBeNull();
    const { settings, chat } = layout.panels;
    expect(chat!.x).toBe(settings!.x);
    expect(chat!.y).toBeGreaterThan(settings!.y + settings!.height - 1);
  });
  it("floats the chat on a desktop: settings take the right column, a closed chat is a pill", () => {
    const closed = lobbyLayout(1440, 980, 56, "seats", 24);
    expect(closed.mode).toBe("float");
    expect(closed.panels.chat).toBeUndefined();
    const { seats, settings } = closed.panels;
    const pill = closed.chatPill!;
    // The settings list ends above the pill, not behind it.
    expect(settings!.y + settings!.height).toBeLessThanOrEqual(pill.y);
    expect(seats!.x + seats!.width).toBeLessThan(pill.x);
    expect(pill.x + pill.width).toBe(settings!.x + settings!.width);
    expect(pill.y + pill.height).toBeLessThan(closed.footer.y);

    const open = lobbyLayout(1440, 980, 56, "seats", 24, undefined, undefined, undefined, true);
    expect(open.chatPill).toBeNull();
    const chat = open.panels.chat!;
    expect(open.panels.settings!.height).toBe(open.panels.seats!.height);
    expect(chat.x + chat.width).toBe(settings!.x + settings!.width);
    expect(chat.y + chat.height).toBeLessThan(open.footer.y);
    expect(chat.y).toBeGreaterThan(open.header.y + open.header.height);
  });
  it("lifts the open floating chat above a soft keyboard, on a touch tablet's 1366x1024", () => {
    const plain = lobbyLayout(1366, 1024, 56, "seats", 24, undefined, undefined, undefined, true);
    expect(plain.mode).toBe("float");
    const keyboard = 420;
    const lifted = lobbyLayout(1366, 1024, 56, "seats", 24, undefined, undefined, undefined, true, false, keyboard);
    const chat = lifted.panels.chat!;
    expect(chat.y + chat.height).toBeLessThanOrEqual(1024 - keyboard);
    expect(chat.y).toBeGreaterThan(lifted.header.y + lifted.header.height);
    expect(chat.height).toBeGreaterThanOrEqual(160);
    expect(chat.x).toBe(plain.panels.chat!.x);
    // With no keyboard the panel is where it was.
    expect(
      lobbyLayout(1366, 1024, 56, "seats", 24, undefined, undefined, undefined, true, false, 0).panels.chat,
    ).toEqual(plain.panels.chat);
  });
  it("swaps the pill for a card while the chat is in its own window, and the settings still end above it", () => {
    const popped = lobbyLayout(1440, 980, 56, "seats", 24, undefined, undefined, undefined, true, true);
    expect(popped.panels.chat).toBeUndefined();
    const card = popped.chatPill!;
    expect(card.width).toBeGreaterThan(lobbyLayout(1440, 980, 56, "seats", 24).chatPill!.width);
    expect(popped.panels.settings!.y + popped.panels.settings!.height).toBeLessThanOrEqual(card.y);
    expect(card.y + card.height).toBeLessThan(popped.footer.y);
  });
  it("puts seats, settings and chat in three columns on an ultrawide, with no floating chat", () => {
    const layout = lobbyLayout(2560, 1080, 56, "seats", 24);
    expect(layout.mode).toBe("triple");
    expect(layout.chatPill).toBeNull();
    const { seats, settings, chat } = layout.panels;
    expect(seats!.x + seats!.width).toBeLessThan(settings!.x);
    expect(settings!.x + settings!.width).toBeLessThan(chat!.x);
    expect(chat!.height).toBe(settings!.height);
    expect(lobbyLayout(1920, 1080, 56, "seats", 24).mode).toBe("float");
    expect(lobbyLayout(1600, 600, 56, "seats", 24).mode).toBe("float");
  });
  it("shows only the chosen panel on a phone", () => {
    expect(Object.keys(lobbyLayout(375, 667, 56, "chat", 16).panels)).toEqual(["chat"]);
    expect(Object.keys(lobbyLayout(768, 1024, 56, "chat", 24).panels).sort()).toEqual(["chat", "seats"]);
  });
});
