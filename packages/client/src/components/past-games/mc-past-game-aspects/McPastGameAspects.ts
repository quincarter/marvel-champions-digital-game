import { html, LitElement, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { McPastGameAspectsStyles } from "./mc-past-game-aspects.styles.js";
import type { AspectBadge, McPastGameAspectsProps } from "./mc-past-game-aspects.types.js";

/** How long a name is, by the room it needs: 41px for a short one, 55px for JUSTICE, 76px for the ten-letter aspects. */
const fitOf = (full: string): "short" | "mid" | "long" =>
  full.length <= 5 ? "short" : full.length <= 7 ? "mid" : "long";

/**
 * # Past game aspects
 * The aspect chips along the foot of a hero's picture: one per aspect the seat's deck used, side by side across the
 * picture's width, each in the aspect's printed frame colour and saying its name, else a three-letter code, else its
 * first letter, by the room it has (a container query on each chip, so no width is measured). Never colour alone.
 *
 * @element mc-past-game-aspects
 * @prop badges - The chips (`AspectBadge`).
 */
export class McPastGameAspects extends LitElement implements McPastGameAspectsProps {
  static override styles = [McPastGameAspectsStyles];

  static override properties: PropertyDeclarations = { badges: { attribute: false } };

  declare badges: readonly AspectBadge[];

  constructor() {
    super();
    this.badges = [];
  }

  override render() {
    return html`${repeat(
      this.badges,
      (badge) => badge.id,
      (badge) =>
        html`<span
          class="chip"
          style=${`--chip-fill:var(--mc-fill-${badge.id});--chip-ink:var(--mc-text-on-${badge.id})`}
          ><span class="word" data-fit=${fitOf(badge.full)}
            ><span class="letter">${badge.letter}</span><span class="code">${badge.code}</span
            ><span class="full">${badge.full}</span></span
          ></span
        >`,
    )}`;
  }
}
