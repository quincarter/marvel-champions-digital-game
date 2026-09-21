/**
 * A `Text` that rasterises once, when something needs the result, instead of
 * once per setter.
 *
 * Phaser's `Text` redraws its whole 2D canvas and re-uploads its texture inside
 * every call that could change how it looks: the constructor's `setText`, then
 * again for a style's `padding`, again for its `letterSpacing`, and again for
 * each `setPadding` / `setBackgroundColor` / `setFontSize` / `setWordWrapWidth`
 * chained after it. Measured on the phone board (2026-09-21): about 40 labels,
 * about 100 rasterisations, and four fifths of a redraw's time — and every
 * screen here redraws whole on every change, so that is what a tap waits for.
 *
 * Nothing between those calls looks at the result, so they only have to mark
 * the label dirty. The work happens the first time anyone reads the label's
 * size (layout, `fitText`, `setOrigin`'s display origin, a sizer) or draws it.
 * What a caller observes is unchanged; how often the canvas is painted is not.
 *
 * Installed by replacing the `text` factory (`installLazyText`), so every
 * `scene.add.text(...)` in the app gets it without naming it. A `Text` built
 * with `new` directly is untouched.
 */

import Phaser from "phaser";

export class McLazyText extends Phaser.GameObjects.Text {
  // `declare`, never initialised: the base constructor already calls `updateText`, and a field initialiser would
  // run after it and wipe the flag it set.
  declare private lazyDirty: boolean | undefined;

  override updateText(): this {
    this.lazyDirty = true;
    return this;
  }

  /** Paints the canvas if anything changed since the last paint. */
  flush(): void {
    if (!this.lazyDirty) return;
    this.lazyDirty = false;
    super.updateText();
  }
}

/**
 * `width` and `height` become accessors that paint first. Defined on the prototype rather than in the class:
 * `Text` declares them as plain properties, which TypeScript will not let a subclass redeclare as accessors, and the
 * base constructor's own `this.width = …` still lands in the setter this way.
 */
function flushBeforeMeasure(size: "width" | "height", slot: "lazyWidth" | "lazyHeight"): void {
  Object.defineProperty(McLazyText.prototype, size, {
    configurable: true,
    get(this: McLazyText): number {
      this.flush();
      return (this as unknown as Record<string, number>)[slot] ?? 0;
    },
    set(this: McLazyText, value: number) {
      (this as unknown as Record<string, number>)[slot] = value;
    },
  });
}

/**
 * The renderers live on the prototype as plain functions (`TextRender`), so they are wrapped rather than overridden.
 * Phaser calls them detached, as `render(renderer, gameObject, …)`: the label is the second argument, never `this`.
 */
function flushBeforeRender(method: "renderWebGL" | "renderCanvas"): void {
  const proto = McLazyText.prototype as unknown as Record<string, (...args: unknown[]) => void>;
  const render = proto[method];
  if (!render) return;
  proto[method] = function (this: unknown, ...args: unknown[]): void {
    const label = args[1];
    if (label instanceof McLazyText) label.flush();
    render.apply(this, args);
  };
}

let installed = false;

/** Makes `scene.add.text` build a `McLazyText`. Call once, before the game is created. */
export function installLazyText(): void {
  if (installed) return;
  installed = true;
  flushBeforeMeasure("width", "lazyWidth");
  flushBeforeMeasure("height", "lazyHeight");
  flushBeforeRender("renderWebGL");
  flushBeforeRender("renderCanvas");
  const factory = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (this: Phaser.GameObjects.GameObjectFactory, x: number, y: number, text: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => Phaser.GameObjects.Text;
  };
  factory.text = function (x, y, text, style) {
    return this.displayList.add(new McLazyText(this.scene, x, y, text, style ?? {})) as Phaser.GameObjects.Text;
  };
}
