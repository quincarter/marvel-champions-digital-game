// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-seats-detail.js";
import type { McSeatsDetail } from "../McSeatsDetail.js";
import type { SeatsDetailModel } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

const detail = (over: Partial<SeatsDetailModel> = {}): SeatsDetailModel => ({
  hero: {
    name: "Spider-Man",
    credit: null,
    stats: "Peter Parker · 10 HP · hand 5",
    obligationLabel: "Obligation",
    obligation: "Financial Woes",
    nemesisLabel: "Nemesis",
    nemesis: "Sandman",
  },
  seatNote: "Seat 1 is set · pick seat 2 below",
  emptyText: "Pick a hero below.",
  insights: [{ text: "Both seats play Spider-Man.", tone: "caution" }],
  ...over,
});

async function mount(model: SeatsDetailModel | null): Promise<McSeatsDetail> {
  const el = document.createElement("mc-seats-detail") as McSeatsDetail;
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-seats-detail", () => {
  it("composes the seat note, the hero's facts and the insight lines", async () => {
    const el = await mount(detail());
    const root = el.shadowRoot!;
    expect(root.querySelector(".note")!.textContent).toBe("Seat 1 is set · pick seat 2 below");
    const hero = root.querySelector("mc-detail-hero") as HTMLElement & { model: SeatsDetailModel["hero"] };
    expect(hero.model!.name).toBe("Spider-Man");
    const insights = root.querySelector("mc-detail-insights") as HTMLElement & { insights: unknown[] };
    expect(insights.insights).toEqual([{ text: "Both seats play Spider-Man.", tone: "caution" }]);
    expect(root.querySelector(".empty")).toBeNull();
  });

  it("says the empty words before a hero is chosen, and keeps the insights", async () => {
    const el = await mount(detail({ hero: null, seatNote: null }));
    const root = el.shadowRoot!;
    expect(root.querySelector(".empty")!.textContent).toBe("Pick a hero below.");
    expect(root.querySelector("mc-detail-hero")).toBeNull();
    expect(root.querySelector(".note")).toBeNull();
    expect(root.querySelector("mc-detail-insights")).not.toBeNull();
  });

  it("draws nothing without a model, and follows a new one", async () => {
    const el = await mount(null);
    expect(el.shadowRoot!.querySelector(".panel")).toBeNull();
    el.model = detail({ seatNote: null });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".panel")).not.toBeNull();
    expect(el.shadowRoot!.querySelector(".note")).toBeNull();
  });

  it("raises no events and has no focus stops", async () => {
    const el = await mount(detail());
    expect(el.shadowRoot!.querySelectorAll("[data-stop]")).toHaveLength(0);
  });
});
