// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-room-ask-dialog.js";
import type { McRoomAskDialog } from "../McRoomAskDialog.js";
import type { RoomAskModel, RoomDialogEvent } from "../mc-room-ask-dialog.types.js";

afterEach(() => document.body.replaceChildren());

const model: RoomAskModel = {
  heading: "Ask for a change",
  body: "Tell the host what you would like.",
  placeholder: "Your note",
  value: "more time",
  cancel: { key: "cancel", label: "Cancel", kind: "secondary" },
  send: { key: "send", label: "Send", kind: "primary" },
  glyphs: {},
};

async function mount(): Promise<McRoomAskDialog> {
  const el = document.createElement("mc-room-ask-dialog") as McRoomAskDialog;
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-room-ask-dialog", () => {
  it("shows its words, hands the draft to the field and names its three stops", async () => {
    const el = await mount();
    const dialog = el.shadowRoot!.querySelector("mc-dialog")!;
    expect((dialog as unknown as { heading: string }).heading).toBe("Ask for a change");
    expect(el.shadowRoot!.querySelector(".body")!.textContent).toBe("Tell the host what you would like.");
    expect(el.field!.value).toBe("more time");
    const stops = [...el.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")].map((p) => p.dataset.stop);
    expect(stops).toEqual(["field"]);
    const buttons = [...el.shadowRoot!.querySelectorAll("mc-popup-button")].map(
      (b) => (b as unknown as { button: { key: string } }).button.key,
    );
    expect(buttons).toEqual(["cancel", "send"]);
  });

  it("raises one typed press for the activated button and holds back the generic activation", async () => {
    const el = await mount();
    const seen: RoomDialogEvent[] = [];
    const generic: unknown[] = [];
    el.addEventListener("mc-room-dialog", (event) => seen.push((event as CustomEvent<RoomDialogEvent>).detail));
    el.addEventListener("mc-activate", (event) => generic.push(event));
    el.shadowRoot!.querySelectorAll("mc-popup-button")[1]!.dispatchEvent(
      new CustomEvent("mc-activate", { detail: { key: "send" }, bubbles: true, composed: true }),
    );
    expect(seen).toEqual([{ type: "press", key: "send" }]);
    expect(generic).toEqual([]);
  });
});
