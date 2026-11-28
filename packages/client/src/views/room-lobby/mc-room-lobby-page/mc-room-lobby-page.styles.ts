import { css } from "lit";
import { LobbyResponsiveStyles } from "../responsive.styles.js";

/**
 * One grid per mode. Rows and columns are the old layout's shares (seats 42% of a stacked body, 52% / 48% columns on a wide
 * screen, 36 / rest / 26 on an ultrawide); every panel scrolls inside its own frame, so a long list never grows the page.
 */
export const McRoomLobbyPageStyles = [
  LobbyResponsiveStyles,
  css`
    :host {
      position: relative;
      display: grid;
      width: 100%;
      height: calc(100% - var(--lobby-covered, 0px));
      overflow: hidden;
      background-color: var(--mc-fill-paper);
      color: var(--mc-text-ink);
      gap: 12px;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto minmax(0, 1fr) auto;
      grid-template-areas: "header" "tabs" "seats" "footer";
    }
    .header {
      grid-area: header;
    }
    .tabs {
      grid-area: tabs;
      margin: 0 16px;
    }
    .seats,
    .settings,
    .chat {
      margin: 0 16px;
    }
    .seats {
      grid-area: seats;
    }
    .settings {
      grid-area: seats;
    }
    .chat {
      grid-area: seats;
    }
    .footer {
      grid-area: footer;
    }
    .pill {
      display: none;
    }

    /* tabs: the one chosen panel fills the body (the model leaves the others out). */

    /* stack: seats across the top, the tab strip, then settings or chat. */
    :host([mode="stack"]) {
      grid-template-rows: auto minmax(0, 0.42fr) auto minmax(0, 0.58fr) auto;
      grid-template-areas: "header" "seats" "tabs" "lower" "footer";
    }
    :host([mode="stack"]) .tabs {
      margin: 0 24px;
    }
    :host([mode="stack"]) .seats,
    :host([mode="stack"]) .settings,
    :host([mode="stack"]) .chat {
      margin: 0 24px;
    }
    :host([mode="stack"]) .settings,
    :host([mode="stack"]) .chat {
      grid-area: lower;
    }

    /* wide: seats left, settings over chat right. */
    :host([mode="wide"]),
    :host([mode="float"]) {
      grid-template-columns: minmax(0, 52fr) minmax(0, 48fr);
      grid-template-rows: auto minmax(0, 1fr) minmax(0, 1fr) auto;
      grid-template-areas: "header header" "seats settings" "seats chat" "footer footer";
      column-gap: 12px;
    }
    :host([mode="wide"]) .seats,
    :host([mode="float"]) .seats {
      margin: 0 0 0 24px;
    }
    :host([mode="wide"]) .settings,
    :host([mode="wide"]) .chat,
    :host([mode="float"]) .settings {
      margin: 0 24px 0 0;
    }
    :host([mode="wide"]) .settings {
      grid-area: settings;
    }
    :host([mode="wide"]) .chat {
      grid-area: chat;
    }

    /* float: settings take the whole right column; chat floats over its bottom-right corner behind a pill. */
    :host([mode="float"]) .settings {
      grid-area: auto;
      grid-column: 2;
      grid-row: 2 / 4;
    }
    :host([mode="float"]) .chat {
      grid-area: auto;
      grid-column: 2;
      grid-row: 2 / 4;
      align-self: end;
      justify-self: end;
      width: min(400px, 100%);
      max-height: min(520px, 100%);
      margin: 0 24px 0 0;
      z-index: 3;
    }
    :host([mode="float"]) .pill {
      display: block;
      grid-column: 2;
      grid-row: 2 / 4;
      align-self: end;
      justify-self: end;
      width: 132px;
      margin: 0 24px 0 0;
      z-index: 3;
    }

    /* triple: seats, settings and chat side by side. */
    :host([mode="triple"]) {
      grid-template-columns: minmax(0, 36fr) minmax(0, 38fr) minmax(0, 26fr);
      grid-template-rows: auto minmax(0, 1fr) auto;
      grid-template-areas: "header header header" "seats settings chat" "footer footer footer";
    }
    :host([mode="triple"]) .seats {
      margin: 0 0 0 24px;
    }
    :host([mode="triple"]) .settings {
      margin: 0;
      grid-area: settings;
    }
    :host([mode="triple"]) .chat {
      margin: 0 24px 0 0;
      grid-area: chat;
    }

    /* The keyboard is up over a narrow layout's Chat tab: the tab strip and the chat take everything. */
    :host([compact]) {
      grid-template-rows: auto minmax(0, 1fr);
      grid-template-areas: "tabs" "seats";
    }
    :host([compact]) .header,
    :host([compact]) .footer {
      display: none;
    }
    :host([compact]) .chat {
      grid-area: seats;
    }
  `,
];
