import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { McSideStoryStageStyles } from "./mc-side-story-stage.styles.js";
import type { McSideStoryStageProps } from "./mc-side-story-stage.types.js";

/**
 * # Side story stage
 * The reading area and the line under it ("PAGE 2 · PANEL 3"). The comic picture is drawn in the canvas (its camera pans
 * and masks animate every frame), so the reading area is an empty box the scene reads (`readingArea`) and leaves a hole
 * at: the picture is seen through it, and a tap there reaches the scene's own zone.
 *
 * @element mc-side-story-stage
 */
export class McSideStoryStage extends LitElement implements McSideStoryStageProps {
  static override styles = [ThemeStyles, McSideStoryStageStyles];

  static override properties: PropertyDeclarations = {
    where: { type: String },
  };

  declare where: string;

  constructor() {
    super();
    this.where = "";
  }

  /** The box the comic picture is shown in. */
  get readingArea(): HTMLElement | null {
    return this.renderRoot.querySelector(".reading");
  }

  override render() {
    return html`<div class="reading"></div>
      <div class="where" role="status">${this.where}</div>`;
  }
}
