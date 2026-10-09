/**
 * Resolves a `view/lesson-model.ts` `LessonAnchor` to a screen rect (guided mode G4c, `docs/guided-mode.md` §4):
 * the spotlight ring's target, and where a `TRY THIS`/`GUIDE PICK` tag sits. Pure and Phaser-free, so it's tested
 * without a canvas — the caller (the dev demo here, G5c's guide controller later) supplies whatever the live
 * board actually drew this frame.
 *
 * **Zone anchors** are answered from `boardLayout()` itself (`view/layout.ts`), not from a live frame — a zone's
 * rect is a pure function of the viewport and the layout options, so this can compute it even for a tab that
 * isn't the one currently active, and report which tab the caller needs to switch to
 * (`ResolvedAnchor.tab`) to actually bring it on screen. A zone this form factor never shows at all (`team` in
 * solo) still resolves to `null`, same as anything genuinely not visible right now.
 *
 * **Action and card anchors** are answered from the live draw's own rects — `BoardFrame.hitRects` (cards, by
 * instance id) and `BoardFrame.focusRects` (the action bar's basics, `basic:<BasicAction>`, `scenes/board/
 * selection.ts`'s own `focusKey` convention) — because unlike a zone, where a button or a card actually landed
 * depends on the live game state (how many cards are in hand, whether a form choice is open), not just the
 * viewport. A card not currently drawn (off the active phone tab, not yet in hand) resolves to `null` — "return
 * null when the anchor isn't currently visible, so the caller can fall back" (this module's own brief) — the
 * caller decides whether to switch tabs and try again once the next draw lands.
 *
 * **Choice anchors** read a small map the caller builds from whatever choice sheet is open (`view/defend-choice.ts`
 * et al.), keyed however that caller likes — this module has no opinion on choice-sheet internals, only on what a
 * `LessonAnchor`'s own `id` should look up.
 */
import type { CardId } from "@mc/content";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import type { BasicAction } from "./highlights.js";
import { boardLayout, type LayoutOptions, type PhoneTab, type Rect, type ZoneName } from "./layout.js";
import type { LessonAnchor } from "./lesson-model.js";

/** What one draw put on screen, in exactly the shape `BoardFrame` already carries (`scenes/board/context.ts`). */
export interface AnchorFrame {
  /** Card rect by instance id, this draw — `BoardFrame.hitRects`. */
  readonly cardRects: ReadonlyMap<InstanceId, Rect>;
  /** Every focusable rect this draw, by `focusKey`'s own string keys — `BoardFrame.focusRects`. Only the
   * `basic:<BasicAction>` entries matter to this module; anything else in the map is ignored. */
  readonly focusRects: ReadonlyMap<string, Rect>;
  /** An open choice sheet's option rects, keyed by the caller's own convention (a `LessonAnchor`'s choice `id`, an
   * option id, whatever fits that sheet) — omitted or empty when no choice is open. */
  readonly choiceRects?: ReadonlyMap<string, Rect>;
  /** The perspective player's instance for a card code, among their hand and play area right now — null when it
   * isn't there. See `instanceOfCode` below for the usual implementation. */
  readonly instanceOfCode: (code: CardId) => InstanceId | null;
  /**
   * The live main scheme's own instance id, when there's a game running — guided mode G5c's fix for the
   * `"mainScheme"` zone anchor (`docs/guided-mode.md` §4 G4c "For G5c"): the *panel*'s own rect
   * (`scenes/board/schemes.ts` registers it in `cardRects` the same way every other card does), not the whole
   * `threat` zone the plain zone lookup below would otherwise return, which also holds the side schemes and reads
   * far larger than the thing lesson 5 is actually teaching. Omitted/null falls back to the full zone rect —
   * every other zone anchor, and a caller with no game running yet.
   */
  readonly mainSchemeInstanceId?: InstanceId | null;
}

export interface ResolvedAnchor {
  readonly rect: Rect;
  /** The phone tab that must be active to see this — null when it's already showing, or this anchor kind never
   * lives behind a tab (the action bar and the hand are drawn on every tab). */
  readonly tab: PhoneTab | null;
}

/** `LessonAnchor`'s action ids, mapped to the action bar's own `BasicAction` (`scenes/board/action-bar.ts`) —
 * exported so a caller building a `scenes/board/guide-gate.ts` `GuideGate` for an `"action"` step (the demo here,
 * G5c later) uses the same mapping this module resolves the rect with, rather than a second copy that could drift. */
export const ACTION_TO_BASIC: Readonly<Record<"flip" | "thwart" | "attack" | "endTurn", BasicAction>> = {
  flip: "changeForm",
  thwart: "thwart",
  attack: "attack",
  endTurn: "endTurn",
};

/** `LessonAnchor` zone ids (`docs/guided-mode.md` §4 G4c, and the tutorial's own `guide/tutorial-lessons.ts`), mapped
 * to `view/layout.ts`'s `ZoneName`. More than one id can share a zone — `mainScheme` and `sideSchemes` are both
 * drawn in the `threat` band, `villain` and `minions` both in `enemies` — because the lesson content names the
 * thing being taught, not the zone that happens to hold it. */
const ZONE_ID_TO_NAME: Readonly<Record<string, ZoneName>> = {
  mainScheme: "threat",
  sideSchemes: "threat",
  villain: "enemies",
  minions: "enemies",
  encounter: "encounter",
  me: "me",
  identity: "me",
  playArea: "playArea",
  hand: "hand",
  team: "team",
  log: "log",
  actionBar: "actionBar",
  chrome: "chrome",
};

/** Which phone tab shows each zone — only the zones `PHONE_TABS` actually gates need an entry. */
const ZONE_TAB: Readonly<Partial<Record<ZoneName, PhoneTab>>> = {
  threat: "threat",
  enemies: "enemies",
  encounter: "enemies",
  me: "me",
  playArea: "me",
  team: "team",
  log: "log",
};

/** Resolves `anchor` against `viewport`/`layoutOptions` (for a zone) or `frame` (for anything live). Null when the
 * anchor names something that either doesn't exist on this layout, or isn't on screen this draw. */
export function resolveAnchor(
  anchor: LessonAnchor,
  viewport: Rect,
  layoutOptions: LayoutOptions,
  frame: AnchorFrame,
): ResolvedAnchor | null {
  switch (anchor.kind) {
    case "zone": {
      // The mainScheme panel fix (see `AnchorFrame.mainSchemeInstanceId`'s own doc comment): prefer the live
      // panel rect over the whole zone when this draw actually rendered it. A tab-switch case (the panel isn't
      // rendered on the current tab) falls through to the ordinary zone resolution below, which still reports
      // the tab to switch to.
      if (anchor.id === "mainScheme" && frame.mainSchemeInstanceId != null) {
        const rect = frame.cardRects.get(frame.mainSchemeInstanceId);
        if (rect) return { rect, tab: null };
      }
      return resolveZoneAnchor(anchor.id, viewport, layoutOptions);
    }
    case "action": {
      const rect = frame.focusRects.get(`basic:${ACTION_TO_BASIC[anchor.id]}`);
      return rect ? { rect, tab: null } : null;
    }
    case "card": {
      const instanceId = frame.instanceOfCode(anchor.code);
      const rect = instanceId !== null ? frame.cardRects.get(instanceId) : undefined;
      return rect ? { rect, tab: null } : null;
    }
    case "choice": {
      const rect = frame.choiceRects?.get(anchor.id);
      return rect ? { rect, tab: null } : null;
    }
    case "control": {
      const rect = frame.focusRects.get(anchor.id);
      return rect ? { rect, tab: null } : null;
    }
  }
}

function resolveZoneAnchor(id: string, viewport: Rect, layoutOptions: LayoutOptions): ResolvedAnchor | null {
  const zoneName = ZONE_ID_TO_NAME[id];
  if (!zoneName) return null;
  const current = boardLayout(viewport, layoutOptions);
  const currentRect = current.zones[zoneName];
  if (currentRect) return { rect: currentRect, tab: null };
  if (!current.tabbed) return null; // Not a tab problem — this form factor never shows the zone at all (e.g. `team` solo).
  const tab = ZONE_TAB[zoneName];
  if (!tab) return null;
  const rect = boardLayout(viewport, { ...layoutOptions, activeTab: tab }).zones[zoneName];
  return rect ? { rect, tab } : null;
}

/**
 * The usual `AnchorFrame.instanceOfCode`: the perspective player's own hand or play area (then the top of the deck), first match. The
 * tutorial (and every aspect try-it game, G10d) never has two copies of the same signature card live in the same
 * lesson step, so "first match" never has to pick between two.
 */
export function instanceOfCode(state: GameState, playerId: PlayerId, code: CardId): InstanceId | null {
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) return null;
  // The top card of the deck last: it has a rect on the board only while the engine shows it (Magik's faceup top).
  for (const id of [...player.hand, ...player.playArea, ...player.deck.slice(0, 1)]) {
    if (state.instances[id]?.cardId === code) return id;
  }
  return null;
}

/**
 * Whether a resolved card anchor lies past the screen's left or right edge: a hand card the sideways-scrolling phone
 * hand has not scrolled to. The ring and the callout's arrow then point at nothing the player can see (wave 7 QA,
 * Cable's "The limit is one" at 390), so the guide scrolls the hand to it first (`HandScroll#scrollIntoView`).
 */
export function anchorOffScreenX(rect: Rect, viewport: Rect): boolean {
  return rect.x < viewport.x || rect.x + rect.width > viewport.x + viewport.width;
}
