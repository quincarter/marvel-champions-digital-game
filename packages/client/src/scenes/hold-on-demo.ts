/**
 * Dev-only click-through entry point for the "Hold on!" overlay (guided mode G9b, `docs/guided-mode.md` §4),
 * reached with `?screen=holdondemo` (`scenes/boot.ts`'s dev-jump list) — there is no in-game way to reach this
 * screen directly. It exercises `scenes/hold-on.ts` against synthetic `Hint`s, the same way
 * `scenes/guide-callout-demo.ts` exercises `McGuideCallout` — the controller's own interception is
 * `scenes/board/controller.test.ts`'s job (a real Rhino game, no canvas); this demo is for the overlay's own
 * rendering and pointer/keyboard interaction: P06's centered card, T03's anchored-with-leader-line card, the
 * safe/anyway buttons, the checkbox, and Escape/outside-click sending nothing.
 */
import Phaser from "phaser";
import { surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import type { Hint } from "../view/guide-hints.js";
import type { Rect } from "../view/layout.js";
import { showHoldOn } from "./hold-on.js";
import { SCENES } from "./keys.js";

const SCHEME_FINISH: Hint = {
  key: "schemeFinish",
  title: "The scheme could complete",
  body: "The main scheme is at 10 of 12 [[threat|threat]]. Next [[villainPhase|villain phase]] could add 3 more — enough to lose the game.",
  facts: { threat: 10, target: 12, projected: 3, remaining: 2 },
  safeAction: { label: "Thwart first −3" },
  anywayAction: { label: "End turn anyway" },
};

const LETHAL: Hint = {
  key: "lethal",
  title: "You could take lethal damage",
  body: "Spider-Man is at 3 of 10 HP. Even with the best block, Rhino's ATK could deal 4 next [[villainPhase|villain phase]] — and a boost card could add more.",
  facts: { currentHp: 3, maxHp: 10, totalAtk: 4, bestCaseDamage: 4 },
  safeAction: { label: "Flip to alter-ego" },
  anywayAction: { label: "End turn anyway" },
};

const FLIP_DANGER: Hint = {
  key: "flipDanger",
  title: "Alter-ego lets the scheme through",
  body: "In alter-ego form, Rhino's SCH plus next [[villainPhase|villain phase]]'s threat could lose the game. The main scheme is at 9 of 12.",
  facts: { threat: 9, target: 12, projected: 3, sch: 2 },
  safeAction: { label: "Stay in hero form" },
  anywayAction: { label: "Flip anyway" },
};

const WASTED_PAY: Hint = {
  key: "wastedPay",
  title: "This pays more than needed",
  body: "The [[cost|cost]] is 2, and this payment adds up to 3.",
  facts: { paid: 3, required: 2 },
  safeAction: { label: "Change payment" },
  anywayAction: { label: "Confirm payment" },
};

/** No safe action at all — a hint that fires with nothing legal to offer instead ("Thwart first" hidden when a
 * crisis side scheme blocks it, `guide-hints.ts`'s own doc comment on `schemeFinishHint`). */
const NO_SAFE_ACTION: Hint = { ...SCHEME_FINISH, safeAction: null };

const HINTS: readonly { readonly label: string; readonly hint: Hint }[] = [
  { label: "schemeFinish", hint: SCHEME_FINISH },
  { label: "lethal", hint: LETHAL },
  { label: "flipDanger", hint: FLIP_DANGER },
  { label: "wastedPay", hint: WASTED_PAY },
  { label: "no safe action", hint: NO_SAFE_ACTION },
];

export class HoldOnDemoScene extends Phaser.Scene {
  #status!: Phaser.GameObjects.Text;
  #schemeGraphic!: Phaser.GameObjects.Graphics;
  #showScheme = true;
  #chips: Phaser.GameObjects.Text[] = [];

  constructor() {
    super(SCENES.holdOnDemo);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(surface.parchment.css);
    this.add.text(24, 12, "HOLD ON! DEV DEMO", textStyle(typeRole.label, surface.ink.hex));
    this.add.text(
      24,
      28,
      "Click a chip to show that hint  ·  s: toggle the scheme rect (T03's anchor)  ·  Esc: dismiss",
      { ...textStyle(typeRole.mono, surface.ink.hex, 0.6), fontSize: "10px" },
    );

    this.#schemeGraphic = this.add.graphics();
    this.#status = this.add.text(24, this.scale.height - 24, "", textStyle(typeRole.mono, surface.ink.hex, 0.7));

    this.#drawChips();
    this.#drawScheme();

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.key === "s") {
        this.#showScheme = !this.#showScheme;
        this.#drawScheme();
      }
    });
    this.scale.on("resize", () => this.#drawScheme());

    if (import.meta.env.DEV) {
      (window as unknown as { __mcHoldOnDemoDebug?: unknown }).__mcHoldOnDemoDebug = {
        show: (index: number) => this.#show(HINTS[index]?.hint ?? SCHEME_FINISH),
        setSchemeVisible: (visible: boolean) => {
          this.#showScheme = visible;
          this.#drawScheme();
        },
      };
    }
  }

  #schemeRect(): Rect | null {
    if (!this.#showScheme) return null;
    const width = Math.min(260, this.scale.width - 32);
    return { x: this.scale.width - width - 24, y: 90, width, height: 90 };
  }

  #drawScheme(): void {
    this.#schemeGraphic.clear();
    const rect = this.#schemeRect();
    if (!rect) return;
    this.#schemeGraphic
      .fillStyle(surface.card.hex, 1)
      .fillRect(rect.x, rect.y, rect.width, rect.height)
      .lineStyle(2, surface.ink.hex, 1)
      .strokeRect(rect.x, rect.y, rect.width, rect.height);
  }

  #drawChips(): void {
    HINTS.forEach(({ label }, i) => {
      const chip = this.add
        .text(24 + i * 110, 46, label, textStyle(typeRole.label, surface.ink.hex, 0.7))
        .setInteractive({ useHandCursor: true });
      chip.on("pointerup", () => this.#show(HINTS[i]!.hint));
      this.#chips.push(chip);
    });
  }

  #show(hint: Hint): void {
    showHoldOn(this, {
      hint,
      schemeRect: this.#schemeRect(),
      schemeName: "Crossbones' Assault",
      onSafe: () => this.#log("safe"),
      onAnyway: () => this.#log("anyway"),
      onSilence: () => this.#log("silenced"),
    });
  }

  #log(action: string): void {
    this.#status.setText(`last action: ${action}`).setPosition(24, this.scale.height - 24);
  }
}
