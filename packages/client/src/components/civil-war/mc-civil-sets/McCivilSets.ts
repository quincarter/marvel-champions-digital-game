import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import "../../table-setup/mc-setup-set-tile/mc-setup-set-tile.js";
import type { SetupEventDetail } from "../../table-setup/shared/setup-events.types.js";
import type { SetTileInput } from "../../table-setup/mc-setup-set-tile/mc-setup-set-tile.types.js";
import type { ModularStepView, SetTileView } from "../../../view/civil-war-builder-model.js";
import { CIVIL_WAR_EVENT, type CivilMode, type CivilPictures, type CivilWarEventDetail } from "../civil-war.types.js";
import { McCivilSetsStyles } from "./mc-civil-sets.styles.js";

/**
 * # Civil War modular sets
 * Step 4: the counter line, then the candidate sets in sections (this side's, the others, and the other side's behind a
 * fold). Each set is the Set up the table `mc-setup-set-tile` (its stops are `civil:set:<id>`): a white tile with the set's
 * most recognizable card, its name and a line of "Recommended", why it cannot be picked now or its card count, red-bordered
 * when chosen, faded when it cannot be picked; a tap picks it and its picture or "Cards" tab opens the cards in the set. A
 * blind scenario shows only how many are chosen.
 *
 * @element mc-civil-sets
 * @prop modular - `ModularStepView`.
 * @prop pictures - `CivilPictures`.
 * @attr mode - wide | tablet | phone.
 * @fires mc-civil-war - `act` for a tile or the fold, `sheet` to open its cards.
 */
export class McCivilSets extends LitElement {
  static override styles = [McCivilSetsStyles];

  static override properties: PropertyDeclarations = {
    modular: { attribute: false },
    pictures: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare modular: ModularStepView | null;
  declare pictures: CivilPictures | null;
  declare mode: CivilMode;
  /** Each tile's builder action, by set id: what a tap on its tile sends. */
  #actions = new Map<string, string>();

  constructor() {
    super();
    this.modular = null;
    this.pictures = null;
    this.mode = "wide";
    new FeatureRelay<CivilWarEventDetail>(this, CIVIL_WAR_EVENT);
    this.addEventListener("mc-setup", this.#setup as EventListener);
  }

  /** The tile's own `mc-setup` event, as the builder's: a toggle is the tile's action, the cards open the sheet. */
  readonly #setup = (event: CustomEvent<SetupEventDetail>): void => {
    event.stopPropagation();
    const detail = event.detail;
    if (detail.type === "modular-toggle") {
      const action = this.#actions.get(detail.id);
      if (action) this.#say({ type: "act", action });
    } else if (detail.type === "modular-cards") this.#say({ type: "sheet", id: detail.id });
  };

  #say(detail: CivilWarEventDetail): void {
    this.dispatchEvent(
      new CustomEvent<CivilWarEventDetail>(CIVIL_WAR_EVENT, { detail, bubbles: true, composed: true }),
    );
  }

  #tileOf(tile: SetTileView): SetTileInput {
    const face = tile.faces[0];
    const count = [`${tile.cardCount} cards`, tile.descriptor].filter((x): x is string => Boolean(x)).join(" · ");
    const label = [tile.recommended ? "Recommended" : null, tile.capNote ?? null, tile.disabledReason ?? count]
      .filter(Boolean)
      .join(" · ");
    return {
      id: tile.id,
      name: tile.name,
      label:
        tile.enabled || tile.capNote
          ? [tile.recommended ? "Recommended" : null, tile.capNote ?? null, count].filter(Boolean).join(" · ")
          : label,
      selected: tile.selected,
      // A tap on a set that cannot be picked still says why: the builder's refusal is its status line.
      barred: false,
      dim: !tile.enabled,
      picture:
        face && this.pictures ? { source: this.pictures.face(face), cardId: face.cardId, face: face.face } : null,
    };
  }

  override render() {
    const modular = this.modular;
    if (!modular) return nothing;
    this.#actions = new Map(modular.sections.flatMap((s) => s.tiles.map((tile) => [tile.id, tile.action] as const)));
    const counter = modular.hidden
      ? `${modular.chosen} modular sets chosen, hidden.`
      : `${modular.counterLine}${modular.hint ? ` ${modular.hint}.` : ""}`;
    const tileMode = this.mode === "phone" ? "phone" : "wide";
    return html`<p class="counter">${counter}</p>
      ${modular.sections.map(
        (section) =>
          html`<section>
            ${
              section.key === "otherSide"
                ? html`<mc-press-card
                    class="fold"
                    .stop=${"civil:other-side"}
                    .action=${{ type: "act", action: "civil:other-side" } satisfies CivilWarEventDetail}
                    >${
                      section.expanded
                        ? `▾ ${section.label}: not used with this leader`
                        : `▸ ${section.collapsedLine ?? section.label}`
                    }</mc-press-card
                  >`
                : html`<h3 class="label">${section.label}</h3>`
            }
            <div class="tiles">
              ${section.tiles.map(
                (tile) =>
                  html`<mc-setup-set-tile
                    stop-prefix="civil:set:"
                    mode=${tileMode}
                    .tile=${this.#tileOf(tile)}
                  ></mc-setup-set-tile>`,
              )}
            </div>
          </section>`,
      )}`;
  }
}
