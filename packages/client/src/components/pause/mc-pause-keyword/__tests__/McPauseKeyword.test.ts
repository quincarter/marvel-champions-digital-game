// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pause-keyword";
import type { PauseKeywordInput } from "../../pause.types";

afterEach(() => document.body.replaceChildren());

const keyword = (over: Partial<PauseKeywordInput> = {}): PauseKeywordInput => ({
  id: "stunned",
  term: "Stunned",
  definition: "Cannot attack.",
  tone: "stunned",
  tail: { text: "On Rhino.", cardId: "rhino" },
  ...over,
});

async function card(k: PauseKeywordInput) {
  const el = document.createElement("mc-pause-keyword");
  el.keyword = k;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-pause-keyword", () => {
  it("is a focus stop for its term, with the term, the definition and the card it is on", async () => {
    const el = await card(keyword());
    expect(el.getAttribute("data-stop")).toBe("keyword:stunned");
    expect(el.getAttribute("tone")).toBe("stunned");
    const root = el.shadowRoot!;
    expect(root.querySelector(".term")!.textContent).toBe("Stunned");
    expect(root.querySelector(".definition")!.textContent).toBe("Cannot attack.");
    expect(root.querySelector(".tail")!.textContent).toBe("On Rhino.");
  });

  it("raises a keyword action when pressed, and has no tail when no card carries it", async () => {
    const el = await card(keyword({ tone: "plain", tail: null }));
    expect(el.shadowRoot!.querySelector(".tail")).toBeNull();
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push((e as CustomEvent).detail));
    el.click();
    expect(seen).toEqual([{ action: { type: "keyword", id: "stunned" }, hold: false }]);
  });

  it("raises the card hover for the card its tail names", async () => {
    const el = await card(keyword());
    const heard: unknown[] = [];
    el.addEventListener("mc-card-hover", (e) => heard.push((e as CustomEvent).detail.cardId));
    const tail = el.shadowRoot!.querySelector<HTMLElement>(".tail")!;
    const event = new Event("pointerenter");
    Object.defineProperty(event, "pointerType", { value: "mouse" });
    tail.dispatchEvent(event);
    expect(heard).toEqual(["rhino"]);
  });
});
