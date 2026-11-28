// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-room-give-dialog.js";
import type { McRoomGiveDialog } from "../McRoomGiveDialog.js";
import type { RoomDialogEvent, RoomGiveModel } from "../mc-room-give-dialog.types.js";

afterEach(() => document.body.replaceChildren());

const person = (id: string, name: string) => ({
  id,
  button: { key: `give:${id}`, label: name, kind: "primary" as const },
});

const model = (over: Partial<RoomGiveModel> = {}): RoomGiveModel => ({
  heading: "Give Spider-Man to",
  empty: null,
  people: [person("p1", "Ava"), person("p2", "Ben")],
  cancel: { key: "cancel", label: "Cancel", kind: "secondary" },
  glyphs: {},
  ...over,
});

async function mount(m: RoomGiveModel): Promise<McRoomGiveDialog> {
  const el = document.createElement("mc-room-give-dialog") as McRoomGiveDialog;
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const keys = (el: McRoomGiveDialog): string[] =>
  [...el.shadowRoot!.querySelectorAll("mc-popup-button")].map(
    (b) => (b as unknown as { button: { key: string } }).button.key,
  );

describe("mc-room-give-dialog", () => {
  it("lists a button per person, then Cancel in the footer", async () => {
    const el = await mount(model());
    expect(keys(el)).toEqual(["give:p1", "give:p2", "cancel"]);
    expect(el.shadowRoot!.querySelector(".empty")).toBeNull();
  });

  it("says nobody is free instead of a list", async () => {
    const el = await mount(model({ people: [], empty: "Nobody is free to take it" }));
    expect(el.shadowRoot!.querySelector(".empty")!.textContent).toBe("Nobody is free to take it");
    expect(keys(el)).toEqual(["cancel"]);
  });

  it("raises one typed press with the pressed control's stop key", async () => {
    const el = await mount(model());
    const seen: RoomDialogEvent[] = [];
    el.addEventListener("mc-room-dialog", (event) => seen.push((event as CustomEvent<RoomDialogEvent>).detail));
    el.shadowRoot!.querySelectorAll("mc-popup-button")[1]!.dispatchEvent(
      new CustomEvent("mc-activate", { detail: { key: "give:p2" }, bubbles: true, composed: true }),
    );
    expect(seen).toEqual([{ type: "press", key: "give:p2" }]);
  });
});
