import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type McTipChip } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McAspectPickerStyles } from "./mc-aspect-picker.styles.js";
import type { AspectPickerModel } from "./mc-aspect-picker.types.js";

/**
 * # Aspect picker
 * One chip per choosable aspect in the aspect's own card-frame colors (a tint is a fill, so what is chosen is also said by
 * the tick on the chip, never by colour alone), each with an "i" segment that opens the aspect's tip. A mouse resting on
 * the "i" says so (`aspect-hover`) and the scene opens the tip after a pause; a tap opens it at once.
 *
 * Focus stops: `aspect:<aspect>`.
 *
 * @element mc-aspect-picker
 * @prop model - The picker (`AspectPickerModel`).
 * @fires mc-deck-builder - `aspect`, `aspect-info`, `aspect-hover`.
 */
export class McAspectPicker extends BuilderElement {
  static override styles = [ThemeStyles, McAspectPickerStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: AspectPickerModel | null;
  readonly #hovered = new WeakSet<Element>();

  constructor() {
    super();
    this.model = null;
  }

  /** The "i" segment of `aspect`'s chip, once drawn: where its tip points. Null when it has none. */
  async infoElementOf(aspect: string): Promise<HTMLElement | null> {
    await this.updateComplete;
    const chip = this.renderRoot.querySelector<McTipChip>(`mc-tip-chip[data-aspect="${CSS.escape(aspect)}"]`);
    if (!chip) return null;
    await chip.updateComplete;
    return chip.infoElement;
  }

  protected override updated(): void {
    // A mouse over an "i" (a finger never hovers) says so, so the scene can open its tip after a pause.
    for (const chip of this.renderRoot.querySelectorAll<McTipChip>("mc-tip-chip")) {
      void chip.updateComplete.then(() => {
        const info = chip.infoElement;
        if (!info || this.#hovered.has(info)) return;
        this.#hovered.add(info);
        const tell = (over: boolean) => (event: PointerEvent) => {
          if (event.pointerType === "mouse") this.emit({ type: "aspect-hover", aspect: chip.value, over });
        };
        info.addEventListener("pointerenter", tell(true));
        info.addEventListener("pointerleave", tell(false));
      });
    }
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<div class="label">${model.label}</div>
      <div class="chips">
        ${model.chips.map(
          (chip) =>
            html`<mc-tip-chip
              data-aspect=${chip.aspect}
              .value=${chip.aspect}
              .label=${chip.label}
              .tint=${{ fill: chip.fill, ink: chip.ink }}
              .stop=${`aspect:${chip.aspect}`}
              .infoLabel=${chip.infoLabel ?? ""}
              .size=${11}
              ?selected=${chip.selected}
              ?disabled=${chip.disabled !== null}
              .reason=${chip.disabled && chip.disabled !== "" ? chip.disabled : ""}
              ?info-open=${chip.infoOpen}
              @mc-activate=${(event: Event) => {
                event.stopPropagation();
                this.emit({ type: "aspect", aspect: chip.aspect });
              }}
              @mc-info=${(event: Event) => {
                event.stopPropagation();
                this.emit({ type: "aspect-info", aspect: chip.aspect });
              }}
            ></mc-tip-chip>`,
        )}
      </div>`;
  }
}
