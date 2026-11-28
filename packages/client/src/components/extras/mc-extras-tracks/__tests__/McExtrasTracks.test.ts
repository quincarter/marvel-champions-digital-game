// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../../mc-extras-track/mc-extras-track.js";
import "../mc-extras-tracks.js";

afterEach(() => document.body.replaceChildren());

describe("mc-extras-tracks", () => {
  it("has a focus stop per song and relays a press as one mc-extras tile event", async () => {
    const el = document.createElement("mc-extras-tracks");
    el.tracks = [
      { id: "music:title", row: { leading: "▶", title: "Title", detail: "Title screen", open: true, active: false } },
      { id: "music:rhino", row: { leading: "▶", title: "Rhino", detail: "Beat Rhino", open: false, active: false } },
    ];
    document.body.append(el);
    await el.updateComplete;
    const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>("mc-extras-track")];
    expect(rows.map((row) => row.dataset.stop)).toEqual(["tile:music:title", "tile:music:rhino"]);
    const heard = vi.fn();
    el.addEventListener("mc-extras", (event) => heard(event.detail));
    rows[1]!.click();
    expect(heard).toHaveBeenCalledWith({ type: "tile", id: "music:rhino" });
  });
});
