// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-setup-summary";
import type { SetupEventDetail } from "../../shared/setup-events.types";
import type { SummaryInput } from "../mc-setup-summary.types";

afterEach(() => document.body.replaceChildren());

const input = (over: Partial<SummaryInput> = {}): SummaryInput => ({
  rows: [
    { label: "Villain", value: "Rhino" },
    { label: "Heroes", value: "2" },
  ],
  seedText: "123",
  watchable: false,
  room: false,
  villain: { name: "Rhino", picture: { src: "rhino.jpg" }, cardId: "01094" },
  ...over,
});

async function make(i: SummaryInput | null, mode: "wide" | "phone" = "wide") {
  const el = document.createElement("mc-setup-summary");
  el.input = i;
  el.mode = mode;
  document.body.append(el);
  await el.updateComplete;
  const seen: SetupEventDetail[] = [];
  el.addEventListener("mc-setup", (e) => seen.push(e.detail));
  return { el, seen };
}

describe("mc-setup-summary", () => {
  it("lists the engine's summary rows, the seed field with Reroll, the villain and the watch toggle when wide", async () => {
    const { el, seen } = await make(input());
    const root = el.shadowRoot!;
    expect([...root.querySelectorAll(".row")].map((r) => r.textContent!.replace(/\s+/g, " ").trim())).toEqual([
      "VillainRhino",
      "Heroes2",
    ]);
    const field = root.querySelector("mc-text-field")!;
    expect(field.getAttribute("data-stop")).toBe("seed");
    expect(field.value).toBe("123");
    expect(root.querySelector(".villain")!.textContent).toContain("Rhino");
    root.querySelector('[data-stop="reroll"]')!.press();
    root.querySelector('[data-stop="watch"]')!.press();
    expect(seen).toEqual([{ type: "reroll" }, { type: "watch" }]);
  });

  it("raises the seed's text and its caret as mc-setup events, and nothing else reaches above", async () => {
    const { el, seen } = await make(input());
    const outside: string[] = [];
    document.body.addEventListener("mc-input", () => outside.push("input"));
    const field = el.shadowRoot!.querySelector("mc-text-field")!;
    field.dispatchEvent(new CustomEvent("mc-input", { detail: { value: "9" }, bubbles: true, composed: true }));
    field.dispatchEvent(new CustomEvent("mc-field-focus", { detail: { focused: true }, bubbles: true, composed: true }));
    expect(seen).toEqual([
      { type: "seed-input", value: "9" },
      { type: "seed-focus", focused: true },
    ]);
    expect(outside).toEqual([]);
  });

  it("draws the watch toggle ticked when watchable, and none in a room", async () => {
    const on = await make(input({ watchable: true }));
    expect(on.el.shadowRoot!.querySelector("mc-check-row")!.hasAttribute("checked")).toBe(true);
    const room = await make(input({ room: true }));
    expect(room.el.shadowRoot!.querySelector("mc-check-row")).toBeNull();
  });

  it("is a seed card and a watch row with its state in words on a phone, with no summary rows or villain", async () => {
    const { el } = await make(input({ watchable: true }), "phone");
    const root = el.shadowRoot!;
    expect(root.querySelector(".seedcard mc-text-field")).not.toBeNull();
    expect(root.querySelector(".rows")).toBeNull();
    expect(root.querySelector(".villain")).toBeNull();
    expect(root.querySelector("mc-check-row")!.getAttribute("meta")).not.toBe("");
  });

  it("leaves the villain out when there is none (a Civil War build), and raises the card hover for a mouse", async () => {
    const none = await make(input({ villain: null }));
    expect(none.el.shadowRoot!.querySelector(".villain")).toBeNull();
    const { el } = await make(input());
    const hovered: string[] = [];
    el.addEventListener("mc-card-hover", (e) => hovered.push(e.detail.cardId));
    el.shadowRoot!.querySelector(".villain .pic")!.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    expect(hovered).toEqual(["01094"]);
  });
});
