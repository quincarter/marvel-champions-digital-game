import { describe, expect, it } from "vitest";
import "./mc-settings-body.js";
import type { SettingsBodyModel } from "./McSettingsBody.js";

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

const model: SettingsBodyModel = {
  height: 300,
  headings: [{ rect: rect(0, 0, 400, 26), title: "Table" }],
  rows: [
    {
      key: "row:reduced-motion",
      rect: rect(0, 34, 400, 44),
      title: "Reduced motion",
      detail: "Skip travel animation.",
      detailWidth: 300,
      rowKey: "reduced-motion",
      controls: [
        {
          kind: "button",
          key: "reduced-motion",
          rect: rect(314, 40, 84, 32),
          label: "ON",
          look: "secondary",
          selected: true,
          framed: true,
        },
      ],
    },
    {
      key: "row:card-size",
      rect: rect(0, 90, 400, 80),
      title: "Card size",
      controls: [
        {
          kind: "cell",
          key: "card-size:small",
          rect: rect(2, 130, 100, 32),
          label: "Small",
          selected: false,
          fill: "paper",
        },
        {
          kind: "cell",
          key: "card-size:large",
          rect: rect(102, 130, 100, 32),
          label: "Large",
          selected: true,
          fill: "paper",
        },
      ],
    },
  ],
};

function tap(element: Element, x = 5, y = 5): void {
  const at = { bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

async function mounted(): Promise<{ body: HTMLElementTagNameMap["mc-settings-body"]; keys: string[] }> {
  const body = document.createElement("mc-settings-body");
  body.model = model;
  document.body.append(body);
  await body.updateComplete;
  const keys: string[] = [];
  body.addEventListener("mc-activate", (event) => keys.push((event as CustomEvent<{ key: string }>).detail.key));
  return { body, keys };
}

describe("mc-settings-body", () => {
  it("places headings, rows and controls where the layout put them", async () => {
    const { body } = await mounted();
    const root = body.shadowRoot!;
    expect(root.querySelector(".heading h3")?.textContent).toBe("Table");
    expect(root.querySelector<HTMLElement>(".content")!.style.height).toBe("300px");
    const row = body.elementOf("row:reduced-motion")!;
    expect(row.style.top).toBe("34px");
    expect(row.querySelector(".title")?.textContent).toBe("Reduced motion");
    const button = body.elementOf("reduced-motion")!;
    expect(button.tagName).toBe("MC-BUTTON");
    expect(button.hasAttribute("framed")).toBe(true);
    const large = body.elementOf("card-size:large")!;
    expect(large.hasAttribute("data-selected")).toBe(true);
    expect(large.style.left).toBe("102px");
    body.remove();
  });

  it("says which key was tapped: a cell, a button, or a row for its own switch", async () => {
    const { body, keys } = await mounted();
    tap(body.elementOf("card-size:small")!);
    await (body.elementOf("reduced-motion") as HTMLElementTagNameMap["mc-button"]).updateComplete;
    tap(body.elementOf("reduced-motion")!);
    tap(body.elementOf("row:reduced-motion")!);
    expect(keys).toEqual(["card-size:small", "reduced-motion", "reduced-motion"]);
    body.remove();
  });

  it("draws an open dropdown over the rows: a tap on an option picks it, a tap beside it closes it", async () => {
    const body = document.createElement("mc-settings-body");
    body.model = {
      ...model,
      list: {
        rect: rect(2, 60, 200, 76),
        rowHeight: 36,
        closeKey: "list:close",
        options: [
          { key: "list:0", label: "1280 × 720", selected: false },
          { key: "list:1", label: "1920 × 1080", selected: true },
        ],
      },
    };
    document.body.append(body);
    await body.updateComplete;
    const keys: string[] = [];
    body.addEventListener("mc-activate", (event) => keys.push((event as CustomEvent<{ key: string }>).detail.key));
    const picked = body.elementOf("list:1") as HTMLElementTagNameMap["mc-button"];
    await picked.updateComplete;
    expect(picked.hasAttribute("selected")).toBe(true);
    tap(picked);
    tap(body.shadowRoot!.querySelector(".backdrop")!);
    expect(keys).toEqual(["list:1", "list:close"]);
    body.remove();
  });
});
