import { afterEach, describe, expect, it } from "vitest";
import "../../../controls/mc-dotted-term/mc-dotted-term";
import "../../mc-term-tip/mc-term-tip";
import "../mc-term-text";
import type { McTermRun, McTermTipContent } from "../mc-term-text.types";

afterEach(() => document.body.replaceChildren());

const RUNS: McTermRun[] = [
  { kind: "text", text: "Every villain phase it adds " },
  { kind: "term", id: "threat", label: "threat" },
  { kind: "text", text: " to the scheme." },
  { kind: "break", paragraph: true },
  { kind: "term", id: "unknown", label: "mystery" },
];
const TIPS: Record<string, McTermTipContent> = {
  threat: { heading: "Threat", body: "Pressure toward the scheme.", linkLabel: "Rules glossary" },
};

async function text() {
  const el = document.createElement("mc-term-text");
  el.runs = RUNS;
  el.tips = TIPS;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const termOf = (el: HTMLElement) => el.shadowRoot!.querySelector<HTMLElement>("mc-dotted-term")!;

describe("mc-term-text", () => {
  it("wraps its words in spans, makes a term with a tip a stop and leaves one without a tip as words", async () => {
    const el = await text();
    const root = el.shadowRoot!;
    expect(root.querySelectorAll("p")).toHaveLength(2);
    expect(termOf(el).dataset.stop).toBe("term:threat");
    expect(root.querySelectorAll("mc-dotted-term")).toHaveLength(1);
    expect(root.textContent).toContain("mystery");
    expect(root.querySelector("mc-term-tip")).toBeNull();
  });

  it("opens the tip on a press of the term and tells its owner, and closes it on a second press", async () => {
    const el = await text();
    const heard: (string | null)[] = [];
    el.addEventListener("mc-term-tip-change", (e) => heard.push(e.detail.id));
    termOf(el).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-term-tip")).not.toBeNull();
    termOf(el).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-term-tip")).toBeNull();
    expect(heard).toEqual(["threat", null]);
  });

  it("closeTip says whether a tip was open", async () => {
    const el = await text();
    expect(el.closeTip()).toBe(false);
    termOf(el).click();
    await el.updateComplete;
    expect(el.closeTip()).toBe(true);
  });

  it("closes on a press outside and raises mc-term-glossary from the tip's link", async () => {
    const el = await text();
    termOf(el).click();
    await el.updateComplete;
    await el.shadowRoot!.querySelector("mc-term-tip")!.updateComplete;
    const glossary: string[] = [];
    el.addEventListener("mc-term-glossary", (e) => glossary.push(e.detail.heading));
    el.shadowRoot!.querySelector("mc-term-tip")!.shadowRoot!.querySelector<HTMLElement>(".link")!.click();
    expect(glossary).toEqual(["Threat"]);
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-term-tip")).toBeNull();
  });
});
