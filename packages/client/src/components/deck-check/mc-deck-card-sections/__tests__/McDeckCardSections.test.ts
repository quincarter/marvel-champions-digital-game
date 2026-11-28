// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-deck-card-sections.js";

const cell = (id: string) => ({
  id,
  cardId: id,
  cost: 1,
  costColor: "",
  name: id,
  typeWord: "Event",
  picture: { src: null, missing: "no scan" },
  rules: "",
  quantity: 1,
});

describe("mc-deck-card-sections", () => {
  it("draws nothing until it knows its width, then the faces, the note and the groups as sections", async () => {
    const el = document.createElement("mc-deck-card-sections");
    el.faces = [
      {
        title: "IDENTITY · 2 FACES",
        tiles: [{ id: "x.front.0", cardId: "x", picture: { src: null, missing: "" }, label: "A", name: "X" }],
      },
    ];
    el.groups = [{ title: "HERO · 2", cells: [cell("a"), cell("b")] }];
    el.note = "No cards match.";
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-card-sections")).toBeNull();
    el.boxWidth = 640;
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector<
      HTMLElement & { model: { sections: { kind: string }[]; columns: number } }
    >("mc-card-sections")!;
    expect(list.model.sections.map((section) => section.kind)).toEqual(["faces", "note", "cards"]);
    expect(list.model.columns).toBeGreaterThanOrEqual(1);
    el.remove();
  });

  it("says which card was tapped, and keeps the activation to itself", async () => {
    const el = document.createElement("mc-deck-card-sections");
    el.groups = [{ title: "HERO · 1", cells: [cell("a")] }];
    document.body.append(el);
    el.boxWidth = 640;
    await el.updateComplete;
    const heard = vi.fn();
    const leaked = vi.fn();
    el.addEventListener("mc-deck-check", (event) => heard(event.detail));
    document.body.addEventListener("mc-activate", leaked);
    el.shadowRoot!.querySelector("mc-card-sections")!.dispatchEvent(
      new CustomEvent("mc-activate", { detail: { key: "card:a" }, bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "card", key: "card:a" });
    expect(leaked).not.toHaveBeenCalled();
    el.remove();
  });
});
