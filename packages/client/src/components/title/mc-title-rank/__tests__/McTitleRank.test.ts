// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-title-rank.js";
import type { TitleRankInput } from "../mc-title-rank.types.js";

afterEach(() => document.body.replaceChildren());

const input = (over: Partial<TitleRankInput> = {}): TitleRankInput => ({
  compact: false,
  up: false,
  label: "RANGO 3",
  title: "Compañero en prácticas",
  points: "1.250 pts",
  next: "300 para Vigilante del barrio",
  fraction: 0.4,
  summary: "Rango 3 de 9.",
  ...over,
});

async function rank(value: TitleRankInput) {
  const el = document.createElement("mc-title-rank");
  el.input = value;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-title-rank", () => {
  it("says the rank, the name, the points and the caption in words, with a bar filled to its share", async () => {
    const root = (await rank(input())).shadowRoot!;
    expect(root.querySelector(".label")!.textContent).toBe("RANGO 3");
    expect(root.querySelector(".title")!.textContent).toBe("Compañero en prácticas");
    expect(root.querySelector(".points")!.textContent).toBe("1.250 pts");
    expect(root.querySelector(".caption")!.textContent).toBe("300 para Vigilante del barrio");
    expect(root.querySelector(".fill")!.getAttribute("style")).toContain("* 0.4");
  });

  it("drops the name line when compact, and the bar while announcing a rank-up", async () => {
    const compact = await rank(input({ compact: true }));
    expect(compact.shadowRoot!.querySelector(".title")).toBeNull();
    const up = await rank(input({ up: true, points: null, next: null }));
    expect(up.hasAttribute("up")).toBe(true);
    expect(up.shadowRoot!.querySelector(".bar")).toBeNull();
    expect(up.shadowRoot!.querySelector(".points")).toBeNull();
  });

  it("names itself for assistive tech and raises its action on click()", async () => {
    const el = await rank(input());
    el.action = "rank-badge";
    expect(el.getAttribute("aria-label")).toBe("Rango 3 de 9.");
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push(e.detail.action));
    el.click();
    expect(seen).toEqual(["rank-badge"]);
  });
});
