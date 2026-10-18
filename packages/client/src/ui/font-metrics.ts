/**
 * Measure each font once, not once per label.
 *
 * Phaser's `TextStyle` measures a font (`MeasureText`: a pooled canvas, `measureText` of a test string and, where the
 * browser has no bounding-box metrics, a pixel scan) whenever a `Text` is built or its font changes. The answer
 * depends only on the font string and the test string, yet a screen with 200 labels in ten type roles asked 200
 * times: about 195 ms of a 2.1 s screen build on a 6x slowed CPU (first visit to Decks & Collection, 2026-10-18).
 *
 * The cache is keyed on the style's actual `_font`, read at the moment Phaser would measure, not on the three
 * properties it is built from: `ui/desktop-type.ts` bumps small sizes in the `_font` setter on desktop, so the two
 * differ. Two hooks cover Phaser's two measuring paths:
 *
 *  - `setStyle` (a label's construction) only measures when `metrics` is falsy, so `metrics` becomes an accessor:
 *    reading it with nothing set looks the current `_font` up and hands back what was measured before.
 *  - `update(true)` (behind `setFontSize`, `setFontFamily`, `setFontStyle`, `setTestString`) always measures, so it is
 *    wrapped to look the new `_font` up first.
 *
 * Whatever Phaser then measures is remembered. The answer is exactly what Phaser measured the first time, so nothing
 * is drawn differently.
 *
 * A font is only remembered once the browser reports it loaded for the test string. Measured while a web font is
 * still on its way, the numbers describe the fallback face and must not outlive it.
 */

export interface FontMetrics {
  ascent: number;
  descent: number;
  fontSize: number;
}

/** The members of a `TextStyle` the hooks read and write. */
export interface MeasuringStyle {
  fontStyle: string;
  fontSize: string;
  fontFamily: string;
  testString: string;
  _font: string;
  metrics: FontMetrics | undefined;
  parent: { updateText(): unknown };
  update(recalculateMetrics?: boolean): unknown;
}

/** What a font is cached under: the canvas font string and the test string measured with it. */
export function metricsKey(font: string, testString: string): string {
  return `${font}\u0000${testString}`;
}

/** True when the browser has the font's faces for `testString`, so a measure of it is the final one. */
export type FontReady = (font: string, testString: string) => boolean;

export const documentFontReady: FontReady = (font, testString) => {
  try {
    return typeof document !== "undefined" && document.fonts?.check(font, testString) === true;
  } catch {
    return false;
  }
};

interface StoredStyle {
  mcMetrics?: FontMetrics | undefined;
}

export class FontMetricsCache {
  readonly #known = new Map<string, FontMetrics>();
  readonly #ready: FontReady;
  /** Fonts recalled rather than measured, for tests and diagnostics. */
  recalled = 0;

  constructor(ready: FontReady = documentFontReady) {
    this.#ready = ready;
  }

  get(font: string, testString: string): FontMetrics | undefined {
    return this.#known.get(metricsKey(font, testString));
  }

  /** Remembers `metrics` for `font` if it is safe to. */
  remember(font: string, testString: string, metrics: FontMetrics | undefined): void {
    if (!metrics) return;
    const key = metricsKey(font, testString);
    if (this.#known.has(key) || !this.#ready(font, testString)) return;
    this.#known.set(key, { ascent: metrics.ascent, descent: metrics.descent, fontSize: metrics.fontSize });
  }

  /** Installs the two hooks on a `TextStyle` prototype. */
  patch(proto: MeasuringStyle): void {
    const update = proto.update;
    const get = (font: string, testString: string) => this.get(font, testString);
    const note = () => {
      this.recalled++;
    };
    const remember = (font: string, testString: string, metrics: FontMetrics | undefined) =>
      this.remember(font, testString, metrics);
    Object.defineProperty(proto, "metrics", {
      configurable: true,
      get(this: MeasuringStyle & StoredStyle): FontMetrics | undefined {
        if (this.mcMetrics) return this.mcMetrics;
        const known = get(this._font, this.testString);
        if (!known) return undefined;
        note();
        this.mcMetrics = { ...known };
        return this.mcMetrics;
      },
      set(this: MeasuringStyle & StoredStyle, value: FontMetrics | undefined) {
        this.mcMetrics = value;
        // Reached by Phaser's own measure, so this is where a new font is learned.
        remember(this._font, this.testString, value);
      },
    });
    proto.update = function (this: MeasuringStyle & StoredStyle, recalculateMetrics) {
      if (!recalculateMetrics) return update.call(this, recalculateMetrics);
      // What `update` does first; the assignment goes through any `_font` setter, as it does there.
      this._font = [this.fontStyle, this.fontSize, this.fontFamily].join(" ").trim();
      const known = get(this._font, this.testString);
      if (!known) return update.call(this, recalculateMetrics);
      note();
      this.mcMetrics = { ...known };
      return this.parent.updateText();
    };
  }
}

export const fontMetrics = new FontMetricsCache();

let patched = false;

/**
 * Makes every `TextStyle` recall metrics it has measured before. Call once, before the game is created, with
 * `Phaser.GameObjects.TextStyle.prototype` (passed in so this module stays loadable without Phaser, under Vitest).
 */
export function installFontMetricsCache(textStyle: object): void {
  if (patched) return;
  patched = true;
  fontMetrics.patch(textStyle as MeasuringStyle);
}
