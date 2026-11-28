// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-extras-player.js";
import type { ExtrasPlayerModel } from "../mc-extras-player.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<ExtrasPlayerModel> = {}): ExtrasPlayerModel => ({
  status: "NOW PLAYING",
  title: "BATTLE THEME",
  detail: "Repeating this song",
  shuffle: { key: "player:shuffle", label: "Shuffle", kind: "secondary" },
  next: { key: "player:next", label: "Next", kind: "secondary" },
  pause: { key: "player:pause", label: "Pause", kind: "secondary" },
  volume: null,
  ...over,
});

async function player(m: ExtrasPlayerModel, progress: (() => { seek: number; duration: number } | null) | null = null) {
  const el = document.createElement("mc-extras-player");
  el.model = m;
  el.progress = progress;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-extras-player", () => {
  it("shows the song with its clock and the share of the bar that is played", async () => {
    const el = await player(model(), () => ({ seek: 30, duration: 120 }));
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(root.querySelector(".title")!.textContent).toBe("BATTLE THEME");
    expect(root.querySelector(".clock")!.textContent).toContain("/");
    expect(root.querySelector<HTMLElement>(".fill")!.style.width).toBe("25%");
  });

  it("says what is not playing, with no title or bar", async () => {
    const el = await player(model({ status: "NOTHING PLAYING", title: null, detail: null }));
    expect(el.shadowRoot!.querySelector(".title")).toBeNull();
    expect(el.shadowRoot!.querySelector(".progress")).toBeNull();
    expect(el.shadowRoot!.querySelector(".block")!.hasAttribute("data-idle")).toBe(true);
  });

  it("raises one mc-extras event for a control and for the volume slider", async () => {
    const el = await player(model({ volume: { value: 70, label: "70%", stepLabels: ["-", "+"] } }));
    const heard = vi.fn();
    el.addEventListener("mc-extras", (event) => heard(event.detail));
    const controls = el.shadowRoot!.querySelector("mc-player-controls")!;
    controls.dispatchEvent(
      new CustomEvent("mc-activate", { detail: { key: "player:shuffle" }, bubbles: true, composed: true }),
    );
    const slider = el.shadowRoot!.querySelector("mc-volume-slider")!;
    slider.dispatchEvent(
      new CustomEvent("mc-slide", { detail: { share: 0.4, commit: true }, bubbles: true, composed: true }),
    );
    slider.dispatchEvent(new CustomEvent("mc-step", { detail: { direction: 1 }, bubbles: true, composed: true }));
    expect(heard.mock.calls.map(([detail]) => detail)).toEqual([
      { type: "player", action: "shuffle" },
      { type: "volume", share: 0.4, commit: true },
      { type: "volume-step", direction: 1 },
    ]);
  });
});
