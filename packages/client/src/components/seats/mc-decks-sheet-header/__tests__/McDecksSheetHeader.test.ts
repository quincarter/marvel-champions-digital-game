// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-decks-sheet-header.js";
import type { McDecksSheetHeader } from "../McDecksSheetHeader.js";

afterEach(() => document.body.replaceChildren());

async function mount(heading: string, subtitle: string): Promise<McDecksSheetHeader> {
  const header = document.createElement("mc-decks-sheet-header") as McDecksSheetHeader;
  header.heading = heading;
  header.subtitle = subtitle;
  document.body.append(header);
  await header.updateComplete;
  return header;
}

describe("mc-decks-sheet-header", () => {
  it("shows the title and the line under it", async () => {
    const header = await mount("Spider-Man", "3 decks. Pick the one this seat plays.");
    expect(header.shadowRoot!.querySelector(".title")!.textContent).toBe("Spider-Man");
    expect(header.shadowRoot!.querySelector(".subtitle")!.textContent).toBe("3 decks. Pick the one this seat plays.");
  });

  it("leaves out an empty subtitle and follows a change of words", async () => {
    const header = await mount("Spider-Man", "");
    expect(header.shadowRoot!.querySelector(".subtitle")).toBeNull();
    header.heading = "Hombre Araña";
    header.subtitle = "2 mazos.";
    await header.updateComplete;
    expect(header.shadowRoot!.querySelector(".title")!.textContent).toBe("Hombre Araña");
    expect(header.shadowRoot!.querySelector(".subtitle")!.textContent).toBe("2 mazos.");
  });
});
