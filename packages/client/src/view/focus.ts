/**
 * What keyboard focus moves through on the board, and in what order.
 *
 * A canvas has no focus order of its own — there is no DOM to tab through — so
 * the order is stated here rather than emerging from the draw calls. Keeping it
 * a pure function means the order is testable, and that it cannot quietly
 * change because someone reordered two `#draw` calls (PLAN.md Phase 4,
 * accessibility: "full keyboard and gamepad navigation with a visible focus
 * ring").
 *
 * The order follows the table, bottom-up, because that is the order a player
 * thinks in: the cards in your hand, then the actions you could take with them,
 * then the one control that ends your turn.
 */

import type { InstanceId } from "@mc/engine";
import type { BasicAction, Highlights } from "./highlights.js";

export type FocusTarget =
  | { readonly kind: "card"; readonly instanceId: InstanceId }
  | { readonly kind: "basic"; readonly action: BasicAction }
  /** A Team-Up ring (`scenes/board/team-up-badge.ts`): Enter opens that pair's panel. Last on the idle route. */
  | { readonly kind: "teamUp"; readonly pairKey: string }
  /** The targeting panel's own "Cancel · Esc" (docs/phase4-screen-gaps.md §3 "W5") — Escape already backs out from anywhere, so this is only the tab stop for the pointer/pad control that does the same thing. */
  | { readonly kind: "cancel" }
  /** A multi-pick panel's own Confirm (`view/in-play-cost-choice.ts`): Enter on it sends the picks, the tab stop for the pointer/pad control that does the same. */
  | { readonly kind: "confirm" }
  /** The action bar's Undo (`view/undo.ts`), beside End turn. */
  | { readonly kind: "undo" }
  /** The pay step's X picker (a card printed with an X cost): the minus and plus controls, after the sources. */
  | { readonly kind: "xLess" }
  | { readonly kind: "xMore" }
  /**
   * The `index`th button of the mode bar over the hand (Pay, Play it, a form, a seat's helper, Decline): drawn this
   * frame, in the order the bar draws them (`scenes/board/bar-stops.ts`). Its Cancel is the `cancel` stop instead.
   */
  | { readonly kind: "bar"; readonly index: number }
  /** Your discard pile, bottom right of the table: Enter opens the pile view, as a click on it does. */
  | { readonly kind: "discard" }
  /** The victory display's pile in the encounter column: Enter opens the pile view, as a click on it does. */
  | { readonly kind: "victoryDisplay" }
  /** The top bar's music note: Enter opens the music player. The last stop on the idle route. */
  | { readonly kind: "music" };

/** What the board is currently asking for, which changes what is worth focusing. */
export type FocusMode =
  | {
      readonly kind: "idle";
      readonly hand: readonly InstanceId[];
      readonly teamUps?: readonly string[];
      /** True while the top bar's music note is drawn: the route's last stop. */
      readonly music?: true;
      /** True while the discard pile has a card to open: a stop just after the hand, where the table draws it. */
      readonly discard?: true;
      /** True while the victory display has a pile on the table: a stop after the table's cards. */
      readonly victoryDisplay?: true;
      /** True while the action bar draws Undo, so it is a stop just before End turn. */
      readonly undo?: boolean;
      /**
       * Every card on the table in reading order (your play area, then the villain side: villains, minions, schemes and
       * the attachments on each, then the other seats), so a pad can reach any of them to inspect it, not only the
       * ones with an ability to use. Each is a stop only while it is tiled.
       */
      readonly table?: readonly InstanceId[];
      /** True when the card is drawn as a tile or chip right now; a usable card with none is not a stop. */
      readonly tiled?: (id: InstanceId) => boolean;
    }
  /** Only the legal targets are worth stepping through. */
  | { readonly kind: "targeting"; readonly targets: readonly InstanceId[]; readonly confirm?: true }
  /** Only the things that can pay are worth stepping through. */
  | { readonly kind: "paying"; readonly sources: readonly InstanceId[]; readonly x?: true };

const BASICS: readonly BasicAction[] = ["attack", "thwart", "recover", "changeForm", "endTurn"];

/**
 * The focus ring's route.
 *
 * While a decision is open the route narrows to the answers: stepping through
 * an action bar you cannot use, to reach the one target you can, is the kind of
 * keyboard support that is worse than none.
 */
export function focusOrder(mode: FocusMode, marks: Highlights | null): readonly FocusTarget[] {
  if (mode.kind === "targeting") {
    // Cancel is last: browse the options first, and reaching for "back out" is the natural end of that scan.
    return [
      ...mode.targets.map((instanceId) => ({ kind: "card" as const, instanceId })),
      ...(mode.confirm ? [{ kind: "confirm" as const }] : []),
      { kind: "cancel" as const },
    ];
  }
  if (mode.kind === "paying") {
    const sources: FocusTarget[] = mode.sources.map((instanceId) => ({ kind: "card", instanceId }));
    // The X picker leads the route: X is chosen first, because it changes what the sources must add up to.
    return mode.x ? [{ kind: "xLess" }, { kind: "xMore" }, ...sources] : sources;
  }

  const cards: FocusTarget[] = mode.hand.map((instanceId) => ({ kind: "card", instanceId }));
  // Cards in play with a usable ability — the villain, an ally, your own
  // identity — sit between the hand and the action bar: they're something you
  // could still act on this turn, same as the hand is, but they aren't a
  // *basic* action and they aren't in your hand either. `usableAbilities`
  // already excludes anything not currently legal, so nothing here decides
  // that itself (PLAN.md Phase 4, "abilities on cards in play are not
  // reachable from the UI").
  //
  // Every other card on the table joins them in the table's own order: Y (Inspect) needs a focused card, and a pad has
  // no pointer to hover the villain, a scheme or an attachment with (reported from a Steam Deck). A press on one opens
  // it in Inspect (`BoardController#activate`), as a tap does.
  const tiled = (id: InstanceId): boolean => !mode.hand.includes(id) && (mode.tiled?.(id) ?? true);
  const usable = marks ? [...marks.usableAbilities] : [];
  const tableIds = (mode.table ?? []).filter(tiled);
  const tableCards: FocusTarget[] = [...new Set([...tableIds, ...usable.filter(tiled)])].map((instanceId) => ({
    kind: "card",
    instanceId,
  }));
  // An unusable control still takes focus: "why can't I attack?" is a question
  // the player has to be able to reach the answer to, and the reason lives on
  // the button. Only controls the engine never offers at all are skipped.
  const basics: FocusTarget[] = BASICS.filter(
    (action) => marks?.basics.some((basic) => basic.action === action) ?? false,
  ).map((action) => ({ kind: "basic", action }));
  // Undo sits just before End turn, where the bar draws it — and like any other control, a stop even while unusable.
  const endTurnAt = basics.findIndex((target) => target.kind === "basic" && target.action === "endTurn");
  if (mode.undo) basics.splice(endTurnAt < 0 ? basics.length : endTurnAt, 0, { kind: "undo" });
  const teamUps: FocusTarget[] = (mode.teamUps ?? []).map((pairKey) => ({ kind: "teamUp", pairKey }));
  return [
    ...cards,
    ...(mode.discard ? [{ kind: "discard" as const }] : []),
    ...tableCards,
    ...(mode.victoryDisplay ? [{ kind: "victoryDisplay" as const }] : []),
    ...basics,
    ...teamUps,
    ...(mode.music ? [{ kind: "music" as const }] : []),
  ];
}

/**
 * Where focus lands when a player's turn begins (or the board first shows it): the first card in their hand, far left,
 * else the route's first stop, else nothing.
 */
export function turnStartFocus(hand: readonly InstanceId[], order: readonly FocusTarget[]): FocusTarget | null {
  const first = hand[0];
  // Only a stop the route has now: a decision open at turn start (paying, targeting) narrows the route to its answers.
  if (first !== undefined && order.some((t) => t.kind === "card" && t.instanceId === first)) {
    return { kind: "card", instanceId: first };
  }
  // No focus otherwise: the route's first stop could be a corner control (the music note) the player never meant, and
  // with nothing focused A and Start still reach the screen's forward button.
  return null;
}

/**
 * The key of the turn the board shows: the round and whose player turn it is, or null with no player turn step (setup,
 * the villain phase). Not the viewer's perspective, which also follows a pending choice's player and the seat tabs.
 */
export function turnKeyOf(game: {
  readonly round: number;
  readonly step: { readonly phase: string; readonly kind: string; readonly activePlayerId?: string };
}): string | null {
  const { step } = game;
  if (step.phase !== "player" || step.kind !== "turn" || step.activePlayerId === undefined) return null;
  return `${step.activePlayerId}|${game.round}`;
}

/** Moves focus by `delta`, wrapping. Returns the new index, or -1 when there is nothing to focus. */
export function stepFocus<T>(order: readonly T[], current: number, delta: number): number {
  if (order.length === 0) return -1;
  const from = current < 0 ? (delta > 0 ? -1 : 0) : current;
  return (((from + delta) % order.length) + order.length) % order.length;
}

/**
 * `stepFocus` over a route of plain string keys, for the screens whose stops
 * are just their controls (Title, the villain-phase walkthrough, Game Over).
 * A key no longer on the route counts as no focus. Null when the route is empty.
 */
export function stepKey(order: readonly string[], current: string | null, delta: number): string | null {
  const next = stepFocus(order, current === null ? -1 : order.indexOf(current), delta);
  return next >= 0 ? (order[next] ?? null) : null;
}

/** True when two focus targets name the same thing, so focus survives a redraw. */
export function sameTarget(a: FocusTarget | null, b: FocusTarget | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "card" && b.kind === "card") return a.instanceId === b.instanceId;
  if (a.kind === "basic" && b.kind === "basic") return a.action === b.action;
  if (a.kind === "teamUp" && b.kind === "teamUp") return a.pairKey === b.pairKey;
  if (a.kind === "bar" && b.kind === "bar") return a.index === b.index;
  return a.kind === b.kind;
}

/** The selections whose answers are all buttons on the mode bar: nothing on the table to step through. */
export const BUTTON_ONLY_SELECTIONS: ReadonlySet<string> = new Set([
  "choosingForm",
  "choosingCostSelection",
  "choosingCostHelp",
  "confirmingAllianceHelp",
]);

/**
 * A decision's route with its mode bar's buttons in it: the route's own stops, then one `bar` stop per button in draw
 * order, then Cancel last, once however many times the route already had it (and only when the bar draws one).
 */
export function withBarStops(
  route: readonly FocusTarget[],
  bar: { readonly count: number; readonly cancel: boolean },
): readonly FocusTarget[] {
  const hadCancel = route.some((target) => target.kind === "cancel");
  return [
    ...route.filter((target) => target.kind !== "cancel"),
    ...Array.from({ length: bar.count }, (_, index): FocusTarget => ({ kind: "bar", index })),
    ...(hadCancel || bar.cancel ? [{ kind: "cancel" as const }] : []),
  ];
}

/** What Start does with a decision open: press the bar's forward button, press the panel's Confirm, or nothing (Pause). */
export type PrimaryPress = { readonly kind: "bar"; readonly index: number } | { readonly kind: "confirmPick" } | null;

export function primaryPressOf(
  selectionKind: string,
  stops: readonly { readonly primary: boolean; readonly enabled: boolean }[],
  confirmReady = false,
): PrimaryPress {
  if (selectionKind === "idle") return null;
  const index = stops.findIndex((stop) => stop.primary);
  if (index >= 0) return stops[index]!.enabled ? { kind: "bar", index } : null;
  // The panel's Confirm only while it can be pressed, so a not-yet-ready pick leaves Start to open Pause.
  if ((selectionKind === "choosingInPlayCost" || selectionKind === "dividingPower") && confirmReady)
    return { kind: "confirmPick" };
  return null;
}
