// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-decks-import-box.js";
import type { McDecksImportBox } from "../McDecksImportBox.js";
import type { DecksEvent, DecksImportModel } from "../../decks.types.js";

afterEach(() => document.body.replaceChildren());

const io = (over: Partial<DecksImportModel> = {}): DecksImportModel => ({
  heading: "Import / Export",
  description: "Paste a list or a MarvelCDB link.",
  open: null,
  pasteText: "",
  marvelcdbText: "",
  busy: false,
  pasteLabel: "Paste",
  cdbLabel: "CDB link",
  exportLabel: "Export",
  exportDisabled: null,
  pastePlaceholder: "1x Hawkeye",
  linkPlaceholder: "marvelcdb.com/decklist/…",
  importListLabel: "Import list",
  importCdbLabel: "Import",
  importingLabel: "Importing…",
  ...over,
});

async function mount(model: DecksImportModel): Promise<McDecksImportBox> {
  const element = document.createElement("mc-decks-import-box") as McDecksImportBox;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-decks-import-box", () => {
  it("shows only the three buttons while shut, and the Paste field with its Import button once opened", async () => {
    const element = await mount(io());
    const root = element.shadowRoot!;
    expect(root.querySelectorAll("mc-button")).toHaveLength(3);
    expect(root.querySelector("mc-text-field")).toBeNull();
    element.model = io({ open: "paste", pasteText: "1x Hawkeye" });
    await element.updateComplete;
    const field = root.querySelector("mc-text-field") as HTMLElement & { value: string };
    expect(field.getAttribute("data-stop")).toBe("paste-field");
    expect(field.value).toBe("1x Hawkeye");
    expect(root.querySelector('[data-stop="paste-import"]')).not.toBeNull();
    expect(root.querySelector('[data-stop="marvelcdb-import"]')).toBeNull();
  });

  it("raises the typed text and the button presses, and says Importing while busy", async () => {
    const element = await mount(io({ open: "marvelcdb", busy: true }));
    const seen: DecksEvent[] = [];
    element.addEventListener("mc-decks", (event) => seen.push((event as CustomEvent<DecksEvent>).detail));
    const field = element.shadowRoot!.querySelector("mc-text-field")!;
    field.dispatchEvent(new CustomEvent("mc-input", { detail: { value: "x" }, bubbles: true, composed: true }));
    element.shadowRoot!.querySelector<HTMLElement>('[data-stop="ie-export"]')!.click();
    expect(seen).toEqual([
      { type: "input", field: "marvelcdb", text: "x" },
      { type: "action", action: "ie-export" },
    ]);
    const go = element.shadowRoot!.querySelector('[data-stop="marvelcdb-import"]') as HTMLElement & { label: string };
    expect(go.label).toBe("Importing…");
  });
});
