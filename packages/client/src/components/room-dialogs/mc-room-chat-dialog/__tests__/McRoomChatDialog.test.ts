// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-room-chat-dialog.js";
import type { McRoomChatDialog } from "../McRoomChatDialog.js";
import type { RoomChatDialogModel, RoomChatEvent, RoomDialogEvent } from "../mc-room-chat-dialog.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<RoomChatDialogModel> = {}): RoomChatDialogModel => ({
  heading: "Room chat",
  lines: { lines: [{ id: "0", who: "Ava", text: "hi", mine: false }], empty: "No messages", toEnd: 1 },
  value: "draft",
  placeholder: "Say something",
  sendLabel: "Send",
  close: { key: "close", label: "Close", kind: "secondary" },
  glyphs: {},
  ...over,
});

async function mount(m: RoomChatDialogModel): Promise<McRoomChatDialog> {
  const el = document.createElement("mc-room-chat-dialog") as McRoomChatDialog;
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-room-chat-dialog", () => {
  it("composes the lines, the compose row with the dialog's stop names, and Close", async () => {
    const el = await mount(model());
    const lines = el.shadowRoot!.querySelector("mc-chat-lines")!;
    await (lines as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(lines.shadowRoot!.querySelector(".line")!.textContent!.trim()).toBe("Ava: hi");
    const compose = el.compose!;
    expect(compose.fieldStop).toBe("field");
    expect(compose.sendStop).toBe("send");
    expect(compose.value).toBe("draft");
  });

  it("keeps the same compose element when a line arrives", async () => {
    const el = await mount(model());
    const before = el.compose;
    el.model = model({ lines: { lines: [], empty: "No messages", toEnd: 2 } });
    await el.updateComplete;
    expect(el.compose).toBe(before);
  });

  it("raises a typed press for Close and lets the compose row's send through", async () => {
    const el = await mount(model());
    const presses: RoomDialogEvent[] = [];
    const sends: RoomChatEvent[] = [];
    el.addEventListener("mc-room-dialog", (event) => presses.push((event as CustomEvent<RoomDialogEvent>).detail));
    el.addEventListener("mc-room-chat", (event) => sends.push((event as CustomEvent<RoomChatEvent>).detail));
    el.shadowRoot!.querySelector("mc-popup-button")!.dispatchEvent(
      new CustomEvent("mc-activate", { detail: { key: "close" }, bubbles: true, composed: true }),
    );
    el.compose!.dispatchEvent(
      new CustomEvent("mc-room-chat", { detail: { type: "send", via: "button" }, bubbles: true, composed: true }),
    );
    expect(presses).toEqual([{ type: "press", key: "close" }]);
    expect(sends).toEqual([{ type: "send", via: "button" }]);
  });
});
