// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import type { McSearchField, McSheet, McTextField } from "@mc/ui";
import { GUARDED_EVENTS, guardRegion, guardStops } from "./dom-region.js";

afterEach(() => document.body.replaceChildren());

/**
 * A region's box holding a real panel field, and a "scene" listening above it (as `DomRegion`'s scene does): what the
 * scene accepted is what reached it through the guard, so the field's text and the scene's text can be compared.
 */
function region(takes: { value: boolean }) {
  const wrap = document.createElement("div");
  document.body.append(wrap);
  // The scene listens on the panel inside the box, as the real scene listens on its `mc-sheet`.
  const panel = document.createElement("div");
  wrap.append(panel);
  const accepted: { search: string | null; input: string | null } = { search: null, input: null };
  const heard: string[] = [];
  panel.addEventListener("mc-search", (event) => {
    accepted.search = (event as CustomEvent<{ value: string }>).detail.value;
    heard.push(`search:${accepted.search}`);
  });
  panel.addEventListener("mc-input", (event) => {
    accepted.input = (event as CustomEvent<{ value: string }>).detail.value;
    heard.push(`input:${accepted.input}`);
  });
  const apply = guardRegion(
    wrap,
    () => takes.value,
    () => false,
  );
  return { wrap: panel, box: wrap, accepted, heard, apply };
}

const inputOf = (el: HTMLElement): HTMLInputElement => el.shadowRoot!.querySelector("input")!;

async function typeInto(el: McSearchField | McTextField, text: string): Promise<void> {
  const input = inputOf(el);
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  await el.updateComplete;
}

async function searchField(wrap: HTMLElement, props: Partial<{ value: string; debounce: number }> = {}) {
  const el = document.createElement("mc-search-field") as McSearchField;
  Object.assign(el, { debounce: 0, ...props });
  wrap.append(el);
  await el.updateComplete;
  return el;
}

async function textField(wrap: HTMLElement, value = "") {
  const el = document.createElement("mc-text-field") as McTextField;
  el.value = value;
  wrap.append(el);
  await el.updateComplete;
  return el;
}

describe("guardRegion: a panel field under a modal keeps its text in step with the scene", () => {
  it("mc-search-field: an edit made while covered is dropped and the field goes back to what the scene accepted", async () => {
    const takes = { value: true };
    const { wrap, accepted, apply } = region(takes);
    const field = await searchField(wrap, { value: "web" });
    await typeInto(field, "web-swing");
    expect(accepted.search).toBe("web-swing");
    // A modal opens over the panel; a late edit reaches the field.
    takes.value = false;
    apply();
    await typeInto(field, "web-swing and more");
    expect(accepted.search).toBe("web-swing");
    await field.updateComplete;
    expect(field.text).toBe("web-swing");
    expect(inputOf(field).value).toBe("web-swing");
    // The modal closes: what is typed now is taken, and the field and the scene agree again.
    takes.value = true;
    apply();
    await typeInto(field, "web-swing!");
    expect(accepted.search).toBe("web-swing!");
    expect(field.text).toBe(accepted.search);
  });

  it("mc-search-field: a debounced edit still waiting when the modal opens (the blur flush) never leaves the text unapplied", async () => {
    const takes = { value: true };
    const { wrap, accepted, apply } = region(takes);
    // Accepted baseline: the screen handed the field "spi" and took no edit since.
    const field = await searchField(wrap, { value: "spi", debounce: 60 });
    field.focusInput();
    await typeInto(field, "spider");
    // The pause has not ended; a modal opens and the caret is taken out (the blur flushes the edit).
    takes.value = false;
    apply();
    await field.updateComplete;
    expect(accepted.search).toBeNull();
    // The visible text is what the screen has, not the dropped edit.
    expect(field.text).toBe("spi");
    expect(inputOf(field).value).toBe("spi");
    // The pause ends later: nothing is raised for the dropped edit.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(accepted.search).toBeNull();
    expect(field.text).toBe("spi");
  });

  it("mc-search-field: reopening after the modal, the visible text and the accepted text are one", async () => {
    const takes = { value: true };
    const { wrap, accepted, apply } = region(takes);
    const field = await searchField(wrap, { debounce: 40 });
    await typeInto(field, "iron");
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(accepted.search).toBe("iron");
    await typeInto(field, "iron man");
    takes.value = false;
    apply();
    await new Promise((resolve) => setTimeout(resolve, 80));
    takes.value = true;
    apply();
    await field.updateComplete;
    expect(field.text).toBe(accepted.search);
    expect(inputOf(field).value).toBe(accepted.search);
  });

  it("mc-text-field: a composition that ends while covered is dropped and the field goes back", async () => {
    const takes = { value: true };
    const { wrap, accepted, apply } = region(takes);
    const field = await textField(wrap, "paste me");
    await typeInto(field, "paste me too");
    expect(accepted.input).toBe("paste me too");
    takes.value = false;
    apply();
    const input = inputOf(field);
    input.dispatchEvent(new Event("compositionstart", { bubbles: true, composed: true }));
    input.value = "paste me too ni";
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("compositionend", { bubbles: true, composed: true }));
    await field.updateComplete;
    expect(accepted.input).toBe("paste me too");
    expect(inputOf(field).value).toBe("paste me too");
    takes.value = true;
    apply();
    await typeInto(field, "paste me three");
    expect(accepted.input).toBe("paste me three");
    expect(inputOf(field).value).toBe(accepted.input);
  });

  it("mc-text-field: with nothing accepted yet, a dropped edit goes back to the value the screen handed the field", async () => {
    const takes = { value: false };
    const { wrap, accepted } = region(takes);
    const field = await textField(wrap, "from the screen");
    await typeInto(field, "typed under a modal");
    await field.updateComplete;
    expect(accepted.input).toBeNull();
    expect(inputOf(field).value).toBe("from the screen");
  });

  it("an mc-search-field in a real mc-sheet: the sheet's keyed mc-search is guarded and the field restored too", async () => {
    const takes = { value: true };
    const { wrap, accepted, apply } = region(takes);
    const sheet = document.createElement("mc-sheet") as McSheet;
    sheet.nodes = [
      {
        kind: "search",
        key: "pool-search",
        rect: { x: 0, y: 0, width: 300, height: 44 },
        value: "think",
        placeholder: "Search",
        clearLabel: "Clear",
        debounce: 0,
      },
    ];
    wrap.append(sheet);
    await sheet.updateComplete;
    const field = sheet.elementOf("pool-search") as McSearchField;
    await field.updateComplete;
    await typeInto(field, "think fast");
    expect(accepted.search).toBe("think fast");
    takes.value = false;
    apply();
    await typeInto(field, "think fast again");
    expect(accepted.search).toBe("think fast");
    await field.updateComplete;
    expect(inputOf(field).value).toBe("think fast");
    expect(field.text).toBe("think fast");
  });

  it("lets the field's focus in and out reach the scene as before: only a focus-in is stopped while covered", () => {
    const focus = (focused: boolean, type = "mc-field-focus") => new CustomEvent(type, { detail: { focused } });
    expect(guardStops(focus(true), false)).toBe(true);
    expect(guardStops(focus(false), false)).toBe(false);
    expect(guardStops(focus(false, "mc-search-focus"), false)).toBe(false);
    expect(guardStops(new CustomEvent("mc-input", { detail: { value: "x" } }), false)).toBe(true);
    expect(guardStops(new CustomEvent("mc-input", { detail: { value: "x" } }), true)).toBe(false);
    expect(GUARDED_EVENTS).toContain("mc-input");
  });

  it("a redraw between typing and the modal does not move the baseline: the screen hands the field the text it accepted", async () => {
    const takes = { value: true };
    const { wrap, apply } = region(takes);
    // The consumer (the Decks pool search): it keeps the text it accepted and hands the field exactly that on every redraw.
    let acceptedText = "";
    const results: string[] = [];
    const sheet = document.createElement("mc-sheet") as McSheet;
    const draw = async (): Promise<void> => {
      sheet.nodes = [
        {
          kind: "search",
          key: "pool-search",
          rect: { x: 0, y: 0, width: 300, height: 44 },
          value: acceptedText,
          placeholder: "Search",
          clearLabel: "Clear",
          debounce: 40,
        },
      ];
      await sheet.updateComplete;
    };
    wrap.addEventListener("mc-search", (event) => {
      acceptedText = (event as CustomEvent<{ value: string }>).detail.value;
      results.push(acceptedText);
    });
    wrap.append(sheet);
    await draw();
    const field = sheet.elementOf("pool-search") as McSearchField;
    field.focusInput();
    // Accept A.
    await typeInto(field, "think");
    await new Promise((resolve) => setTimeout(resolve, 80));
    await draw();
    expect(results).toEqual(["think"]);
    // Type B; before the pause ends the screen redraws (a resize, a worker answer), then a modal covers it.
    await typeInto(field, "think fast");
    await draw();
    takes.value = false;
    apply();
    await new Promise((resolve) => setTimeout(resolve, 80));
    await field.updateComplete;
    // The pool still has A, and so does the field: nothing the pool did not take is shown.
    expect(results).toEqual(["think"]);
    expect(field.text).toBe("think");
    expect(inputOf(field).value).toBe("think");
    // The modal closes and the screen redraws: the text and the results are still one.
    takes.value = true;
    apply();
    await draw();
    expect(inputOf(field).value).toBe(acceptedText);
    expect(field.text).toBe(acceptedText);
    // A new edit is taken as usual.
    await typeInto(field, "thinking");
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(results.at(-1)).toBe("thinking");
    expect(field.text).toBe(acceptedText);
  });
});
