// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-track-list.js";
import type { TrackListItem } from "../mc-track-list.types.js";
import type { MusicEventDetail } from "../../shared/music-events.types.js";

afterEach(() => document.body.replaceChildren());

const tracks = (n: number, playing = 0): TrackListItem[] =>
  Array.from({ length: n }, (_, i) => ({
    key: `song:${i}`,
    title: `T${i}`,
    where: `Where ${i}`,
    playing: i === playing,
  }));

async function list(items: readonly TrackListItem[], empty = "none") {
  const el = document.createElement("mc-track-list");
  el.tracks = items;
  el.empty = empty;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-track-list", () => {
  it("draws a row per song, marks the playing one and names each row a focus stop", async () => {
    const el = await list(tracks(2));
    const rows = el.shadowRoot!.querySelectorAll<HTMLElement>("mc-track-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.getAttribute("data-stop")).toBe("song:0");
    expect(rows[0]!.hasAttribute("playing")).toBe(true);
    expect(rows[1]!.hasAttribute("playing")).toBe(false);
  });

  it("raises one mc-music press for a row's tap, and lets the row's own event go no further", async () => {
    const el = await list(tracks(2));
    const heard = vi.fn();
    const pressed = vi.fn();
    el.addEventListener("mc-music", (event) => heard(event.detail satisfies MusicEventDetail));
    document.body.addEventListener("mc-pressed", pressed);
    el.shadowRoot!.querySelectorAll<HTMLElement>("mc-track-row")[1]!.click();
    expect(heard).toHaveBeenCalledWith({ type: "press", key: "song:1" });
    expect(pressed).not.toHaveBeenCalled();
  });

  it("says what to say in place of the list while there are no songs", async () => {
    const el = await list([], "Earn a song first");
    expect(el.shadowRoot!.querySelector(".empty")!.textContent).toBe("Earn a song first");
    expect(el.scroller).toBeNull();
  });

  it("keeps the scroll position when the songs change", async () => {
    const el = await list(tracks(30));
    el.scroller!.scrollTop = 120;
    el.tracks = tracks(30, 1);
    await el.updateComplete;
    expect(el.scroller!.scrollTop).toBe(120);
  });
});
