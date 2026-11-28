import { html, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { ViewerElement } from "../shared/ViewerElement.js";
import { McViewerHeaderStyles } from "./mc-viewer-header.styles.js";
import type { McViewerHeaderProps } from "./mc-viewer-header.types.js";

/**
 * # Viewer header
 * The ink head of the viewer: the entry's title in Bangers over a red rule, and the close button (the focus stop `close`).
 *
 * @element mc-viewer-header
 * @fires mc-viewer - `{ type: "close" }`.
 */
export class McViewerHeader extends ViewerElement implements McViewerHeaderProps {
  static override styles = [ThemeStyles, McViewerHeaderStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    closeLabel: { type: String, attribute: "close-label" },
    compact: { type: Boolean, reflect: true },
  };

  declare heading: string;
  declare closeLabel: string;
  declare compact: boolean;

  constructor() {
    super();
    this.heading = "";
    this.closeLabel = "";
    this.compact = false;
  }

  override render() {
    return html`<span class="title">${this.heading}</span>
      <mc-button
        class="close"
        kind="onInk"
        data-stop="close"
        .label=${"✕"}
        aria-label=${this.closeLabel}
        @mc-press=${() => this.emit({ type: "close" })}
      ></mc-button>`;
  }
}
