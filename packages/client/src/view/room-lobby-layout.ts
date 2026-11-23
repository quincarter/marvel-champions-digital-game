/**
 * Where the lobby's panels go at each screen size (issue #880). The lobby has three panels: the people and seats, the
 * table's settings, and chat.
 *
 * - **wide** (a landscape tablet, 900 to 1199): people and seats down the left, settings above chat on the right.
 * - **float** (a desktop, 1200 and up): people and seats on the left, settings the whole right column, chat a floating
 *   panel docked at the bottom-right corner, behind a Chat pill while it is closed.
 * - **triple** (an ultrawide, 2.2:1 and 1800 wide or more): seats, settings and chat as three columns.
 * - **stack** (a portrait tablet, 700 to 899): people and seats across the top, a tab strip under them choosing
 *   Settings or Chat for the rest.
 * - **tabs** (a phone): one tab strip choosing People and seats, Settings or Chat; one panel at a time.
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";

export type LobbyPanelId = "seats" | "settings" | "chat";
export type LobbyLayoutMode = "wide" | "float" | "triple" | "stack" | "tabs";

export interface LobbyLayout {
  readonly mode: LobbyLayoutMode;
  /** The strip with the code and the Copy link button. */
  readonly header: Rect;
  /** Where the tabs are drawn, with the panels they choose between; null when every panel shows at once. */
  readonly tabs: Rect | null;
  readonly tabIds: readonly LobbyPanelId[];
  /** The Start strip across the bottom. */
  readonly footer: Rect;
  /** Each shown panel's rect; a panel the tabs have put away is absent. */
  readonly panels: Readonly<Partial<Record<LobbyPanelId, Rect>>>;
  /** The Chat pill a closed floating chat sits behind; null unless the chat floats and is closed. */
  readonly chatPill: Rect | null;
}

export const FLOAT_MIN_WIDTH = 1200;
export const TRIPLE_MIN_WIDTH = 1800;
export const TRIPLE_MIN_ASPECT = 2.2;
const FLOAT_WIDTH = 400;
const FLOAT_MAX_HEIGHT = 520;
const PILL_WIDTH = 132;

export const LOBBY_HEADER_HEIGHT = 84;
export const LOBBY_FOOTER_HEIGHT = 92;
const GAP = 12;

export function lobbyLayout(
  width: number,
  height: number,
  topBar: number,
  active: LobbyPanelId,
  gutter: number,
  headerHeight: number = LOBBY_HEADER_HEIGHT,
  footerHeight: number = LOBBY_FOOTER_HEIGHT,
  /** Whether a floating chat is open. */
  chatOpen = false,
): LobbyLayout {
  const header: Rect = { x: gutter, y: topBar + GAP, width: width - gutter * 2, height: headerHeight };
  const footer: Rect = {
    x: gutter,
    y: height - footerHeight - GAP / 2,
    width: width - gutter * 2,
    height: footerHeight,
  };
  const bodyTop = header.y + header.height + GAP;
  const bodyBottom = footer.y - GAP;
  const bodyHeight = Math.max(0, bodyBottom - bodyTop);
  const bodyWidth = width - gutter * 2;

  if (width >= TRIPLE_MIN_WIDTH && width / height >= TRIPLE_MIN_ASPECT) {
    const seatsWidth = Math.round(bodyWidth * 0.36);
    const chatWidth = Math.round(bodyWidth * 0.26);
    const settingsWidth = bodyWidth - seatsWidth - chatWidth - GAP * 2;
    const settingsX = gutter + seatsWidth + GAP;
    return {
      mode: "triple",
      header,
      tabs: null,
      tabIds: [],
      footer,
      chatPill: null,
      panels: {
        seats: { x: gutter, y: bodyTop, width: seatsWidth, height: bodyHeight },
        settings: { x: settingsX, y: bodyTop, width: settingsWidth, height: bodyHeight },
        chat: { x: settingsX + settingsWidth + GAP, y: bodyTop, width: chatWidth, height: bodyHeight },
      },
    };
  }

  if (width >= FLOAT_MIN_WIDTH) {
    const left = Math.round(bodyWidth * 0.52);
    const rightX = gutter + left + GAP;
    const rightWidth = bodyWidth - left - GAP;
    const right = rightX + rightWidth;
    const bottom = footer.y - GAP;
    const panelHeight = Math.min(FLOAT_MAX_HEIGHT, Math.round(bodyHeight * 0.8));
    return {
      mode: "float",
      header,
      tabs: null,
      tabIds: [],
      footer,
      chatPill: chatOpen
        ? null
        : { x: right - PILL_WIDTH, y: bottom - hit.target, width: PILL_WIDTH, height: hit.target },
      panels: {
        seats: { x: gutter, y: bodyTop, width: left, height: bodyHeight },
        settings: { x: rightX, y: bodyTop, width: rightWidth, height: bodyHeight },
        ...(chatOpen
          ? { chat: { x: right - FLOAT_WIDTH, y: bottom - panelHeight, width: FLOAT_WIDTH, height: panelHeight } }
          : {}),
      },
    };
  }

  if (width >= 900) {
    const left = Math.round(bodyWidth * 0.52);
    const rightX = gutter + left + GAP;
    const rightWidth = bodyWidth - left - GAP;
    const settingsHeight = Math.round((bodyHeight - GAP) * 0.5);
    return {
      mode: "wide",
      header,
      tabs: null,
      tabIds: [],
      footer,
      chatPill: null,
      panels: {
        seats: { x: gutter, y: bodyTop, width: left, height: bodyHeight },
        settings: { x: rightX, y: bodyTop, width: rightWidth, height: settingsHeight },
        chat: {
          x: rightX,
          y: bodyTop + settingsHeight + GAP,
          width: rightWidth,
          height: bodyHeight - settingsHeight - GAP,
        },
      },
    };
  }

  if (width >= 700) {
    const seatsHeight = Math.round(bodyHeight * 0.42);
    const tabs: Rect = { x: gutter, y: bodyTop + seatsHeight + GAP, width: bodyWidth, height: hit.target };
    const lower = active === "chat" ? "chat" : "settings";
    const panelTop = tabs.y + tabs.height + GAP / 2;
    return {
      mode: "stack",
      header,
      tabs,
      tabIds: ["settings", "chat"],
      footer,
      chatPill: null,
      panels: {
        seats: { x: gutter, y: bodyTop, width: bodyWidth, height: seatsHeight },
        [lower]: { x: gutter, y: panelTop, width: bodyWidth, height: Math.max(0, bodyBottom - panelTop) },
      },
    };
  }

  const tabs: Rect = { x: gutter, y: bodyTop, width: bodyWidth, height: hit.target };
  const panelTop = tabs.y + tabs.height + GAP / 2;
  return {
    mode: "tabs",
    header,
    tabs,
    tabIds: ["seats", "settings", "chat"],
    footer,
    chatPill: null,
    panels: { [active]: { x: gutter, y: panelTop, width: bodyWidth, height: Math.max(0, bodyBottom - panelTop) } },
  };
}
