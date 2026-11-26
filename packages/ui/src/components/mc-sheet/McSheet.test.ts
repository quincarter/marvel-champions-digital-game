import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

  it("asks once to resolve a retryable picture again when its load fails, and not for the fresh URL's own failure loop", async () => {
    const sheet = document.createElement("mc-sheet");
    const image = (src: string): SheetNode => ({
      kind: "image",
      key: "art",
      rect: rect(0, 0, 60, 84),
      src,
      missing: "no scan",
      retry: "art:pack:demo@1/c.webp",
    });
    sheet.nodes = [image("blob:old")];
    document.body.append(sheet);
    await sheet.updateComplete;
    const asked: { key: string; src: string }[] = [];
    sheet.addEventListener("mc-image-error", (event) => asked.push((event as CustomEvent).detail));
    sheet.elementOf("art")!.querySelector("img")!.dispatchEvent(new Event("error"));
    await sheet.updateComplete;
    expect(asked).toEqual([{ key: "art:pack:demo@1/c.webp", src: "blob:old" }]);
    expect(sheet.elementOf("art")!.querySelector(".missing")?.textContent).toBe("no scan");
    // The owner hands a fresh URL: it draws, and fails once more without a second ask (the picture is truly gone).
    sheet.nodes = [image("blob:new")];
    await sheet.updateComplete;
    const img = sheet.elementOf("art")!.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("blob:new");
    img.dispatchEvent(new Event("error"));
    await sheet.updateComplete;
    expect(asked).toHaveLength(1);
    expect(sheet.elementOf("art")!.querySelector(".missing")?.textContent).toBe("no scan");
    // A picture that loads re-arms the ask.
    sheet.nodes = [image("blob:third")];
    await sheet.updateComplete;
    sheet.elementOf("art")!.querySelector("img")!.dispatchEvent(new Event("load"));
    sheet.nodes = [image("blob:fourth")];
    await sheet.updateComplete;
    sheet.elementOf("art")!.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(asked).toHaveLength(2);
    sheet.remove();
  });

  it("cancels a hold that is still armed, so a covered panel raises no mc-inspect", async () => {
    vi.useFakeTimers();
    try {
      const sheet = document.createElement("mc-sheet");
      sheet.nodes = [{ kind: "tap", key: "card", rect: rect(0, 0, 80, 40), inspect: true }];
      document.body.append(sheet);
      await sheet.updateComplete;
      const keys: string[] = [];
      sheet.addEventListener("mc-inspect", (event) => keys.push((event as CustomEvent<{ key: string }>).detail.key));
      const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
      sheet.elementOf("card")!.dispatchEvent(new PointerEvent("pointerdown", at));
      sheet.cancelHolds();
      vi.advanceTimersByTime(2000);
      expect(keys).toEqual([]);
      // Not armed for good: the next press holds as usual.
      sheet.elementOf("card")!.dispatchEvent(new PointerEvent("pointerdown", at));
      vi.advanceTimersByTime(2000);
      expect(keys).toEqual(["card"]);
      sheet.remove();
    } finally {
      vi.useRealTimers();
    }
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

describe("mc-sheet drawings, QR codes and sliders", () => {
  it("draws a QR code as one path of its dark modules with the quiet zone round them", async () => {
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = [
      {
        kind: "qr",
        key: "qr",
        rect: rect(0, 0, 100, 100),
        rows: ["10", "01"],
        border: 4,
        background: "#fff",
        foreground: "#000",
      },
    ];
    document.body.append(sheet);
    await sheet.updateComplete;
    const drawn = sheet.elementOf("qr")!;
    expect(drawn.getAttribute("viewBox")).toBe("0 0 10 10");
    expect(drawn.querySelector("path")!.getAttribute("d")).toBe("M4 4h1v1h-1zM5 5h1v1h-1z");
    sheet.remove();
  });

  it("draws a drawing's shapes and keeps its text as text", async () => {
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = [
      {
        kind: "svg",
        key: "drawing",
        rect: rect(0, 0, 200, 100),
        viewBox: [400, 200],
        ops: [
          { k: "rect", x: 0, y: 0, w: 10, h: 10, fill: "#111" },
          {
            k: "text",
            x: 5,
            y: 5,
            text: "Prev zone",
            size: 12,
            weight: 800,
            anchor: "middle",
            fill: "#fff",
            font: "body",
          },
        ],
      },
    ];
    document.body.append(sheet);
    await sheet.updateComplete;
    const drawn = sheet.elementOf("drawing")!;
    expect(drawn.querySelectorAll("rect")).toHaveLength(1);
    expect(drawn.querySelector("text")!.textContent).toBe("Prev zone");
    sheet.remove();
  });

  it("reports a step press, and a tap on the track as a committed share", async () => {
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = [
      {
        kind: "slider",
        key: "size",
        rect: rect(0, 0, 300, 30),
        share: 0.5,
        label: "125%",
        ground: "ink",
        stepLabels: ["−", "+"],
      },
    ];
    document.body.append(sheet);
    await sheet.updateComplete;
    const steps: unknown[] = [];
    const slides: unknown[] = [];
    sheet.addEventListener("mc-step", (event) => steps.push((event as CustomEvent).detail));
    sheet.addEventListener("mc-slide", (event) => slides.push((event as CustomEvent).detail));
    expect(sheet.elementOf("size:label")!.textContent).toBe("125%");
    sheet.elementOf("size:up")!.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(steps).toEqual([{ key: "size", direction: 1 }]);
    const track = sheet.elementOf("size:track")!;
    track.getBoundingClientRect = () =>
      ({ left: 0, width: 118, top: 0, right: 118, bottom: 30, height: 30, x: 0, y: 0 }) as DOMRect;
    const at = { bubbles: true, composed: true, clientX: 34, clientY: 5, pointerId: 1, button: 0 };
    track.dispatchEvent(new PointerEvent("pointerdown", at));
    track.dispatchEvent(new PointerEvent("pointerup", at));
    expect(slides).toEqual([{ key: "size", share: 0.25, commit: true }]);
    sheet.remove();
  });

  it("treats an up or down drag on the track as the page's scroll and reports nothing", async () => {
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = [
      {
        kind: "slider",
        key: "size",
        rect: rect(0, 0, 300, 30),
        share: 0,
        label: "75%",
        ground: "ink",
        stepLabels: ["−", "+"],
      },
    ];
    document.body.append(sheet);
    await sheet.updateComplete;
    const slides: unknown[] = [];
    sheet.addEventListener("mc-slide", (event) => slides.push((event as CustomEvent).detail));
    const track = sheet.elementOf("size:track")!;
    const at = (clientY: number) => ({ bubbles: true, composed: true, clientX: 20, clientY, pointerId: 1, button: 0 });
    track.dispatchEvent(new PointerEvent("pointerdown", at(5)));
    track.dispatchEvent(new PointerEvent("pointermove", at(40)));
    track.dispatchEvent(new PointerEvent("pointerup", at(40)));
    expect(slides).toEqual([]);
    sheet.remove();
  });

  const sliderSheet = async () => {
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = [
      {
        kind: "slider",
        key: "size",
        rect: rect(0, 0, 300, 30),
        share: 0,
        label: "75%",
        ground: "ink",
        stepLabels: ["−", "+"],
      },
    ];
    document.body.append(sheet);
    await sheet.updateComplete;
    const slides: unknown[] = [];
    sheet.addEventListener("mc-slide", (event) => slides.push((event as CustomEvent).detail));
    const track = sheet.elementOf("size:track")!;
    track.getBoundingClientRect = () =>
      ({ left: 0, width: 118, top: 0, right: 118, bottom: 30, height: 30, x: 0, y: 0 }) as DOMRect;
    return { sheet, slides, track };
  };

  it("keeps the value when the knob at the minimum end is tapped on its outer half", async () => {
    const { sheet, slides, track } = await sliderSheet();
    const at = { bubbles: true, composed: true, clientX: 3, clientY: 5, pointerId: 1, button: 0 };
    track.dispatchEvent(new PointerEvent("pointerdown", at));
    track.dispatchEvent(new PointerEvent("pointerup", at));
    expect(slides).toEqual([{ key: "size", share: 0, commit: true }]);
    sheet.remove();
  });

  it("commits nothing when a mouse press leaves the track and is released elsewhere, then hovers back across", async () => {
    const { sheet, slides, track } = await sliderSheet();
    const at = (clientX: number, buttons: number) => ({
      bubbles: true,
      composed: true,
      clientX,
      clientY: 5,
      pointerId: 1,
      button: 0,
      buttons,
      pointerType: "mouse",
    });
    track.dispatchEvent(new PointerEvent("pointerdown", at(40, 1)));
    // Released far off the track: the press ended there, not here.
    track.dispatchEvent(new PointerEvent("pointerup", { ...at(400, 0), clientY: 200 }));
    track.dispatchEvent(new PointerEvent("pointermove", at(70, 0)));
    track.dispatchEvent(new PointerEvent("pointermove", at(90, 0)));
    expect(slides).toEqual([]);
    sheet.remove();
  });

  it("says a drawing's picture is missing when it fails to load", async () => {
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = [
      {
        kind: "svg",
        key: "drawing",
        rect: rect(0, 0, 200, 100),
        viewBox: [400, 200],
        missing: "No picture",
        ops: [{ k: "image", href: "/nope.png", x: 0, y: 0, w: 400, h: 200 }],
      },
    ];
    document.body.append(sheet);
    await sheet.updateComplete;
    expect(sheet.renderRoot.querySelector(".missing")).toBeNull();
    sheet.renderRoot.querySelector("image")!.dispatchEvent(new Event("error"));
    await sheet.updateComplete;
    expect(sheet.renderRoot.querySelector(".missing")!.textContent).toBe("No picture");
    sheet.remove();
  });

  it("draws an aspect chip at its point with its label", async () => {
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = [{ kind: "chip", key: "c", x: 16, y: 12, aspect: "leadership", label: "Liderazgo" }];
    document.body.append(sheet);
    await sheet.updateComplete;
    const chip = sheet.elementOf("c")!;
    expect(chip.tagName).toBe("MC-ASPECT-CHIP");
    expect(chip.style.left).toBe("16px");
    expect((chip as unknown as { label: string }).label).toBe("Liderazgo");
    sheet.remove();
  });
});
