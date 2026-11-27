// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { GUARDED_EVENTS, guardRegion, guardStops } from "./dom-region.js";

describe("guardRegion: a text field under a modal", () => {
  /** A region's box with a focused field inside, and a scene listening above it (as `DomRegion`'s scene does). */
  function setup(takes: { value: boolean }) {
    const wrap = document.createElement("div");
    const field = document.createElement("input");
    wrap.append(field);
    document.body.append(wrap);
    const heard: string[] = [];
    for (const name of GUARDED_EVENTS)
      wrap.addEventListener(name, (event) =>
        heard.push(`${name}:${(event as CustomEvent).detail?.value ?? (event as CustomEvent).detail?.focused ?? ""}`),
      );
    const apply = guardRegion(
      wrap,
      () => takes.value,
      () => false,
    );
    const emit = (name: string, detail: object): void => {
      field.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    };
    return { wrap, field, heard, apply, emit };
  }

  it("lets a focused field's input and focus through while the scene takes events", () => {
    const takes = { value: true };
    const { heard, apply, emit, wrap } = setup(takes);
    apply();
    expect(wrap.inert).toBe(false);
    emit("mc-field-focus", { focused: true });
    emit("mc-input", { value: "abc" });
    expect(heard).toEqual(["mc-field-focus:true", "mc-input:abc"]);
  });

  it("stops a late input (a compositionend that lands after the modal opened) and a focus, and goes inert", () => {
    const takes = { value: true };
    const { heard, apply, emit, wrap, field } = setup(takes);
    field.focus();
    takes.value = false; // a modal opened over the panel
    apply();
    expect(wrap.inert).toBe(true);
    emit("mc-input", { value: "late" });
    emit("mc-search", { value: "late" });
    emit("mc-field-focus", { focused: true });
    emit("mc-search-focus", { focused: true });
    expect(heard).toEqual([]);
    // Leaving the field still reaches the scene, so it never keeps a stale typing flag.
    emit("mc-field-focus", { focused: false });
    expect(heard).toEqual(["mc-field-focus:false"]);
    takes.value = true;
    apply();
    expect(wrap.inert).toBe(false);
    emit("mc-input", { value: "back" });
    expect(heard.at(-1)).toBe("mc-input:back");
  });

  it("guardStops is pure: only the focus-out of a field passes while covered", () => {
    const focus = (focused: boolean, type = "mc-field-focus") => new CustomEvent(type, { detail: { focused } });
    expect(guardStops(focus(true), false)).toBe(true);
    expect(guardStops(focus(false), false)).toBe(false);
    expect(guardStops(focus(false, "mc-search-focus"), false)).toBe(false);
    expect(guardStops(new CustomEvent("mc-input", { detail: { value: "x" } }), false)).toBe(true);
    expect(guardStops(new CustomEvent("mc-input", { detail: { value: "x" } }), true)).toBe(false);
  });
});
