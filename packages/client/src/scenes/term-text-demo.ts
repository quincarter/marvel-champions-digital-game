/**
 * Dev-only screenshot/click-through entry point for `McTermText`/`McTooltip` (guided mode G3b,
 * `docs/guided-mode.md` §4), reached with `?screen=termtext` (`scenes/boot.ts`'s dev-jump list) — there
 * is no in-game way to reach this screen; it exists only so this pair of widgets can be exercised by
 * hand and by a headless click-through before any real guide surface (G4a) embeds them.
 *
 * Two `McTermText` blocks share one `McTooltip`, over a plain paper ground: a short one near the top
 * (for an "opens near the top edge, flips below" check) and a longer paragraph lower down. Tab cycles
 * keyboard focus across both blocks' terms one at a time (`McTermText#focusNext`), Enter/Space opens the
 * focused term, and Escape closes an open tooltip (`McTooltip#handleEscape`, consulted first — this
 * scene is the only one on the stack here, so the usual multi-scene Escape ordering gotcha
 * (`ui/coach-state.ts`) doesn't apply, but the call shape still matches what a real host scene would do).
 *
 * **Coordinating `setTermsEnabled` across blocks.** With more than one `McTermText` sharing a tooltip, the
 * host — this scene today, a real guide surface later — is the only thing that knows about every block, so
 * it's the one that calls `setTermsEnabled` on all of them when any one opens or closes (`McTermText`'s own
 * doc comment on that method has the "why": a term zone the open tooltip visually covers is still
 * hit-testable unless disabled, and can otherwise steal the pointer on its way to the tooltip's own link).
 */
import Phaser from "phaser";
import { surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McTermText } from "../ui/term-text.js";
import { McTooltip } from "../ui/tooltip.js";
import type { TermTextTerm } from "../view/term-text-model.js";
import { tooltipContentOf } from "../view/term-text-model.js";
import { SCENES } from "./keys.js";
import type { RulesSceneData } from "./rules.js";

const TOP_TEXT =
  "This lesson is about [[threat]]. Once the [[mainScheme]] reaches its printed value, you lose the game.";
const BODY_TEXT =
  "Every [[villainPhase]], the villain adds [[acceleration]] to the main scheme, then activates against you. " +
  "If you're in [[heroAlterEgoForm]], playing an [[ally]] or a [[resource]] card can help you [[thwart]] next turn. " +
  "A card you can't afford to play stays in hand until you [[flip]] or [[recover]]. If you're " +
  "[[exhausted|exhausted]], you can't act again until something [[ready|readies]] you.";

export class TermTextDemoScene extends Phaser.Scene {
  #tooltip!: McTooltip;
  #blocks: McTermText[] = [];
  #focusedBlock = -1;

  constructor() {
    super(SCENES.termTextDemo);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(surface.paper.css);
    this.add.text(24, 16, "MCTERMTEXT DEV DEMO", textStyle(typeRole.pageTitle, surface.ink.hex));

    this.#tooltip = new McTooltip(this);
    const width = Math.min(420, this.scale.width - 48);

    const top = new McTermText(this, {
      x: 24,
      y: 72,
      width,
      text: TOP_TEXT,
      onTermOpen: (term, rect) => this.#openTooltip(term, rect),
      onTermClose: () => this.#closeTooltip(),
    });
    this.#blocks.push(top);

    const body = new McTermText(this, {
      x: 24,
      y: 72 + top.height + 32,
      width,
      text: BODY_TEXT,
      onTermOpen: (term, rect) => this.#openTooltip(term, rect),
      onTermClose: () => this.#closeTooltip(),
    });
    this.#blocks.push(body);

    // Headless click-through hook only (never referenced by product code): the term zones are canvas-drawn, so a
    // test driving real pointer events needs their screen rects rather than a DOM selector.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcTermTextDebug?: unknown }).__mcTermTextDebug = {
        terms: [top, body].flatMap((block, blockIndex) =>
          block.debugTermRects().map((rect) => ({ blockIndex, ...rect })),
        ),
        linkRect: () => this.#tooltip.linkRect,
      };
    }

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // `handleEscape` runs `McTooltip`'s own `onClose` (wired to `#setAllTermsEnabled` in `#openTooltip`)
        // when it actually closes something, so there's nothing else to undo here.
        if (this.#tooltip.handleEscape()) event.preventDefault();
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        this.#closeTooltip();
        this.#focusNext(event.shiftKey ? -1 : 1);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        const block = this.#blocks[this.#focusedBlock];
        block?.activateFocused();
      }
    });
  }

  #focusNext(direction: 1 | -1): void {
    if (this.#blocks.length === 0) return;
    if (this.#focusedBlock < 0) this.#focusedBlock = direction > 0 ? 0 : this.#blocks.length - 1;
    let attempts = 0;
    while (attempts < this.#blocks.length) {
      const block = this.#blocks[this.#focusedBlock]!;
      if (block.focusNext(direction)) return;
      this.#blocks[this.#focusedBlock]?.blur();
      this.#focusedBlock = (this.#focusedBlock + direction + this.#blocks.length) % this.#blocks.length;
      attempts += 1;
    }
  }

  #openTooltip(
    term: TermTextTerm,
    anchor: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  ): void {
    const content = tooltipContentOf(term);
    if (!content) return;
    for (const block of this.#blocks) block.setTermsEnabled((id) => id === term.id);
    const viewport = { x: 0, y: 0, width: this.scale.width, height: this.scale.height };
    this.#tooltip.show(
      anchor,
      content,
      viewport,
      () => {
        this.scene.launch(SCENES.rules, {
          initialTab: "glossary",
          initialQuery: content.title,
        } satisfies RulesSceneData);
      },
      () => this.#setAllTermsEnabled(),
    );
  }

  #closeTooltip(): void {
    this.#tooltip.hide();
    this.#setAllTermsEnabled();
  }

  #setAllTermsEnabled(): void {
    for (const block of this.#blocks) block.setTermsEnabled(() => true);
  }
}
