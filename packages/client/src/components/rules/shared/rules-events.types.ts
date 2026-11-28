/**
 * What the Rules reference elements say to the scene: one `mc-rules` event, bubbling and composed, whose `detail` is one of
 * these (one name, in `GUARDED_EVENTS`, so the panel region holds it back while its scene is not taking input).
 */
export const RULES_EVENT = "mc-rules";

export type RulesScope = "all" | "table";

export type RulesEventDetail =
  | { readonly type: "back" }
  /** The scope toggle: "All rules" or "On your table". */
  | { readonly type: "scope"; readonly scope: RulesScope }
  /** A tab of the rail (`glossary`, `villainPhase`, `cardList`). */
  | { readonly type: "tab"; readonly tab: string }
  /** The glossary search field's text (after its typing pause). */
  | { readonly type: "search"; readonly value: string }
  | { readonly type: "search-focus"; readonly focused: boolean }
  /** A tap on a card picture: the scene opens Inspect on the card its key names. */
  | { readonly type: "card"; readonly key: string }
  /** The "Added in ..." link of a glossary entry: the box page it names. */
  | { readonly type: "origin"; readonly boxId: string };

export type RulesEvent = CustomEvent<RulesEventDetail>;

export const rulesEvent = (detail: RulesEventDetail): RulesEvent =>
  new CustomEvent(RULES_EVENT, { detail, bubbles: true, composed: true });

declare global {
  interface HTMLElementEventMap {
    "mc-rules": RulesEvent;
  }
}
