import { TURN_ROW_HEIGHT, type Rect } from "./layout.js";

/**
 * Where the token rests when its seat's card is not on screen and no tab holds it (a teammate's side is being looked
 * at). On a bar with rows under its own (the whose-turn line, a prompt, a strip of the other side) it sits at the right
 * end of the whose-turn row, clear of the strip's words; Chat, where there is one, keeps its place beside it. With no
 * such rows it sits at the middle of the bar, as it always did.
 */
export function firstPlayerFallbackOn(chrome: Rect, extra: number, turnRow: boolean, chat: boolean): Rect {
  if (extra <= 0 || !turnRow) {
    return { x: chrome.x + chrome.width * 0.5 - 20, y: chrome.y, width: 40, height: chrome.height };
  }
  const size = 30;
  return {
    x: chrome.x + chrome.width - 8 - size - (chat ? 190 : 0),
    y: chrome.y + chrome.height - extra + 2,
    width: size,
    height: TURN_ROW_HEIGHT - 4,
  };
}
