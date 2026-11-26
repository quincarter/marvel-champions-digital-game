import { describe, expect, it } from "vitest";
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
    tap(resume);
    tap(sheet.elementOf("card")!);
    tap(sheet.elementOf("moment:1")!);
    expect(keys).toEqual(["resume", "card", "moment:1"]);
    sheet.remove();
  });

  it("draws a picture whole inside its box, and says why when there is none", async () => {
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = [
      {
        kind: "image",
        key: "art",
        rect: rect(10, 10, 60, 84),
        src: "/card-art/01001a.png",
        fill: "#eee",
        missing: "no scan",
        hover: "01001a@0",
      },
      { kind: "image", key: "none", rect: rect(80, 10, 60, 84), src: null, missing: "no scan" },
    ];
    document.body.append(sheet);
    await sheet.updateComplete;
    const art = sheet.elementOf("art")!;
    expect(art.querySelector("img")?.getAttribute("src")).toBe("/card-art/01001a.png");
    expect(art.querySelector("img")?.getAttribute("loading")).toBe("lazy");
    expect(art.dataset.hover).toBe("01001a@0");
    expect(art.querySelector(".missing")).toBeNull();
    expect(sheet.elementOf("none")!.querySelector(".missing")?.textContent).toBe("no scan");
    // A scan that fails to load says so, and keeps saying so when the sheet is drawn again.
    art.querySelector("img")!.dispatchEvent(new Event("error"));
    await sheet.updateComplete;
    expect(sheet.elementOf("art")!.querySelector(".missing")?.textContent).toBe("no scan");
    sheet.nodes = [...sheet.nodes];
    await sheet.updateComplete;
    expect(sheet.elementOf("art")!.querySelector("img")).toBeNull();
    sheet.remove();
  });

  it("raises mc-inspect for a held or right-clicked tap area that asks for it, and only that one", async () => {
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = [
      { kind: "tap", key: "card", rect: rect(0, 0, 80, 40), inspect: true, hover: "c@1" },
      { kind: "tap", key: "plain", rect: rect(0, 50, 80, 40) },
      { kind: "box", key: "frame", rect: rect(0, 100, 20, 20), round: true, fill: "#000" },
    ];
    document.body.append(sheet);
    await sheet.updateComplete;
    const keys: string[] = [];
    sheet.addEventListener("mc-inspect", (event) => keys.push((event as CustomEvent<{ key: string }>).detail.key));
    sheet.elementOf("card")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    sheet.elementOf("plain")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(keys).toEqual(["card"]);
    expect(sheet.elementOf("card")!.dataset.hover).toBe("c@1");
    expect(sheet.elementOf("frame")!.style.borderRadius).toBe("50%");
    sheet.remove();
  });

  it("draws a cropped picture, halftone dots, a notch, a turned outlined text, and tells a mouse over a tracked area", async () => {
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = [
      { kind: "image", key: "art", rect: rect(0, 0, 100, 80), src: "/a.png", cover: { x: 0.5, y: 0.3 } },
      { kind: "halftone", rect: rect(0, 40, 100, 40), color: "#000", step: 8, fade: 30, opacity: 0.85 },
      {
        kind: "poly",
        points: [
          [0, 0],
          [10, 0],
          [5, -8],
        ],
        fill: "#ff0",
      },
      {
        kind: "poly",
        points: [
          [0, 0],
          [5, -8],
          [10, 0],
        ],
        stroke: "#000",
        strokeWidth: 3,
      },
      {
        kind: "text",
        key: "vs",
        x: 50,
        y: 20,
        text: "VS",
        font: "display",
        size: 28,
        weight: 400,
        color: "#fff",
        anchorX: 0.5,
        anchorY: 0.5,
        angle: -8,
        italic: true,
        strokeColor: "#000",
        strokeWidth: 5,
      },
      { kind: "tap", key: "box", rect: rect(0, 0, 100, 80), track: true },
      { kind: "tap", key: "plain", rect: rect(0, 90, 100, 40) },
    ];
    document.body.append(sheet);
    await sheet.updateComplete;
    const img = sheet.elementOf("art")!.querySelector("img")!;
    expect(img.style.objectFit).toBe("cover");
    expect(img.style.objectPosition).toBe("50% 30%");
    const root = sheet.shadowRoot!;
    expect(root.querySelectorAll("svg circle").length).toBeGreaterThan(5);
    expect(root.querySelectorAll("polygon")).toHaveLength(1);
    expect(root.querySelectorAll("polyline")).toHaveLength(1);
    const vs = sheet.elementOf("vs")!;
    expect(vs.style.transform).toContain("rotate(-8deg)");
    expect(vs.style.fontStyle).toBe("italic");
    const seen: string[] = [];
    sheet.addEventListener("mc-hover", (event) => {
      const { key, over } = (event as CustomEvent<{ key: string; over: boolean }>).detail;
      seen.push(`${key}:${over}`);
    });
    const move = (el: Element, type: string, pointerType: string): void => {
      const event = new Event(type) as Event & { pointerType: string };
      event.pointerType = pointerType;
      el.dispatchEvent(event);
    };
    move(sheet.elementOf("box")!, "pointerenter", "mouse");
    move(sheet.elementOf("box")!, "pointerleave", "mouse");
    move(sheet.elementOf("box")!, "pointerenter", "touch");
    move(sheet.elementOf("plain")!, "pointerenter", "mouse");
    expect(seen).toEqual(["box:true", "box:false"]);
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
});
