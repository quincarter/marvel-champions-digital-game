// @vitest-environment happy-dom
import { LitElement, html } from "lit";
import { afterEach, describe, expect, it } from "vitest";
import { LearnElement, learnDetailOf } from "../LearnElement";
import type { LearnEventDetail } from "../learn-events.types";

class TestLearn extends LearnElement {
  override render() {
    return html`<slot></slot>`;
  }
}
if (!customElements.get("test-learn")) customElements.define("test-learn", TestLearn);
// A stand-in for a press control: raises mc-pressed from inside.
class TestPress extends LitElement {}
if (!customElements.get("test-press")) customElements.define("test-press", TestPress);

afterEach(() => document.body.replaceChildren());

function mount() {
  const section = document.createElement("test-learn");
  const press = document.createElement("test-press");
  section.append(press);
  document.body.append(section);
  const heard: LearnEventDetail[] = [];
  const leaked: unknown[] = [];
  document.body.addEventListener("mc-learn", (e) => heard.push(e.detail));
  document.body.addEventListener("mc-pressed", (e) => leaked.push(e));
  return { press, heard, leaked };
}

const raise = (el: Element, name: string, detail: unknown) =>
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));

describe("LearnElement", () => {
  it("turns a pressed action that is a learn detail into mc-learn and stops the original", () => {
    const { press, heard, leaked } = mount();
    raise(press, "mc-pressed", { action: { type: "lesson", id: "how-to-win" }, hold: false });
    expect(heard).toEqual([{ type: "lesson", id: "how-to-win" }]);
    expect(leaked).toEqual([]);
  });

  it("reads the bare close action as close and ignores an action it does not know", () => {
    const { press, heard } = mount();
    raise(press, "mc-pressed", { action: "close", hold: false });
    raise(press, "mc-pressed", { action: "mystery", hold: false });
    expect(heard).toEqual([{ type: "close" }]);
    expect(learnDetailOf(null)).toBeNull();
  });

  it("turns the term text's events into glossary and tip", () => {
    const { press, heard } = mount();
    raise(press, "mc-term-tip-change", { id: "threat" });
    raise(press, "mc-term-tip-change", { id: null });
    raise(press, "mc-term-glossary", { id: "threat", heading: "Threat" });
    expect(heard).toEqual([
      { type: "tip", open: true },
      { type: "tip", open: false },
      { type: "glossary", heading: "Threat" },
    ]);
  });
});
