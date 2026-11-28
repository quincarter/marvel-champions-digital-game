// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-extras-track.js";

afterEach(() => document.body.replaceChildren());

describe("mc-extras-track", () => {
  it("draws its row and, pressed by the focus route's click, raises its action", async () => {
    const el = document.createElement("mc-extras-track");
    el.model = { leading: "▶", title: "Title theme", detail: "Title screen", open: true, active: false };
    el.action = { type: "tile", id: "music:title" };
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-list-row")).not.toBeNull();
    const heard = vi.fn();
    el.addEventListener("mc-pressed", (event) => heard(event.detail));
    el.click();
    expect(heard).toHaveBeenCalledWith({ action: { type: "tile", id: "music:title" }, hold: false });
  });
});
