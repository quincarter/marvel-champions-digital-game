/**
 * What the learning screens' elements raise (How to win, How to play, the guide chooser): one `mc-learn` event, bubbling
 * and composed, whose detail says what the player did. The scene listens on the page element and acts. One name for all of
 * them so the panel region can hold them back while its scene is not taking input (`GUARDED_EVENTS`).
 *
 * Focus stops (`data-stop`) keep the names the specs and the pad route use: How to win has `close`, `term:<id>`,
 * `tip-link`, `tell-me-more`, `start-the-fight`; How to play has `close`, `lesson:<id>`, `aspect:<aspect>`, `reference`,
 * `box:<id>`, `continue-learning`; the guide chooser has `option:<value>`, `back`, `suit-up`.
 */
export const LEARN_EVENT = "mc-learn";

/** The three levels of guide the chooser offers. */
export type GuideChoice = "full" | "hints" | "off";

export type LearnEventDetail =
  /** The × of a screen's bar. */
  | { readonly type: "close" }
  /** How to win's "Tell me more". */
  | { readonly type: "tell-more" }
  /** How to win's "Start the fight". */
  | { readonly type: "start" }
  /** A term tip's glossary link: open the Rules reference at this term. */
  | { readonly type: "glossary"; readonly heading: string }
  /** A term tip opened or closed (so Escape can close the tip before it leaves the screen). */
  | { readonly type: "tip"; readonly open: boolean }
  /** A lesson row of the hub. */
  | { readonly type: "lesson"; readonly id: string }
  /** An aspect row of the hub. */
  | { readonly type: "aspect"; readonly aspect: string }
  /** The hub's Rules & glossary row. */
  | { readonly type: "reference" }
  /** A "New in this box" row. */
  | { readonly type: "box"; readonly id: string }
  /** The hub's Continue learning. */
  | { readonly type: "continue" }
  /** A guide level card of the chooser. */
  | { readonly type: "option"; readonly value: GuideChoice }
  /** The chooser's Back. */
  | { readonly type: "back" }
  /** The chooser's Suit up. */
  | { readonly type: "suit-up" };

export type LearnEvent = CustomEvent<LearnEventDetail>;

/** The event for `detail`, ready to dispatch. */
export const learnEvent = (detail: LearnEventDetail): LearnEvent =>
  new CustomEvent(LEARN_EVENT, { detail, bubbles: true, composed: true });

declare global {
  interface HTMLElementEventMap {
    "mc-learn": LearnEvent;
  }
}
