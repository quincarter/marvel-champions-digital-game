/**
 * The deck builder's search cheat sheet (issue #531): `view/search-help.ts`'s rows in a dialog. Each query has Use, which
 * puts it in the search box and closes the sheet, and Copy, since a canvas can't be selected. Like the other sheets it
 * switches off the launching screen's input while up.
 *
 * The sheet is one element, `mc-search-help` (`components/deck-builder/`), mounted as an overlay region: the list scrolls
 * natively and every button is a tap, so a swipe that lifts over Use or Copy presses nothing. This scene sets its model and
 * answers its `mc-deck-builder` events.
 */
import "@mc/ui";
import "../components/deck-builder/mc-search-help/mc-search-help.js";
import { t } from "../i18n/translate.js";
import { searchHelpRows } from "../view/search-help.js";
import type { SearchHelpModel } from "../components/deck-builder/mc-search-help/mc-search-help.types.js";
import { DeckBuilderSheetScene } from "./deck-builder/sheet-scene.js";
import { SCENES } from "./keys.js";

export interface SearchHelpSheetData {
  /** The scene that asked: its pointer input is off while this is up. */
  readonly from: string;
  /** The player chose Use: the sheet is already closed. */
  readonly onUse: (query: string) => void;
  /** The sheet closed, by any route. */
  readonly onClose: () => void;
}

export class SearchHelpSheet extends DeckBuilderSheetScene<"mc-search-help"> {
  #data!: SearchHelpSheetData;
  /** The row whose Copy just ran, and whether it worked: its button says so. */
  #copied: { readonly index: number; readonly ok: boolean } | null = null;

  constructor() {
    super(SCENES.searchHelp);
  }

  create(data: SearchHelpSheetData): void {
    this.#data = data;
    this.#copied = null;
    this.openSheet(
      "mc-search-help",
      data.from,
      (detail) => {
        if (detail.type === "help-use") this.#use(detail.query);
        else if (detail.type === "help-copy") this.#copy(detail.index, detail.query);
        else if (detail.type === "sheet-close") this.close();
      },
      data.onClose,
    );
    this.redraw();
  }

  #use(query: string): void {
    const { onUse } = this.#data;
    this.close();
    onUse(query);
  }

  #copy(index: number, query: string): void {
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    const done = (ok: boolean): void => {
      if (!this.sys.isActive()) return;
      this.#copied = { index, ok };
      this.redraw();
    };
    if (!clipboard?.writeText) {
      done(false);
      return;
    }
    clipboard.writeText(query).then(
      () => done(true),
      () => done(false),
    );
  }

  protected redraw(): void {
    const model: SearchHelpModel = {
      title: t("searchHelp.title"),
      backLabel: t("searchHelp.back"),
      useLabel: t("searchHelp.use"),
      copyLabel: t("searchHelp.copy"),
      copiedLabel: t("searchHelp.copied"),
      failedLabel: t("searchHelp.failed"),
      rows: searchHelpRows(),
      copied: this.#copied,
    };
    this.show(model);
  }
}
