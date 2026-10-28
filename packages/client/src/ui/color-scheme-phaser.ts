/**
 * Where dark mode (#459, `view/color-scheme.ts`) meets Phaser: the few drawing entry points every screen's colors pass
 * through take the scheme's color for their channel, so no screen has to know which scheme is up.
 *
 *  - fill: `Graphics.fillStyle`, a shape's `setFillStyle` (`add.rectangle(…, color)` goes through it), a camera's
 *    background and a text's background;
 *  - line: `Graphics.lineStyle` and a shape's `setStrokeStyle`;
 *  - text: a text style's color, however it is set (`textStyle(...)` in `add.text`, `setColor`, `setStyle`).
 *
 * Textures are never touched: card art, card faces (painted off the main thread, `art/card-face.ts`) and any baked
 * glyph draw exactly as they are.
 *
 * Flipping the toggle recolors what is already on screen in place, so the Board, a popup or a half-built deck never
 * has to be rebuilt: each graphics object remembers where in its command buffer a scheme color sits, and shapes,
 * texts and cameras carry their colors as plain fields.
 */
import Phaser from "phaser";
import {
  colorScheme,
  onColorSchemeChange,
  schemeColor,
  schemeCss,
  type ColorChannel,
  type ColorScheme,
} from "../view/color-scheme.js";
import {
  FILL_STYLE_COLOR_AT,
  GRADIENT_FILL_COLORS_AT,
  LINE_STYLE_COLOR_AT,
  recolorBuffer,
  slotOf,
  type ColorSlot,
} from "../view/color-slots.js";

/** Command-buffer indexes holding a scheme color, with their channel, per graphics object. */
const slots = new WeakMap<Phaser.GameObjects.Graphics, ColorSlot[]>();

let installed = false;

/** Patch the drawing entry points (once) and recolor every running screen whenever the scheme changes. */
export function installColorScheme(game: Phaser.Game): void {
  if (!installed) {
    installed = true;
    patchGraphics();
    patchShapes();
    patchText();
    patchCameras();
  }
  onColorSchemeChange((next, previous) => recolorGame(game, next, previous));
}

const now = (color: number, channel: ColorChannel): number => schemeColor(color, channel, colorScheme());

function track(graphics: Phaser.GameObjects.Graphics, slot: ColorSlot | null): void {
  if (!slot) return;
  let list = slots.get(graphics);
  if (!list) slots.set(graphics, (list = []));
  list.push(slot);
}

function patchGraphics(): void {
  const proto = Phaser.GameObjects.Graphics.prototype;
  const { fillStyle, lineStyle, clear } = proto;
  proto.fillStyle = function (this: Phaser.GameObjects.Graphics, color: number, alpha?: number) {
    const start = this.commandBuffer.length;
    const drawn = now(color, "fill");
    fillStyle.call(this, drawn, alpha);
    track(this, slotOf(start, FILL_STYLE_COLOR_AT, drawn, "fill"));
    return this;
  };
  proto.lineStyle = function (this: Phaser.GameObjects.Graphics, width: number, color: number, alpha?: number) {
    const start = this.commandBuffer.length;
    const drawn = now(color, "line");
    lineStyle.call(this, width, drawn, alpha);
    track(this, slotOf(start, LINE_STYLE_COLOR_AT, drawn, "line"));
    return this;
  };
  // A scroll list's fade (`ui/virtual-list.ts`): drawn to its own ground's color, so it takes that ground's scheme.
  // `Commands.GRADIENT_FILL_STYLE, alpha ×4, color ×4`, as Phaser 4 lays it out.
  const { fillGradientStyle } = proto;
  proto.fillGradientStyle = function (
    this: Phaser.GameObjects.Graphics,
    topLeft: number,
    topRight: number,
    bottomLeft: number,
    bottomRight: number,
    alphaTopLeft?: number,
    alphaTopRight?: number,
    alphaBottomLeft?: number,
    alphaBottomRight?: number,
  ) {
    const start = this.commandBuffer.length;
    const corners = [topLeft, topRight, bottomLeft, bottomRight].map((color) => now(color, "fill"));
    fillGradientStyle.call(
      this,
      corners[0]!,
      corners[1]!,
      corners[2]!,
      corners[3]!,
      alphaTopLeft,
      alphaTopRight,
      alphaBottomLeft,
      alphaBottomRight,
    );
    corners.forEach((color, i) => track(this, slotOf(start, GRADIENT_FILL_COLORS_AT[i]!, color, "fill")));
    return this;
  };
  proto.clear = function (this: Phaser.GameObjects.Graphics) {
    slots.delete(this);
    return clear.call(this);
  };
}

function patchShapes(): void {
  const proto = Phaser.GameObjects.Shape.prototype;
  const { setFillStyle, setStrokeStyle } = proto;
  proto.setFillStyle = function (this: Phaser.GameObjects.Shape, color?: number, alpha?: number) {
    return setFillStyle.call(this, color === undefined ? color : now(color, "fill"), alpha);
  };
  proto.setStrokeStyle = function (this: Phaser.GameObjects.Shape, width?: number, color?: number, alpha?: number) {
    return setStrokeStyle.call(this, width, color === undefined ? color : now(color, "line"), alpha);
  };
}

type StyleRecord = Record<string, unknown>;

function patchText(): void {
  const proto = Phaser.GameObjects.TextStyle.prototype;
  const { setStyle, setColor, setBackgroundColor } = proto;
  const scheme = colorScheme;
  proto.setStyle = function (
    this: Phaser.GameObjects.TextStyle,
    style: Phaser.Types.GameObjects.Text.TextStyle,
    updateText?: boolean,
    setDefaults?: boolean,
  ) {
    if (!style || scheme() === "light") return setStyle.call(this, style, updateText, setDefaults);
    const record = { ...(style as StyleRecord) };
    for (const key of ["color", "fill"]) {
      const value = record[key];
      if (typeof value === "string") record[key] = schemeCss(value, "text", scheme());
    }
    if (typeof record["backgroundColor"] === "string") {
      record["backgroundColor"] = schemeCss(record["backgroundColor"] as string, "fill", scheme());
    }
    return setStyle.call(this, record as Phaser.Types.GameObjects.Text.TextStyle, updateText, setDefaults);
  };
  proto.setColor = function (this: Phaser.GameObjects.TextStyle, color: string | CanvasGradient | CanvasPattern) {
    return setColor.call(this, typeof color === "string" ? schemeCss(color, "text", scheme()) : color);
  };
  proto.setBackgroundColor = function (this: Phaser.GameObjects.TextStyle, color: string) {
    return setBackgroundColor.call(this, typeof color === "string" ? schemeCss(color, "fill", scheme()) : color);
  };
}

function patchCameras(): void {
  const proto = Phaser.Cameras.Scene2D.BaseCamera.prototype;
  const { setBackgroundColor } = proto;
  proto.setBackgroundColor = function (
    this: Phaser.Cameras.Scene2D.BaseCamera,
    color?: string | number | Phaser.Types.Display.InputColorObject,
  ) {
    if (typeof color === "string") return setBackgroundColor.call(this, schemeCss(color, "fill", colorScheme()));
    if (typeof color === "number") return setBackgroundColor.call(this, now(color, "fill"));
    return setBackgroundColor.call(this, color);
  };
}

/** Recolor every scene's objects and cameras from `previous` to `next`, in place. */
function recolorGame(game: Phaser.Game, next: ColorScheme, previous: ColorScheme): void {
  for (const scene of game.scene.scenes) {
    const sys = scene.sys;
    if (!sys?.displayList) continue;
    for (const object of sys.displayList.list) recolorObject(object, next, previous);
    for (const camera of sys.cameras?.cameras ?? []) recolorCamera(camera, next, previous);
  }
}

function recolorObject(object: Phaser.GameObjects.GameObject, next: ColorScheme, previous: ColorScheme): void {
  if (object instanceof Phaser.GameObjects.Graphics) {
    recolorBuffer(object.commandBuffer as number[], slots.get(object) ?? [], next, previous);
  } else if (object instanceof Phaser.GameObjects.Text) {
    const style = object.style;
    if (typeof style.color === "string") {
      const color = schemeCss(style.color, "text", next, previous);
      // Straight to the stored field and one update: going through the patched `setColor` would map it again.
      if (color !== style.color) {
        style.color = color;
        style.update(false);
      }
    }
    if (typeof style.backgroundColor === "string") {
      const ground = schemeCss(style.backgroundColor, "fill", next, previous);
      if (ground !== style.backgroundColor) {
        style.backgroundColor = ground;
        style.update(false);
      }
    }
  } else if (object instanceof Phaser.GameObjects.Shape) {
    // Fields, not the patched setters, for the same reason.
    if (object.isFilled) object.fillColor = schemeColor(object.fillColor, "fill", next, previous);
    if (object.isStroked) object.strokeColor = schemeColor(object.strokeColor, "line", next, previous);
  }
  const children = (object as { list?: unknown }).list;
  if (Array.isArray(children)) {
    for (const child of children) recolorObject(child as Phaser.GameObjects.GameObject, next, previous);
  }
}

function recolorCamera(camera: Phaser.Cameras.Scene2D.BaseCamera, next: ColorScheme, previous: ColorScheme): void {
  const ground = camera.backgroundColor;
  const color = schemeColor(ground.color, "fill", next, previous);
  if (color === ground.color) return;
  ground.setTo((color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, ground.alpha);
}
