/** One of a card's copy buttons: whether it presses, and why it does not. */
export interface CopyButtonModel {
  /** The button's name for assistive tech ("Remove a copy of Web-Swing"), already translated. */
  readonly aria: string;
  /** Not pressable: dimmed. A string is the reason (a tooltip), `true` has none. */
  readonly disabled: string | true | null;
}

/** A card's "-" and "+": one copy less or more in the deck. */
export interface CopyButtonsModel {
  readonly cardId: string;
  readonly minus: CopyButtonModel;
  readonly plus: CopyButtonModel;
}
