import { afterEach, describe, expect, it } from "vitest";
import "../mc-track-list.js";
import { activations, stop, tap } from "../../../shared/test-tap.js";

afterEach(() => document.body.replaceChildren());

describe("mc-track-list and mc-track-row", () => {
  it("draws a row per song, marks the playing one, and reports a tapped row by its key", async () => {
    const el = document.createElement("mc-track-list");
    el.model = {
      empty: "none",
      tracks: [
        { key: "song:a", title: "A", where: "Title screen", playing: true },
        { key: "song:b", title: "B", where: "Any battle", playing: false },
      ],
    };
    document.body.append(el);
    await el.updateComplete;
    const rows = el.shadowRoot!.querySelectorAll("mc-track-row");
    expect(rows).toHaveLength(2);
    for (const row of rows) await row.updateComplete;
    expect(stop(el, "song:a").hasAttribute("playing")).toBe(true);
    expect(stop(el, "song:b").shadowRoot!.querySelector(".where")!.textContent).toBe("Any battle");
    const keys = activations(el);
    tap(stop(el, "song:b"));
    expect(keys).toEqual(["song:b"]);
  });

  it("keeps the scroll position when the songs change", async () => {
    const el = document.createElement("mc-track-list");
    const tracks = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ key: `song:${i}`, title: `T${i}`, where: "", playing: i === 0 }));
    el.model = { empty: "", tracks: tracks(30) };
    document.body.append(el);
    await el.updateComplete;
    el.scroller!.scrollTop = 120;
    el.model = { empty: "", tracks: tracks(30).map((t, i) => ({ ...t, playing: i === 1 })) };
    await el.updateComplete;
    expect(el.scroller!.scrollTop).toBe(120);
  });
});
