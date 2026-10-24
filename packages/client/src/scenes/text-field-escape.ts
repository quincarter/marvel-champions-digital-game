/**
 * Lets a pad leave a text field it put the caret in.
 *
 * A screen's route stands aside while its search or seed field has the caret (`McTextInput.focused`), so the pad's
 * buttons all went to the held route and nothing could end the typing: a controller player who pressed A on the field
 * was stuck there (the keyboard has Enter and Escape inside the field itself, `ui/widgets.ts`). While a field is
 * focused, B, A and Start take the caret out. The route hears nothing from that press: it is held while the field
 * has the caret, and the caret leaves a frame later, so the same press cannot also back out of the screen.
 */

import type Phaser from "phaser";
import type { McTextInput } from "../ui/widgets.js";
import { bindExtraInput } from "./extra-input.js";

export function bindTextFieldEscape(
  scene: Phaser.Scene,
  field: () => McTextInput | null,
  /** True while something above the screen owns the pad (a sheet): then the field is not the pad's to leave. */
  covered: () => boolean = () => false,
): void {
  const leave = (): void => {
    scene.time.delayedCall(0, () => field()?.blur());
  };
  bindExtraInput(scene, {
    blocked: () => covered() || !(field()?.focused ?? false),
    intents: { cancel: leave, activate: leave, pause: leave },
  });
}
