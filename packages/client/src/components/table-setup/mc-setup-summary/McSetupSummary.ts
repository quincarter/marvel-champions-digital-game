import { watchCard, type McFieldFocusDetail, type McInputDetail } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { t } from "../../../i18n/translate.js";
import { setupEvent, type SetupMode } from "../shared/setup-events.types.js";
import { SetupRelay } from "../shared/setup-relay.js";
import type { SummaryInput } from "./mc-setup-summary.types.js";
import { McSetupSummaryStyles } from "./mc-setup-summary.styles.js";

/** The rows the engine's summary has: any more are not shown. */
const SUMMARY_ROWS = 7;

/**
 * # Setup summary section
 * The "game you'll get" section: the engine's own summary of the game being set up (label over value, paper on ink), the
 * shuffle seed with Reroll, the watch toggle and the villain's picture. On a phone it is the seed card and the watch row
 * in the page's flow. The one red action, Deal it out, is the deal bar's (`mc-setup-deal-bar`). The seed field's text and
 * caret are the scene's: it raises `seed-input` and `seed-focus` and is handed the text back.
 *
 * @element mc-setup-summary
 * @prop input - What it shows (`SummaryInput`).
 * @attr mode - wide (the ink sidebar) | phone (paper, in the page's flow).
 * @fires mc-setup - `seed-input`, `seed-focus`, `reroll`, `watch`.
 */
export class McSetupSummary extends LitElement {
  static override styles = McSetupSummaryStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare input: SummaryInput | null;
  declare mode: SetupMode;
  #watched: HTMLElement | null = null;
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.input = null;
    this.mode = "wide";
    new SetupRelay(this);
  }

  protected override updated(): void {
    const pic = this.renderRoot.querySelector<HTMLElement>(".villain .pic");
    if (pic === this.#watched) return;
    this.#unwatch?.();
    this.#watched = pic;
    this.#unwatch = pic
      ? watchCard(pic, () => {
          const id = this.input?.villain?.cardId;
          return id ? { cardId: id } : null;
        })
      : null;
  }

  override disconnectedCallback(): void {
    this.#unwatch?.();
    this.#unwatch = null;
    this.#watched = null;
    super.disconnectedCallback();
  }

  /** The scene's hand on the field: Enter on the seed stop puts the caret in it. */
  focusSeed(): void {
    this.renderRoot.querySelector<HTMLElement & { focusInput(): void }>("mc-text-field")?.focusInput();
  }

  /** Takes the caret out of the field (a pad's B, A or Start). */
  blurSeed(): void {
    this.renderRoot.querySelector<HTMLElement & { blurInput(): void }>("mc-text-field")?.blurInput();
  }

  #typed = (event: CustomEvent<McInputDetail>): void => {
    event.stopPropagation();
    this.dispatchEvent(setupEvent({ type: "seed-input", value: event.detail.value }));
  };

  #focused = (event: CustomEvent<McFieldFocusDetail>): void => {
    event.stopPropagation();
    this.dispatchEvent(setupEvent({ type: "seed-focus", focused: event.detail.focused }));
  };

  #seed(input: SummaryInput) {
    return html`<div class="seed">
      <mc-text-field
        data-stop="seed"
        .value=${input.seedText}
        placeholder=${t("tableSetup.seedPlaceholder")}
        @mc-input=${this.#typed}
        @mc-field-focus=${this.#focused}
      ></mc-text-field>
      <mc-chip .stop=${"reroll"} label=${t("tableSetup.reroll")} .action=${{ type: "reroll" } as const}></mc-chip>
    </div>`;
  }

  #watch(input: SummaryInput, wide: boolean) {
    if (input.room) return nothing;
    return html`<mc-check-row
      ?onink=${wide}
      .stop=${"watch"}
      name=${t("tableSetup.watch")}
      meta=${wide ? "" : t(input.watchable ? "live.setup.on" : "live.setup.off")}
      ?checked=${input.watchable}
      .action=${{ type: "watch" } as const}
    ></mc-check-row>`;
  }

  #villain(input: SummaryInput) {
    const villain = input.villain;
    if (!villain) return nothing;
    return html`<div class="villain">
      <div class="label">${t("tableSetup.villain", { name: villain.name })}</div>
      <div class="pic"><mc-picture-tile .picture=${villain.picture} frame="2" ground="ink"></mc-picture-tile></div>
    </div>`;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    if (this.mode === "phone")
      return html`<mc-section-heading label=${t("tableSetup.seed")}></mc-section-heading>
        <div class="seedcard">
          <div class="name">${t("tableSetup.seed")}</div>
          <div class="label">${t("tableSetup.seedCaption")}</div>
          ${this.#seed(input)}
        </div>
        ${this.#watch(input, false)}`;
    return html`<mc-section-heading label=${t("tableSetup.summary")} onink></mc-section-heading>
      <div class="rows">
        ${input.rows
          .slice(0, SUMMARY_ROWS)
          .map(
            (row) =>
              html`<div class="row">
                <span class="label">${row.label}</span><span class="value">${row.value}</span>
              </div>`,
          )}
      </div>
      <hr />
      ${this.#seed(input)}
      <div class="help">${t("tableSetup.seedHelp")}</div>
      ${this.#villain(input)} ${this.#watch(input, true)}`;
  }
}
