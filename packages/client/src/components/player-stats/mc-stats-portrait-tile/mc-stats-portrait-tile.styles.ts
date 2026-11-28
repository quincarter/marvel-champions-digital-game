import { css } from "lit";
import { StatsTileStyles } from "../shared/stats-tile.styles.js";

export const McStatsPortraitTileStyles = [
  StatsTileStyles,
  css`
    :host {
      padding: 0;
      gap: 0;
      overflow: hidden;
    }
    mc-picture-tile {
      display: block;
      flex: none;
      min-height: 0;
    }
    .words {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      padding: 8px 16px 14px;
    }
    .name {
      font-size: 24px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .line {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* A picture over the words: the picture takes the tile's height less the words. */
    :host([variant="stack"]) mc-picture-tile {
      flex: 1 1 0;
      min-height: 80px;
    }
    /* The hero: a banner in the ink headline tile, the picture at the left, the caption in the caution yellow. */
    :host([variant="hero"]) {
      flex-direction: row;
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
    }
    :host([variant="hero"]) mc-picture-tile {
      flex: 0 0 38%;
    }
    :host([variant="hero"]) .words {
      flex: 1;
      justify-content: center;
      padding: 12px 16px;
    }
    :host([variant="hero"]) .name {
      font-size: 32px;
    }
    :host([variant="hero"]) .caption {
      color: var(--mc-fill-caution);
    }
    :host([variant="hero"]) .extra {
      white-space: normal;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
    }
    /* On the wide Overview the hero stands tall: the art fills the tile and the words sit over an ink shade at its foot. */
    @container (min-width: 960px) {
      :host([variant="hero"]) {
        flex-direction: column;
        min-height: 320px;
      }
      :host([variant="hero"]) mc-picture-tile {
        position: absolute;
        inset: 2px;
      }
      :host([variant="hero"]) .words {
        position: relative;
        flex: none;
        margin-top: auto;
        justify-content: flex-start;
        padding: 70px 18px 18px;
        background: linear-gradient(
          to bottom,
          transparent,
          color-mix(in srgb, var(--mc-fill-ink) 92%, transparent) 70%
        );
      }
      :host([variant="hero"]) .name {
        font-size: 40px;
      }
    }
    @container (max-width: 520px) {
      .name,
      :host([variant="hero"]) .name {
        font-size: 20px;
      }
    }
  `,
];
