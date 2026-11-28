import { css } from "lit";
import { DecksResponsiveStyles } from "../responsive.styles.js";

/**
 * Wide: the header, then three panes side by side (the list a fixed 260 to 320px, the stats rail 280 to 360px, the pool the rest).
 * Narrow: one column (640px at most, centred) with the tab rail over the pane that is showing, which fills what is left.
 * The stats pane is the ink rail in both.
 */
export const McDecksPageStyles = [
  DecksResponsiveStyles,
  css`
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: var(--mc-fill-paper);
      background-image: radial-gradient(
        circle,
        color-mix(in srgb, var(--mc-line-ink) 14%, transparent) 1px,
        transparent 1.5px
      );
      background-size: 18px 18px;
      color: var(--mc-text-ink);
    }
    .header {
      flex: none;
    }
    .panes {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: clamp(260px, 19%, 320px) minmax(260px, 1fr) clamp(280px, 22%, 360px);
      gap: 16px;
      padding: 16px 32px 32px;
    }
    .column {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
      max-width: 672px;
      margin: 0 auto;
      padding: 16px 16px 16px;
    }
    .tab-hint,
    .tabs {
      flex: none;
    }
    .tabs {
      height: 44px;
    }
    .tab-hint {
      position: relative;
      display: flex;
      justify-content: flex-end;
      min-height: 14px;
    }
    .content {
      flex: 1;
      min-height: 0;
      padding-top: 8px;
    }
    .list,
    .cards,
    .stats {
      min-height: 0;
    }
    .stats {
      padding: 16px;
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
      border: 2px solid var(--mc-line-ink);
    }
    .content[data-pane="stats"] .stats,
    .content > * {
      height: 100%;
    }
  `,
];
