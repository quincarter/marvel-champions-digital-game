import { html, nothing, type PropertyDeclarations } from "lit";
import { McPress, type McListRowModel } from "@mc/ui";
import { McExtrasTrackStyles } from "./mc-extras-track.styles.js";
import type { McExtrasTrackProps } from "./mc-extras-track.types.js";

/**
 * # Extras track
 * One song of the Music tab: a badge row (the play or stop mark, the title, where it plays or what opens it) that is
 * itself the press control (`McPress`: a tap, or the focus route pressing it, raises `mc-pressed` with its `action`).
 * The playing song is an ink row; a locked one dims its title and prints the red "what opens it" line.
 *
 * @element mc-extras-track
 * @fires mc-pressed - `PressDetail`.
 */
export class McExtrasTrack extends McPress implements McExtrasTrackProps {
  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    model: { attribute: false },
  };

  declare model: McListRowModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    return this.model ? html`<mc-list-row .model=${this.model}></mc-list-row>` : nothing;
  }

  static override styles = [McExtrasTrackStyles];
}
