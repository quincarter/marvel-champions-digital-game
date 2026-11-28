// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-music-player.js";
import type { MusicEventDetail } from "../../../../components/music/shared/music-events.types.js";
import type { MusicPlayerModel } from "../mc-music-player.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<MusicPlayerModel> = {}): MusicPlayerModel => ({
  phone: false,
  anchor: { x: 1290, y: 10, width: 44, height: 34 },
  title: "Música",
  earned: "2 de 221 ganadas",
  closeLabel: "✕",
  nowPlaying: { status: "SONANDO AHORA", song: "Main Title", detail: "Repitiendo esta canción" },
  controls: {
    shuffleLabel: "Aleatorio: no",
    nextLabel: "Siguiente",
    pauseLabel: "Pausa",
    shuffleOn: false,
    paused: false,
    reason: "",
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
  glyphs: {},
  ...over,
});

async function mount(m: MusicPlayerModel) {
  const el = document.createElement("mc-music-player");
  el.model = m;
  document.body.append(el);
  const settle = async (root: ParentNode): Promise<void> => {
    for (const child of root.querySelectorAll<HTMLElement & { updateComplete?: Promise<unknown> }>("*")) {
      await child.updateComplete;
      if (child.shadowRoot) await settle(child.shadowRoot);
    }
  };
  await el.updateComplete;
  await settle(el.shadowRoot!);
  return el;
}

/** The `[data-stop]` part with this key, through open shadow roots (what the client's focus route finds). */
function stop(root: ParentNode, key: string): HTMLElement {
  for (const element of root.querySelectorAll<HTMLElement>("*")) {
    if (element.dataset.stop === key) return element;
    if (element.shadowRoot) {
      try {
        return stop(element.shadowRoot, key);
      } catch {
        // not in this one
      }
    }
  }
  throw new Error(`no stop ${key}`);
}

function heard(el: HTMLElement): MusicEventDetail[] {
  const seen: MusicEventDetail[] = [];
  el.addEventListener("mc-music", (event) => seen.push(event.detail));
  return seen;
}

describe("mc-music-player", () => {
  it("is made of now-playing, controls (with the slider) and the track list, and hands each its words", async () => {
    const el = await mount(model());
    const root = el.shadowRoot!;
    for (const tag of ["mc-now-playing", "mc-player-controls", "mc-volume-slider", "mc-track-list"])
      expect(root.querySelector(tag), tag).not.toBeNull();
    expect(root.querySelector("mc-now-playing")!.song).toBe("Main Title");
    expect(el.style.getPropertyValue("--anchor-bottom")).toBe("44px");
    expect(el.style.getPropertyValue("--anchor-center")).toBe("1312px");
    expect(root.querySelector(".caret")).not.toBeNull();
  });

  it("has no caret or slider on a phone's full-screen panel, and says so in an attribute", async () => {
    const el = await mount(model({ phone: true, volume: null }));
    expect(el.hasAttribute("phone")).toBe(true);
    expect(el.shadowRoot!.querySelector(".caret")).toBeNull();
    expect(el.shadowRoot!.querySelector("mc-volume-slider")).toBeNull();
  });

  it("reports the close, shuffle, next, pause and song presses by key as one mc-music event", async () => {
    const el = await mount(model());
    const seen = heard(el);
    for (const key of ["close", "shuffle", "next", "pause"])
      stop(el.shadowRoot!, key).dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    stop(el.shadowRoot!, "song:b").click();
    expect(seen).toEqual(["close", "shuffle", "next", "pause", "song:b"].map((key) => ({ type: "press", key })));
  });

  it("turns the slider's step and slide into mc-music, and lets the slider's own events go no further", async () => {
    const el = await mount(model());
    const seen = heard(el);
    const raw: string[] = [];
    document.body.addEventListener("mc-step", () => raw.push("step"));
    document.body.addEventListener("mc-slide", () => raw.push("slide"));
    const slider = el.shadowRoot!.querySelector("mc-volume-slider")!;
    slider.dispatchEvent(
      new CustomEvent("mc-step", { detail: { key: "volume", direction: 1 }, bubbles: true, composed: true }),
    );
    slider.dispatchEvent(
      new CustomEvent("mc-slide", {
        detail: { key: "volume", share: 0.5, commit: true },
        bubbles: true,
        composed: true,
      }),
    );
    expect(seen).toEqual([
      { type: "step", direction: 1 },
      { type: "slide", share: 0.5, commit: true },
    ]);
    expect(raw).toEqual([]);
  });

  it("reports a tap beside the panel as an outside press, and finds the list scroller and slider track", async () => {
    const el = await mount(model());
    const seen = heard(el);
    const outside = el.shadowRoot!.querySelector(".outside")!;
    const init = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
    outside.dispatchEvent(new PointerEvent("pointerdown", init));
    outside.dispatchEvent(new PointerEvent("pointerup", init));
    expect(seen).toEqual([{ type: "press", key: "outside" }]);
    expect(el.scroller).not.toBeNull();
    expect(el.volumeTrack).not.toBeNull();
  });

  it("hangs a glyph hint on Close when it is given one", async () => {
    const el = await mount(
      model({ glyphs: { close: { specs: [], height: 20, ground: "paper", openness: 1, width: 40 } } }),
    );
    const close = el.shadowRoot!.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>(".close")!;
    await close.updateComplete;
    expect(close.shadowRoot!.querySelector("mc-glyph-hint")).not.toBeNull();
  });
});
