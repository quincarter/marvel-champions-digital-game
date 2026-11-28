import { afterEach, describe, expect, it } from "vitest";
import "../../mc-button/mc-button.js";
import "../mc-music-player.js";
import { activations, stop, tap } from "../../../shared/test-tap.js";
import type { MusicPlayerModel } from "../mc-music-player.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<MusicPlayerModel> = {}): MusicPlayerModel => ({
  phone: false,
  panel: { x: 1000, y: 60, width: 380, height: 420 },
  icon: { x: 1290, y: 10, width: 44, height: 34 },
  title: "Música",
  earned: "2 de 221 ganadas",
  close: { key: "close", label: "✕", kind: "quiet" },
  nowPlaying: { status: "SONANDO AHORA", title: "Main Title", detail: "Repitiendo esta canción" },
  controls: {
    shuffle: { key: "shuffle", label: "Aleatorio: no", kind: "secondary" },
    next: { key: "next", label: "Siguiente ▸▸", kind: "secondary" },
    pause: { key: "pause", label: "❚❚ Pausa", kind: "secondary" },
    withSlider: true,
  },
  volume: { value: 70, label: "70%", stepLabels: ["−", "+"] },
  list: {
    tracks: [
      { key: "song:a", title: "Main Title", where: "Pantalla de título", playing: true },
      { key: "song:b", title: "To Battle We Assemble", where: "Cualquier batalla", playing: false },
    ],
    empty: "Aún no has ganado ninguna canción.",
  },
  foot: "Te faltan 219 por ganar.",
  ...over,
});

async function mount(m: MusicPlayerModel) {
  const el = document.createElement("mc-music-player");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  for (const child of el.shadowRoot!.querySelectorAll<HTMLElement & { updateComplete?: Promise<unknown> }>("*"))
    await child.updateComplete;
  return el;
}

describe("mc-music-player", () => {
  it("is made of now-playing, controls (with the slider), and the track list, in the panel's place", async () => {
    const el = await mount(model());
    const root = el.shadowRoot!;
    for (const tag of ["mc-now-playing", "mc-player-controls", "mc-volume-slider", "mc-track-list"])
      expect(root.querySelector(tag), tag).not.toBeNull();
    expect(el.style.getPropertyValue("--panel-x")).toBe("1000px");
    expect(el.style.getPropertyValue("--caret-x")).toBe("1312px");
    expect(root.querySelector(".caret")).not.toBeNull();
  });

  it("has no caret or slider on a phone's full-screen panel, and says so in an attribute", async () => {
    const el = await mount(model({ phone: true, volume: null, controls: { ...model().controls, withSlider: false } }));
    expect(el.hasAttribute("phone")).toBe(true);
    expect(el.shadowRoot!.querySelector(".caret")).toBeNull();
    expect(el.shadowRoot!.querySelector("mc-volume-slider")).toBeNull();
  });

  it("reports the close, shuffle, next, pause and song presses by key, and a tap outside the panel", async () => {
    const el = await mount(model());
    const keys = activations(el);
    for (const key of ["close", "shuffle", "next", "pause"]) tap(stop(el, key));
    tap(stop(el, "song:b"));
    tap(el.shadowRoot!.querySelector(".outside")!);
    expect(keys).toEqual(["close", "shuffle", "next", "pause", "song:b", "outside"]);
  });

  it("finds the slider's parts and the list's scroller for the focus route", async () => {
    const el = await mount(model());
    expect(stop(el, "volume-up")).not.toBeNull();
    expect(stop(el, "volume-down")).not.toBeNull();
    expect(el.volumeTrack).not.toBeNull();
    expect(el.scroller).not.toBeNull();
    expect(stop(el, "song:a").hasAttribute("playing")).toBe(true);
  });

  it("shows what to say when no song is earned yet, instead of a list", async () => {
    const el = await mount(model({ list: { tracks: [], empty: "Aún no has ganado ninguna canción." } }));
    const list = el.shadowRoot!.querySelector("mc-track-list")!;
    expect(list.shadowRoot!.querySelector(".empty")!.textContent).toBe("Aún no has ganado ninguna canción.");
    expect(el.scroller).toBeNull();
  });

  it("steps the volume with − and +, and reports a tap on the track as a committed slide", async () => {
    const el = await mount(model());
    const seen: string[] = [];
    el.addEventListener("mc-step", (event) => seen.push(`step ${(event as CustomEvent).detail.direction}`));
    el.addEventListener("mc-slide", (event) => {
      const d = (event as CustomEvent).detail;
      seen.push(`slide ${d.share.toFixed(2)} ${d.commit}`);
    });
    tap(stop(el, "volume-down"));
    tap(stop(el, "volume-up"));
    const track = el.volumeTrack!;
    track.getBoundingClientRect = () =>
      ({ left: 0, right: 118, top: 0, bottom: 40, width: 118, height: 40 }) as DOMRect;
    tap(track, { x: 9 + 50, y: 20 });
    expect(seen).toEqual(["step -1", "step 1", "slide 0.50 true"]);
  });
});
