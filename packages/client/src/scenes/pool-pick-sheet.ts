/**
 * The deck builder's pack and wave picker (issue #977, benpap24): a press on the pack or wave button opens it, and every
 * pack (under its wave) or every wave is a row that toggles, so several are chosen at once instead of stepping through
 * them one at a time. "All" clears the choice. Each press applies at once (the pool behind updates); Done, B or Escape
 * closes it. Like the other sheets it switches off the launching screen's input while up.
 *
 * The sheet is one element, `mc-pool-pick` (`components/deck-builder/`), mounted as an overlay region: the list scrolls
 * natively and every button is a tap, so a swipe that lifts over a row presses nothing. This scene sets its model and
 * answers its `mc-deck-builder` events.
 */
import "@mc/ui";
import "../components/deck-builder/mc-pool-pick/mc-pool-pick.js";
import { t } from "../i18n/translate.js";
import type { FilterChoice } from "../view/deck-builder-model.js";
import { togglePick } from "../view/deck-builder-model.js";
import { poolPickRowsOf } from "../view/pool-pick-rows.js";
import { DeckBuilderSheetScene } from "./deck-builder/sheet-scene.js";
import { SCENES } from "./keys.js";

export interface PoolPickSheetData {
  /** The scene that asked: its pointer input is off while this is up. */
  readonly from: string;
  readonly title: string;
  /** What the pool offers plus every current pick, in release order (`choicesWithPicks`); a pack's `group` is its wave. */
  readonly choices: readonly FilterChoice[];
  readonly chosen: readonly string[];
  /** Every press: the new choice (empty is all). */
  readonly onChange: (chosen: readonly string[]) => void;
  /** The sheet closed, by any route. */
  readonly onClose: () => void;
}

export class PoolPickSheet extends DeckBuilderSheetScene<"mc-pool-pick"> {
  #data!: PoolPickSheetData;
  #chosen: readonly string[] = [];

  constructor() {
    super(SCENES.poolPick);
  }

  create(data: PoolPickSheetData): void {
    this.#data = data;
    this.#chosen = data.chosen;
    this.openSheet(
      "mc-pool-pick",
      data.from,
      (detail) => {
        if (detail.type === "pick-all") this.#set([]);
        else if (detail.type === "pick-toggle") this.#set(togglePick(this.#chosen, detail.id));
        else if (detail.type === "sheet-close") this.close();
      },
      data.onClose,
    );
    this.redraw();
  }

  #set(chosen: readonly string[]): void {
    this.#chosen = chosen;
    this.#data.onChange(chosen);
    this.redraw();
  }

  protected redraw(): void {
    this.show({
      title: this.#data.title,
      subtitle: t("deckBuilder.pickSubtitle"),
      allLabel: t("deckBuilder.pickAll"),
      allChosen: this.#chosen.length === 0,
      rows: poolPickRowsOf(this.#data.choices, this.#chosen),
      doneLabel: t("deckBuilder.pickDone"),
    });
  }
}
