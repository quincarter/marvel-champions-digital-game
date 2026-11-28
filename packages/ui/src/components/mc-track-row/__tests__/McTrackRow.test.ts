// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "../mc-track-row.js";
import type { PressDetail } from "../../../shared/press/press.types.js";

afterEach(() => document.body.replaceChildren());

async function row(playing = false) {
  const el = document.createElement("mc-track-row");
  el.heading = "Main Title";
  el.where = "Title screen";
  el.stop = "song:main";
  el.action = "song:main";
  el.playing = playing;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-track-row", () => {
  it("draws a play triangle, the title and where it plays", async () => {
    const el = await row();
    const root = el.shadowRoot!;
    expect(root.querySelector(".disc")!.textContent).toBe("▶");
    expect(root.querySelector(".heading")!.textContent).toBe("Main Title");
    expect(root.querySelector(".where")!.textContent).toBe("Title screen");
    expect(el.getAttribute("data-stop")).toBe("song:main");
  });

  it("shows a note on its disc and reflects playing while it is the song playing", async () => {
    const el = await row(true);
    expect(el.hasAttribute("playing")).toBe(true);
    expect(el.shadowRoot!.querySelector(".disc")!.textContent).toBe("♪");
  });

  it("raises mc-pressed with its action on a tap and on the focus route click", async () => {
    const el = await row();
    const heard = vi.fn();
    el.addEventListener("mc-pressed", (event) => heard(event.detail satisfies PressDetail));
    const init = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
    el.dispatchEvent(new PointerEvent("pointerdown", init));
    el.dispatchEvent(new PointerEvent("pointerup", init));
    el.click();
    expect(heard).toHaveBeenCalledTimes(2);
    expect(heard).toHaveBeenCalledWith({ action: "song:main", hold: false });
  });
});
