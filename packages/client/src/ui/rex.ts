/**
 * The rexUI seam: the one file that reaches into the toolkit (PLAN.md Phase 4,
 * "UI toolkit: rexUI behind our own widget layer").
 *
 * **Two components imported directly, not the `RexUIPlugin`.** rexUI's normal
 * entry point is `templates/ui/ui-plugin.js`, which registers an `ObjectFactory`
 * covering the *entire* component library — every dialog, chart, spinner and
 * progress bar — whether or not a factory is ever called. Registering it to use
 * two components cost **1.1 MB** of the minified bundle (1.6 MB → 2.7 MB),
 * which is a poor trade for a game PLAN.md intends to package to mobile later,
 * and runs against Phase 4's own performance guardrails.
 *
 * Each rexUI component also ships its own module, and the factory it registers
 * is exactly `new Component(scene, config)` followed by `scene.add.existing(…)`
 * (see `templates/ui/textarea/Factory.js`). So constructing them directly is
 * not a workaround — it is the same call the factory would have made, minus the
 * library-wide registration. `add*` below is that one line, kept here so
 * `widgets.ts` reads the same as it did through the plugin.
 *
 * Nothing else in the app imports rexUI: scenes go through the `Mc*` widgets,
 * which is the seam that keeps the toolkit swappable.
 */

import type Phaser from "phaser";
import TextArea from "phaser4-rex-plugins/templates/ui/textarea/TextArea.js";
import InputText from "phaser4-rex-plugins/templates/ui/inputtext/InputText.js";
import TextAreaInput from "phaser4-rex-plugins/templates/ui/textareainput/TextAreaInput.js";
import { SetMask, ClearMask, type MaskType } from "phaser4-rex-plugins/plugins/utils/mask/MaskMethods.js";

export { TextArea, InputText, TextAreaInput };

/**
 * Clips `gameObject` to `maskGameObject`'s shape, in both renderers.
 *
 * **Why this exists rather than `gameObject.setMask(shape.createGeometryMask())`:**
 * that call is a silent no-op under WebGL in Phaser 4 — `Components.Mask#setMask`
 * only logs "This method is not supported in WebGL. Create a Mask filter
 * instead." and does nothing (`GeometryMask` became Canvas-only in v4; see the
 * v4.0 migration guide). The app runs WebGL (PLAN.md Phase 4, "Use the WebGL
 * renderer"), so anything masked that way never actually clips — every row a
 * `McVirtualList` draws rendered over whatever the scene drew before or after
 * it, unclipped, which read as "rows overlap everything above and below the
 * list."
 *
 * rexUI's own `SetMask` (`plugins/utils/mask/MaskMethods.js`) already branches
 * on render mode — a WebGL filter mask or a Canvas `GeometryMask` — and our
 * rexUI scroll panels (`McScrollPanel`'s `TextArea`) already clip correctly
 * through it, so this is the same helper, not a new one.
 *
 * `maskType: "world"` matches the external/world filter context, so the mask
 * shape's coordinates stay in world space — the same space `#layoutTrack`
 * (and every other caller) already draws the mask rect in.
 */
export function setMask(gameObject: Phaser.GameObjects.GameObject, maskGameObject: Phaser.GameObjects.GameObject, maskType: MaskType = "world"): void {
  SetMask(gameObject, maskGameObject, false, maskType);
}

export function clearMask(gameObject: Phaser.GameObjects.GameObject): void {
  ClearMask(gameObject);
}

/** What `rexUI.add.textArea(config)` did: construct, then adopt into the scene. */
export function addTextArea(scene: Phaser.Scene, config: ConstructorParameters<typeof TextArea>[1]): TextArea {
  const gameObject = new TextArea(scene, config);
  scene.add.existing(gameObject as unknown as Phaser.GameObjects.GameObject);
  return gameObject;
}

/** What `rexUI.add.inputText(config)` did. Its element is the app's only DOM. */
export function addInputText(scene: Phaser.Scene, config: ConstructorParameters<typeof InputText>[1]): InputText {
  const gameObject = new InputText(scene, config);
  scene.add.existing(gameObject as unknown as Phaser.GameObjects.GameObject);
  return gameObject;
}

/**
 * What `rexUI.add.textAreaInput(config)` did: a multi-line, wrapped, scrollable
 * editable field (`McTextInput`'s multiline sibling for pasting a decklist,
 * PLAN.md Phase 9). Its text is canvas-drawn (`CanvasInput`/`DynamicText`), not
 * a visible DOM element the way `InputText` is — a single-line `<input>` would
 * silently strip the newlines a real decklist paste depends on, which is the
 * whole reason this exists rather than reusing `McTextInput`. It still opens a
 * hidden, unstyled native text-edit element to capture keystrokes and paste
 * events, exactly as `InputText` does; nothing here adds a *visible* second
 * kind of DOM control to the app.
 */
export function addTextAreaInput(scene: Phaser.Scene, config: ConstructorParameters<typeof TextAreaInput>[1]): TextAreaInput {
  const gameObject = new TextAreaInput(scene, config);
  scene.add.existing(gameObject as unknown as Phaser.GameObjects.GameObject);
  return gameObject;
}
