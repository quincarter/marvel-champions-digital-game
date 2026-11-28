# Building a screen as custom elements

How a Phaser scene's screen is built as Lit custom elements instead of an `mc-sheet` node list. Every rebuilt screen (Set
up the table, Scenario select, Deck check, Seats, the Title pop-ups) follows this. `mc-sheet` stays as it is for screens
not rebuilt yet.

The patterns come from Quin's scaffolding, [create-lit-app](https://github.com/quincarter/create-lit-app)
(`src-example-app/`), and from his fully-Lit app, [brew-me-app-lit](https://github.com/quincarter/brew-me-app-lit); where
they differ, brew-me-app-lit wins. The vault note `Lit patterns.md` summarises both.

## One folder per component

Generic elements go in `packages/ui/src/components/<group>/<tag>/`. Screen-specific ones go beside their scene, in the
client's `components/<feature>/<tag>/`. Pages go in the client's `views/<feature>/<page>/`.

```
mc-my-row/
  McMyRow.ts            the LitElement class: no decorator, no define call, `static styles = [McMyRowStyles]`
  mc-my-row.ts          the define file, and nothing else (below)
  mc-my-row.styles.ts   `export const McMyRowStyles = css`...``: constructible stylesheets only, never inline style
                        strings or a <style> in a template
  mc-my-row.types.ts    the props and the event details
  README.md             usage, markup, a properties table, events, slots (general-purpose components)
  __tests__/McMyRow.test.ts
```

- **Define file**: `import { McMyRow } from "./McMyRow"; if (!customElements.get("mc-my-row")) { customElements.define("mc-my-row", McMyRow); }`
  (the `if` form: oxlint's no-unused-expressions flags `a || b()`).
- **Children**: a parent imports its children's define files (`import "../mc-my-row/mc-my-row";`) once, at the highest level
  where the child is used, and never imports a define from two places. A child does not re-define its own children.
  Shared `@mc/ui` elements are defined by the ui entry (`import "@mc/ui"`, once at app boot).
- **A view** (`views/<page>/<page>.ts`) is one `@customElement` file plus its `.styles.ts`, registered inline because it loads
  once. A view only composes sections; sections compose smaller elements. Responsive rules are one shared
  `responsive.styles.ts` every view spreads into `static styles`.
- **Typed in, typed out**: reactive properties in (`@property` with explicit attribute names, or `declare` + `static
  properties` where decorators are not enabled), typed `CustomEvent`s out with `bubbles: true, composed: true`, both in the
  `.types.ts`. A feature's own events share one `mc-<feature>` name with a discriminated-union detail, listed in
  `GUARDED_EVENTS` (`client/src/dom/dom-region.ts`) so the region holds them back while its scene is not taking input.
- **Tests** import the define (`../mc-my-row`), create the element, `await element.updateComplete`, and assert on the shadow
  DOM and on dispatched events, under happy-dom (`// @vitest-environment happy-dom` in the client).
- **Shared code**: `shared/stores` (signals, `persistentSignal` over idb; mutations go through exported functions, never
  `.value =` from a component), `shared/contexts` (`@lit/context`), `shared/interfaces/*.interface.ts` (types, `I` prefix),
  `shared/utilities/*.utility.ts` (pure functions, each with a test). Strict types: no `any`.

## The rules for a screen

1. **Mounting.** The scene mounts the page element itself as the region's content, not as a node in `mc-sheet`:
   `const { region, element } = mountElement(this, "mc-my-page", rect)` (`client/src/dom/element-region.ts`). The scene sets
   properties from its view model and listens for the page's events. The scene holds the focus route, navigation and the
   store; the page holds none of them. No SheetBuilder or draw-node layer for new work.
2. **Layout.** CSS only: flow, grid, flex and native scroll containers. No JS height arithmetic and no rect-computed
   placement; a rect is read only where a FLIP or token animation needs one. Theme comes from the CSS custom properties the
   panel layer exposes (`dom/ui-layer.ts`: `--mc-fill-*`, `--mc-text-*`, `--mc-line-*`, `--mc-font-*`).
3. **Focus stops.** A focusable part is marked `data-stop="<key>"` on a real focusable element (a `button`, an `input`, or a
   pressable element activated by `click()`). Keep the existing key names (`difficulty:expert`, `deal-it-out`, `back`): specs
   and the pad route use them. `focusStopsOf(element, region.rectOf)` (`client/src/dom/element-stops.ts`) walks open shadow
   roots and gives `FocusRoute` live rects; Enter is `element.click()` (a field is `focus()`ed); an element with an `inspect()`
   method gets Inspect; a stop in a scroll container names it as its view and scrolls into view. Call it after each render.
   `bindStopFocus(element, key => route.focusKey(key))` replaces the old `mc-tile-focus` bridge.
4. **Hover and inspect.** A card picture calls `watchCard(el, () => ({ cardId, face }))` (`@mc/ui`): it raises composed
   `mc-card-hover` `{cardId, face?, rect}`, `mc-card-hover-end` `{cardId}` and, on a hold or right-click, `mc-card-inspect`
   `{cardId, face?}`. The scene makes one `CardEvents(region)` (`client/src/dom/card-events.ts`), passes `cards.hovered()` as
   `HoverPreview`'s `cardIds` and sets `cards.onInspect` to open Inspect.
5. **Taps.** `onTap` / `onHold` from `packages/ui/src/shared/tap.ts`, never a bare `pointerup`: the lift that ends a swipe is
   not a press. Wrap it once per feature in a base class.

## Minimal page

```ts
// components/my-feature/mc-my-row/McMyRow.ts
import { html, LitElement } from "lit";
import { onTap } from "@mc/ui/tap";
import { McMyRowStyles } from "./mc-my-row.styles";

export class McMyRow extends LitElement {
  static override styles = [McMyRowStyles];
  static override properties = {
    label: { type: String },
    stop: { type: String, reflect: true, attribute: "data-stop" },
  };
  declare label: string;
  declare stop: string;
  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("role", "button");
    this.setAttribute("tabindex", "-1");
    onTap(this, () =>
      this.dispatchEvent(new CustomEvent("mc-my-feature", { detail: { type: "pick" }, bubbles: true, composed: true })),
    );
  }
  override render() {
    return html`${this.label}`;
  }
}

// components/my-feature/mc-my-row/mc-my-row.ts
import { McMyRow } from "./McMyRow";
if (!customElements.get("mc-my-row")) {
  customElements.define("mc-my-row", McMyRow);
}

// views/my-feature/my-page/my-page.ts: the page composes; it imports each child's define once.
import "../../../components/my-feature/mc-my-row/mc-my-row";

// The scene:
import "../views/my-feature/my-page/my-page";
const { region, element } = mountElement(this, "my-page", { x: 0, y: 0, ...this.scale.gameSize });
element.model = viewModel;
element.addEventListener("mc-my-feature", (e) => act(e.detail));
this.route.set(
  order,
  focusStopsOf(element, (t) => region.rectOf(t)),
);
bindStopFocus(element, (key) => this.route.focusKey(key));
const cards = new CardEvents(region); // hover popover and Inspect for card pictures
```

The helpers: `dom/element-region.ts` (`mountElement`), `dom/element-stops.ts` (`collectStops`, `focusStopsOf`, `bindStopFocus`,
`activateStop`), `dom/card-events.ts` (`CardEvents`), `@mc/ui` `watchCard`. Their tests: `dom/element-stops.test.ts`,
`shared/card-events.test.ts`.
