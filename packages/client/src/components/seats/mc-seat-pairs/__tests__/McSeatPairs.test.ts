// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-seat-pairs.js";
import type { McSeatPairs } from "../McSeatPairs.js";
import type { SeatPairModel } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

const pair = (a: number, b: number, label: string, picture: SeatPairModel["picture"] = null): SeatPairModel => ({
  seats: [a, b],
  label,
  picture,
});

async function mount(pairs: readonly SeatPairModel[]): Promise<McSeatPairs> {
  const element = document.createElement("mc-seat-pairs") as McSeatPairs;
  element.pairs = pairs;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-seat-pairs", () => {
  it("draws nothing without a pair", async () => {
    const element = await mount([]);
    expect(element.shadowRoot!.querySelector(".strip")).toBeNull();
  });

  it("draws one bracket per pair over the seats it joins, each with its words", async () => {
    const element = await mount([pair(1, 2, "Team-Up: Colossus and Shadowcat"), pair(2, 4, "Team-Up: A and B")]);
    const brackets = [...element.shadowRoot!.querySelectorAll<HTMLElement>(".bracket")];
    expect(brackets.map((bracket) => [bracket.dataset.from, bracket.dataset.span, bracket.dataset.row])).toEqual([
      ["1", "2", "1"],
      ["2", "3", "2"],
    ]);
    expect(brackets.map((bracket) => bracket.querySelector(".label")!.textContent)).toEqual([
      "Team-Up: Colossus and Shadowcat",
      "Team-Up: A and B",
    ]);
    expect(element.shadowRoot!.querySelector<HTMLElement>(".strip")!.dataset.rows).toBe("2");
  });

  it("reads a pair given high seat first the same way", async () => {
    const element = await mount([pair(3, 1, "Team-Up")]);
    const bracket = element.shadowRoot!.querySelector<HTMLElement>(".bracket")!;
    expect([bracket.dataset.from, bracket.dataset.span]).toEqual(["1", "3"]);
  });

  it("shows the pair's picture on the pill only where there is art, and is no stop", async () => {
    const element = await mount([pair(1, 2, "A", { src: "blob:badge" }), pair(3, 4, "B")]);
    expect(element.shadowRoot!.querySelectorAll("mc-picture-tile")).toHaveLength(1);
    expect(element.shadowRoot!.querySelectorAll("[data-stop], button")).toHaveLength(0);
  });
});
