import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "./mc-sheet.js";
import type { SheetNode } from "./McSheet.js";

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

const nodes: SheetNode[] = [
  {
    kind: "box",
    rect: rect(0, 0, 300, 200),
    fill: "var(--mc-fill-ink)",
    stroke: "var(--mc-line-paper)",
    strokeWidth: 4,
  },
  { kind: "dots", rect: rect(0, 0, 300, 200), color: "#fff", spacing: 8, radius: 1, opacity: 0.08 },
  {
    kind: "text",
    key: "title",
    x: 20,
    y: 16,
    text: "Paused",
    font: "display",
    size: 30,
    weight: 400,
    color: "var(--mc-text-paper)",
    uppercase: true,
  },
  { kind: "button", key: "resume", rect: rect(20, 60, 200, 52), label: "Resume", look: "primary", display: true },
  { kind: "tap", key: "card", rect: rect(20, 120, 80, 40) },
  {
    kind: "scroll",
    key: "log",
    rect: rect(120, 120, 160, 60),
    height: 300,
    nodes: [{ kind: "tap", key: "moment:1", rect: rect(0, 0, 160, 44) }],
  },
];

describe("mc-sheet", () => {
  it("places each part at its rect, and text at its anchor", async () => {
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = nodes;
    document.body.append(sheet);
    await sheet.updateComplete;
    const title = sheet.elementOf("title")!;
    expect(title.textContent).toBe("Paused");
    expect(title.style.left).toBe("20px");
    expect(title.style.textTransform).toBe("uppercase");
    expect(sheet.elementOf("resume")!.style.top).toBe("60px");
    const log = sheet.elementOf("log")!;
    expect(log.classList.contains("scroller")).toBe(true);
    expect(log.querySelector<HTMLElement>(".content")!.style.height).toBe("300px");
    sheet.remove();
  });

  it("says which key a tap pressed: a button, a tap area, one inside a scroll region", async () => {
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = nodes;
    document.body.append(sheet);
    await sheet.updateComplete;
    const keys: string[] = [];
    sheet.addEventListener("mc-activate", (event) => keys.push((event as CustomEvent<{ key: string }>).detail.key));
    const resume = sheet.elementOf("resume") as HTMLElementTagNameMap["mc-button"];
    await resume.updateComplete;
    // happy-dom has no layout: each part gets a box under the tap's point (5, 5).
    const box = () => ({ left: 0, top: 0, right: 160, bottom: 60, width: 160, height: 60 }) as DOMRect;
    resume.getBoundingClientRect = box;
    sheet.elementOf("card")!.getBoundingClientRect = box;
    tap(resume);
    tap(sheet.elementOf("card")!);
    // The scroll region clips (a release outside it isn't a tap on what it holds), so it needs a box to lift inside.
    const moment = sheet.elementOf("moment:1")!;
    sheet.elementOf("log")!.getBoundingClientRect = box;
    moment.getBoundingClientRect = box;
    tap(moment);
    expect(keys).toEqual(["resume", "card", "moment:1"]);
    sheet.remove();
  });
  describe("fitWidth with marks", () => {
    const label = (marks: { start: number; end: number }[]): SheetNode => ({
      kind: "text",
      key: "label",
      x: 0,
      y: 0,
      text: "Spider-Man (Peter Parker)",
      font: "body",
      size: 16,
      weight: 400,
      color: "#fff",
      fitWidth: 40,
      marks,
    });

    for (const [name, marks] of [
      ["a match at index 0", [{ start: 0, end: 6 }]],
      ["a match mid-string", [{ start: 7, end: 10 }]],
    ] as const) {
      it(`keeps the text and the marks intact with ${name}, across renders`, async () => {
        const sheet = document.createElement("mc-sheet");
        sheet.nodes = [label([...marks])];
        document.body.append(sheet);
        await sheet.updateComplete;
        for (let again = 0; again < 3; again++) {
          sheet.nodes = [label([...marks])];
          sheet.requestUpdate();
          await sheet.updateComplete;
        }
        const element = sheet.elementOf("label")!;
        expect(element.textContent).toBe("Spider-Man (Peter Parker)");
        const marked = element.querySelectorAll("mark");
        expect(marked).toHaveLength(1);
        expect(marked[0]!.textContent).toBe("Spider-Man (Peter Parker)".slice(marks[0].start, marks[0].end));
        sheet.remove();
      });
    }
  });

  describe("fitWidth cutting", () => {
    const fit = (text: string): SheetNode => ({
      kind: "text",
      key: "label",
      x: 0,
      y: 0,
      text,
      font: "body",
      size: 8,
      weight: 400,
      color: "#fff",
      fitWidth: 60,
    });
    // Ten pixels a UTF-16 unit, so a cut is judged by what it leaves.
    const unitWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");
    beforeAll(() =>
      Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
        configurable: true,
        get(this: HTMLElement) {
          return (this.textContent ?? "").length * 10;
        },
      }),
    );
    afterAll(() => {
      if (unitWidth) Object.defineProperty(HTMLElement.prototype, "scrollWidth", unitWidth);
      else delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
    });

    for (const [name, text] of [
      ["an emoji", "ab😀😀😀😀"],
      ["a decomposed Spanish accent", "Peñáñóñ".normalize("NFD")],
    ] as const) {
      it(`never cuts inside ${name}`, async () => {
        const sheet = document.createElement("mc-sheet");
        sheet.nodes = [fit(text)];
        document.body.append(sheet);
        await sheet.updateComplete;
        const shown = sheet.elementOf("label")!.textContent!;
        expect(shown.endsWith("…")).toBe(true);
        const kept = shown.slice(0, -1);
        expect(text.startsWith(kept)).toBe(true);
        // No lone surrogate, and the next character of the source is not a combining mark or a low surrogate.
        const before = kept.charCodeAt(kept.length - 1);
        const after = text.charCodeAt(kept.length);
        expect(before >= 0xd800 && before <= 0xdbff).toBe(false);
        expect((after >= 0xdc00 && after <= 0xdfff) || (after >= 0x300 && after <= 0x36f)).toBe(false);
        sheet.remove();
      });
    }
  });
});
