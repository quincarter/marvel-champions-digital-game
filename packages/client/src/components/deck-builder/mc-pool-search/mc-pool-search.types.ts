/** The pool search row: the field, the ? that opens the cheat sheet and the Cards / List view toggle. */
export interface PoolSearchModel {
  /** The text the screen accepted (never a live draft). */
  readonly text: string;
  readonly placeholder: string;
  readonly clearLabel: string;
  readonly helpLabel: string;
  /** The toggle's words: the view it switches to ("List view" while the pool shows cards). */
  readonly viewLabel: string;
}
