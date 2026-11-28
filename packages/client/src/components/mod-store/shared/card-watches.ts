import { watchCard, type CardRef } from "@mc/ui";

/**
 * The card pictures of an element that raise the hover popover and Inspect events (`@mc/ui` `watchCard`): wired when the
 * element draws, let go when it draws again or leaves, so a picture that came and went never leaks a listener.
 */
export class CardWatches {
  #off: (() => void)[] = [];

  /** Watches each picture of `pictures` for the card `cardOf` names (null: none now). */
  watch(pictures: Iterable<HTMLElement>, cardOf: (picture: HTMLElement) => CardRef | null): void {
    this.clear();
    for (const picture of pictures) this.#off.push(watchCard(picture, () => cardOf(picture)));
  }

  clear(): void {
    for (const off of this.#off) off();
    this.#off = [];
  }
}
