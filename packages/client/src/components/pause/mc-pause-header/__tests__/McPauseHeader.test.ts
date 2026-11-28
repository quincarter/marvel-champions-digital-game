// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pause-header";
import type { PauseHeaderInput } from "../../pause.types";
import type { PauseEventDetail } from "../../shared/pause-events.types";

afterEach(() => document.body.replaceChildren());

const input = (over: Partial<PauseHeaderInput> = {}): PauseHeaderInput => ({
  title: "Paused",
  status: "Round 3 · player phase · Spider-Man",
  blind: [],
  note: "",
  close: null,
  ...over,
});

async function header(i: PauseHeaderInput, mode: "wide" | "phone" = "wide") {
  const el = document.createElement("mc-pause-header");
  el.input = i;
  el.mode = mode;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-pause-header", () => {
  it("shows the title and the status, and the blind sheet and the note only when there are some", async () => {
    const el = await header(input());
    const root = el.shadowRoot!;
    expect(root.querySelector(".title")!.textContent).toBe("Paused");
    expect(root.querySelector(".status")!.textContent).toContain("Round 3");
    expect(root.querySelector(".blind")).toBeNull();
    expect(root.querySelector(".note")).toBeNull();
    el.input = input({ blind: ["Stage 1: hidden"], note: "Adjusted" });
    await el.updateComplete;
    expect(root.querySelectorAll(".blind li").length).toBe(1);
    expect(root.querySelector(".note")!.textContent).toBe("Adjusted");
  });

  it("has a close stop only when it is given a close button, and says close when it is pressed", async () => {
    const wide = await header(input());
    expect(wide.shadowRoot!.querySelector('[data-stop="close"]')).toBeNull();
    const el = await header(input({ close: { label: "✕" } }), "phone");
    const seen: PauseEventDetail[] = [];
    el.addEventListener("mc-pause", (e) => seen.push(e.detail));
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="close"]')!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(seen).toEqual([{ type: "menu", id: "close" }]);
  });
});
