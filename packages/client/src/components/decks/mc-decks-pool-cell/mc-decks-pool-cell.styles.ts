import { css } from "lit";
import { ThemeStyles } from "@mc/ui";

export const McDecksPoolCellStyles = [
  ThemeStyles,
  css`
    :host {
      display: block;
      width: var(--cell-width, 150px);
      color: var(--mc-text-ink);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .frame {
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100%;
      outline: 2px solid transparent;
      outline-offset: -1px;
    }
    .frame[data-held="true"] {
      outline: 3px solid var(--mc-line-red);
    }
    .art {
      position: relative;
      flex: none;
      height: var(--art-height, 210px);
      background: var(--mc-fill-parchment);
    }
    .art mc-picture-tile {
      position: absolute;
      inset: 0;
    }
    .pip {
      position: absolute;
      top: 4px;
      left: 4px;
      min-width: 22px;
      padding: 2px 5px;
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
      font-family: var(--mc-font-display);
      font-size: 14px;
      text-align: center;
    }
    .caption {
      flex: none;
      display: flex;
      flex-direction: column;
      gap: 2px;
      height: var(--caption-height, 46px);
      padding: 4px 2px 0;
      overflow: hidden;
    }
    .title {
      font-weight: 800;
      font-size: 12px;
      line-height: 1.15;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .line {
      font-weight: 700;
      font-size: var(--mc-small-9);
      letter-spacing: 0.8px;
      text-transform: uppercase;
      line-height: 1.2;
      opacity: 0.75;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .held {
      position: absolute;
      top: 4px;
      right: 4px;
      padding: 2px 6px;
      background: var(--mc-fill-red);
      color: var(--mc-text-paper);
      font-weight: 800;
      font-size: 12px;
    }
  `,
];
