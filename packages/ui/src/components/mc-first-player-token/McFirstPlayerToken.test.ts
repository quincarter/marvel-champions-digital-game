import { afterEach, describe, expect, it, vi } from "vitest";
import "./mc-first-player-token.js";
import type { TokenFlight } from "./mc-first-player-token.types.js";

afterEach(() => document.body.replaceChildren());

const flight: TokenFlight = {
  durationMs: 600,
  frames: [
    { x: -200, y: 0, lift: 0, scaleX: 1, scaleY: 1, angle: 0 },
    { x: 0, y: 0, lift: 0, scaleX: 1, scaleY: 1, angle: 0 },
  ],
};

async function mount() {
  const el = document.createElement("mc-first-player-token");
  el.src = "/assets/first-player-token.svg";
  document.body.append(el);
  await el.updateComplete;
  const animate = vi.fn(() => ({ cancel: vi.fn(), playState: "running" }) as unknown as Animation);
  for (const part of el.shadowRoot!.querySelectorAll<HTMLElement>(".token, .shadow")) part.animate = animate;
  return { el, animate };
}

describe("mc-first-player-token", () => {
  it("shows the token art and says what it is", async () => {
    const { el } = await mount();
    expect(el.shadowRoot!.querySelector("img")!.getAttribute("src")).toBe("/assets/first-player-token.svg");
    expect(el.shadowRoot!.querySelector(".token")!.getAttribute("aria-label")).toBe("1st");
  });

  it("falls back to a disc with its words when the art does not load", async () => {
    const { el } = await mount();
    el.shadowRoot!.querySelector("img")!.dispatchEvent(new Event("error"));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".disc")!.textContent).toBe("1st");
  });

  it("flies the token and its shadow from the old place with transform keyframes", async () => {
    const { el, animate } = await mount();
    el.fly(flight, false);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate).toHaveBeenCalledWith(expect.any(Array), { duration: 600, easing: "linear" });
    expect(el.flying).toBe(true);
  });

  it("only fades in at the new place when less motion is asked for", async () => {
    const { el, animate } = await mount();
    el.fly(flight, true);
    expect(animate).toHaveBeenCalledTimes(2);
    for (const [frames] of animate.mock.calls) expect(frames).toEqual([{ opacity: 0 }, { opacity: 1 }]);
  });

  it("places without a flight when there is none to play", async () => {
    const { el, animate } = await mount();
    el.fly(null, false);
    expect(animate).not.toHaveBeenCalled();
  });
});
