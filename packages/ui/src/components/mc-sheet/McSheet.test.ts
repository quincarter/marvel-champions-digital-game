import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import "./mc-sheet.js";
import { SCROLL_GUTTER, scrollBox } from "./McSheet.js";
import type { SheetNode } from "../../shared/sheet.types.js";

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

  it("re-arms a picture tile's retry once its picture loads", async () => {
    const sheet = document.createElement("mc-sheet");
    const tile = (src: string): SheetNode => ({
      kind: "pictureTile",
      key: "hero",
      rect: rect(0, 0, 56, 56),
      src,
      retry: "art:pack:demo@1/h.webp",
    });
    sheet.nodes = [tile("blob:a")];
    document.body.append(sheet);
    await sheet.updateComplete;
    const asked: unknown[] = [];
    sheet.addEventListener("mc-image-error", (event) => asked.push((event as CustomEvent).detail));
    const inner = (): HTMLElement => sheet.elementOf("hero") as HTMLElement;
    const img = (): HTMLImageElement => inner().shadowRoot!.querySelector("img")!;
    img().dispatchEvent(new Event("error"));
    await sheet.updateComplete;
    expect(asked).toHaveLength(1);
    // A fresh URL that loads clears the flag, so a later failure asks again.
    sheet.nodes = [tile("blob:b")];
    await sheet.updateComplete;
    await (inner() as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    img().dispatchEvent(new Event("load"));
    sheet.nodes = [tile("blob:c")];
    await sheet.updateComplete;
    await (inner() as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    img().dispatchEvent(new Event("error"));
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
      { kind: "image", key: "art", rect: rect(0, 0, 100, 80), src: "/a.png", cover: { x: 0.5, y: 0.3 }, dim: true },
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
    // A locked tile's picture is a gray, faded ghost.
    expect(img.style.filter).toBe("grayscale(1)");
    expect(img.style.opacity).toBe("0.3");
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

  it("reads a slider's percent in ink on a paper ground, and in paper on ink", async () => {
    for (const ground of ["paper", "ink"] as const) {
      const sheet = document.createElement("mc-sheet");
      sheet.nodes = [
        {
          kind: "slider",
          key: "volume",
          rect: rect(0, 0, 300, 30),
          share: 0.5,
          label: "50%",
          ground,
          stepLabels: ["-", "+"],
        },
      ];
      document.body.append(sheet);
      await sheet.updateComplete;
      const color = sheet.elementOf("volume:label")!.style.color;
      expect(color !== "").toBe(ground === "paper");
      sheet.remove();
    }
  });

  it("stops a dragged slider changing anything once the panel cancels its holds", async () => {
    const { sheet, slides, track } = await sliderSheet();
    const at = (clientX: number) => ({
      bubbles: true,
      composed: true,
      clientX,
      clientY: 5,
      pointerId: 1,
      button: 0,
      buttons: 1,
      pointerType: "mouse",
    });
    track.dispatchEvent(new PointerEvent("pointerdown", at(20)));
    track.dispatchEvent(new PointerEvent("pointermove", at(60)));
    expect(slides).toHaveLength(1);
    sheet.cancelHolds();
    track.dispatchEvent(new PointerEvent("pointermove", at(90)));
    track.dispatchEvent(new PointerEvent("pointerup", at(90)));
    expect(slides).toHaveLength(1);
    sheet.remove();
  });

  it("ends a slider press when the pointer capture is lost", async () => {
    const { sheet, slides, track } = await sliderSheet();
    const at = { bubbles: true, composed: true, clientX: 60, clientY: 5, pointerId: 1, button: 0, buttons: 1 };
    track.dispatchEvent(new PointerEvent("pointerdown", at));
    track.dispatchEvent(new PointerEvent("lostpointercapture", at));
    track.dispatchEvent(new PointerEvent("pointerup", at));
    expect(slides).toEqual([]);
    sheet.remove();
  });

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

describe("scrollBox", () => {
  it("widens a region by the scrollbar's gutter only while its content scrolls", () => {
    const r = rect(10, 20, 300, 100);
    expect(scrollBox({ rect: r, height: 400 })).toEqual({ ...r, width: 300 + SCROLL_GUTTER });
    expect(scrollBox({ rect: r, height: 100 })).toBe(r);
  });

  it("centers a cover crop on its focal point once the picture's size is known, and keeps it inside the picture", async () => {
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = [
      {
        kind: "image",
        key: "hero",
        rect: rect(0, 0, 100, 100),
        src: "/h.png",
        cover: { x: 0.5, y: 0.6, centered: true },
      },
      {
        kind: "button",
        key: "go",
        rect: rect(0, 0, 10, 10),
        label: "Go",
        look: "secondary",
        disabled: "No",
        pressable: true,
      },
    ];
    document.body.append(sheet);
    await sheet.updateComplete;
    const img = sheet.elementOf("hero")!.querySelector("img")!;
    // Not loaded yet: the point is a share of the overflow.
    expect(img.style.objectPosition).toBe("50% 60%");
    // A 200 x 400 picture in a 100 x 100 box scales by 0.5: the crop is 200 x 200 of it. Centered on 0.6 (240) it starts at 140 of 200 spare.
    Object.defineProperty(img, "naturalWidth", { value: 200 });
    Object.defineProperty(img, "naturalHeight", { value: 400 });
    img.dispatchEvent(new Event("load"));
    await sheet.updateComplete;
    expect(sheet.elementOf("hero")!.querySelector("img")!.style.objectPosition).toBe("50% 70%");
    expect(sheet.elementOf("go")!.hasAttribute("pressable")).toBe(true);
    sheet.remove();
  });
});

describe("mc-sheet kit parts", () => {
  const mount = async (nodes: SheetNode[]) => {
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = nodes;
    document.body.append(sheet);
    await sheet.updateComplete;
    return sheet;
  };
  const ready = (el: Element) => (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

  it("draws a section header, a tab rail, a picture tile and card, a row, an empty state and a search", async () => {
    const sheet = await mount([
      {
        kind: "sectionHeader",
        key: "h",
        rect: rect(0, 0, 200, 24),
        label: "Heroes",
        count: "3 of 7",
        underline: true,
        open: false,
      },
      {
        kind: "tabRail",
        key: "tabs",
        rect: rect(0, 30, 200, 30),
        tabs: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        selected: "b",
      },
      {
        kind: "pictureTile",
        key: "t",
        rect: rect(0, 70, 50, 50),
        src: "/a.png",
        fit: "contain",
        dim: true,
        hover: "01001",
      },
      {
        kind: "pictureCard",
        key: "c",
        rect: rect(60, 70, 80, 100),
        model: {
          src: null,
          focusY: 0.3,
          dim: false,
          chip: "READ",
          chipTone: "action",
          title: "T",
          detail: "D",
          detailTone: "meta",
          initial: "T",
        },
      },
      {
        kind: "listRow",
        key: "r",
        rect: rect(0, 180, 200, 40),
        model: { leading: "▶", title: "Song", detail: "x", open: true, active: false },
      },
      { kind: "emptyState", key: "e", x: 0, y: 230, width: 200, height: 40, message: "Nothing", align: "center" },
      {
        kind: "search",
        key: "s",
        rect: rect(0, 280, 200, 40),
        value: "ab",
        placeholder: "Search",
        clearLabel: "Clear",
        escapeClears: true,
      },
    ]);
    const header = sheet.elementOf("h") as HTMLElement & { open: boolean; underline: boolean; count: string };
    expect([header.open, header.underline, header.count]).toEqual([false, true, "3 of 7"]);
    const rail = sheet.elementOf("tabs") as HTMLElement & { selected: string };
    expect(rail.selected).toBe("b");
    const tile = sheet.elementOf("t") as HTMLElement & { fit: string; dim: boolean };
    expect([tile.fit, tile.dim, tile.dataset.hover]).toEqual(["contain", true, "01001"]);
    expect((sheet.elementOf("c") as HTMLElement & { model: { title: string } }).model.title).toBe("T");
    expect((sheet.elementOf("r") as HTMLElement & { model: { title: string } }).model.title).toBe("Song");
    expect((sheet.elementOf("e") as HTMLElement & { align: string }).align).toBe("center");
    expect((sheet.elementOf("s") as HTMLElement & { escapeClears: boolean }).escapeClears).toBe(true);
    sheet.remove();
  });

  it("turns a tab rail tap into mc-activate with the prefixed key, and finds a rail cell by its key", async () => {
    const sheet = await mount([
      { kind: "tabRail", rect: rect(0, 0, 200, 30), tabs: [{ id: "a", label: "A" }], prefix: "panel:" },
    ]);
    const keys: string[] = [];
    sheet.addEventListener("mc-activate", (e) => keys.push((e as CustomEvent<{ key: string }>).detail.key));
    const cell = sheet.elementOf("panel:a")!;
    expect(cell.tagName).toBe("MC-BUTTON");
    cell.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(keys).toEqual(["panel:a"]);
    sheet.remove();
  });

  it("turns a filter bar chip tap into mc-activate, finds the chip by key, and lets mc-sort through", async () => {
    const sheet = await mount([
      {
        kind: "filterBar",
        key: "filters",
        rect: rect(0, 0, 300, 90),
        chips: [{ id: "x", label: "X", selected: false, width: 60 }],
        sort: {
          label: "Sort",
          value: "a",
          options: [
            { value: "a", label: "A" },
            { value: "b", label: "B" },
          ],
        },
        rows: 2,
        rowHeight: 40,
      },
    ]);
    const seen: string[] = [];
    sheet.addEventListener("mc-activate", (e) => seen.push((e as CustomEvent<{ key: string }>).detail.key));
    sheet.addEventListener("mc-sort", (e) => seen.push(`sort:${(e as CustomEvent<{ value: string }>).detail.value}`));
    expect(sheet.elementOf("chip:x")).not.toBeNull();
    const bar = sheet.elementOf("filters")!;
    const chip = bar.shadowRoot!.querySelector("mc-filter-chip")!;
    await ready(chip);
    tap(chip.shadowRoot!.querySelector("mc-button")!);
    const select = bar.shadowRoot!.querySelector("select")!;
    select.value = "b";
    select.dispatchEvent(new Event("change"));
    expect(seen).toEqual(["chip:x", "sort:b"]);
    sheet.remove();
  });

  it("asks once to resolve a picture again when a tile or a media row picture fails, and says missing after", async () => {
    const sheet = await mount([
      {
        kind: "pictureTile",
        key: "t",
        rect: rect(0, 0, 50, 50),
        src: "/gone.png",
        missing: "No scan",
        retry: "pack:1",
      },
      {
        kind: "mediaRow",
        key: "m",
        rect: rect(0, 60, 300, 80),
        heading: "Pack",
        meta: "",
        summary: "",
        foot: "",
        badge: "+ Install",
        src: "/gone2.png",
        letter: "P",
        retry: "pack:2",
      },
    ]);
    const asked: unknown[] = [];
    sheet.addEventListener("mc-image-error", (e) => asked.push((e as CustomEvent).detail));
    const tile = sheet.elementOf("t")!;
    await ready(tile);
    tile.shadowRoot!.querySelector("img")!.dispatchEvent(new Event("error"));
    const row = sheet.elementOf("m")!;
    await ready(row);
    const inner = row.shadowRoot!.querySelector("mc-picture-tile")!;
    await ready(inner);
    inner.shadowRoot!.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(asked).toEqual([
      { key: "pack:1", src: "/gone.png" },
      { key: "pack:2", src: "/gone2.png" },
    ]);
    await sheet.updateComplete;
    expect((sheet.elementOf("t") as unknown as { src: string }).src).toBe("");
    sheet.remove();
  });

  it("raises mc-activate for a media row tap, names a symbol button, and ghosts a dim image", async () => {
    const sheet = await mount([
      {
        kind: "mediaRow",
        key: "m",
        rect: rect(0, 0, 300, 80),
        heading: "P",
        meta: "",
        summary: "",
        foot: "",
        badge: "",
        src: null,
        letter: "P",
      },
      { kind: "button", key: "plus", rect: rect(0, 90, 40, 40), label: "+", look: "secondary", aria: "Add a seat" },
      { kind: "image", key: "img", rect: rect(0, 140, 50, 50), src: "/a.png", cover: { x: 0.5, y: 0.5 }, dim: true },
    ]);
    const keys: string[] = [];
    sheet.addEventListener("mc-activate", (e) => keys.push((e as CustomEvent<{ key: string }>).detail.key));
    tap(sheet.elementOf("m")!);
    expect(keys).toEqual(["m"]);
    expect(sheet.elementOf("plus")!.getAttribute("aria-label")).toBe("Add a seat");
    expect(sheet.elementOf("img")!.querySelector("img")!.style.opacity).toBe("0.3");
    sheet.remove();
  });
  it("draws a group from its own corner: a sticky one in the flow by its margin, a fading one placed and told its range", async () => {
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = [
      {
        kind: "scroll",
        key: "page",
        rect: rect(0, 0, 300, 200),
        height: 600,
        nodes: [
          {
            kind: "group",
            key: "art",
            rect: rect(16, 16, 200, 100),
            fade: 100,
            nodes: [{ kind: "box", key: "frame", rect: rect(0, 0, 200, 100), fill: "red" }],
          },
          {
            kind: "group",
            key: "pinned",
            rect: rect(16, 120, 200, 60),
            sticky: true,
            nodes: [{ kind: "tap", key: "inside", rect: rect(10, 10, 50, 20) }],
          },
        ],
      },
    ];
    document.body.append(sheet);
    await sheet.updateComplete;
    const art = sheet.elementOf("art")!;
    expect(art.classList.contains("fades")).toBe(true);
    expect(art.style.top).toBe("16px");
    expect(art.style.getPropertyValue("--mc-fade")).toBe("100px");
    const pinned = sheet.elementOf("pinned")!;
    expect(pinned.classList.contains("sticky")).toBe(true);
    expect(pinned.style.marginTop).toBe("120px");
    expect(pinned.style.height).toBe("60px");
    // A tap inside a group says its own key.
    const keys: string[] = [];
    sheet.addEventListener("mc-activate", (event) => keys.push((event as CustomEvent<{ key: string }>).detail.key));
    tap(sheet.elementOf("inside")!);
    expect(keys).toEqual(["inside"]);
    sheet.remove();
  });
  it("fades a collapsing group from the scroll position where the browser has no scroll timelines", async () => {
    vi.stubGlobal("CSS", { ...CSS, escape: CSS.escape.bind(CSS), supports: () => false });
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = [
      {
        kind: "scroll",
        key: "page",
        rect: rect(0, 0, 300, 200),
        height: 800,
        nodes: [{ kind: "group", key: "art", rect: rect(0, 0, 200, 100), fade: 100, nodes: [] }],
      },
    ];
    document.body.append(sheet);
    await sheet.updateComplete;
    const art = sheet.elementOf("art")!;
    expect(art.style.opacity).toBe("1");
    const scroller = sheet.elementOf("page")!;
    scroller.scrollTop = 50;
    scroller.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    // Eased out: half way through the range it is already past half faded, and trails at half the scroll's speed.
    expect(Number(art.style.opacity)).toBeCloseTo(0.25, 2);
    expect(art.style.translate).toBe("0 25px");
    scroller.scrollTop = 400;
    scroller.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(art.style.opacity).toBe("0");
    expect(art.style.translate).toBe("0 50px");
    vi.unstubAllGlobals();
    sheet.remove();
  });
});
