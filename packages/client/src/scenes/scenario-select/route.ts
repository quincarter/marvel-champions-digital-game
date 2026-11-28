/** Choose a scenario's keyboard and pad route: what each button does, over the focus stops the page marks. */
import type Phaser from "phaser";
import type { McScenarioSelectPage } from "../../views/scenario-select/mc-scenario-select-page/mc-scenario-select-page.js";
import { domFocusRing } from "../../dom/dom-ring.js";
import { areaOf } from "../../view/focus-areas.js";
import { bindExtraInput } from "../extra-input.js";
import { FocusRoute } from "../focus-route.js";
import type { PadFilters } from "../pad-filters.js";
import { SCENES } from "../keys.js";
import { bindTextFieldEscape } from "../text-field-escape.js";
import type { ScenarioFocus } from "./focus.js";

/** A page of the shelves, as a share of their height. */
const PAGE = 0.85;

export interface RouteDeps {
  readonly page: () => McScenarioSelectPage | null;
  readonly focus: ScenarioFocus;
  readonly padFilters: () => PadFilters;
  readonly canContinue: () => boolean;
  /** The open box's id, or null on the full shelf list. */
  readonly drilledPack: () => string | null;
  readonly drillOut: () => void;
  readonly back: () => void;
}

export function createScenarioRoute(scene: Phaser.Scene, deps: RouteDeps): FocusRoute {
  const { focus } = deps;
  const covered = (): boolean => scene.scene.isActive(SCENES.inspect) || scene.scene.isActive(SCENES.unlockConfirm);
  const typing = (): boolean => deps.page()?.searchField?.isFocused ?? false;
  // A pad that put the caret in the search field can take it out again (B, A or Start).
  bindTextFieldEscape(scene, () => deps.page()?.searchField ?? null, covered);
  const roster = () => deps.page()?.roster ?? null;
  const route: FocusRoute = new FocusRoute(scene, {
    ring: domFocusRing,
    blocked: () => covered() || typing(),
    // Y is the filters' fold while a controller is in use (the keyboard's Inspect key is unchanged); View inspects.
    onInspect: (source) => {
      if (source === "key" || !deps.padFilters().padMode) return false;
      focus.toggleFilters();
      return true;
    },
    // LT / RT page the focused row, like its chevrons.
    onTrigger: (trigger) => focus.pageRow(trigger === "lt" ? -1 : 1),
    // B from the list returns to the filters (scrolled back to the top); from the filters it backs out.
    onCancel: () => {
      if (areaOf(route.focused, focus.areas) === "list") focus.jump(true);
      else if (deps.drilledPack() !== null) deps.drillOut();
      else deps.back();
    },
    // Start / Menu (and A with nothing focused) is "Choose heroes ▸".
    primary: () => (deps.canContinue() ? "next" : null),
    // The right stick, PageUp / PageDown and Home / End scroll the shelves.
    onScroll: (_dx, dy) => roster()?.scroller?.scrollBy({ top: dy }),
    onPage: (direction) => {
      const scroller = roster()?.scroller;
      scroller?.scrollBy({ top: direction * scroller.clientHeight * PAGE });
    },
    onHomeEnd: (edge) => roster()?.scroller?.scrollTo({ top: edge === "home" ? 0 : Number.MAX_SAFE_INTEGER }),
  });
  bindExtraInput(scene, {
    blocked: () => covered() || typing(),
    intents: {
      view: () => {
        if (deps.padFilters().padMode && route.focused?.startsWith("scenario:")) route.inspectFocused();
      },
    },
  });
  return route;
}
