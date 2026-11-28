import { afterEach, describe, expect, it } from "vitest";
import "./mc-promo-panel.js";
import type { PromoPanelModel } from "./mc-promo-panel.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<PromoPanelModel> = {}): PromoPanelModel => ({
  available: true,
  band: { x: 0, y: 0, width: 300, height: 60 },
  title: { rect: { x: 12, y: 8, width: 200, height: 44 }, text: "PLAY\nONLINE", size: 28, lines: 2 },
  live: { rect: { x: 220, y: 20, width: 70, height: 22 }, text: "12 live", align: "right" },
  pitch: { rect: { x: 12, y: 70, width: 276, height: 36 }, text: "Play with friends over the internet.", size: 12 },
  seats: { x: 12, y: 112, width: 276, height: 40 },
  buttons: [{ key: "host", label: "Host", kind: "primary", rect: { x: 12, y: 160, width: 130, height: 40 } }],
  ...over,
});

async function mount(m: PromoPanelModel | null) {
  const el = document.createElement("mc-promo-panel");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-promo-panel", () => {
  it("draws the title on its halftone band, the live chip with its count, the pitch, the seats and the buttons", async () => {
    const el = await mount(model());
    const root = el.shadowRoot!;
    expect(root.querySelector(".title")!.textContent).toBe("PLAY\nONLINE");
    expect(root.querySelectorAll(".band svg circle").length).toBeGreaterThan(10);
    expect(root.querySelector(".chip")!.textContent!.trim()).toBe("12 live");
    expect(root.querySelector(".pitch")!.textContent).toBe("Play with friends over the internet.");
    expect(root.querySelectorAll("svg.seats circle")).toHaveLength(4);
    expect(el.elementOf("host")).not.toBeNull();
    expect(el.hasAttribute("unavailable")).toBe(false);
  });

  it("dims when the feature is unavailable (offline), thinning the halftone, and leaves out a missing chip and seats", async () => {
    const el = await mount(model({ available: false, live: null, seats: null }));
    expect(el.hasAttribute("unavailable")).toBe(true);
    expect(el.shadowRoot!.querySelector(".chip")).toBeNull();
    expect(el.shadowRoot!.querySelector("svg.seats")).toBeNull();
    expect(el.shadowRoot!.querySelector(".band svg")!.getAttribute("fill-opacity")).toBe("0.1");
  });

  it("aligns the live chip to the left or to the right of its rect, and draws nothing without a model", async () => {
    const left = await mount(
      model({ live: { rect: { x: 20, y: 20, width: 70, height: 22 }, text: "3 live", align: "left" } }),
    );
    expect(left.shadowRoot!.querySelector(".chip")!.getAttribute("style")).toContain("left:20px");
    const right = await mount(model());
    expect(right.shadowRoot!.querySelector(".chip")!.getAttribute("style")).toContain("right:calc(100% - 290px)");
    expect((await mount(null)).shadowRoot!.querySelector(".ground")).toBeNull();
  });
});
