import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { sideStoryEvent } from "../../../components/side-story/shared/side-story-events.types.js";
import "../../../components/side-story/mc-side-story-stage/mc-side-story-stage.js";
import "../../../components/side-story/mc-side-story-actions/mc-side-story-actions.js";
import type { McSideStoryStage } from "../../../components/side-story/mc-side-story-stage/McSideStoryStage.js";
import { McSideStoryPageStyles } from "./mc-side-story-page.styles.js";
import type { SideStoryPageModel } from "./mc-side-story-page.types.js";

/**
 * # Side story (page)
 * The side-story reader's chrome as one element that only composes: the shared `mc-reader` frame (`@mc/ui`) holding the
 * header, the reading area with its page line, and the action bar. The comic picture is drawn in the canvas and shown
 * through the reading area (`readingArea`). The scene mounts it in a `DomRegion`, sets `model` and listens for
 * `mc-side-story`.
 *
 * @element mc-side-story-page
 * @prop model - `SideStoryPageModel`.
 * @fires mc-side-story - `SideStoryEventDetail`, from any section.
 */
export class McSideStoryPage extends LitElement {
  static override styles = [ThemeStyles, McSideStoryPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: SideStoryPageModel | null;

  constructor() {
    super();
    this.model = null;
  }

  /** The box the comic picture is shown in: the scene reads its rect and leaves a hole there. */
  get readingArea(): HTMLElement | null {
    return this.renderRoot.querySelector<McSideStoryStage>("mc-side-story-stage")?.readingArea ?? null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<mc-reader no-side pane="main">
      <mc-top-bar
        slot="bar"
        ?compact=${m.compact}
        .eyebrow=${m.header.label}
        .heading=${m.header.title}
        .subtitle=${m.header.credit}
      >
        <mc-hint-button
          slot="end"
          class="close"
          data-stop="close"
          kind="onInk"
          .label=${m.header.closeLabel}
          .glyph=${m.header.closeGlyph}
          @mc-press=${(event: Event) => {
            event.stopPropagation();
            this.dispatchEvent(sideStoryEvent({ type: "close" }));
          }}
        ></mc-hint-button>
      </mc-top-bar>
      <mc-side-story-stage slot="main" .where=${m.where}></mc-side-story-stage>
      <mc-side-story-actions
        slot="foot"
        ?compact=${m.compact}
        ?has-back=${m.actions.hasBack}
        .backLabel=${m.actions.backLabel}
        .nextLabel=${m.actions.nextLabel}
        .nextGlyph=${m.actions.nextGlyph}
      ></mc-side-story-actions>
    </mc-reader>`;
  }
}

if (!customElements.get("mc-side-story-page")) {
  customElements.define("mc-side-story-page", McSideStoryPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-side-story-page": McSideStoryPage;
  }
}
