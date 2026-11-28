import { afterEach, describe, expect, it } from "vitest";
import "../mc-button/mc-button.js";
import "../mc-now-playing/mc-now-playing.js";
import "./mc-player-controls.js";
import { activations, tap } from "../../shared/test-tap.js";

afterEach(() => document.body.replaceChildren());

describe("mc-player-controls", () => {
  it("draws Shuffle, Next and Pause, dims the first two with a reason when no song is earned, and reports presses", async () => {
    const el = document.createElement("mc-player-controls");
    el.model = {
      shuffle: { key: "shuffle", label: "Shuffle", kind: "secondary", selected: true },
      next: { key: "next", label: "Next", kind: "secondary", disabled: "Earn a song first" },
      pause: { key: "pause", label: "Pause", kind: "secondary" },
      withSlider: false,
    };
    document.body.append(el);
    await el.updateComplete;
    expect(el.elementOf("shuffle")!.hasAttribute("selected")).toBe(true);
    expect(el.elementOf("next")!.hasAttribute("disabled")).toBe(true);
    const keys = activations(el);
    tap(el.elementOf("shuffle")!);
    tap(el.elementOf("next")!);
    tap(el.elementOf("pause")!);
    expect(keys).toEqual(["shuffle", "pause"]);
  });

  it("hangs a glyph under a control that has one", async () => {
    const el = document.createElement("mc-player-controls");
    el.model = {
      shuffle: { key: "shuffle", label: "S", kind: "secondary" },
      next: { key: "next", label: "N", kind: "secondary" },
      pause: { key: "pause", label: "P", kind: "secondary" },
      withSlider: true,
      glyphs: { pause: { specs: [{ kind: "key", label: "A" }], height: 20, ground: "paper", openness: 1 } },
    };
    document.body.append(el);
    await el.updateComplete;
    expect(el.hasAttribute("slider")).toBe(true);
    expect(el.shadowRoot!.querySelectorAll(".hang")).toHaveLength(1);
  });
});

describe("mc-now-playing", () => {
  it("says what plays and what plays it, and goes idle when nothing plays", async () => {
    const el = document.createElement("mc-now-playing");
    el.model = { status: "NOW PLAYING", title: "Main Title", detail: "Repeating this song" };
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".title")!.textContent).toBe("Main Title");
    expect(el.hasAttribute("idle")).toBe(false);
    el.model = { status: "NOTHING PLAYING", title: null, detail: null };
    await el.updateComplete;
    expect(el.hasAttribute("idle")).toBe(true);
    expect(el.shadowRoot!.querySelector(".title")).toBeNull();
  });
});
