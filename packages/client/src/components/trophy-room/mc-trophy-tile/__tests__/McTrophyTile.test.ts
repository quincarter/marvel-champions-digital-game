// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-trophy-tile.js";
import type { McTrophyTile } from "../McTrophyTile.js";
import type { TrophyTileModel } from "../mc-trophy-tile.types.js";

afterEach(() => document.body.replaceChildren());

const model: TrophyTileModel = {
  kind: "achievement",
  id: "wins-10",
  name: "Ten wins",
  detail: "Win ten games.",
  state: "locked",
  stateLabel: "LOCKED",
  reward: "+25 points",
  progress: { current: 4, target: 10, fraction: 0.4 },
  progressLabel: "4 / 10",
};

async function mount(m: TrophyTileModel = model): Promise<McTrophyTile> {
  const el = document.createElement("mc-trophy-tile");
  el.model = m;
  el.stop = "row:wins-10";
  el.action = { type: "achievement", id: "wins-10" };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-trophy-tile", () => {
  it("shows the name, what it takes, the state, the reward and the progress", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector(".name")!.textContent).toBe("Ten wins");
    expect(root.querySelector(".detail")!.textContent).toBe("Win ten games.");
    expect(root.querySelector<HTMLElement & { label: string }>("mc-trophy-state")!.label).toBe("LOCKED");
    expect(root.querySelector(".reward")!.textContent).toBe("+25 points");
    expect(root.querySelector<HTMLElement & { fraction: number }>("mc-progress-bar")!.fraction).toBe(0.4);
    expect(root.querySelector(".count")!.textContent).toBe("4 / 10");
    expect(el.getAttribute("state")).toBe("locked");
  });

  it("is an earned ink card with no bar when nothing is counted", async () => {
    const el = await mount({
      ...model,
      state: "earned",
      stateLabel: "EARNED",
      progress: null,
      progressLabel: "",
      reward: "",
    });
    expect(el.hasAttribute("earned")).toBe(true);
    expect(el.shadowRoot!.querySelector("mc-progress-bar")).toBeNull();
    expect(el.shadowRoot!.querySelector(".reward")).toBeNull();
  });

  it("raises its action when the route clicks it", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-pressed", (event) => heard((event as CustomEvent).detail));
    el.click();
    expect(heard).toHaveBeenCalledWith({ action: { type: "achievement", id: "wins-10" }, hold: false });
  });
});
