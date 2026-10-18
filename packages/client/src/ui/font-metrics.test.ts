import { describe, expect, it } from "vitest";
import { FontMetricsCache, metricsKey, type FontMetrics, type MeasuringStyle } from "./font-metrics.js";

/**
 * A `TextStyle` stand-in that follows Phaser's `setStyle` and `update` for the lines that matter: `_font` is built
 * from the three parts (through a "desktop bump" that makes it differ from them, as `ui/desktop-type.ts` does), and
 * `metrics` is measured only when it is missing, or always for `update(true)`.
 */
function fakeStyleClass(measure: (font: string) => void, bump = 0) {
  class Fake {
    fontStyle = "";
    fontSize = "16px";
    fontFamily = "Courier";
    testString = "|M";
    declare metrics: FontMetrics | undefined;
    _fontValue = "";
    updates = 0;
    parent = {
      updateText: () => {
        this.updates++;
        return "parent";
      },
    };
    get _font(): string {
      return this._fontValue;
    }
    set _font(value: string) {
      this._fontValue = value.replace(/(\d+)px/, (_, size: string) => `${Number(size) + bump}px`);
    }
    setStyle(style: Record<string, unknown>, updateText = true, setDefaults = false) {
      if (setDefaults) {
        this.fontStyle = "";
        this.fontSize = "16px";
        this.fontFamily = "Courier";
      }
      if (style.fontFamily !== undefined) this.fontFamily = style.fontFamily as string;
      if (style.fontSize !== undefined) this.fontSize = String(style.fontSize);
      if (style.fontStyle !== undefined) this.fontStyle = style.fontStyle as string;
      this._font = [this.fontStyle, this.fontSize, this.fontFamily].join(" ").trim();
      if (updateText || !this.metrics) this.metrics = this.measure();
      return updateText ? this.parent.updateText() : this.parent;
    }
    update(recalculate?: boolean) {
      if (recalculate) {
        this._font = [this.fontStyle, this.fontSize, this.fontFamily].join(" ").trim();
        this.metrics = this.measure();
      }
      return this.parent.updateText();
    }
    measure(): FontMetrics {
      measure(this._font);
      return { ascent: this._font.length, descent: 2, fontSize: this._font.length + 2 };
    }
  }
  return Fake;
}

function patched(measure: (font: string) => void, ready = () => true, bump = 0) {
  const Fake = fakeStyleClass(measure, bump);
  const cache = new FontMetricsCache(ready);
  cache.patch(Fake.prototype as unknown as MeasuringStyle);
  return { Fake, cache };
}

describe("FontMetricsCache", () => {
  it("measures a font once and recalls it for the next style", () => {
    const measured: string[] = [];
    const { Fake } = patched((font) => measured.push(font));
    const first = new Fake();
    first.setStyle({ fontFamily: "A", fontSize: "10px" }, false, true);
    const second = new Fake();
    second.setStyle({ fontFamily: "A", fontSize: "10px" }, false, true);
    expect(measured).toEqual(["10px A"]);
    expect(second.metrics).toEqual(first.metrics);
    expect(second.metrics).not.toBe(first.metrics);
  });

  it("keys on the font string the style really uses, not on its three parts", () => {
    // Desktop bump: a 10px style is measured, and so cached, as 12px. A 12px style is a different font.
    const measured: string[] = [];
    const { Fake } = patched(
      (font) => measured.push(font),
      () => true,
      2,
    );
    const small = new Fake();
    small.setStyle({ fontFamily: "A", fontSize: "10px" }, false, true);
    const large = new Fake();
    large.setStyle({ fontFamily: "A", fontSize: "98px" }, false, true);
    const again = new Fake();
    again.setStyle({ fontFamily: "A", fontSize: "10px" }, false, true);
    expect(measured).toEqual(["12px A", "100px A"]);
    expect(small.metrics).toEqual({ ascent: 6, descent: 2, fontSize: 8 });
    expect(again.metrics).toEqual(small.metrics);
    expect(large.metrics).not.toEqual(small.metrics);
  });

  it("recalls through update(true) after a font setter", () => {
    const measured: string[] = [];
    const { Fake } = patched((font) => measured.push(font));
    const style = new Fake();
    style.setStyle({ fontFamily: "A", fontSize: "10px" }, false, true);
    style.fontSize = "12px";
    style.update(true);
    style.fontSize = "10px";
    const before = style.updates;
    style.update(true);
    expect(measured).toEqual(["10px A", "12px A"]);
    expect(style.metrics?.ascent).toBe("10px A".length);
    expect(style.updates).toBe(before + 1);
  });

  it("does not remember a font that is not loaded yet", () => {
    const measured: string[] = [];
    let loaded = false;
    const { Fake } = patched(
      (font) => measured.push(font),
      () => loaded,
    );
    new Fake().setStyle({ fontFamily: "A" }, false, true);
    new Fake().setStyle({ fontFamily: "A" }, false, true);
    expect(measured).toHaveLength(2);
    loaded = true;
    new Fake().setStyle({ fontFamily: "A" }, false, true);
    new Fake().setStyle({ fontFamily: "A" }, false, true);
    expect(measured).toHaveLength(3);
  });

  it("measures when a style is set with updateText, as Phaser does", () => {
    const measured: string[] = [];
    const { Fake } = patched((font) => measured.push(font));
    new Fake().setStyle({ fontFamily: "A" }, false, true);
    new Fake().setStyle({ fontFamily: "A" }, true, true);
    expect(measured).toHaveLength(2);
  });

  it("keeps the test string part of the key", () => {
    const measured: string[] = [];
    const { Fake, cache } = patched((font) => measured.push(font));
    new Fake().setStyle({ fontFamily: "A" }, false, true);
    expect(cache.get("Courier", "|M")).toBeUndefined();
    expect(cache.get("16px A", "|M")).toBeDefined();
    expect(cache.get("16px A", "other")).toBeUndefined();
    expect(metricsKey("a", "b")).not.toBe(metricsKey("ab", ""));
  });
});
