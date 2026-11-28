import { css } from "lit";

export const McHeroTileStyles = css`
  :host {
    display: block;
    position: relative;
    flex: none;
    box-sizing: border-box;
    width: var(--mc-hero-tile-width, 200px);
    aspect-ratio: 5 / 7;
    max-height: 360px;
    min-height: 160px;
  }
  .press {
    appearance: none;
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    text-align: left;
    font: inherit;
    color: var(--mc-text-ink);
    background: var(--mc-fill-parchment);
    border: 0;
    border-radius: 0;
    cursor: pointer;
    box-shadow: inset 0 0 0 2px var(--mc-line-ink);
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    user-select: none;
  }
  .press[data-selected] {
    box-shadow: inset 0 0 0 4px var(--mc-line-red);
  }
  .press[data-dim] .art,
  .press[data-dim] .caption {
    opacity: 0.5;
  }
  .press:focus-visible {
    outline: 3px solid var(--mc-line-red);
    outline-offset: -6px;
  }
  .art {
    position: relative;
    display: block;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: var(--mc-fill-ink);
  }
  .pic {
    position: absolute;
    inset: 0;
  }
  .initial {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--mc-font-display);
    font-size: 64px;
    line-height: 1;
    color: var(--mc-text-paper);
    opacity: 0.18;
  }
  .tag,
  .plate,
  .stamp {
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    line-height: 1.2;
    white-space: nowrap;
  }
  .tag,
  .plate {
    position: absolute;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--mc-text-paper);
    background: var(--mc-fill-ink);
    outline: 1px solid var(--mc-line-paper);
    outline-offset: -1px;
  }
  .tag {
    top: 8px;
    right: 8px;
    max-width: calc(100% - 16px);
    padding: 3px 6px;
  }
  .plate {
    top: 6px;
    left: 6px;
    max-width: calc(100% - 12px);
    padding: 2px 5px;
    outline: 1.5px solid var(--mc-line-red);
    outline-offset: -1.5px;
  }
  /* With a tag over the corner, the plate drops under it rather than overlapping the words. */
  .tag ~ .plate {
    top: 34px;
  }
  .stamps {
    position: absolute;
    left: 6px;
    right: 6px;
    bottom: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .stamp {
    padding: 2px 5px;
    color: var(--stamp-ink, var(--mc-text-paper));
    background: var(--stamp-fill, var(--mc-fill-ink));
    box-shadow: inset 0 0 0 1px var(--mc-line-ink);
  }
  .caption {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: none;
    height: 52px;
    padding: 7px 8px 0;
    min-width: 0;
    box-sizing: border-box;
  }
  .title {
    font-weight: 800;
    font-size: 13px;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .line {
    font-size: var(--mc-small-10);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.75;
  }
  .line.caution {
    font-weight: 800;
    opacity: 1;
  }
`;
